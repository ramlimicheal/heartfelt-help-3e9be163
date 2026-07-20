INSERT INTO public.prompt_versions (key, version, active, body, model_hint)
VALUES (
  'wisdom.persona_extraction', 1, true,
  E'You extract durable persona facts from a user''s Wisdom session — things worth remembering across sessions to serve them better.\n\nEXTRACT ONLY facts that are:\n1. STABLE — traits, relationships, roles, commitments, values, recurring struggles. NOT one-off feelings.\n2. USEFUL — would meaningfully change how Wisdom responds in future sessions.\n3. GROUNDED — clearly stated or strongly implied by the user''s own words.\n\nDO NOT extract:\n- Transient emotions ("I feel sad today")\n- One-time events unless they reveal a pattern\n- Anything the user asked not to remember\n- Guessed demographics never mentioned\n\nSENSITIVITY:\n- "sensitive": mental health, trauma, faith crises, family estrangement, sexuality, addiction, abuse, marital struggles.\n- "normal": name, role, life circumstances, stated values, hobbies.\n\nFor each fact:\n- key: snake_case (e.g. "role", "spouse_name", "recurring_struggle", "core_value")\n- value: object with a "value" string field\n- confidence: 0.4–0.9 (0.6 for reasonable inference, 0.85+ only for explicit statements)\n- sensitivity: "normal" or "sensitive"\n- rationale: one sentence — the line/context that grounds it\n\nReturn AT MOST 6 facts. Quality over quantity. Prefer 0 to speculation.',
  'google/gemini-2.5-flash'
);

INSERT INTO public.model_configs (stage, provider, model, version, params, active)
VALUES (
  'persona_extraction', 'lovable-ai-gateway', 'google/gemini-2.5-flash', 1,
  '{"temperature": 0.2}'::jsonb, true
);