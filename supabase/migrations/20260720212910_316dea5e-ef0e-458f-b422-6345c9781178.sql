-- Tighten new SECURITY DEFINER functions: nothing but service_role may execute.
revoke execute on function public.persist_unified_turn(uuid, uuid, jsonb, jsonb, text, integer, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.fail_unified_turn(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.wisdom_turn_rate_limit_check(uuid, integer, integer) from public, anon, authenticated;
-- (grant to service_role was made in the previous migration and remains.)