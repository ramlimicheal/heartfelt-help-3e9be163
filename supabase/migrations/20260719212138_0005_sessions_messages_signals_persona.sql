-- 0005_sessions_messages_signals_persona.sql

------------------------------------------------------------------------------
-- Profile auto-bootstrap on new auth user
------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------------------------
-- sessions
------------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode public.session_mode not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.sessions from anon, authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant all on public.sessions to service_role;

alter table public.sessions enable row level security;

create policy sessions_owner_select on public.sessions
  for select to authenticated using (auth.uid() = user_id);
create policy sessions_owner_insert on public.sessions
  for insert to authenticated with check (auth.uid() = user_id);
create policy sessions_owner_update on public.sessions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sessions_owner_delete on public.sessions
  for delete to authenticated using (auth.uid() = user_id);

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.update_updated_at_column();

create index sessions_user_id_idx on public.sessions(user_id, created_at desc);

------------------------------------------------------------------------------
-- messages (immutable)
------------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  memory_directive public.memory_directive not null default 'normal',
  created_at timestamptz not null default now()
);

revoke all on public.messages from anon, authenticated;
-- Deliberately no UPDATE / DELETE grant: messages are immutable client-side;
-- deletion happens only through session or account cascade.
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;

alter table public.messages enable row level security;

create policy messages_owner_select on public.messages
  for select to authenticated using (auth.uid() = user_id);
create policy messages_owner_insert on public.messages
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );
-- No UPDATE / DELETE policies -> both denied.

-- Belt-and-braces immutability: block UPDATE/DELETE for every caller, including service_role.
create or replace function public.messages_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'messages are immutable; delete the parent session or account instead';
end;
$$;
revoke all on function public.messages_immutable() from public, anon, authenticated;

create trigger messages_no_update
  before update on public.messages
  for each row execute function public.messages_immutable();
create trigger messages_no_delete_direct
  before delete on public.messages
  for each row when (pg_trigger_depth() = 0)
  execute function public.messages_immutable();
-- pg_trigger_depth() > 0 lets ON DELETE CASCADE from sessions/auth.users pass.

create index messages_session_id_idx on public.messages(session_id, created_at);
create index messages_user_id_idx on public.messages(user_id, created_at desc);

------------------------------------------------------------------------------
-- signals
------------------------------------------------------------------------------
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

revoke all on public.signals from anon, authenticated;
-- Signals are server-produced. Owners can read; no client writes.
grant select on public.signals to authenticated;
grant all on public.signals to service_role;

alter table public.signals enable row level security;

create policy signals_owner_select on public.signals
  for select to authenticated using (auth.uid() = user_id);
-- No insert/update/delete policies for authenticated.

-- DB-level guard: refuse to insert a signal derived from a do_not_remember message,
-- even if the service role gets it wrong.
create or replace function public.signals_reject_dnr_source()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  src_directive public.memory_directive;
  src_user uuid;
begin
  select memory_directive, user_id
    into src_directive, src_user
  from public.messages
  where id = new.source_message_id;

  if src_directive is null then
    raise exception 'signals: source message % not found', new.source_message_id;
  end if;

  if src_directive = 'do_not_remember' then
    raise exception 'signals: cannot derive a durable signal from a do_not_remember message';
  end if;

  if src_user is distinct from new.user_id then
    raise exception 'signals: user_id must match source message owner';
  end if;

  return new;
end;
$$;
revoke all on function public.signals_reject_dnr_source() from public, anon, authenticated;

create trigger signals_check_dnr
  before insert on public.signals
  for each row execute function public.signals_reject_dnr_source();

create index signals_user_idx on public.signals(user_id, created_at desc);
create index signals_message_idx on public.signals(source_message_id);

------------------------------------------------------------------------------
-- personas (one per user)
------------------------------------------------------------------------------
create table public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.personas from anon, authenticated;
grant select on public.personas to authenticated;
grant all on public.personas to service_role;

alter table public.personas enable row level security;

create policy personas_owner_select on public.personas
  for select to authenticated using (auth.uid() = user_id);
-- No client writes; server-managed via service_role when the first fact is proposed.

create trigger personas_set_updated_at
  before update on public.personas
  for each row execute function public.update_updated_at_column();

------------------------------------------------------------------------------
-- persona_facts
------------------------------------------------------------------------------
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

