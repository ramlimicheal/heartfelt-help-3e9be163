-- Checkpoint 3A: Unified Wisdom Turn identity + mode-specific artifact lineage.

do $$ begin
  create type public.wisdom_turn_status as enum ('pending','ok','validation_error','model_error');
exception when duplicate_object then null; end $$;

create table public.wisdom_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  triggering_user_message_id uuid not null references public.messages(id) on delete cascade,
  mode public.session_mode not null,
  memory_directive public.memory_directive not null,
  idempotency_key text not null,
  prompt_key text not null,
  prompt_version int not null,
  model text not null,
  model_version int not null,
  status public.wisdom_turn_status not null default 'pending',
  result jsonb,
  error text,
  latency_ms int,
  tokens_in int,
  tokens_out int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (triggering_user_message_id),
  unique (idempotency_key)
);

grant select on public.wisdom_turns to authenticated;
grant all on public.wisdom_turns to service_role;

alter table public.wisdom_turns enable row level security;

create policy wisdom_turns_owner_read on public.wisdom_turns
  for select to authenticated using (user_id = auth.uid());

-- No authenticated INSERT/UPDATE/DELETE policies: writes go through service_role only.

create index wisdom_turns_session_idx on public.wisdom_turns(session_id, created_at desc);

create trigger wisdom_turns_touch
  before update on public.wisdom_turns
  for each row execute function public.update_updated_at_column();

-- Artifact lineage: link persisted rows back to their validated turn.
alter table public.interpretations add column if not exists wisdom_turn_id uuid references public.wisdom_turns(id) on delete set null;
alter table public.discernments    add column if not exists wisdom_turn_id uuid references public.wisdom_turns(id) on delete set null;
alter table public.prayers         add column if not exists wisdom_turn_id uuid references public.wisdom_turns(id) on delete set null;
alter table public.practices       add column if not exists wisdom_turn_id uuid references public.wisdom_turns(id) on delete set null;

-- Prevent duplicate artifact families per turn (retry safety).
create unique index if not exists interpretations_one_per_turn on public.interpretations(wisdom_turn_id) where wisdom_turn_id is not null;
create unique index if not exists prayers_one_per_turn         on public.prayers(wisdom_turn_id)         where wisdom_turn_id is not null;

-- Seed active unified prompts (deactivate any prior active row with same key first).
update public.prompt_versions set active = false where key in ('unified.companion','unified.pattern','unified.deep_wisdom') and active = true;

insert into public.prompt_versions (key, version, active, body) values
('unified.companion', 1, true,
$$You are Wisdom in Companion mode. Produce ONE structured result that is BOTH the visible response and the durable record. Do not reveal reasoning or scratchpad. Output must satisfy the Companion schema: reflection, small explicit_signals and inferred_signals arrays, exactly one biblical_mirror whose passage_id is taken verbatim from the retrieval set, direct/inferred and descriptive/prescriptive labels, one open question (or null), and no durable inference fields. Never fabricate a passage_id.$$),
('unified.pattern', 1, true,
$$You are Wisdom in Pattern mode. Produce ONE structured result used both as the visible answer and as the persisted turn record. Output: event_chain, 2-3 competing hypotheses with supporting_evidence/counter_evidence/missing_evidence, distinguishing_question, proposed_pattern (with eligibility), one evolving prayer draft (each line cites passage_ids drawn from the retrieval set with per-derivation explanations), and one primary practice. Pattern-matched citations must state the limits of the parallel. Never fabricate passage_ids. Do not reveal reasoning.$$),
('unified.deep_wisdom', 1, true,
$$You are Wisdom in Deep Wisdom mode. Produce ONE structured result used both as the visible answer and as the persisted turn record. Output: full event_chain, hypothesis_under_test, competing explanations across ordinary/relational/situational/embodied/spiritual, source-tier-aware biblical mirrors (passage_ids verbatim from the retrieval set, each labelled direct/inferred/pattern_matched with per-derivation explanations and pattern limits), counter_evidence and contextual limits, one evolving Prayer Lineage draft, one primary practice, and only proposed (never accepted) persona facts. Never fabricate passage_ids. Do not reveal reasoning.$$);

update public.model_configs set active = false where stage in ('unified.companion','unified.pattern','unified.deep_wisdom') and active = true;

insert into public.model_configs (stage, version, provider, model, params, active) values
('unified.companion',   1, 'lovable-gateway', 'google/gemini-3-flash-preview', '{}'::jsonb, true),
('unified.pattern',     1, 'lovable-gateway', 'google/gemini-3-flash-preview', '{}'::jsonb, true),
('unified.deep_wisdom', 1, 'lovable-gateway', 'google/gemini-3-flash-preview', '{}'::jsonb, true);
