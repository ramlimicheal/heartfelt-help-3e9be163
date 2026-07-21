CREATE OR REPLACE FUNCTION public.current_user_has_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = _role
  )
$function$;

GRANT EXECUTE ON FUNCTION public.current_user_has_role(app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(app_role) TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wisdom_turn_attempts TO service_role;

DROP POLICY IF EXISTS wisdom_turn_attempts_service_role_only ON public.wisdom_turn_attempts;
CREATE POLICY wisdom_turn_attempts_service_role_only
ON public.wisdom_turn_attempts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);