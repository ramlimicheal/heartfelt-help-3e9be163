
-- 1. wisdom_turns: attempt tracking + processing lease + structured last_error
ALTER TABLE public.wisdom_turns
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error jsonb,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_expires_at timestamptz;

-- Drop redundant partial index (covered by unique(triggering_user_message_id))
DROP INDEX IF EXISTS public.wisdom_turns_msg_payload_uidx;

-- 2. wisdom_turn_attempts — rate-limit ledger (metadata only, no content)
CREATE TABLE IF NOT EXISTS public.wisdom_turn_attempts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wisdom_turn_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.wisdom_turn_attempts_id_seq TO service_role;
ALTER TABLE public.wisdom_turn_attempts ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated: ledger is service-role only.
CREATE INDEX IF NOT EXISTS wisdom_turn_attempts_user_time_idx
  ON public.wisdom_turn_attempts (user_id, created_at DESC);

-- 3. Sliding-window rate limiter — atomic, per-user advisory lock
CREATE OR REPLACE FUNCTION public.wisdom_turn_rate_limit_v2(
  p_user uuid,
  p_limit integer DEFAULT 20,
  p_window_seconds integer DEFAULT 300
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_oldest timestamptz;
  v_retry_after integer;
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'wisdom_turn_rate_limit_v2: user required' USING ERRCODE = '22023';
  END IF;
  -- Per-user transaction advisory lock (serialize concurrent checks for this user)
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 42));

  SELECT count(*), min(created_at)
    INTO v_count, v_oldest
  FROM public.wisdom_turn_attempts
  WHERE user_id = p_user
    AND created_at > now() - make_interval(secs => p_window_seconds);

  IF v_count >= p_limit THEN
    v_retry_after := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (v_oldest + make_interval(secs => p_window_seconds) - now())))::int
    );
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after', v_retry_after,
      'count', v_count,
      'limit', p_limit
    );
  END IF;

  INSERT INTO public.wisdom_turn_attempts (user_id) VALUES (p_user);

  -- Opportunistic cleanup (bounded by simple age)
  DELETE FROM public.wisdom_turn_attempts
    WHERE user_id = p_user
      AND created_at < now() - make_interval(secs => GREATEST(p_window_seconds * 4, 3600));

  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1, 'limit', p_limit);
