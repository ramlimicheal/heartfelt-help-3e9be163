CREATE TABLE public.prayer_pattern_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prayer_id uuid NOT NULL REFERENCES public.prayers(id) ON DELETE CASCADE,
  pattern_id uuid NOT NULL REFERENCES public.patterns(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prayer_id, pattern_id)
);

GRANT SELECT, INSERT, DELETE ON public.prayer_pattern_links TO authenticated;
GRANT ALL ON public.prayer_pattern_links TO service_role;

ALTER TABLE public.prayer_pattern_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prayer_pattern_links_owner_read"
  ON public.prayer_pattern_links
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "prayer_pattern_links_owner_write"
  ON public.prayer_pattern_links
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prayer_pattern_links_owner_delete"
  ON public.prayer_pattern_links
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX prayer_pattern_links_prayer_idx ON public.prayer_pattern_links(prayer_id);
CREATE INDEX prayer_pattern_links_pattern_idx ON public.prayer_pattern_links(pattern_id);
CREATE INDEX prayer_pattern_links_user_idx ON public.prayer_pattern_links(user_id);