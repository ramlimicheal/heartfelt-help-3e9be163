
-- =========================================================================
-- 0002 EXTENSIONS
-- =========================================================================
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- =========================================================================
-- 0001 ENUMS
-- =========================================================================
create type public.app_role as enum ('admin','curator','user');
create type public.source_tier as enum ('S1','S2','S3','S4','S5','S6','S7','S8');
create type public.canon_profile as enum ('protestant_66','ethiopian_orthodox_tewahedo_research','comparative_early_christian_literature');
create type public.source_profile as enum ('founder_default');
create type public.source_status as enum ('draft','in_review','approved','superseded','retired');
create type public.session_mode as enum ('companion','pattern','deep_wisdom','curse_breaker');
create type public.persona_fact_status as enum ('session_only','proposed','accepted','rejected','deleted');
create type public.sensitivity as enum ('normal','sensitive','hidden');
create type public.memory_directive as enum ('normal','session_only','do_not_remember');
create type public.signal_origin as enum ('explicit','inferred');
create type public.pattern_status as enum ('active','archived','rejected');
create type public.pattern_relation as enum ('causes','reinforces','masks','contradicts','precedes');
create type public.hypothesis_status as enum ('proposed','supported','weakened','rejected');
create type public.interpretation_category as enum (
  'biblical_curse','stronghold','chosen_behavior','trauma_wound',
  'systemic_injustice','physiological','spiritual_attack','generational_sin',
  'identity_lie','vow_or_agreement','unforgiveness','idolatry',
  'fear_bondage','ignorance'
);
create type public.prayer_movement as enum (
  'adoration','confession','renunciation','forgiveness','deliverance',
  'healing','blessing','commissioning','thanksgiving'
);
create type public.derivation_type as enum ('direct','inferred','pattern_matched');
create type public.formation_event_type as enum (
  'signal','pattern_update','interpretation','prayer',
  'practice_assigned','check_in','memory_change'
);
create type public.check_in_result as enum ('kept','partial','missed','deferred');
create type public.run_status as enum ('started','succeeded','failed','skipped');
create type public.eval_dimension as enum (
  'persona_fidelity','event_chain_fidelity','hypothesis_quality','counter_evidence',
  'biblical_grounding','context_integrity','source_tier_accuracy','prayer_pattern_fit',
  'prayer_lineage','action_fit','non_shaming_tone','unsupported_certainty',
  'user_correction_behavior','citation_validity','category_coverage','refusal_correctness',
  'latency','cost','safety'
);

-- =========================================================================
-- 0003 IDENTITY + GOVERNANCE (profiles, user_roles, admin_audit)
-- source_audit intentionally deferred to the corpus batch.
-- =========================================================================

-- Shared updated_at trigger fn
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  canon_profile public.canon_profile not null default 'protestant_66',
  source_profile public.source_profile not null default 'founder_default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "profiles_owner_select"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_owner_insert"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_owner_update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- ---------- user_roles ----------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- Least-privilege: owner may READ own row; NO client write grants at all.
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "user_roles_select_own"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for `authenticated` => all client writes denied.
-- All writes go through server functions that use service_role.

-- has_role(): the ONLY trusted role check (security definer, stable, pinned search_path)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- Anti-escalation trigger: even if a server function is coded incorrectly,
-- a caller with a live JWT (auth.uid() is not null) cannot insert or update
-- a role row targeting themselves. service_role calls have auth.uid() = null
-- and therefore bypass this trigger.
create or replace function public.prevent_role_self_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.user_id = auth.uid() then
    raise exception 'user_roles: self role assignment is forbidden'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger user_roles_no_self_assign
  before insert or update on public.user_roles
  for each row execute function public.prevent_role_self_assignment();

-- ---------- admin_audit (append-only) ----------
create table public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  target_table text,
  target_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Admins read via RLS on the authenticated grant; only service_role writes.
grant select on public.admin_audit to authenticated;
grant all on public.admin_audit to service_role;

alter table public.admin_audit enable row level security;

create policy "admin_audit_admin_select"
  on public.admin_audit for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies for authenticated => client writes denied.

-- Append-only trigger: block UPDATE/DELETE even for service_role
create or replace function public.admin_audit_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_audit is append-only'
    using errcode = '42501';
end;
$$;

create trigger admin_audit_no_update
  before update on public.admin_audit
  for each row execute function public.admin_audit_append_only();

create trigger admin_audit_no_delete
  before delete on public.admin_audit
  for each row execute function public.admin_audit_append_only();
