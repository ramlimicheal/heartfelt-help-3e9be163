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
-- 0003 IDENTITY + GOVERNANCE
-- =========================================================================
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

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
create policy "profiles_owner_select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_owner_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_owner_update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "user_roles_select_own" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to service_role;

create or replace function public.prevent_role_self_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.user_id = auth.uid() then
    raise exception 'user_roles: self role assignment is forbidden' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger user_roles_no_self_assign before insert or update on public.user_roles for each row execute function public.prevent_role_self_assignment();

create table public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  target_table text,
  target_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.admin_audit to authenticated;
grant all on public.admin_audit to service_role;
alter table public.admin_audit enable row level security;

create or replace function public.admin_audit_append_only()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'admin_audit is append-only' using errcode = '42501'; end; $$;
create trigger admin_audit_no_update before update on public.admin_audit for each row execute function public.admin_audit_append_only();
create trigger admin_audit_no_delete before delete on public.admin_audit for each row execute function public.admin_audit_append_only();

revoke all on function public.prevent_role_self_assignment() from public, authenticated, anon;
revoke all on function public.admin_audit_append_only() from public, authenticated, anon;
revoke all on function public.update_updated_at_column() from public;

create schema if not exists extensions;
grant usage on schema extensions to authenticated, service_role, anon;
alter extension pgcrypto set schema extensions;
alter extension pg_trgm set schema extensions;

-- 0004 role helper hardening
create or replace function public.current_user_has_role(_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = _role)
$$;
revoke all on function public.current_user_has_role(public.app_role) from public, anon;
grant execute on function public.current_user_has_role(public.app_role) to authenticated, service_role;

create policy admin_audit_admin_select on public.admin_audit for select to authenticated using (public.current_user_has_role('admin'));

-- 0005 sessions/messages/signals/persona
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id) values (new.id) on conflict (id) do nothing; return new; end; $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode public.session_mode not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sessions to authenticated;
grant all on public.sessions to service_role;
alter table public.sessions enable row level security;
create policy sessions_owner_select on public.sessions for select to authenticated using (auth.uid() = user_id);
create policy sessions_owner_insert on public.sessions for insert to authenticated with check (auth.uid() = user_id);
create policy sessions_owner_update on public.sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sessions_owner_delete on public.sessions for delete to authenticated using (auth.uid() = user_id);
create trigger sessions_set_updated_at before update on public.sessions for each row execute function public.update_updated_at_column();
create index sessions_user_id_idx on public.sessions(user_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  memory_directive public.memory_directive not null default 'normal',
  created_at timestamptz not null default now()
);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy messages_owner_select on public.messages for select to authenticated using (auth.uid() = user_id);
create policy messages_owner_insert on public.messages for insert to authenticated with check (
  auth.uid() = user_id and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
);
create or replace function public.messages_immutable()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'messages are immutable'; end; $$;
revoke all on function public.messages_immutable() from public, anon, authenticated;
create trigger messages_no_update before update on public.messages for each row execute function public.messages_immutable();
create trigger messages_no_delete_direct before delete on public.messages for each row when (pg_trigger_depth() = 0) execute function public.messages_immutable();
create index messages_session_id_idx on public.messages(session_id, created_at);
create index messages_user_id_idx on public.messages(user_id, created_at desc);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  source_message_id uuid not null references public.messages(id) on delete cascade,
  origin public.signal_origin not null,
  source_span_start int,
  source_span_end int,
  span_text text,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (source_span_start is null or source_span_start >= 0),
  check (source_span_end is null or source_span_end >= source_span_start)
);
grant select on public.signals to authenticated;
grant all on public.signals to service_role;
alter table public.signals enable row level security;
create policy signals_owner_select on public.signals for select to authenticated using (auth.uid() = user_id);
create or replace function public.signals_reject_dnr_source()
returns trigger language plpgsql set search_path = public as $$
declare src_directive public.memory_directive; src_user uuid;
begin
  select memory_directive, user_id into src_directive, src_user from public.messages where id = new.source_message_id;
  if src_directive is null then raise exception 'signals: source message % not found', new.source_message_id; end if;
  if src_directive = 'do_not_remember' then raise exception 'signals: cannot derive a durable signal from a do_not_remember message'; end if;
  if src_user is distinct from new.user_id then raise exception 'signals: user_id must match source message owner'; end if;
  return new;
