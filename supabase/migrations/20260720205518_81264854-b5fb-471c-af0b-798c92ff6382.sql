-- signals had only a SELECT policy, so authenticated INSERTs were rejected
-- by RLS. Add owner-scoped write policies matching the read policy.
CREATE POLICY signals_owner_insert ON public.signals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY signals_owner_update ON public.signals
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY signals_owner_delete ON public.signals
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);