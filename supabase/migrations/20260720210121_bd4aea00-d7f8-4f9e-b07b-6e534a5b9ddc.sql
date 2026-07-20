-- ============================================================================
-- Checkpoint 2.1: signals & pattern_evidence become server-write-only,
-- immutable historical evidence. User corrections flow through an
-- append-only signal_corrections table.
-- ============================================================================

-- 1. Revoke direct write privileges from authenticated on signals.
REVOKE INSERT, UPDATE, DELETE ON public.signals FROM authenticated;
DROP POLICY IF EXISTS signals_owner_insert ON public.signals;
DROP POLICY IF EXISTS signals_owner_update ON public.signals;
DROP POLICY IF EXISTS signals_owner_delete ON public.signals;
-- Keep signals_owner_select (owners read their own history).

-- 2. Same contract for pattern_evidence.
REVOKE INSERT, UPDATE, DELETE ON public.pattern_evidence FROM authenticated;
DROP POLICY IF EXISTS pattern_evidence_owner_insert ON public.pattern_evidence;
DROP POLICY IF EXISTS pattern_evidence_owner_update ON public.pattern_evidence;
DROP POLICY IF EXISTS pattern_evidence_owner_delete ON public.pattern_evidence;
-- Keep pattern_evidence_owner_select.

-- 3. Belt & braces: even service_role writes are constrained to be immutable.
--    Signals never change after insert; corrections go into signal_corrections.
CREATE OR REPLACE FUNCTION public.signals_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  raise exception 'signals rows are immutable historical evidence; append a row to signal_corrections instead'
    using errcode = '42501';
end;
$$;

DROP TRIGGER IF EXISTS trg_signals_no_update ON public.signals;
DROP TRIGGER IF EXISTS trg_signals_no_delete ON public.signals;
CREATE TRIGGER trg_signals_no_update BEFORE UPDATE ON public.signals
  FOR EACH ROW EXECUTE FUNCTION public.signals_immutable_guard();
CREATE TRIGGER trg_signals_no_delete BEFORE DELETE ON public.signals
  FOR EACH ROW EXECUTE FUNCTION public.signals_immutable_guard();

-- 4. Append-only user correction ledger.
CREATE TABLE IF NOT EXISTS public.signal_corrections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id uuid NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  correction_kind text NOT NULL
    CHECK (correction_kind IN ('disagree','refine','withdraw_consent','context_missing')),
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_signal_corrections_signal ON public.signal_corrections(signal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_corrections_user ON public.signal_corrections(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.signal_corrections TO authenticated;
GRANT ALL ON public.signal_corrections TO service_role;

ALTER TABLE public.signal_corrections ENABLE ROW LEVEL SECURITY;

-- Owner may read and append; the pair of signal ownership + auth.uid() is enforced.
CREATE POLICY signal_corrections_owner_select ON public.signal_corrections
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY signal_corrections_owner_insert ON public.signal_corrections
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.signals s
       WHERE s.id = signal_id
         AND s.user_id = auth.uid()
    )
  );

-- Append-only: no update, no delete for anyone (mirrors admin_audit pattern).
CREATE OR REPLACE FUNCTION public.signal_corrections_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  raise exception 'signal_corrections is append-only' using errcode = '42501';
end;
$$;
DROP TRIGGER IF EXISTS trg_signal_corrections_no_update ON public.signal_corrections;
DROP TRIGGER IF EXISTS trg_signal_corrections_no_delete ON public.signal_corrections;
CREATE TRIGGER trg_signal_corrections_no_update BEFORE UPDATE ON public.signal_corrections
  FOR EACH ROW EXECUTE FUNCTION public.signal_corrections_append_only();
CREATE TRIGGER trg_signal_corrections_no_delete BEFORE DELETE ON public.signal_corrections
  FOR EACH ROW EXECUTE FUNCTION public.signal_corrections_append_only();