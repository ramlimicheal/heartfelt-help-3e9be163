
-- Split delete vs update guard so a controlled cascade can delete signals
CREATE OR REPLACE FUNCTION public.signals_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
begin
  if coalesce(current_setting('app.allow_signal_cascade', true), '') = 'on' then
    return old;
  end if;
  raise exception 'signals rows are immutable historical evidence; append a row to signal_corrections instead'
    using errcode = '42501';
end $$;

DROP TRIGGER IF EXISTS trg_signals_no_delete ON public.signals;
CREATE TRIGGER trg_signals_no_delete
BEFORE DELETE ON public.signals
FOR EACH ROW EXECUTE FUNCTION public.signals_delete_guard();

-- Owner-scoped cascade delete for a session
CREATE OR REPLACE FUNCTION public.delete_session_cascade(p_session_id uuid, p_expected_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.sessions where id = p_session_id;
  if v_owner is null then return; end if;
  if v_owner <> p_expected_user then
    raise exception 'delete_session_cascade: owner mismatch' using errcode = '42501';
  end if;

  perform set_config('app.allow_signal_cascade', 'on', true);
  delete from public.signals where session_id = p_session_id;
  perform set_config('app.allow_signal_cascade', 'off', true);

  delete from public.wisdom_turns where session_id = p_session_id and user_id = p_expected_user;
  delete from public.messages     where session_id = p_session_id and user_id = p_expected_user;
  delete from public.sessions     where id = p_session_id and user_id = p_expected_user;
end $$;

REVOKE ALL ON FUNCTION public.delete_session_cascade(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_session_cascade(uuid, uuid) TO authenticated, service_role;
