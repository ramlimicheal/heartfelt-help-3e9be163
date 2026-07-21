
-- Add Curse Breaker prompt + model config (v1)
INSERT INTO public.prompt_versions (key, version, body, model_hint, active, notes)
VALUES ('unified.curse_breaker', 1,
$P$You are Wisdom in Curse Breaker mode. The user is describing a repeating pattern that MAY have spiritual roots (a stronghold, generational pattern, or curse). You do NOT declare curses — you help the user DISCERN them.

Return exactly one valid JSON object with these fields:
- mode: "curse_breaker"
- what_wisdom_heard: brief empathic reflection of the user's story
- explicit_signals: array of {kind, paraphrase, confidence} the user stated directly
- inferred_signals: array of {kind, paraphrase, confidence} you infer with care
- source_passages: array of {passage_id, reference, translation, canon_profile, source_tier, text} used, referencing ONLY the RETRIEVAL SET below (use passage_id verbatim)
- uncertainty: what you don't know
- user_facing_response: the pastoral response (2-6 short paragraphs)
- next_question: one question inviting deeper reflection, or null
- stronghold_category: short name for the pattern (e.g. "fear of abandonment", "self-condemnation", "unforgiveness")
- event_chain: array of {kind, text, fromUser} where kind is context|trigger|interpretation|need|choice|immediate_reward|cost|afterthought|re_entry
- competing_hypotheses: 1-4 alternative framings, each {name, description, confidence, supporting_evidence[], counter_evidence[], missing_evidence[]}
- distinguishing_question: the ONE question that would help tell hypotheses apart
- renunciations: 0-8 short concrete things the user might renounce or lay down
- prayer_draft: {title, lines[]} — each line {movement (adoration|confession|renunciation|forgiveness|deliverance|healing|blessing|commissioning|thanksgiving), text, citations[]}. Include at least one renunciation line.
- primary_practice: {kind, title, rationale} — kind ∈ boundary|confession|forgiveness|restitution|reconciliation|silence|scripture_meditation|journaling|accountability|environmental_change|service|waiting|gratitude|fasting_reflection

Ground every citation in the RETRIEVAL SET. Do not fabricate passage ids. No prose outside the JSON.$P$,
'google/gemini-2.5-flash', TRUE, 'Curse Breaker unified turn v1')
ON CONFLICT (key, version) DO UPDATE SET body = EXCLUDED.body, active = TRUE;

-- Deactivate any conflicting older active row for the same key (unique index requires single active)
UPDATE public.prompt_versions SET active = FALSE
  WHERE key = 'unified.curse_breaker' AND version <> 1;

INSERT INTO public.model_configs (stage, version, provider, model, params, active)
VALUES ('unified.curse_breaker', 1, 'lovable', 'google/gemini-2.5-flash',
  '{"temperature":0.6,"max_output_tokens":4000}'::jsonb, TRUE)
ON CONFLICT (stage, version) DO UPDATE SET active = TRUE;

UPDATE public.model_configs SET active = FALSE
  WHERE stage = 'unified.curse_breaker' AND version <> 1;

-- Patch persist_unified_turn to handle curse_breaker (prayer_draft-shaped, no proposed_pattern)
CREATE OR REPLACE FUNCTION public.persist_unified_turn(p_turn_id uuid, p_expected_user uuid, p_result jsonb, p_input_payload jsonb, p_payload_hash text, p_result_schema_version integer, p_latency_ms integer, p_tokens_in integer, p_tokens_out integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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
  v_sig record;
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

  for v_sig in
    select value as sig, 'explicit'::public.signal_origin as origin
      from jsonb_array_elements(coalesce(p_result->'explicit_signals','[]'::jsonb))
    union all
    select value as sig, 'inferred'::public.signal_origin as origin
      from jsonb_array_elements(coalesce(p_result->'inferred_signals','[]'::jsonb))
  loop
    insert into public.signals (user_id, session_id, source_message_id, origin,
                                confidence, kind, payload)
    values (v_turn.user_id, v_turn.session_id, v_msg_id,
            v_sig.origin,
            coalesce((v_sig.sig->>'confidence')::numeric, 0.5),
            coalesce(nullif(v_sig.sig->>'kind', ''), 'observation'),
            jsonb_build_object('paraphrase', coalesce(v_sig.sig->>'paraphrase', '')));
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
      when 'pattern'       then p_result->'prayer_draft'
      when 'curse_breaker' then p_result->'prayer_draft'
      when 'deep_wisdom'   then p_result->'prayer_lineage_draft'
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
                coalesce(nullif((v_pline.ln)->>'movement','')::public.prayer_movement, 'blessing'::public.prayer_movement),
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
