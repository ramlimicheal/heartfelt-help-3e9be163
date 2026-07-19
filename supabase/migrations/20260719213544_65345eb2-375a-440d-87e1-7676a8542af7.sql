
-- 0007_pattern_graph_and_corpus.sql
-- Batch 3: Pattern Graph + first approved biblical corpus.

------------------------------------------------------------------------------
-- Enums
------------------------------------------------------------------------------
create type public.pattern_evidence_kind as enum
  ('supporting','counter','missing','hidden_agreement');

create type public.pattern_feedback_kind as enum
  ('accept','refine','reject','reconsider');

create type public.governed_entity as enum ('source','archetype');

------------------------------------------------------------------------------
-- PATTERN GRAPH
------------------------------------------------------------------------------

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
  unique (user_id, idempotency_key),
  constraint patterns_accept_requires_feedback
    check (lifecycle <> 'accepted' or (acceptance_feedback is not null and length(acceptance_feedback) > 0)),
  constraint patterns_reject_requires_snapshot
    check (lifecycle <> 'rejected'
      or (rejected_reason is not null and rejected_scope is not null and rejected_evidence_snapshot is not null)),
  constraint patterns_reconsider_requires_evidence
    check (lifecycle <> 'reconsidered'
      or (reconsidered_from is not null and reconsideration_evidence is not null
          and length(reconsideration_evidence) > 0))
);

grant select, insert, update on public.patterns to authenticated;
grant all on public.patterns to service_role;
alter table public.patterns enable row level security;

create policy patterns_owner_select on public.patterns
  for select to authenticated using (auth.uid() = user_id);
create policy patterns_owner_insert on public.patterns
  for insert to authenticated with check (auth.uid() = user_id);
-- Owner may update ONLY safe fields (title/description/status archive). Lifecycle transitions
-- to accepted/rejected/reconsidered go through server functions using service_role.
create policy patterns_owner_update_safe on public.patterns
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger: forbid owner-side transitions into accepted/rejected/reconsidered lifecycles.
create or replace function public.patterns_owner_lifecycle_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
begin
  -- service_role has no auth.uid(); skip when caller is not an end user.
  if caller is null then return new; end if;
  if new.lifecycle is distinct from old.lifecycle
     and new.lifecycle in ('accepted','rejected','reconsidered') then
    raise exception 'patterns: lifecycle transition to % must go through server function', new.lifecycle
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger patterns_owner_lifecycle_guard
  before update on public.patterns
  for each row execute function public.patterns_owner_lifecycle_guard();

create trigger patterns_updated_at
  before update on public.patterns
  for each row execute function public.update_updated_at_column();

------------------------------------------------------------------------------
-- pattern_events
------------------------------------------------------------------------------
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

create policy pattern_events_owner_select on public.pattern_events
  for select to authenticated using (auth.uid() = user_id);
create policy pattern_events_owner_insert on public.pattern_events
  for insert to authenticated with check (auth.uid() = user_id);

------------------------------------------------------------------------------
-- pattern_evidence  (server-inserted only)
------------------------------------------------------------------------------
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

create policy pattern_evidence_owner_select on public.pattern_evidence
  for select to authenticated using (auth.uid() = user_id);
-- Reject any evidence backed by a do_not_remember message (defense-in-depth).
create or replace function public.pattern_evidence_dnr_guard()
returns trigger language plpgsql set search_path = public as $$
declare d public.memory_directive;
begin
  select memory_directive into d from public.messages where id = new.source_message_id;
  if d = 'do_not_remember' then
    raise exception 'pattern_evidence: do_not_remember messages cannot become durable evidence'
      using errcode = '42501';
  end if;
  return new;
end $$;
create trigger pattern_evidence_dnr_guard
  before insert on public.pattern_evidence
  for each row execute function public.pattern_evidence_dnr_guard();

------------------------------------------------------------------------------
-- pattern_relationships (same-user only)
------------------------------------------------------------------------------
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

create policy pattern_relationships_owner_select on public.pattern_relationships
  for select to authenticated using (auth.uid() = user_id);

-- Enforce: both endpoints belong to same user, and equal user_id column
create or replace function public.pattern_relationships_same_user_guard()
returns trigger language plpgsql set search_path = public as $$
declare u1 uuid; u2 uuid;
begin
  select user_id into u1 from public.patterns where id = new.from_pattern_id;
  select user_id into u2 from public.patterns where id = new.to_pattern_id;
  if u1 is null or u2 is null or u1 <> u2 or u1 <> new.user_id then
    raise exception 'pattern_relationships: endpoints must belong to the same user'
      using errcode = '42501';
  end if;
  return new;