end; $$;
revoke all on function public.signals_reject_dnr_source() from public, anon, authenticated;
create trigger signals_check_dnr before insert on public.signals for each row execute function public.signals_reject_dnr_source();
create index signals_user_idx on public.signals(user_id, created_at desc);
create index signals_message_idx on public.signals(source_message_id);

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.personas to authenticated;
grant all on public.personas to service_role;
alter table public.personas enable row level security;
create policy personas_owner_select on public.personas for select to authenticated using (auth.uid() = user_id);
create trigger personas_set_updated_at before update on public.personas for each row execute function public.update_updated_at_column();

create table public.persona_facts (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  status public.persona_fact_status not null default 'proposed',
  sensitivity public.sensitivity not null default 'normal',
  origin public.signal_origin not null default 'inferred',
  source_signal_id uuid references public.signals(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  memory_directive public.memory_directive not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.persona_facts to authenticated;
grant all on public.persona_facts to service_role;
alter table public.persona_facts enable row level security;
create policy persona_facts_owner_select on public.persona_facts for select to authenticated using (auth.uid() = user_id);

create table public.persona_fact_confirmations (
  id uuid primary key default gen_random_uuid(),
  persona_fact_id uuid not null,
  confirmed_by uuid not null references auth.users(id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  method text not null default 'explicit_ui',
  notes text
);
alter table public.persona_fact_confirmations add constraint pfc_fact_fk foreign key (persona_fact_id) references public.persona_facts(id) on delete cascade;
grant select on public.persona_fact_confirmations to authenticated;
grant all on public.persona_fact_confirmations to service_role;
alter table public.persona_fact_confirmations enable row level security;
create policy pfc_owner_select on public.persona_fact_confirmations for select to authenticated using (auth.uid() = confirmed_by);
create or replace function public.pfc_append_only()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'persona_fact_confirmations are append-only'; end; $$;
revoke all on function public.pfc_append_only() from public, anon, authenticated;
create trigger pfc_no_update before update on public.persona_fact_confirmations for each row execute function public.pfc_append_only();
create trigger pfc_no_delete_direct before delete on public.persona_fact_confirmations for each row when (pg_trigger_depth() = 0) execute function public.pfc_append_only();

create or replace function public.persona_facts_guard()
returns trigger language plpgsql set search_path = public as $$
declare src_directive public.memory_directive;
begin
  if new.source_message_id is not null then
    select memory_directive into src_directive from public.messages where id = new.source_message_id;
    if src_directive = 'do_not_remember' then raise exception 'persona_facts: do_not_remember messages cannot back a durable fact'; end if;
  end if;
  if new.status = 'accepted' and new.sensitivity = 'sensitive' then
    if not exists (select 1 from public.persona_fact_confirmations c where c.persona_fact_id = new.id and c.confirmed_by = new.user_id) then
      raise exception 'persona_facts: sensitive fact requires an owner confirmation before acceptance';
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.persona_facts_guard() from public, anon, authenticated;
create trigger persona_facts_set_updated_at before update on public.persona_facts for each row execute function public.update_updated_at_column();
create index persona_facts_persona_idx on public.persona_facts(persona_id, status);
create index persona_facts_user_idx on public.persona_facts(user_id, status);

create or replace function public.pfc_enforce_ownership()
returns trigger language plpgsql set search_path = public as $$
declare fact_owner uuid; fact_sensitivity public.sensitivity;
begin
  select user_id, sensitivity into fact_owner, fact_sensitivity from public.persona_facts where id = new.persona_fact_id;
  if fact_owner is null then raise exception 'persona_fact_confirmations: fact % not found', new.persona_fact_id; end if;
  if fact_owner is distinct from new.confirmed_by then raise exception 'persona_fact_confirmations: confirmer must own the fact'; end if;
  if fact_sensitivity <> 'sensitive' then raise exception 'persona_fact_confirmations: only sensitive facts are confirmable'; end if;
  return new;
end; $$;
revoke all on function public.pfc_enforce_ownership() from public, anon, authenticated;
create trigger pfc_enforce_owner before insert on public.persona_fact_confirmations for each row execute function public.pfc_enforce_ownership();
create trigger persona_facts_guard_iu before insert or update on public.persona_facts for each row execute function public.persona_facts_guard();
create index pfc_fact_idx on public.persona_fact_confirmations(persona_fact_id);

alter type public.persona_fact_status add value if not exists 'corrected';

-- 0007 pattern graph + corpus
create type public.pattern_evidence_kind as enum ('supporting','counter','missing','hidden_agreement');
create type public.pattern_feedback_kind as enum ('accept','refine','reject','reconsider');
create type public.governed_entity as enum ('source','archetype');

create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  title text not null,
  description text,
  status public.pattern_status not null default 'active',
  lifecycle text not null default 'proposed'
    check (lifecycle in ('proposed','accepted','refined','rejected','archived','reconsidered')),
  acceptance_feedback text,
  accepted_at timestamptz,
  rejected_reason text,
  rejected_scope text,
  rejected_evidence_snapshot jsonb,
  rejected_at timestamptz,
  archived_at timestamptz,
  reconsidered_from uuid references public.patterns(id) on delete set null,
  reconsideration_evidence text,
  last_edited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
grant select, insert, update on public.patterns to authenticated;
grant all on public.patterns to service_role;
alter table public.patterns enable row level security;
create policy patterns_owner_select on public.patterns for select to authenticated using (auth.uid() = user_id);
create policy patterns_owner_insert on public.patterns for insert to authenticated with check (auth.uid() = user_id);
create policy patterns_owner_update_safe on public.patterns for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.patterns_owner_lifecycle_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare caller uuid := auth.uid();
begin
  if caller is null then return new; end if;
  if new.lifecycle is distinct from old.lifecycle and new.lifecycle in ('accepted','rejected','reconsidered') then
    raise exception 'patterns: lifecycle transition to % must go through server function', new.lifecycle using errcode = '42501';
  end if;
  return new;
end $$;
create trigger patterns_owner_lifecycle_guard before update on public.patterns for each row execute function public.patterns_owner_lifecycle_guard();
create trigger patterns_updated_at before update on public.patterns for each row execute function public.update_updated_at_column();

create table public.pattern_events (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references public.patterns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  note text,
  source_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert on public.pattern_events to authenticated;
grant all on public.pattern_events to service_role;
alter table public.pattern_events enable row level security;
create policy pattern_events_owner_select on public.pattern_events for select to authenticated using (auth.uid() = user_id);
create policy pattern_events_owner_insert on public.pattern_events for insert to authenticated with check (auth.uid() = user_id);

create table public.pattern_evidence (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references public.patterns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.pattern_evidence_kind not null,
  source_message_id uuid not null references public.messages(id) on delete restrict,
  excerpt text,
  confidence numeric(4,3),
  created_at timestamptz not null default now()
);
grant select on public.pattern_evidence to authenticated;
grant all on public.pattern_evidence to service_role;
alter table public.pattern_evidence enable row level security;
create policy pattern_evidence_owner_select on public.pattern_evidence for select to authenticated using (auth.uid() = user_id);
create or replace function public.pattern_evidence_dnr_guard()
returns trigger language plpgsql set search_path = public as $$
declare d public.memory_directive;
begin
  select memory_directive into d from public.messages where id = new.source_message_id;
  if d = 'do_not_remember' then raise exception 'pattern_evidence: do_not_remember messages cannot become durable evidence' using errcode = '42501'; end if;
  return new;
end $$;
create trigger pattern_evidence_dnr_guard before insert on public.pattern_evidence for each row execute function public.pattern_evidence_dnr_guard();

create table public.pattern_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_pattern_id uuid not null references public.patterns(id) on delete cascade,
  to_pattern_id uuid not null references public.patterns(id) on delete cascade,
  relation public.pattern_relation not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (user_id, from_pattern_id, to_pattern_id, relation),
  check (from_pattern_id <> to_pattern_id)
);
grant select on public.pattern_relationships to authenticated;
grant all on public.pattern_relationships to service_role;
alter table public.pattern_relationships enable row level security;
create policy pattern_relationships_owner_select on public.pattern_relationships for select to authenticated using (auth.uid() = user_id);
create or replace function public.pattern_relationships_same_user_guard()
returns trigger language plpgsql set search_path = public as $$
declare u1 uuid; u2 uuid;
begin
  select user_id into u1 from public.patterns where id = new.from_pattern_id;
  select user_id into u2 from public.patterns where id = new.to_pattern_id;
  if u1 is null or u2 is null or u1 <> u2 or u1 <> new.user_id then
    raise exception 'pattern_relationships: endpoints must belong to the same user' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger pattern_relationships_same_user_guard before insert on public.pattern_relationships for each row execute function public.pattern_relationships_same_user_guard();

create table public.pattern_feedback (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references public.patterns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.pattern_feedback_kind not null,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert on public.pattern_feedback to authenticated;
grant all on public.pattern_feedback to service_role;
alter table public.pattern_feedback enable row level security;
create policy pattern_feedback_owner_select on public.pattern_feedback for select to authenticated using (auth.uid() = user_id);
create policy pattern_feedback_owner_insert on public.pattern_feedback for insert to authenticated with check (auth.uid() = user_id);
create or replace function public.pattern_feedback_append_only()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'pattern_feedback is append-only' using errcode = '42501'; end $$;
create trigger pattern_feedback_no_update before update on public.pattern_feedback for each row execute function public.pattern_feedback_append_only();
create trigger pattern_feedback_no_delete before delete on public.pattern_feedback for each row execute function public.pattern_feedback_append_only();

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  tier public.source_tier not null,
  tradition text,
  period text,
  canon jsonb not null default '[]'::jsonb,
  translation text,
  licence text not null,
  licence_notes text,
  status public.source_status not null default 'draft',
  version int not null default 1,
  supersedes_id uuid references public.source_documents(id) on delete set null,
  superseded_by_id uuid references public.source_documents(id) on delete set null,
  author text,
  url text,
  notes text,
  last_edited_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.source_documents to authenticated;
grant all on public.source_documents to service_role;
alter table public.source_documents enable row level security;
create policy source_documents_curator_read on public.source_documents for select to authenticated using (public.current_user_has_role('curator') or public.current_user_has_role('admin'));
create policy source_documents_curator_insert on public.source_documents for insert to authenticated with check (public.current_user_has_role('curator') or public.current_user_has_role('admin'));
create policy source_documents_curator_update on public.source_documents for update to authenticated using (public.current_user_has_role('curator') or public.current_user_has_role('admin')) with check (public.current_user_has_role('curator') or public.current_user_has_role('admin'));
create trigger source_documents_updated_at before update on public.source_documents for each row execute function public.update_updated_at_column();

create table public.source_passages (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.source_documents(id) on delete restrict,
  reference text not null,
  canonical_ref text not null,
  text text not null,
  created_at timestamptz not null default now(),
  unique (source_id, canonical_ref)
);
grant select on public.source_passages to authenticated;
grant all on public.source_passages to service_role;
alter table public.source_passages enable row level security;
create policy source_passages_curator_read on public.source_passages for select to authenticated using (public.current_user_has_role('curator') or public.current_user_has_role('admin'));
create policy source_passages_curator_write on public.source_passages for all to authenticated using (public.current_user_has_role('curator') or public.current_user_has_role('admin')) with check (public.current_user_has_role('curator') or public.current_user_has_role('admin'));

create table public.source_approvals (
  id uuid primary key default gen_random_uuid(),
  target_type public.governed_entity not null,
  target_id uuid not null,
  target_version int not null,
  approver_id uuid not null references auth.users(id) on delete restrict,
  approver_role public.app_role not null,
  note text,
  created_at timestamptz not null default now(),
  unique (target_type, target_id, target_version, approver_id)
);
grant select, insert on public.source_approvals to authenticated;
grant all on public.source_approvals to service_role;
alter table public.source_approvals enable row level security;
create policy source_approvals_curator_read on public.source_approvals for select to authenticated using (public.current_user_has_role('curator') or public.current_user_has_role('admin'));
create policy source_approvals_curator_insert on public.source_approvals for insert to authenticated with check (
  approver_id = auth.uid() and (public.current_user_has_role('curator') or public.current_user_has_role('admin')) and approver_role in ('curator','admin')
);
create or replace function public.source_approvals_append_only()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'source_approvals is append-only' using errcode = '42501'; end $$;
create trigger source_approvals_no_update before update on public.source_approvals for each row execute function public.source_approvals_append_only();
create trigger source_approvals_no_delete before delete on public.source_approvals for each row execute function public.source_approvals_append_only();

create table public.source_audit (
  id uuid primary key default gen_random_uuid(),
  target_type public.governed_entity not null,
  target_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.source_audit to authenticated;
grant all on public.source_audit to service_role;
alter table public.source_audit enable row level security;
create policy source_audit_curator_read on public.source_audit for select to authenticated using (public.current_user_has_role('curator') or public.current_user_has_role('admin'));
create policy source_audit_curator_insert on public.source_audit for insert to authenticated with check (
  actor_id = auth.uid() and (public.current_user_has_role('curator') or public.current_user_has_role('admin'))
);
create or replace function public.source_audit_append_only()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'source_audit is append-only' using errcode = '42501'; end $$;
create trigger source_audit_no_update before update on public.source_audit for each row execute function public.source_audit_append_only();
create trigger source_audit_no_delete before delete on public.source_audit for each row execute function public.source_audit_append_only();

create table public.biblical_archetypes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  status public.source_status not null default 'draft',
  version int not null default 1,
  last_edited_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.biblical_archetypes to authenticated;
grant all on public.biblical_archetypes to service_role;
alter table public.biblical_archetypes enable row level security;
create policy biblical_archetypes_approved_read on public.biblical_archetypes for select to authenticated using (status = 'approved');
create policy biblical_archetypes_curator_all on public.biblical_archetypes for all to authenticated using (public.current_user_has_role('curator') or public.current_user_has_role('admin')) with check (public.current_user_has_role('curator') or public.current_user_has_role('admin'));
create trigger biblical_archetypes_updated_at before update on public.biblical_archetypes for each row execute function public.update_updated_at_column();

create or replace function public.source_approvals_derive_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.has_role(new.approver_id, 'admin') then new.approver_role := 'admin';
  elsif public.has_role(new.approver_id, 'curator') then new.approver_role := 'curator';
  else raise exception 'source_approvals: approver must be curator or admin' using errcode = '42501'; end if;
  if new.target_type = 'source' then
    if exists (select 1 from public.source_documents s where s.id = new.target_id and s.last_edited_by = new.approver_id) then
      raise exception 'source_approvals: last editor cannot approve their own change' using errcode = '42501';
    end if;
  elsif new.target_type = 'archetype' then
    if exists (select 1 from public.biblical_archetypes a where a.id = new.target_id and a.last_edited_by = new.approver_id) then
      raise exception 'source_approvals: last editor cannot approve their own change' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger source_approvals_derive_role before insert on public.source_approvals for each row execute function public.source_approvals_derive_role();

create table public.archetype_mirrors (
  id uuid primary key default gen_random_uuid(),
  archetype_id uuid not null references public.biblical_archetypes(id) on delete cascade,
  mirror_type text not null,
  description text not null,
  created_at timestamptz not null default now()
);
grant select on public.archetype_mirrors to authenticated;
grant all on public.archetype_mirrors to service_role;
alter table public.archetype_mirrors enable row level security;
create policy archetype_mirrors_approved_read on public.archetype_mirrors for select to authenticated using (exists (select 1 from public.biblical_archetypes a where a.id = archetype_id and a.status = 'approved'));
create policy archetype_mirrors_curator_all on public.archetype_mirrors for all to authenticated using (public.current_user_has_role('curator') or public.current_user_has_role('admin')) with check (public.current_user_has_role('curator') or public.current_user_has_role('admin'));

create table public.archetype_passages (
  id uuid primary key default gen_random_uuid(),
  archetype_id uuid not null references public.biblical_archetypes(id) on delete cascade,
  passage_id uuid not null references public.source_passages(id) on delete restrict,
  role text not null default 'primary',
  ordering int not null default 0,
  created_at timestamptz not null default now(),
  unique (archetype_id, passage_id)
);
grant select on public.archetype_passages to authenticated;
grant all on public.archetype_passages to service_role;
alter table public.archetype_passages enable row level security;
create policy archetype_passages_approved_read on public.archetype_passages for select to authenticated using (exists (select 1 from public.biblical_archetypes a where a.id = archetype_id and a.status = 'approved'));
create policy archetype_passages_curator_all on public.archetype_passages for all to authenticated using (public.current_user_has_role('curator') or public.current_user_has_role('admin')) with check (public.current_user_has_role('curator') or public.current_user_has_role('admin'));

create or replace function public.enforce_two_approver_publish()
returns trigger language plpgsql security definer set search_path = public as $$
declare entity public.governed_entity; approver_count int; last_editor uuid; target_ver int;
begin
  if tg_table_name = 'source_documents' then entity := 'source'; last_editor := new.last_edited_by; target_ver := new.version;
  else entity := 'archetype'; last_editor := new.last_edited_by; target_ver := new.version; end if;
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    select count(distinct approver_id) into approver_count from public.source_approvals
      where target_type = entity and target_id = new.id and target_version = target_ver
        and (last_editor is null or approver_id <> last_editor) and approver_role in ('curator','admin');
    if approver_count < 2 then raise exception 'publication requires two distinct qualified approvers (excluding last editor)' using errcode = '42501'; end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end $$;
create trigger source_documents_two_approver_publish before update on public.source_documents for each row execute function public.enforce_two_approver_publish();
create trigger biblical_archetypes_two_approver_publish before update on public.biblical_archetypes for each row execute function public.enforce_two_approver_publish();
revoke execute on function public.patterns_owner_lifecycle_guard() from public, anon, authenticated;
revoke execute on function public.source_approvals_derive_role() from public, anon, authenticated;
revoke execute on function public.enforce_two_approver_publish() from public, anon, authenticated;

CREATE POLICY "source_passages_historical_read" ON public.source_passages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.source_documents s WHERE s.id = source_passages.source_id AND s.status IN ('approved','superseded','retired')));
CREATE POLICY "source_documents_public_read" ON public.source_documents FOR SELECT TO authenticated USING (status IN ('approved','superseded','retired'));

-- Batch 4a: Wisdom core domain
create type public.prayer_mode as enum ('concise','full','guided','journal');
create type public.practice_kind as enum ('boundary','confession','forgiveness','restitution','reconciliation','silence','scripture_meditation','journaling','accountability','environmental_change','service','waiting','gratitude','fasting_reflection');
create type public.practice_assignment_status as enum ('pending','committed','completed','skipped','abandoned');
create type public.discernment_kind as enum ('context_note','direct_vs_inferred','descriptive_vs_prescriptive','counter_evidence','distinguishing_question','tension');
create type public.category_verdict as enum ('accepted','rejected','unsure','deferred');
create type public.pipeline_mode as enum ('companion','wisdom','curse_breaker');
create type public.pipeline_run_status as enum ('ok','error','skipped');

create or replace function public.append_only_guard()
returns trigger language plpgsql set search_path = public as $$
begin raise exception '% is append-only', tg_table_name using errcode='42501'; end $$;

create table public.interpretations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  pattern_id uuid references public.patterns(id) on delete set null,
  headline text not null,
  body text not null,
  confidence numeric(3,2) not null check (confidence between 0 and 1),
  min_source_tier public.source_tier,
  archetype_id uuid references public.biblical_archetypes(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.interpretations to authenticated;
grant all on public.interpretations to service_role;
alter table public.interpretations enable row level security;
create policy interpretations_owner_all on public.interpretations for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index interpretations_session_idx on public.interpretations(session_id);

create table public.stronghold_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  category public.interpretation_category not null,
  cheap_score numeric(3,2) not null default 0 check (cheap_score between 0 and 1),
  deep_analyzed boolean not null default false,
  confidence numeric(3,2) not null default 0 check (confidence between 0 and 1),
  pastoral_note text,
  supporting_evidence jsonb not null default '[]'::jsonb,
  counter_evidence jsonb not null default '[]'::jsonb,
  alternative_explanations jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, category)
);
grant select, insert, update, delete on public.stronghold_categories to authenticated;
grant all on public.stronghold_categories to service_role;
alter table public.stronghold_categories enable row level security;
create policy stronghold_categories_owner_all on public.stronghold_categories for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger stronghold_categories_updated_at before update on public.stronghold_categories for each row execute function public.update_updated_at_column();
create or replace function public.stronghold_categories_deep_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.deep_analyzed and jsonb_array_length(coalesce(new.citations,'[]'::jsonb)) < 1 then
    raise exception 'stronghold_categories: deep_analyzed=true requires >=1 citation';
  end if;
  return new;
end $$;
create trigger stronghold_categories_deep before insert or update on public.stronghold_categories for each row execute function public.stronghold_categories_deep_guard();

create table public.stronghold_category_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.stronghold_categories(id) on delete cascade,
  verdict public.category_verdict not null,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert on public.stronghold_category_approvals to authenticated;
grant all on public.stronghold_category_approvals to service_role;
alter table public.stronghold_category_approvals enable row level security;
create policy sca_owner_read on public.stronghold_category_approvals for select to authenticated using (auth.uid() = user_id);
create policy sca_owner_insert on public.stronghold_category_approvals for insert to authenticated with check (auth.uid() = user_id);
create trigger sca_no_update before update on public.stronghold_category_approvals for each row execute function public.append_only_guard();
create trigger sca_no_delete before delete on public.stronghold_category_approvals for each row execute function public.append_only_guard();
create or replace function public.sca_ownership_guard()
returns trigger language plpgsql set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.stronghold_categories where id = new.category_id;
  if owner is distinct from new.user_id then raise exception 'stronghold_category_approvals: user must own the category'; end if;
  return new;
end $$;
create trigger sca_ownership before insert on public.stronghold_category_approvals for each row execute function public.sca_ownership_guard();

create table public.discernments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  pattern_id uuid references public.patterns(id) on delete set null,
  kind public.discernment_kind not null,
  text text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.discernments to authenticated;
grant all on public.discernments to service_role;
alter table public.discernments enable row level security;
create policy discernments_owner_all on public.discernments for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index discernments_session_idx on public.discernments(session_id);

create table public.prayers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  pattern_id uuid references public.patterns(id) on delete set null,
  title text not null,
  mode public.prayer_mode not null default 'full',
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.prayers to authenticated;
grant all on public.prayers to service_role;
alter table public.prayers enable row level security;
create policy prayers_owner_all on public.prayers for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger prayers_updated_at before update on public.prayers for each row execute function public.update_updated_at_column();
create index prayers_session_idx on public.prayers(session_id);

create table public.prayer_lines (
  id uuid primary key default gen_random_uuid(),
  prayer_id uuid not null references public.prayers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ordering int not null,
  movement public.prayer_movement not null,
  text text not null,
  confidence numeric(3,2) not null default 0.8 check (confidence between 0 and 1),
  user_edited boolean not null default false,
  created_at timestamptz not null default now(),
  unique (prayer_id, ordering)
);
grant select, insert, update, delete on public.prayer_lines to authenticated;
grant all on public.prayer_lines to service_role;
alter table public.prayer_lines enable row level security;
create policy prayer_lines_owner_all on public.prayer_lines for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.prayer_line_sources (
  id uuid primary key default gen_random_uuid(),
  prayer_line_id uuid not null references public.prayer_lines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  passage_id uuid not null references public.source_passages(id) on delete restrict,
  derivation public.derivation_type not null,
  explanation text not null,
  tier public.source_tier not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.prayer_line_sources to authenticated;
grant all on public.prayer_line_sources to service_role;
alter table public.prayer_line_sources enable row level security;
create policy pls_owner_all on public.prayer_line_sources for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index pls_line_idx on public.prayer_line_sources(prayer_line_id);

create or replace function public.prayers_finalize_guard()
returns trigger language plpgsql set search_path = public as $$
declare missing int;
begin
  if new.finalized_at is not null and (old.finalized_at is null or old.finalized_at is distinct from new.finalized_at) then
    select count(*) into missing from public.prayer_lines pl
    left join public.prayer_line_sources s on s.prayer_line_id = pl.id
    where pl.prayer_id = new.id group by pl.id having count(s.id) = 0;
    if missing is not null and missing > 0 then raise exception 'prayers: every prayer_line must have >=1 source before finalization'; end if;
  end if;
  return new;
end $$;
create trigger prayers_finalize before update on public.prayers for each row execute function public.prayers_finalize_guard();

create table public.practices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  pattern_id uuid references public.patterns(id) on delete set null,
  kind public.practice_kind not null,
  title text not null,
  rationale text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.practices to authenticated;
grant all on public.practices to service_role;
alter table public.practices enable row level security;
create policy practices_owner_all on public.practices for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create unique index practices_one_primary_per_session on public.practices(session_id) where is_primary;

create table public.practice_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_id uuid not null references public.practices(id) on delete cascade,
  status public.practice_assignment_status not null default 'pending',
  scheduled_for timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.practice_assignments to authenticated;
grant all on public.practice_assignments to service_role;
alter table public.practice_assignments enable row level security;
create policy pa_owner_all on public.practice_assignments for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger pa_updated_at before update on public.practice_assignments for each row execute function public.update_updated_at_column();

create table public.formation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type public.formation_event_type not null,
  pattern_id uuid references public.patterns(id) on delete set null,
  prayer_id uuid references public.prayers(id) on delete set null,
  practice_id uuid references public.practices(id) on delete set null,
  note text,
  fruit text[] not null default '{}',
  at timestamptz not null default now()
);
grant select, insert on public.formation_events to authenticated;
grant all on public.formation_events to service_role;
alter table public.formation_events enable row level security;
create policy fe_owner_read on public.formation_events for select to authenticated using (auth.uid() = user_id);
create policy fe_owner_insert on public.formation_events for insert to authenticated with check (auth.uid() = user_id);
create trigger fe_no_update before update on public.formation_events for each row execute function public.append_only_guard();
create trigger fe_no_delete before delete on public.formation_events for each row execute function public.append_only_guard();
create index fe_user_at_idx on public.formation_events(user_id, at desc);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  practice_assignment_id uuid references public.practice_assignments(id) on delete set null,
  observed text,
  setback text,
  note text,
  at timestamptz not null default now()
);
grant select, insert, update, delete on public.check_ins to authenticated;
grant all on public.check_ins to service_role;
alter table public.check_ins enable row level security;
create policy check_ins_owner_all on public.check_ins for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version int not null check (version > 0),
  body text not null,
  model_hint text,
  active boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (key, version)
);
grant select on public.prompt_versions to authenticated;
grant all on public.prompt_versions to service_role;
alter table public.prompt_versions enable row level security;
create policy prompt_versions_read on public.prompt_versions for select to authenticated using (true);
create policy prompt_versions_admin_write on public.prompt_versions for all to authenticated using (public.current_user_has_role('admin')) with check (public.current_user_has_role('admin'));
create unique index prompt_versions_one_active_per_key on public.prompt_versions(key) where active;

