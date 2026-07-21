
-- Turn 2a.1: explicit EXECUTE grants to service_role + hardened search_path.
-- SECURITY DEFINER only changes execution identity AFTER the caller passes
-- EXECUTE. Do not rely on ownership-through-Data-API assumptions.

DO $$
DECLARE
  fn record;
  sigs text[] := ARRAY[
    'public.persist_unified_turn(uuid, uuid, jsonb, jsonb, text, integer, integer, integer, integer)',
    'public.fail_unified_turn(uuid, uuid, text, text, boolean)',
    'public.claim_turn_retry(uuid, uuid, text, integer, integer)',
    'public.wisdom_turn_rate_limit_v2(uuid, integer, integer)',
    'public.wisdom_turn_rate_limit_check(uuid, integer, integer)',
    'public.wisdom_turn_attempts_cleanup(integer)'
  ];
  sig text;
BEGIN
  FOREACH sig IN ARRAY sigs LOOP
    -- Pin search_path to pg_catalog first, then public, then pg_temp last.
    -- pg_catalog leading prevents shadowing of core operators/casts by
    -- attacker-owned public objects; pg_temp last denies temp-table hijack.
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public, pg_temp', sig);
    -- Explicit deny to lesser roles.
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', sig);
    -- Explicit allow to service_role — the ONLY intended caller.
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
  END LOOP;
END $$;

-- Belt-and-braces: also revoke CREATE on public schema from lesser roles.
-- (Already the case on this project; asserted here so any future migration
-- that widens it will show up as an explicit change.)
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;