end $$;
create trigger pattern_relationships_same_user_guard
  before insert on public.pattern_relationships
  for each row execute function public.pattern_relationships_same_user_guard();

------------------------------------------------------------------------------
-- pattern_feedback (owner-authored, append-only)
------------------------------------------------------------------------------
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

create policy pattern_feedback_owner_select on public.pattern_feedback
  for select to authenticated using (auth.uid() = user_id);
create policy pattern_feedback_owner_insert on public.pattern_feedback
  for insert to authenticated with check (auth.uid() = user_id);

-- Append-only: no updates or deletes
create or replace function public.pattern_feedback_append_only()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'pattern_feedback is append-only' using errcode = '42501';
end $$;
create trigger pattern_feedback_no_update
  before update on public.pattern_feedback
  for each row execute function public.pattern_feedback_append_only();
create trigger pattern_feedback_no_delete
  before delete on public.pattern_feedback
  for each row execute function public.pattern_feedback_append_only();

------------------------------------------------------------------------------
-- BIBLICAL CORPUS
------------------------------------------------------------------------------

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

-- Ordinary users: read approved only. Curators: read all (including drafts) for editing.
create policy source_documents_approved_read on public.source_documents
  for select to authenticated
  using (status = 'approved');
create policy source_documents_curator_read on public.source_documents
  for select to authenticated
  using (public.current_user_has_role('curator') or public.current_user_has_role('admin'));
create policy source_documents_curator_insert on public.source_documents
  for insert to authenticated
  with check (public.current_user_has_role('curator') or public.current_user_has_role('admin'));
create policy source_documents_curator_update on public.source_documents
  for update to authenticated
  using (public.current_user_has_role('curator') or public.current_user_has_role('admin'))
  with check (public.current_user_has_role('curator') or public.current_user_has_role('admin'));

create trigger source_documents_updated_at
  before update on public.source_documents
  for each row execute function public.update_updated_at_column();

------------------------------------------------------------------------------
-- source_passages
------------------------------------------------------------------------------
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

-- Approved-source passages only for ordinary users; curators see all
create policy source_passages_approved_read on public.source_passages
  for select to authenticated using (
    exists (select 1 from public.source_documents s
            where s.id = source_id and s.status = 'approved')
  );
create policy source_passages_curator_read on public.source_passages
  for select to authenticated using (
    public.current_user_has_role('curator') or public.current_user_has_role('admin')
  );
create policy source_passages_curator_write on public.source_passages
  for all to authenticated
  using (public.current_user_has_role('curator') or public.current_user_has_role('admin'))
  with check (public.current_user_has_role('curator') or public.current_user_has_role('admin'));

------------------------------------------------------------------------------
-- source_approvals (polymorphic: source | archetype), append-only,
-- two-approver publication with last-editor exclusion enforced via trigger.
------------------------------------------------------------------------------
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

create policy source_approvals_curator_read on public.source_approvals
  for select to authenticated using (
    public.current_user_has_role('curator') or public.current_user_has_role('admin')
  );
-- Curators and admins can insert their own approval; approver_role derived server-side.
create policy source_approvals_curator_insert on public.source_approvals
  for insert to authenticated
  with check (
    approver_id = auth.uid()
    and (public.current_user_has_role('curator') or public.current_user_has_role('admin'))
    and approver_role in ('curator','admin')
  );

-- Server-derived approver_role: overwrite claimed role with the caller's real max role
create or replace function public.source_approvals_derive_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.has_role(new.approver_id, 'admin') then
    new.approver_role := 'admin';
  elsif public.has_role(new.approver_id, 'curator') then
    new.approver_role := 'curator';
  else
    raise exception 'source_approvals: approver must be curator or admin' using errcode = '42501';
  end if;
  -- Prevent last editor of the target from approving
  if new.target_type = 'source' then
    if exists (select 1 from public.source_documents s
               where s.id = new.target_id and s.last_edited_by = new.approver_id) then
      raise exception 'source_approvals: last editor cannot approve their own change'
        using errcode = '42501';
    end if;
  elsif new.target_type = 'archetype' then
    if exists (select 1 from public.biblical_archetypes a
               where a.id = new.target_id and a.last_edited_by = new.approver_id) then
      raise exception 'source_approvals: last editor cannot approve their own change'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
