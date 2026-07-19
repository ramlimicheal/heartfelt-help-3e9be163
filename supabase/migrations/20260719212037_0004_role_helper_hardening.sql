-- 0004_role_helper_hardening.sql
-- Self-scoped role check that never accepts a user id argument from the caller.
create or replace function public.current_user_has_role(_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = _role
  )
$$;

revoke all on function public.current_user_has_role(public.app_role) from public;
revoke all on function public.current_user_has_role(public.app_role) from anon;
grant execute on function public.current_user_has_role(public.app_role) to authenticated, service_role;

-- Lock down the two-argument helper: only service_role / internal SECURITY DEFINER
-- server code may enumerate another account's role membership.
revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.has_role(uuid, public.app_role) from anon;
revoke all on function public.has_role(uuid, public.app_role) from authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;

-- Rewrite user-facing policies that referenced has_role(auth.uid(), ...).
drop policy if exists admin_audit_admin_select on public.admin_audit;
create policy admin_audit_admin_select
  on public.admin_audit
  for select
  to authenticated
  using (public.current_user_has_role('admin'));