revoke all on public.persona_facts from anon, authenticated;
-- Owners may read only. Accept/reject/correct/delete flow through server functions
-- that use service_role; direct client writes are prohibited.
grant select on public.persona_facts to authenticated;
grant all on public.persona_facts to service_role;

alter table public.persona_facts enable row level security;

create policy persona_facts_owner_select on public.persona_facts
  for select to authenticated using (auth.uid() = user_id);

-- Guard: cannot become accepted if sensitive without a matching confirmation.
-- Also: durable facts cannot cite a do_not_remember source message.
create or replace function public.persona_facts_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  src_directive public.memory_directive;
begin
  -- Reject do_not_remember evidence for durable facts.
  if new.source_message_id is not null then
    select memory_directive into src_directive
    from public.messages where id = new.source_message_id;
    if src_directive = 'do_not_remember' then
      raise exception 'persona_facts: do_not_remember messages cannot back a durable fact';
    end if;
  end if;

  -- Sensitive + accepted requires a confirmation row already recorded.
  if new.status = 'accepted' and new.sensitivity = 'sensitive' then
    if not exists (
      select 1 from public.persona_fact_confirmations c
      where c.persona_fact_id = new.id
        and c.confirmed_by = new.user_id
    ) then
      raise exception 'persona_facts: sensitive fact requires an owner confirmation before acceptance';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.persona_facts_guard() from public, anon, authenticated;

create trigger persona_facts_set_updated_at
  before update on public.persona_facts
  for each row execute function public.update_updated_at_column();

create index persona_facts_persona_idx on public.persona_facts(persona_id, status);
create index persona_facts_user_idx on public.persona_facts(user_id, status);

------------------------------------------------------------------------------
-- persona_fact_confirmations (append-only)
------------------------------------------------------------------------------
create table public.persona_fact_confirmations (
  id uuid primary key default gen_random_uuid(),
  persona_fact_id uuid not null references public.persona_facts(id) on delete cascade,
  confirmed_by uuid not null references auth.users(id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  method text not null default 'explicit_ui',
  notes text
);

revoke all on public.persona_fact_confirmations from anon, authenticated;
-- Owners may read their own confirmations; writes flow through server functions.
grant select on public.persona_fact_confirmations to authenticated;
grant all on public.persona_fact_confirmations to service_role;

alter table public.persona_fact_confirmations enable row level security;

create policy pfc_owner_select on public.persona_fact_confirmations
  for select to authenticated using (auth.uid() = confirmed_by);

-- Append-only: block UPDATE/DELETE for every caller including service_role
-- (deletion still happens via ON DELETE CASCADE from persona_facts / auth.users).
create or replace function public.pfc_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'persona_fact_confirmations are append-only';
end;
$$;
revoke all on function public.pfc_append_only() from public, anon, authenticated;

create trigger pfc_no_update
  before update on public.persona_fact_confirmations
  for each row execute function public.pfc_append_only();
create trigger pfc_no_delete_direct
  before delete on public.persona_fact_confirmations
  for each row when (pg_trigger_depth() = 0)
  execute function public.pfc_append_only();

-- Enforce that the confirmer owns the fact and the fact is sensitive.
create or replace function public.pfc_enforce_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  fact_owner uuid;
  fact_sensitivity public.sensitivity;
begin
  select user_id, sensitivity
    into fact_owner, fact_sensitivity
  from public.persona_facts where id = new.persona_fact_id;

  if fact_owner is null then
    raise exception 'persona_fact_confirmations: fact % not found', new.persona_fact_id;
  end if;

  if fact_owner is distinct from new.confirmed_by then
    raise exception 'persona_fact_confirmations: confirmer must own the fact';
  end if;

  if fact_sensitivity <> 'sensitive' then
    raise exception 'persona_fact_confirmations: only sensitive facts are confirmable';
  end if;

  return new;
end;
$$;
revoke all on function public.pfc_enforce_ownership() from public, anon, authenticated;

create trigger pfc_enforce_owner
  before insert on public.persona_fact_confirmations
  for each row execute function public.pfc_enforce_ownership();

-- Re-run the persona_facts guard AFTER a confirmation is inserted so the
-- application can insert the confirmation and then flip status to accepted.
-- (The guard fires on any INSERT/UPDATE of persona_facts.)
create trigger persona_facts_guard_iu
  before insert or update on public.persona_facts
  for each row execute function public.persona_facts_guard();

create index pfc_fact_idx on public.persona_fact_confirmations(persona_fact_id);