-- (trigger created after biblical_archetypes exists below)

create or replace function public.source_approvals_append_only()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'source_approvals is append-only' using errcode = '42501'; end $$;
create trigger source_approvals_no_update
  before update on public.source_approvals
  for each row execute function public.source_approvals_append_only();
create trigger source_approvals_no_delete
  before delete on public.source_approvals
  for each row execute function public.source_approvals_append_only();

------------------------------------------------------------------------------
-- source_audit (polymorphic, append-only)
------------------------------------------------------------------------------
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

create policy source_audit_curator_read on public.source_audit
  for select to authenticated using (
    public.current_user_has_role('curator') or public.current_user_has_role('admin')
  );
create policy source_audit_curator_insert on public.source_audit
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and (public.current_user_has_role('curator') or public.current_user_has_role('admin'))
  );

create or replace function public.source_audit_append_only()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'source_audit is append-only' using errcode = '42501'; end $$;
create trigger source_audit_no_update
  before update on public.source_audit
  for each row execute function public.source_audit_append_only();
create trigger source_audit_no_delete
  before delete on public.source_audit
  for each row execute function public.source_audit_append_only();

------------------------------------------------------------------------------
-- biblical_archetypes + archetype_mirrors + archetype_passages
------------------------------------------------------------------------------
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

create policy biblical_archetypes_approved_read on public.biblical_archetypes
  for select to authenticated using (status = 'approved');
create policy biblical_archetypes_curator_all on public.biblical_archetypes
  for all to authenticated
  using (public.current_user_has_role('curator') or public.current_user_has_role('admin'))
  with check (public.current_user_has_role('curator') or public.current_user_has_role('admin'));

create trigger biblical_archetypes_updated_at
  before update on public.biblical_archetypes
  for each row execute function public.update_updated_at_column();

-- now safe to attach the source_approvals BEFORE INSERT trigger
create trigger source_approvals_derive_role
  before insert on public.source_approvals
  for each row execute function public.source_approvals_derive_role();

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

create policy archetype_mirrors_approved_read on public.archetype_mirrors
  for select to authenticated using (
    exists (select 1 from public.biblical_archetypes a
            where a.id = archetype_id and a.status = 'approved')
  );
create policy archetype_mirrors_curator_all on public.archetype_mirrors
  for all to authenticated
  using (public.current_user_has_role('curator') or public.current_user_has_role('admin'))
  with check (public.current_user_has_role('curator') or public.current_user_has_role('admin'));

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

create policy archetype_passages_approved_read on public.archetype_passages
  for select to authenticated using (
    exists (select 1 from public.biblical_archetypes a
            where a.id = archetype_id and a.status = 'approved')
  );
create policy archetype_passages_curator_all on public.archetype_passages
  for all to authenticated
  using (public.current_user_has_role('curator') or public.current_user_has_role('admin'))
  with check (public.current_user_has_role('curator') or public.current_user_has_role('admin'));

------------------------------------------------------------------------------
-- Publication guard: promoting to 'approved' requires two distinct approvers,
-- neither being the last editor. Enforced for both source_documents and
-- biblical_archetypes.
------------------------------------------------------------------------------
create or replace function public.enforce_two_approver_publish()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  entity public.governed_entity;
  approver_count int;
  last_editor uuid;
  target_ver int;
begin
  if tg_table_name = 'source_documents' then
    entity := 'source';
    last_editor := new.last_edited_by;
    target_ver := new.version;
  else
    entity := 'archetype';
    last_editor := new.last_edited_by;
    target_ver := new.version;
  end if;

  if new.status = 'approved' and (old.status is distinct from 'approved') then
    select count(distinct approver_id) into approver_count
      from public.source_approvals
      where target_type = entity
        and target_id = new.id
        and target_version = target_ver
        and (last_editor is null or approver_id <> last_editor)
        and approver_role in ('curator','admin');
    if approver_count < 2 then
      raise exception 'publication requires two distinct qualified approvers (excluding last editor)'
        using errcode = '42501';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end $$;

create trigger source_documents_two_approver_publish
  before update on public.source_documents
  for each row execute function public.enforce_two_approver_publish();

create trigger biblical_archetypes_two_approver_publish
  before update on public.biblical_archetypes
  for each row execute function public.enforce_two_approver_publish();
