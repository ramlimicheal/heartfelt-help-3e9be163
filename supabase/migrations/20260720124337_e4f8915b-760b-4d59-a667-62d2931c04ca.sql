
-- 1) Event chain persistence for interpretations
ALTER TABLE public.interpretations
  ADD COLUMN IF NOT EXISTS event_chain jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Per-user chat rate limit table (sliding-ish 5-min window)
CREATE TABLE IF NOT EXISTS public.chat_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);
GRANT SELECT ON public.chat_rate_limits TO authenticated;
GRANT ALL ON public.chat_rate_limits TO service_role;
ALTER TABLE public.chat_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_rate_limits_self_read ON public.chat_rate_limits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS chat_rate_limits_user_window_idx
  ON public.chat_rate_limits (user_id, window_start DESC);
