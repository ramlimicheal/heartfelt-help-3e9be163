-- Signals is a durable per-user table written by authenticated users through
-- server functions running under their bearer token. RLS policies already
-- restrict rows to auth.uid() = user_id, but the table was missing the
-- PostgREST-level GRANT for INSERT/UPDATE/DELETE, so authed inserts failed
-- with "permission denied for table signals". Restore the standard user-data
-- grant block.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;