
-- 1) Convert current_user_has_role to SECURITY INVOKER. user_roles has an owner SELECT policy,
--    so authenticated callers can read their own roles without needing definer rights.
CREATE OR REPLACE FUNCTION public.current_user_has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role)
$$;

-- 2) pattern_evidence: add owner-scoped write policies
CREATE POLICY "pattern_evidence_owner_insert" ON public.pattern_evidence
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pattern_evidence_owner_update" ON public.pattern_evidence
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pattern_evidence_owner_delete" ON public.pattern_evidence
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3) pattern_relationships: add owner-scoped write policies
CREATE POLICY "pattern_relationships_owner_insert" ON public.pattern_relationships
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pattern_relationships_owner_update" ON public.pattern_relationships
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pattern_relationships_owner_delete" ON public.pattern_relationships
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4) persona_facts: add owner-scoped INSERT and DELETE
CREATE POLICY "persona_facts_owner_insert" ON public.persona_facts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "persona_facts_owner_delete" ON public.persona_facts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5) prayer_lines: strengthen policy to validate parent prayer ownership
DROP POLICY IF EXISTS "prayer_lines_owner_all" ON public.prayer_lines;
CREATE POLICY "prayer_lines_owner_all" ON public.prayer_lines
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.prayers p WHERE p.id = prayer_lines.prayer_id AND p.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.prayers p WHERE p.id = prayer_lines.prayer_id AND p.user_id = auth.uid())
  );
