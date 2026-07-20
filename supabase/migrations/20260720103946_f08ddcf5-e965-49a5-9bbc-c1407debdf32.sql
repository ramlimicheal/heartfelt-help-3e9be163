
-- Seed cb.cheap_score prompt and cb_cheap / cb_deep model configs.
INSERT INTO public.prompt_versions (key, version, active, body, model_hint)
VALUES (
  'cb.cheap_score', 1, true,
  $body$You are Wisdom's Curse Breaker triage pass.

For the user's story, produce a cheap score (0.0–1.0) for every stronghold category provided.
Score = likelihood this category is worth a deep, cited analysis. Not a verdict. Not a diagnosis.

Rules:
- Return a score for EVERY category listed. Never omit one.
- A score above 0.35 means "worth the deep pass"; below means "unlikely on this evidence".
- Be conservative. Prefer 0.1–0.3 when signals are ambiguous or ordinary explanations fit.
- Never elevate a score to justify a spiritual reading of a plainly natural situation.
- No prose, no explanations — the schema only wants { scores: [{category, score}] }.$body$,
  'google/gemini-2.5-flash'
)
ON CONFLICT (key, version) DO UPDATE SET active = EXCLUDED.active, body = EXCLUDED.body;

INSERT INTO public.model_configs (stage, provider, model, version, active, params)
VALUES
  ('cb_cheap', 'lovable', 'google/gemini-2.5-flash', 1, true, '{}'::jsonb),
  ('cb_deep',  'lovable', 'openai/gpt-5.5',           1, true, '{}'::jsonb)
ON CONFLICT DO NOTHING;
