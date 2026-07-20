
-- ============================================================
-- Batch 4a: Wisdom core domain (14 tables)
-- ============================================================

do $$ begin create type public.prayer_mode as enum ('concise','full','guided','journal');
exception when duplicate_object then null; end $$;

do $$ begin create type public.practice_kind as enum (
  'boundary','confession','forgiveness','restitution','reconciliation',
  'silence','scripture_meditation','journaling','accountability',
  'environmental_change','service','waiting','gratitude','fasting_reflection');
exception when duplicate_object then null; end $$;

do $$ begin create type public.practice_assignment_status as enum
  ('pending','committed','completed','skipped','abandoned');
exception when duplicate_object then null; end $$;

do $$ begin create type public.discernment_kind as enum
  ('context_note','direct_vs_inferred','descriptive_vs_prescriptive',
   'counter_evidence','distinguishing_question','tension');
exception when duplicate_object then null; end $$;

do $$ begin create type public.category_verdict as enum ('accepted','rejected','unsure','deferred');
exception when duplicate_object then null; end $$;

do $$ begin create type public.pipeline_mode as enum ('companion','wisdom','curse_breaker');
exception when duplicate_object then null; end $$;

do $$ begin create type public.pipeline_run_status as enum ('ok','error','skipped');
exception when duplicate_object then null; end $$;

create or replace function public.append_only_guard()
returns trigger language plpgsql set search_path = public as $$
begin raise exception '% is append-only', tg_table_name using errcode='42501'; end $$;

-- 1. interpretations
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
create policy interpretations_owner_all on public.interpretations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index interpretations_session_idx on public.interpretations(session_id);

-- 2. stronghold_categories
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
create policy stronghold_categories_owner_all on public.stronghold_categories
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger stronghold_categories_updated_at before update on public.stronghold_categories
  for each row execute function public.update_updated_at_column();

create or replace function public.stronghold_categories_deep_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.deep_analyzed and jsonb_array_length(coalesce(new.citations,'[]'::jsonb)) < 1 then
    raise exception 'stronghold_categories: deep_analyzed=true requires ≥1 citation';
  end if;
  return new;
end $$;
create trigger stronghold_categories_deep before insert or update on public.stronghold_categories
  for each row execute function public.stronghold_categories_deep_guard();

-- 3. stronghold_category_approvals (append-only)
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
create policy sca_owner_read on public.stronghold_category_approvals
  for select to authenticated using (auth.uid() = user_id);
create policy sca_owner_insert on public.stronghold_category_approvals
  for insert to authenticated with check (auth.uid() = user_id);
create trigger sca_no_update before update on public.stronghold_category_approvals
  for each row execute function public.append_only_guard();
create trigger sca_no_delete before delete on public.stronghold_category_approvals
  for each row execute function public.append_only_guard();

create or replace function public.sca_ownership_guard()
returns trigger language plpgsql set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.stronghold_categories where id = new.category_id;
  if owner is distinct from new.user_id then
    raise exception 'stronghold_category_approvals: user must own the category';
  end if;
  return new;
end $$;
create trigger sca_ownership before insert on public.stronghold_category_approvals
  for each row execute function public.sca_ownership_guard();

-- 4. discernments
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
create policy discernments_owner_all on public.discernments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index discernments_session_idx on public.discernments(session_id);

-- 5. prayers
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
create policy prayers_owner_all on public.prayers
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger prayers_updated_at before update on public.prayers
  for each row execute function public.update_updated_at_column();
create index prayers_session_idx on public.prayers(session_id);

-- 6. prayer_lines
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
create policy prayer_lines_owner_all on public.prayer_lines
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7. prayer_line_sources
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
create policy pls_owner_all on public.prayer_line_sources
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index pls_line_idx on public.prayer_line_sources(prayer_line_id);

create or replace function public.prayers_finalize_guard()
returns trigger language plpgsql set search_path = public as $$
declare missing int;
begin
  if new.finalized_at is not null
     and (old.finalized_at is null or old.finalized_at is distinct from new.finalized_at) then
    select count(*) into missing
    from public.prayer_lines pl
    left join public.prayer_line_sources s on s.prayer_line_id = pl.id
    where pl.prayer_id = new.id
    group by pl.id
    having count(s.id) = 0;
    if missing is not null and missing > 0 then
      raise exception 'prayers: every prayer_line must have ≥1 source before finalization';
    end if;
  end if;
  return new;
end $$;
create trigger prayers_finalize before update on public.prayers
  for each row execute function public.prayers_finalize_guard();

-- 8. practices
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
create policy practices_owner_all on public.practices
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create unique index practices_one_primary_per_session
  on public.practices(session_id) where is_primary;

-- 9. practice_assignments
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
create policy pa_owner_all on public.practice_assignments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger pa_updated_at before update on public.practice_assignments
  for each row execute function public.update_updated_at_column();

-- 10. formation_events (append-only)
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
create policy fe_owner_read on public.formation_events
  for select to authenticated using (auth.uid() = user_id);
create policy fe_owner_insert on public.formation_events
  for insert to authenticated with check (auth.uid() = user_id);
create trigger fe_no_update before update on public.formation_events
  for each row execute function public.append_only_guard();
create trigger fe_no_delete before delete on public.formation_events
  for each row execute function public.append_only_guard();
create index fe_user_at_idx on public.formation_events(user_id, at desc);

-- 11. check_ins
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
create policy check_ins_owner_all on public.check_ins
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 12. prompt_versions
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
create policy prompt_versions_read on public.prompt_versions
  for select to authenticated using (true);
create policy prompt_versions_admin_write on public.prompt_versions
  for all to authenticated
  using (public.current_user_has_role('admin'))
  with check (public.current_user_has_role('admin'));
create unique index prompt_versions_one_active_per_key
  on public.prompt_versions(key) where active;

-- 13. model_configs
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
create policy model_configs_read on public.model_configs
  for select to authenticated using (true);
create policy model_configs_admin_write on public.model_configs
  for all to authenticated
  using (public.current_user_has_role('admin'))
  with check (public.current_user_has_role('admin'));
create unique index model_configs_one_active_per_stage
  on public.model_configs(stage) where active;

-- 14. pipeline_runs
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
create policy pipeline_runs_owner_read on public.pipeline_runs
  for select to authenticated using (auth.uid() = user_id);
create unique index pipeline_runs_idempotency_uniq
  on public.pipeline_runs(idempotency_key) where idempotency_key is not null;
create index pipeline_runs_session_idx on public.pipeline_runs(session_id, created_at desc);
