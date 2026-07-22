
-- Phase 3B — Curse Breaker layered experience: additive DB support.
-- Non-negotiable: public.interpretation_category enum is UNCHANGED.
-- stronghold_categories is deprecated (not dropped).

-- 1. Additive: taxonomy_version on wisdom_turns.
-- Historical rows keep default 1. New v2 curse_breaker turns write 2.
ALTER TABLE public.wisdom_turns
  ADD COLUMN IF NOT EXISTS taxonomy_version smallint NOT NULL DEFAULT 1;

-- 2. Deprecation marker on stronghold_categories. No active writer remains.
COMMENT ON TABLE public.stronghold_categories IS
  'DEPRECATED (Phase 3B, 2026-07-22). No new writes. Kept for historical read compatibility only. Replaced by the v2 layered Curse Breaker model persisted in wisdom_turns.result + curse_breaker_interpretations.';

-- 3. New durable action table for user decisions on pastoral/biblical
-- interpretations. Stores ONLY user actions (accept / revise / reject /
-- unresolved); the interpretation content itself lives in wisdom_turns.result.
CREATE TYPE public.curse_breaker_interpretation_status AS ENUM (
  'unresolved','accepted','revised','rejected'
);

CREATE TABLE public.curse_breaker_interpretations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  wisdom_turn_id uuid NOT NULL REFERENCES public.wisdom_turns(id) ON DELETE CASCADE,
  interpretation_client_id text NOT NULL,
  status public.curse_breaker_interpretation_status NOT NULL DEFAULT 'unresolved',
  revision text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wisdom_turn_id, interpretation_client_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curse_breaker_interpretations TO authenticated;
GRANT ALL ON public.curse_breaker_interpretations TO service_role;

ALTER TABLE public.curse_breaker_interpretations ENABLE ROW LEVEL SECURITY;

CREATE POLICY cbi_owner_select ON public.curse_breaker_interpretations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY cbi_owner_insert ON public.curse_breaker_interpretations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY cbi_owner_update ON public.curse_breaker_interpretations
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY cbi_owner_delete ON public.curse_breaker_interpretations
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER cbi_updated_at BEFORE UPDATE ON public.curse_breaker_interpretations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. DNR / session_only enforcement: an interpretation action is durable
-- cross-session memory. Reject when the originating turn is non-durable,
-- when the turn is not a curse_breaker turn, or when ownership drifts.
-- Also require taxonomy_version = 2 on the source turn.
CREATE OR REPLACE FUNCTION public.curse_breaker_interpretations_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t_user uuid;
  t_session uuid;
  t_directive public.memory_directive;
  t_mode public.session_mode;
  t_tax smallint;
BEGIN
  SELECT user_id, session_id, memory_directive, mode, taxonomy_version
    INTO t_user, t_session, t_directive, t_mode, t_tax
  FROM public.wisdom_turns WHERE id = NEW.wisdom_turn_id;

  IF t_user IS NULL THEN
    RAISE EXCEPTION 'curse_breaker_interpretations: source turn % not found', NEW.wisdom_turn_id
      USING ERRCODE = '42704';
  END IF;
  IF t_user IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'curse_breaker_interpretations: owner mismatch' USING ERRCODE = '42501';
  END IF;
  IF t_session IS DISTINCT FROM NEW.session_id THEN
    RAISE EXCEPTION 'curse_breaker_interpretations: session mismatch' USING ERRCODE = '42501';
  END IF;
  IF t_mode <> 'curse_breaker' THEN
    RAISE EXCEPTION 'curse_breaker_interpretations: source turn is not a curse_breaker turn' USING ERRCODE = '42501';
  END IF;
  IF t_directive IN ('session_only','do_not_remember') THEN
    RAISE EXCEPTION 'curse_breaker_interpretations: non-durable memory directive forbids durable interpretation actions'
      USING ERRCODE = '42501';
  END IF;
  IF COALESCE(t_tax, 1) < 2 THEN
    RAISE EXCEPTION 'curse_breaker_interpretations: source turn is legacy (taxonomy_version < 2); actions require a v2 turn'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER cbi_guard_insert BEFORE INSERT ON public.curse_breaker_interpretations
  FOR EACH ROW EXECUTE FUNCTION public.curse_breaker_interpretations_guard();
CREATE TRIGGER cbi_guard_update BEFORE UPDATE ON public.curse_breaker_interpretations
  FOR EACH ROW EXECUTE FUNCTION public.curse_breaker_interpretations_guard();

-- 5. Bound the revision length at the DB layer too (defence in depth).
ALTER TABLE public.curse_breaker_interpretations
  ADD CONSTRAINT cbi_revision_bounded CHECK (revision IS NULL OR length(revision) <= 2000);

COMMENT ON TABLE public.curse_breaker_interpretations IS
  'User actions (accept / revise / reject / unresolved) on the pastoral/biblical interpretations produced by a v2 Curse Breaker turn. Content of each interpretation lives in wisdom_turns.result JSONB; this table only records the user''s decision. Rejected for session_only and do_not_remember source turns.';
