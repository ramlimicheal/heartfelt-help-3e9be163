-- has_role(uuid, app_role) should be service-role-only; revoke stray grants.
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;