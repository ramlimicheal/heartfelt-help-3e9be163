
-- profiles
revoke all on public.profiles from anon, authenticated, public;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- user_roles
revoke all on public.user_roles from anon, authenticated, public;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

-- admin_audit
revoke all on public.admin_audit from anon, authenticated, public;
grant select on public.admin_audit to authenticated;
grant all on public.admin_audit to service_role;
