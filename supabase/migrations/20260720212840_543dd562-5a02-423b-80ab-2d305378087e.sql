-- ==========================================================================
-- Checkpoint 3B — atomic persistence, canonical turn state, prayer drafts,
-- rate limiting, payload-drift protection.
-- ==========================================================================

-- 1. Extend wisdom_turn_status with the canonical values requested by 3B.
--    Keep the older 3A values (pending/ok/validation_error/model_error) as
--    read-only history; new inserts and updates use processing/completed/failed.
alter type public.wisdom_turn_status add value if not exists 'processing';
alter type public.wisdom_turn_status add value if not exists 'completed';
alter type public.wisdom_turn_status add value if not exists 'failed';

-- 2. Extend practice_assignments status with the 'proposed' state so a
--    Wisdom turn can register a candidate practice without auto-committing it.
alter type public.practice_assignment_status add value if not exists 'proposed';


-- 3. Canonical turn-result columns for replay + drift protection.
alter table public.wisdom_turns
  add column if not exists result_schema_version integer not null default 1,
  add column if not exists payload_hash text,
  add column if not exists user_text_hash text,
  add column if not exists artifact_ids jsonb not null default '{}'::jsonb,
  add column if not exists input_payload jsonb;

-- Payload identity must be unique per triggering message (drift = 409).
create unique index if not exists wisdom_turns_msg_payload_uidx
  on public.wisdom_turns (triggering_user_message_id, payload_hash)
  where payload_hash is not null;


-- 4. Prayer draft lifecycle: exactly one draft per session.
create unique index if not exists prayers_one_draft_per_session
  on public.prayers (session_id) where finalized_at is null;


-- 5. Rate limit table — atomic per-user per-minute counter.
create table if not exists public.wisdom_turn_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, window_start)
);
grant select on public.wisdom_turn_rate_limits to authenticated;
grant all on public.wisdom_turn_rate_limits to service_role;
alter table public.wisdom_turn_rate_limits enable row level security;
create policy "wtrl_owner_read" on public.wisdom_turn_rate_limits
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.wisdom_turn_rate_limit_check(
  p_user uuid,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket timestamptz := date_trunc('minute', now());
  new_count integer;
begin
  insert into public.wisdom_turn_rate_limits (user_id, window_start, count)
    values (p_user, bucket, 1)
    on conflict (user_id, window_start)
    do update set count = public.wisdom_turn_rate_limits.count + 1
    returning count into new_count;
  -- opportunistic housekeeping (cheap best-effort — no lock held)
  delete from public.wisdom_turn_rate_limits
    where user_id = p_user and window_start < now() - make_interval(secs => greatest(p_window_seconds * 4, 60));
  return new_count <= p_limit;
end;
$$;
revoke all on function public.wisdom_turn_rate_limit_check(uuid, integer, integer) from public;
grant execute on function public.wisdom_turn_rate_limit_check(uuid, integer, integer) to service_role;


-- 6. Atomic persistence RPC.
--    Reads the wisdom_turn row, validates ownership + status, then writes the
--    full artifact family in one transaction. Any raise rolls back everything.
--    The route calls this via the service-role client AFTER verifying the
--    bearer-token owner matches p_expected_user.
create or replace function public.persist_unified_turn(
  p_turn_id uuid,
  p_expected_user uuid,
  p_result jsonb,
  p_input_payload jsonb,
  p_payload_hash text,
  p_result_schema_version integer,
  p_latency_ms integer,
  p_tokens_in integer,
  p_tokens_out integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    -- Idempotent replay: return the already-persisted identity.
    return jsonb_build_object(
      'replayed', true,
      'artifact_ids', v_turn.artifact_ids,
      'result', v_turn.result
    );
  end if;
  if v_turn.status = 'failed' then
    raise exception 'persist_unified_turn: turn % already failed', p_turn_id using errcode = '42501';
  end if;

  v_mode := v_turn.mode;
  v_dnr  := (v_turn.memory_directive = 'do_not_remember');
  v_msg_id := v_turn.triggering_user_message_id;

  -- Companion + DNR: no durable inference writes. Companion stores result
  -- for connection-drop replay; DNR stores no result payload.
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
          updated_at = now()
      where id = p_turn_id;
    return jsonb_build_object('replayed', false, 'artifact_ids', '{}'::jsonb);
  end if;

  -- ── Signals (both explicit + inferred) ──────────────────────────────
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

  -- ── Interpretation ─────────────────────────────────────────────────
  insert into public.interpretations (user_id, session_id, headline, body,
                                      confidence, wisdom_turn_id)
  values (v_turn.user_id, v_turn.session_id,
          left(coalesce(p_result->>'what_wisdom_heard',''), 240),
          coalesce(p_result->>'user_facing_response',''),
          0.7, p_turn_id)
  returning id into v_interp_id;

  -- Discernment (context note)
  insert into public.discernments (user_id, session_id, kind, text, wisdom_turn_id)
  values (v_turn.user_id, v_turn.session_id, 'context'::public.discernment_kind,
          coalesce(p_result->>'uncertainty',''), p_turn_id);

  -- ── Pattern candidate (pattern mode only) ──────────────────────────
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

  -- ── Prayer draft (upsert per session while unfinalized) ────────────
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

  -- ── Primary practice (proposed only — NO assignment). ─────────────
  if (p_result->'primary_practice') is not null then
    -- Only one primary practice per session at a time.
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
    -- deliberately NO row in practice_assignments — only the user can commit.
  end if;

  -- ── Formation event (system observation) ───────────────────────────
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
        updated_at = now()
    where id = p_turn_id;

  return jsonb_build_object('replayed', false, 'artifact_ids', v_artifacts);
end;
$$;
revoke all on function public.persist_unified_turn(uuid, uuid, jsonb, jsonb, text, integer, integer, integer, integer) from public;
grant execute on function public.persist_unified_turn(uuid, uuid, jsonb, jsonb, text, integer, integer, integer, integer) to service_role;


-- 7. Failure recorder — atomic finalize on route/orchestrator error.
create or replace function public.fail_unified_turn(
  p_turn_id uuid,
  p_expected_user uuid,
  p_error text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.wisdom_turns where id = p_turn_id for update;
  if v_owner is null then return; end if;
  if v_owner <> p_expected_user then
    raise exception 'fail_unified_turn: owner mismatch' using errcode = '42501';
  end if;
  update public.wisdom_turns
    set status = 'failed',
        error = left(coalesce(p_error, 'unknown'), 800),
        updated_at = now()
    where id = p_turn_id and status <> 'completed';
end;
$$;
revoke all on function public.fail_unified_turn(uuid, uuid, text) from public;
grant execute on function public.fail_unified_turn(uuid, uuid, text) to service_role;