create table public.model_configs (
  id uuid primary key default gen_random_uuid(),
  stage text not null,
  version int not null check (version > 0),
  provider text not null,
  model text not null,
  params jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (stage, version)
);
grant select on public.model_configs to authenticated;
grant all on public.model_configs to service_role;
alter table public.model_configs enable row level security;
create policy model_configs_read on public.model_configs for select to authenticated using (true);
create policy model_configs_admin_write on public.model_configs for all to authenticated using (public.current_user_has_role('admin')) with check (public.current_user_has_role('admin'));
create unique index model_configs_one_active_per_stage on public.model_configs(stage) where active;

create table public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  mode public.pipeline_mode not null,
  stage text not null,
  status public.pipeline_run_status not null,
  latency_ms int,
  prompt_key text,
  prompt_version int,
  model text,
  tokens_in int,
  tokens_out int,
  error text,
  payload_hash text,
  idempotency_key text,
  created_at timestamptz not null default now()
);
grant select on public.pipeline_runs to authenticated;
grant all on public.pipeline_runs to service_role;
alter table public.pipeline_runs enable row level security;
create policy pipeline_runs_owner_read on public.pipeline_runs for select to authenticated using (auth.uid() = user_id);
create unique index pipeline_runs_idempotency_uniq on public.pipeline_runs(idempotency_key) where idempotency_key is not null;
create index pipeline_runs_session_idx on public.pipeline_runs(session_id, created_at desc);

