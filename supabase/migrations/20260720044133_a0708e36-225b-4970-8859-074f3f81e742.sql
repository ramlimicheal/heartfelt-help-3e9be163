-- Allow historical citations on superseded/retired sources to remain resolvable.
DROP POLICY IF EXISTS "source_passages_approved_read" ON public.source_passages;
CREATE POLICY "source_passages_historical_read" ON public.source_passages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.source_documents s
    WHERE s.id = source_passages.source_id
      AND s.status IN ('approved','superseded','retired')
  ));

-- Same for the parent document read: historical documents must be resolvable by id
-- (list/retrieval code filters to 'approved' explicitly).
DROP POLICY IF EXISTS "source_documents_approved_read" ON public.source_documents;
CREATE POLICY "source_documents_public_read" ON public.source_documents
  FOR SELECT TO authenticated
  USING (status IN ('approved','superseded','retired'));