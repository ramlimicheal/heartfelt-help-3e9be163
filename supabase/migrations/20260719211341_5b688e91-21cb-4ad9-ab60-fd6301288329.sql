
-- 1) Pin search_path on the append-only trigger fn
create or replace function public.admin_audit_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'admin_audit is append-only'
    using errcode = '42501';
end;
$$;

-- 2) Lock down the self-assignment trigger fn — only the trigger itself needs it
revoke all on function public.prevent_role_self_assignment() from public;
revoke all on function public.prevent_role_self_assignment() from authenticated;
revoke all on function public.prevent_role_self_assignment() from anon;

-- Also lock the append-only trigger fn from being invoked directly
revoke all on function public.admin_audit_append_only() from public;
revoke all on function public.admin_audit_append_only() from authenticated;
revoke all on function public.admin_audit_append_only() from anon;

-- update_updated_at_column is SECURITY INVOKER; revoke from public for tidiness
revoke all on function public.update_updated_at_column() from public;

-- 3) Move extensions out of public schema
create schema if not exists extensions;
grant usage on schema extensions to authenticated, service_role, anon;

alter extension pgcrypto set schema extensions;
alter extension pg_trgm set schema extensions;