INSERT INTO public.prompt_versions (key, version, active, body) VALUES
('wisdom.composition', 2, true,
$$You compose a Wisdom response.

Output fields: whatIHear, hypothesis (name, description, confidence, distinguishingQuestion), discernment (contextNote, directVsInferred, descriptiveVsPrescriptive, counterEvidence, distinguishingQuestion), prayer (title + 3-5 lines), primaryPractice.

Every prayer line MUST include 1-4 citations. Each citation has passage_id (exact id from the retrieval set), derivation, and explanation.

Derivation semantics:
- "direct": the passage's own language directly supports this line. Quote a short phrase or name its reference.
- "inferred": Wisdom is applying the passage. Use language like "we infer", "we apply", "an implication".
- "pattern_matched": a structural parallel. Name the pattern AND state its limits.

Additional rules:
- Never cite the same passage_id twice on one prayer line.
- Do not emit reasoning or scratchpad.
- Confidence is a calibrated number in [0,1]; when evidence is thin, lower it.
$$),
('cb.deep_analysis', 2, true,
$$You analyze one stronghold/curse category against the user's story.

Return confidence, supporting_evidence, counter_evidence, alternative_explanations, citations (1-6, each with passage_id, tier, note), and a pastoral_note.

For every citation, the "note" (>=40 chars) MUST name the actual connection between this passage and this category.

Never cite the same passage_id twice. Do not emit chain-of-thought.
$$);