END;
$$;
REVOKE ALL ON FUNCTION public.wisdom_turn_rate_limit_v2(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wisdom_turn_rate_limit_v2(uuid, integer, integer) TO service_role;

-- Bulk cleanup helper (callable from cron / edge maintenance)
CREATE OR REPLACE FUNCTION public.wisdom_turn_attempts_cleanup(p_older_than_seconds integer DEFAULT 3600)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.wisdom_turn_attempts
    WHERE created_at < now() - make_interval(secs => p_older_than_seconds);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.wisdom_turn_attempts_cleanup(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wisdom_turn_attempts_cleanup(integer) TO service_role;

-- 4. claim_turn_retry — atomic reclaim of failed / stale-processing turns
CREATE OR REPLACE FUNCTION public.claim_turn_retry(
  p_turn_id uuid,
  p_expected_user uuid,
  p_payload_hash text,
  p_max_attempts integer DEFAULT 3,
  p_lease_seconds integer DEFAULT 120
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.wisdom_turns%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_row FROM public.wisdom_turns WHERE id = p_turn_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_row.user_id <> p_expected_user THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'owner_mismatch');
  END IF;

  IF v_row.payload_hash IS DISTINCT FROM p_payload_hash THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'payload_drift');
  END IF;

  IF v_row.status = 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_completed');
  END IF;

  -- Reclaim only failed OR processing-with-expired-lease
  IF v_row.status = 'processing' THEN
    IF v_row.processing_expires_at IS NULL OR v_row.processing_expires_at > v_now THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'processing_active');
    END IF;
  ELSIF v_row.status <> 'failed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_retryable', 'status', v_row.status);
  END IF;

  IF v_row.attempt_count >= p_max_attempts THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'retry_exhausted', 'attempt', v_row.attempt_count);
  END IF;

  UPDATE public.wisdom_turns
    SET status = 'processing',
        attempt_count = attempt_count + 1,
        processing_started_at = v_now,
        processing_expires_at = v_now + make_interval(secs => p_lease_seconds),
        updated_at = v_now
    WHERE id = p_turn_id;

  RETURN jsonb_build_object('ok', true, 'attempt', v_row.attempt_count + 1);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_turn_retry(uuid, uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_turn_retry(uuid, uuid, text, integer, integer) TO service_role;

-- 5. Update persist_unified_turn to clear the processing lease
CREATE OR REPLACE FUNCTION public.persist_unified_turn(p_turn_id uuid, p_expected_user uuid, p_result jsonb, p_input_payload jsonb, p_payload_hash text, p_result_schema_version integer, p_latency_ms integer, p_tokens_in integer, p_tokens_out integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_turn public.wisdom_turns%rowtype;
  v_mode public.session_mode;
  v_dnr boolean;
  v_msg_id uuid;
  v_interp_id uuid;
  v_pattern_id uuid;
  v_prayer_id uuid;
  v_practice_id uuid;
  v_line_ids uuid[] := '{}';
  v_pline record;
  v_pline_id uuid;
  v_cite jsonb;
  v_sig jsonb;
  v_ord integer;
  v_artifacts jsonb;
begin
  select * into v_turn from public.wisdom_turns where id = p_turn_id for update;
  if not found then
    raise exception 'persist_unified_turn: turn % not found', p_turn_id using errcode = '42704';
  end if;
  if v_turn.user_id <> p_expected_user then
    raise exception 'persist_unified_turn: turn owner mismatch' using errcode = '42501';
  end if;
  if v_turn.status = 'completed' then
    return jsonb_build_object('replayed', true, 'artifact_ids', v_turn.artifact_ids, 'result', v_turn.result);
  end if;
  if v_turn.status = 'failed' then
    raise exception 'persist_unified_turn: turn % already failed', p_turn_id using errcode = '42501';
  end if;

  v_mode := v_turn.mode;
  v_dnr  := (v_turn.memory_directive = 'do_not_remember');
  v_msg_id := v_turn.triggering_user_message_id;

  if v_mode = 'companion' or v_dnr then
    update public.wisdom_turns
      set status = 'completed',
          result = case when v_dnr then null else p_result end,
          input_payload = p_input_payload,
          payload_hash = p_payload_hash,
          user_text_hash = coalesce(v_turn.user_text_hash, ''),
          result_schema_version = p_result_schema_version,
          latency_ms = p_latency_ms,
          tokens_in = p_tokens_in,
          tokens_out = p_tokens_out,
          artifact_ids = '{}'::jsonb,
          processing_started_at = null,
          processing_expires_at = null,
          last_error = null,
          updated_at = now()
      where id = p_turn_id;
    return jsonb_build_object('replayed', false, 'artifact_ids', '{}'::jsonb);
  end if;

  v_ord := 0;
  for v_sig in
    select value as sig, 'explicit'::public.signal_origin as origin
      from jsonb_array_elements(coalesce(p_result->'explicit_signals','[]'::jsonb))
    union all
    select value, 'inferred'::public.signal_origin
      from jsonb_array_elements(coalesce(p_result->'inferred_signals','[]'::jsonb))
  loop
    insert into public.signals (user_id, session_id, source_message_id, origin,
                                confidence, kind, payload)
    values (v_turn.user_id, v_turn.session_id, v_msg_id,
            (v_sig->>'origin')::public.signal_origin,
            coalesce(((v_sig->'sig')->>'confidence')::numeric, 0.5),
            (v_sig->'sig')->>'kind',
            jsonb_build_object('paraphrase', (v_sig->'sig')->>'paraphrase'));
  end loop;

  insert into public.interpretations (user_id, session_id, headline, body,
                                      confidence, wisdom_turn_id)
  values (v_turn.user_id, v_turn.session_id,
          left(coalesce(p_result->>'what_wisdom_heard',''), 240),
          coalesce(p_result->>'user_facing_response',''),
          0.7, p_turn_id)
  returning id into v_interp_id;

  insert into public.discernments (user_id, session_id, kind, text, wisdom_turn_id)
  values (v_turn.user_id, v_turn.session_id, 'context'::public.discernment_kind,
          coalesce(p_result->>'uncertainty',''), p_turn_id);

  if v_mode = 'pattern' and (p_result->'proposed_pattern') is not null then
    insert into public.patterns (user_id, idempotency_key, title, description, lifecycle)
    values (v_turn.user_id, 'turn:' || p_turn_id::text,
            left(coalesce(p_result->'proposed_pattern'->>'title','Emerging pattern'), 140),
            coalesce(p_result->'proposed_pattern'->>'description',''),
            'proposed')
    on conflict (user_id, idempotency_key) do update set title = excluded.title
    returning id into v_pattern_id;

    insert into public.pattern_evidence (pattern_id, user_id, kind,
                                         source_message_id, excerpt, confidence)
    values (v_pattern_id, v_turn.user_id, 'utterance'::public.pattern_evidence_kind,
            v_msg_id, left(coalesce(p_result->>'user_facing_response',''), 400),
            coalesce((p_result->'proposed_pattern'->>'confidence')::numeric, 0.5));
  end if;

  declare
    v_draft jsonb := case v_mode
      when 'pattern'     then p_result->'prayer_draft'
      when 'deep_wisdom' then p_result->'prayer_lineage_draft'
      else null end;
  begin
    if v_draft is not null then
      select id into v_prayer_id
        from public.prayers
        where session_id = v_turn.session_id and finalized_at is null
        for update;
      if v_prayer_id is null then
        insert into public.prayers (user_id, session_id, title, wisdom_turn_id)
        values (v_turn.user_id, v_turn.session_id,
                left(coalesce(v_draft->>'title','Draft prayer'), 120),
                p_turn_id)
        returning id into v_prayer_id;
      else
        update public.prayers
          set title = left(coalesce(v_draft->>'title','Draft prayer'), 120),
              wisdom_turn_id = p_turn_id,
              updated_at = now()
          where id = v_prayer_id;
        delete from public.prayer_lines where prayer_id = v_prayer_id;
      end if;

      v_ord := 0;
      for v_pline in
        select value as ln, ordinality
          from jsonb_array_elements(coalesce(v_draft->'lines','[]'::jsonb)) with ordinality
      loop
        v_ord := v_ord + 1;
        insert into public.prayer_lines (prayer_id, user_id, ordering, movement, text)
        values (v_prayer_id, v_turn.user_id, v_ord,
                ((v_pline.ln)->>'movement')::public.prayer_movement,
                coalesce((v_pline.ln)->>'text',''))
        returning id into v_pline_id;
        v_line_ids := v_line_ids || v_pline_id;

        for v_cite in
          select value from jsonb_array_elements(coalesce((v_pline.ln)->'citations','[]'::jsonb))
        loop
          insert into public.prayer_line_sources (prayer_line_id, user_id, passage_id,
                                                  derivation, explanation, tier)
          values (v_pline_id, v_turn.user_id, (v_cite->>'passage_id')::uuid,
                  (v_cite->>'derivation')::public.derivation_type,
                  coalesce(v_cite->>'explanation',''),
                  coalesce((
                    select tier from public.source_passages sp
                    join public.source_documents sd on sd.id = sp.source_id
                    where sp.id = (v_cite->>'passage_id')::uuid
                  ), 'S1'::public.source_tier));
        end loop;
      end loop;
    end if;
  end;

  if (p_result->'primary_practice') is not null then
    update public.practices set is_primary = false
      where session_id = v_turn.session_id and is_primary;
    insert into public.practices (user_id, session_id, pattern_id, kind, title,
                                  rationale, is_primary, wisdom_turn_id)
    values (v_turn.user_id, v_turn.session_id, v_pattern_id,
            (p_result->'primary_practice'->>'kind')::public.practice_kind,
            left(coalesce(p_result->'primary_practice'->>'title','Practice'), 140),
            coalesce(p_result->'primary_practice'->>'rationale',''),
            true, p_turn_id)
    returning id into v_practice_id;
  end if;

  insert into public.formation_events (user_id, event_type, pattern_id, prayer_id,
                                       practice_id, note)
  values (v_turn.user_id, 'prayer_composed'::public.formation_event_type,
          v_pattern_id, v_prayer_id, v_practice_id,
          left(coalesce(p_result->>'what_wisdom_heard',''), 400));

  v_artifacts := jsonb_build_object(
    'interpretation_id', v_interp_id,
    'pattern_id',        v_pattern_id,
    'prayer_id',         v_prayer_id,
    'prayer_line_ids',   to_jsonb(v_line_ids),
    'practice_id',       v_practice_id
  );

  update public.wisdom_turns
    set status = 'completed',
        result = p_result,
        input_payload = p_input_payload,
        payload_hash = p_payload_hash,
        user_text_hash = coalesce(v_turn.user_text_hash, ''),
        result_schema_version = p_result_schema_version,
        latency_ms = p_latency_ms,
        tokens_in = p_tokens_in,
        tokens_out = p_tokens_out,
        artifact_ids = v_artifacts,
        processing_started_at = null,
        processing_expires_at = null,
        last_error = null,
        updated_at = now()
    where id = p_turn_id;

  return jsonb_build_object('replayed', false, 'artifact_ids', v_artifacts);
end;
$function$;

-- 6. Update fail_unified_turn to accept sanitized structured metadata + clear lease
DROP FUNCTION IF EXISTS public.fail_unified_turn(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.fail_unified_turn(
  p_turn_id uuid,
  p_expected_user uuid,
  p_error_code text,
  p_stage text DEFAULT NULL,
  p_retryable boolean DEFAULT true
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.wisdom_turns WHERE id = p_turn_id FOR UPDATE;
  IF v_owner IS NULL THEN RETURN; END IF;
  IF v_owner <> p_expected_user THEN
    RAISE EXCEPTION 'fail_unified_turn: owner mismatch' USING ERRCODE = '42501';
  END IF;
  UPDATE public.wisdom_turns
     SET status = 'failed',
         last_error = jsonb_build_object(
           'code', left(coalesce(p_error_code, 'unknown'), 80),
           'stage', left(coalesce(p_stage, 'unknown'), 40),
           'retryable', coalesce(p_retryable, true),
           'at', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')
         ),
         error = left(coalesce(p_error_code, 'unknown'), 80),
         processing_started_at = NULL,
         processing_expires_at = NULL,
         updated_at = now()
   WHERE id = p_turn_id AND status <> 'completed';
END;
$$;
REVOKE ALL ON FUNCTION public.fail_unified_turn(uuid, uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_unified_turn(uuid, uuid, text, text, boolean) TO service_role;
