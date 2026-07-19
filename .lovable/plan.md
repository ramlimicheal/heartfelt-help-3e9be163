# Wisdom — Corrected Implementation Plan (v2)

> Status: DRAFT for founder approval. No application code will be written until this plan is explicitly approved. Encoded as UTF-8.

---

## 0. Scope and Non-Negotiables

Wisdom is a Scripture-first discernment companion. Core loop: Person → Pattern → Biblical mirror → Discernment → Prayer → Practice → Fruit. The intelligence layer is a staged, server-side pipeline with structured outputs, explicit source tiering (S1–S8), and deterministic rendering. It is never a single LLM call. Nothing user-visible may introduce theological claims outside approved, cited sources.

---

## 1. Table Inventory (resolves 16/18/19 inconsistency)

Total: **24 tables** — 18 domain + 6 governance/eval/ops. All in `public` unless noted.

Domain (18):
1. `profiles`
2. `sessions`
3. `messages`
4. `signals`
5. `personas`
6. `event_chains`
7. `hypotheses`
8. `patterns`
9. `pattern_events`
10. `biblical_archetypes`
11. `archetype_mirrors`
12. `discernments`
13. `prayers`
14. `prayer_lines`
15. `practices`
16. `practice_assignments`
17. `check_ins`
18. `formation_snapshots`

Governance / eval / ops (6):
19. `user_roles` (+ `app_role` enum; anti-escalation via `has_role` SECURITY DEFINER)
20. `source_documents` (canon-tiered corpus, versioned)
21. `prompt_versions` (per-stage prompt registry, active-flag)
22. `model_configs` (per-stage model routing + fallbacks)
23. `eval_cases` (150 golden + red-team cases, with expected structured outputs)
24. `pipeline_runs` (observability: per-stage latency, tokens, cost, repairs, retrieval quality)

Guest data stays client-side (IndexedDB) with an optional short-lived `guest_sessions` shadow used only for cross-device continuity if the founder approves; default is local-only. Not counted in the 24.

---

## 2. Database Design

### 2.1 Enums

- `app_role`: `admin | curator | user`
- `source_tier`: `S1_scripture | S2_creed | S3_father | S4_reformer | S5_modern_orthodox | S6_scholar | S7_founder | S8_derived`
- `memory_status`: `active | archived | deleted`
- `pattern_status`: `proposed | confirmed | dormant | rejected`
- `hypothesis_status`: `candidate | supported | refuted | superseded`
- `discernment_stance`: `affirm | caution | redirect | lament | celebrate`
- `practice_kind`: `prayer | scripture | rule_of_life | conversation | fast | sabbath | service`
- `check_in_result`: `fruit | struggle | neutral | skipped`
- `source_status`: `draft | approved | superseded | retired`
- `run_status`: `ok | partial | failed | timeout | invalid_output`

### 2.2 Column-level design (abbreviated but complete for every table)

Standard columns on all domain tables: `id uuid pk default gen_random_uuid()`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (trigger). Ownership column `user_id uuid not null references auth.users(id) on delete cascade` unless noted.

- **profiles** — `user_id pk`, `display_name`, `canon_profile text default 'protestant_evangelical'`, `translation_pref text default 'ESV'`, `memory_enabled bool default true`, `guest_migrated_at`. Cascade: user delete → row delete.
- **sessions** — `user_id`, `title`, `intent text`, `status`. Idx: `(user_id, created_at desc)`.
- **messages** — `session_id fk sessions on delete cascade`, `user_id`, `role`, `content_text`, `redacted bool`. Idx: `(session_id, created_at)`.
- **signals** — `message_id fk on delete cascade`, `user_id`, `kind`, `value_json jsonb`, `confidence numeric(3,2) check (0<=x<=1)`. Idx GIN on `value_json`.
- **personas** — `user_id`, `name`, `relation`, `traits jsonb`, `last_seen_at`. Unique `(user_id, lower(name), relation)`.
- **event_chains** — `session_id`, `user_id`, `summary`, `nodes jsonb` (ordered events with persona refs). Idx `(user_id, created_at desc)`.
- **hypotheses** — `session_id`, `user_id`, `claim`, `status hypothesis_status`, `evidence jsonb`, `confidence`. Idx `(session_id, status)`.
- **patterns** — `user_id`, `label`, `type`, `status pattern_status`, `first_seen_at`, `last_seen_at`, `confidence`, `dormant_after interval default '90 days'`. Unique `(user_id, lower(label))`.
- **pattern_events** — `pattern_id fk on delete cascade`, `session_id`, `user_id`, `weight numeric`. Idx `(pattern_id, created_at)`.
- **biblical_archetypes** — global (no user_id), `slug unique`, `title`, `canon_profiles text[]`, `summary`, `status source_status`, `curator_id`, `version int`. Idx GIN on `canon_profiles`.
- **archetype_mirrors** — `archetype_id fk`, `pattern_type`, `narrative_fit numeric`, `citations jsonb` (S1 refs required), `status source_status`. Unique `(archetype_id, pattern_type)`.
- **discernments** — `session_id`, `user_id`, `stance`, `body`, `citations jsonb`, `prompt_version_id fk`, `model_config_id fk`.
- **prayers** — `session_id`, `user_id`, `title`, `structure text` (e.g. `ACTS`), `prompt_version_id fk`.
- **prayer_lines** — `prayer_id fk on delete cascade`, `ordinal int`, `text`, `source_ref jsonb not null` (tier + citation; enforced non-null: no source-less lines). Unique `(prayer_id, ordinal)`.
- **practices** — global library, `slug unique`, `kind practice_kind`, `title`, `body`, `status source_status`.
- **practice_assignments** — `user_id`, `practice_id fk`, `session_id`, `due_at`, `status`. Idx `(user_id, due_at)`.
- **check_ins** — `user_id`, `practice_assignment_id fk on delete cascade`, `result check_in_result`, `note`. Idx `(user_id, created_at desc)`.
- **formation_snapshots** — `user_id`, `taken_at`, `metrics jsonb`, `narrative`. Idx `(user_id, taken_at desc)`.
- **user_roles** — `user_id`, `role app_role`. Unique `(user_id, role)`. Never on profiles.
- **source_documents** — `slug`, `tier source_tier`, `title`, `author`, `license`, `body`, `embedding vector(1536)` (pgvector), `canon_profiles text[]`, `version int`, `supersedes_id fk self`, `status source_status`, `approved_by`, `approved_at`. Unique `(slug, version)`. Ivfflat idx on embedding.
- **prompt_versions** — `stage text`, `version int`, `template`, `schema_json jsonb`, `active bool`, `created_by`. Unique `(stage, version)`; partial unique `(stage) where active`.
- **model_configs** — `stage`, `primary_model`, `fallback_models text[]`, `timeout_ms`, `max_tokens`, `temperature`, `active bool`. Partial unique `(stage) where active`.
- **eval_cases** — `slug unique`, `kind` (`golden|red_team`), `input_json`, `expected_json`, `gates jsonb`.
- **pipeline_runs** — `session_id`, `stage`, `status run_status`, `latency_ms`, `tokens_in`, `tokens_out`, `cost_usd numeric`, `repairs int`, `retrieval_hits int`, `error_json jsonb`. Idx `(session_id, stage)`, `(created_at)`.

### 2.3 Indexes, retention, migration order, rollback

- Retention: `messages`, `signals`, `pipeline_runs` — 400 days default; `check_ins`, `patterns`, `formation_snapshots` — indefinite while account active; hard-delete on account delete via cascade.
- Migration order: enums → `profiles` → auth-adjacent (`user_roles`, `has_role`) → domain parents → children with FKs → governance (`source_documents`, `prompt_versions`, `model_configs`) → eval/ops → seed archetypes/practices/prompts.
- Each migration is single-transaction; rollback = paired `down` SQL captured as a sibling file; destructive changes require an approved `superseded_by` migration, never in-place edits.

---

## 3. RLS Policy Matrix

Roles: `anon`, `authenticated`, `service_role`. Helper: `public.has_role(_user_id uuid, _role app_role) returns bool security definer` (search_path=public).

| Table | anon | authenticated (self) | curator | service_role |
|---|---|---|---|---|
| profiles | none | RW own row | R all | ALL |
| sessions, messages, signals, event_chains, hypotheses, patterns, pattern_events, discernments, prayers, prayer_lines, practice_assignments, check_ins, formation_snapshots | none | RW where `user_id = auth.uid()` (child tables via parent ownership join) | R all (read-only audit) | ALL |
| personas | none | RW own | R all | ALL |
| biblical_archetypes, archetype_mirrors, practices | R where `status='approved'` | R approved | RW (insert/update draft, approve) | ALL |
| source_documents | none | R minimal fields where approved | RW | ALL |
| prompt_versions, model_configs, eval_cases | none | none | RW | ALL |
| user_roles | none | R own rows only | R all | ALL — inserts/updates ONLY by service_role; anti-escalation trigger blocks self-insert of `admin`/`curator` |
| pipeline_runs | none | none | R all | ALL |

Child-table policies use `EXISTS (select 1 from parent p where p.id = child.parent_id and p.user_id = auth.uid())` — never trust a denormalized `user_id` alone.

Anti-escalation: `before insert or update on user_roles` trigger raises unless `auth.role() = 'service_role'` OR caller `has_role(auth.uid(),'admin')`. Grants: `GRANT SELECT,INSERT,UPDATE,DELETE ON <table> TO authenticated; GRANT ALL TO service_role;` per table; `anon` grants only on approved-content tables.

Direct RLS tests (pgTAP or SQL harness) for every access class: owner-read, owner-write, cross-user-read-denied, cross-user-write-denied, curator-read, curator-write-restricted, anon-approved-only, service-role-full, escalation-blocked.

---

## 4. Intelligence Pipeline — Versioned Contracts (14 stages)

Every stage: input schema, output schema (Zod), `prompt_version_id`, `model_config_id`, evidence refs, confidence ∈ [0,1], invariants. Structured output validated → on failure, one repair attempt with schema echo → on second failure, stage returns `invalid_output` and pipeline degrades gracefully.

Stages and responsibilities (each has a Zod contract stored in `src/lib/wisdom/contracts/v1/*.ts`):

1. **intent_classification** — in: message + short history; out: `{intent: enum, confidence}`.
2. **signal_extraction** — out: `Signal[]` with `kind`, `value`, `confidence`, `source_span`.
3. **persona_retrieval_and_proposals** — out: `{matched: PersonaRef[], proposed: PersonaDraft[]}`.
4. **event_chain_construction** — out: ordered `EventNode[]` with persona refs and temporal relations.
5. **competing_hypotheses** — out: `Hypothesis[]` with `claim`, `evidence[]`, `confidence`, `status`.
6. **pattern_type_classification** — out: `{pattern_type, rationale, confidence}` constrained to controlled vocabulary.
7. **biblical_retrieval** — out: `Candidate[]` with `archetype_id`, `narrative_fit`, `citations` (S1 required); see §7.
8. **discernment** — out: `{stance, body_blocks[], citations[]}` blocks are typed (affirmation, caution, question, invitation); citations must reference retrieved candidates.
9. **response_planning** — out: `ResponsePlan` selecting which blocks to render and in what order (no free prose).
10. **prayer_composition** — out: `PrayerLine[]` each with `source_ref` (tier + citation) — invariant: no line without a source_ref.
11. **practice_selection** — out: `{practice_id, rationale, due_at}` from approved `practices` only.
12. **deterministic_rendering** — pure function over approved structured objects → UI DTO. No LLM call. See §8.
13. **feedback_processing** — in: user feedback events; out: updates to `patterns`, `hypotheses`, `personas` with `pipeline_runs` trail.
14. **formation_update** — nightly + on-check-in; out: `formation_snapshots` row + metric deltas.

Every output includes `stage`, `version`, `run_id`, `evidence_ids[]`, and passes an invariant check (e.g., `citations.every(c => c.tier==='S1_scripture')` for prayer S1 lines, `confidence` monotonic where required).

---

## 5. Runtime Boundary — TanStack `createServerFn` vs Edge Functions

Decision: **`createServerFn` (TanStack Start) fully replaces Supabase Edge Functions for all app-internal logic.** Rationale and boundaries:

- **Runtime**: Cloudflare Worker (nodejs_compat). No native deps. All Wisdom stages are pure TS + fetch to Lovable AI Gateway + Postgres via generated clients.
- **Auth**: `requireSupabaseAuth` middleware attaches per-user client; RLS enforces ownership. Public read (approved archetypes) uses a server publishable client with `TO anon` policies.
- **Authorization**: Curator/admin actions call `context.supabase.rpc('has_role', ...)` before importing `supabaseAdmin` inside the handler; admin client never used to establish that the caller is admin.
- **Secrets**: `LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` read via `process.env` inside handlers only.
- **Streaming**: Chat UI stream endpoint lives as a **server route** at `src/routes/api/wisdom/stream.ts` (raw `Response` for AI SDK `useChat`). All non-streaming stages use `createServerFn`.
- **Webhooks / cron**: `src/routes/api/public/*` with signature verification (pattern dormancy sweeper, formation nightly).
- **Rate limiting**: Token-bucket in Postgres keyed by `user_id` per stage; enforced in a shared middleware. Guests limited by IP + cookie.
- **Timeouts**: Per-stage `timeout_ms` from `model_configs` (default 15s, hard cap 25s per stage, 60s per pipeline). AbortController on gateway calls.
- **Service-role access**: Only via lazy `await import('@/integrations/supabase/client.server')` inside handler, after authorization check.

---

## 6. (folded into §4) — stage responsibilities restored above.

---

## 7. Biblical Retrieval Design

- **Query construction**: composite of pattern_type + persona relations + emotional/behavioral signals + user's `canon_profile`. Rewritten by a small deterministic template (no LLM) before embedding.
- **Filters**: `status='approved'`, `canon_profiles && ARRAY[user_profile]`, tier whitelist per stage (retrieval allows S1–S6; prayer S1 required).
- **Retrieval mode**: **Hybrid** — pgvector ANN (ivfflat, cosine) ∪ Postgres FTS on title/summary. Union then dedupe by `archetype_id`.
- **Narrative-fit scoring**: weighted (cosine 0.5, FTS rank 0.2, curator-rated `narrative_fit` 0.3). Threshold 0.55.
- **Rerank**: cross-encoder call (Lovable AI, small model) over top 20 → top 5. Rerank is optional and falls back to base score on timeout.
- **Approved-only enforcement**: retrieval SQL filter + post-check in Zod; any non-approved candidate rejected.
- **Citation verification**: every citation must resolve to an existing `source_documents` row of tier S1_scripture for Scripture refs. Bad refs discarded.
- **No valid mirror**: pipeline emits `no_mirror` outcome; discernment stage renders a "sit-with" card (§9) and no prayer citing a mirror is composed — prayer falls back to S1-only lament/petition template.

---

## 8. Deterministic Rendering

Final UI is a pure function `render(approvedDTO): ReactTree`. No LLM call after stage 11. All copy is either (a) user text, (b) approved source excerpts with citations, or (c) fixed template strings from a versioned copy deck (`src/lib/wisdom/copy/v1.ts`). Any attempt by an earlier stage to emit prose not covered by a schema block is dropped by the renderer.

---

## 9. Explicit Behaviors for Edge Cases

| Case | Behavior |
|---|---|
| Insufficient evidence | Render "Tell me more" card with 2–3 clarifying questions from template deck; no pattern/prayer emitted. |
| Ambiguous patterns | Present top 2 hypotheses side-by-side; ask user to confirm; nothing persisted as `confirmed`. |
| Contradictory evidence | Mark hypotheses `candidate`; show tension explicitly; suggest a reflective practice, not a prayer prescription. |
| No approved biblical mirror | `no_mirror` outcome → sit-with card + S1-only lament template. |
| Provider timeout/outage | Retry once with jitter, then fallback model from `model_configs.fallback_models`, then graceful "The companion is quiet right now" state; run marked `timeout`. |
| Invalid structured output | One repair attempt with schema echo; on second failure `invalid_output`, stage skipped, downstream stages that depend on it degrade or short-circuit. |
| Source-less prayer lines | Rejected at Zod boundary; prayer stage retries with S1 template; if still failing, no prayer is shown. |
| Partial-stage failure | Pipeline continues where dependencies allow; `pipeline_runs.status='partial'`; UI hides broken cards. |
| Unauthorized access | RLS denies; server functions return typed `Forbidden`; UI shows generic "not available" — no data leak. |
| Rate limiting | 429 with `Retry-After`; UI shows calm cooldown state; guests limited more strictly than authed users. |

---

## 10. Guest Session Architecture

- **Default**: fully local — IndexedDB stores `sessions`, `messages`, `signals`, and cached approved archetypes. No writes to server domain tables.
- **Server touch**: guest calls hit stateless `createServerFn` endpoints that accept the guest DTO in-request and return DTOs; no PII persisted server-side beyond `pipeline_runs` with hashed guest id and short retention (7 days).
- **Auth transition**: on sign-up, client uploads local guest data through a signed migration server function; server validates size caps, writes to owned rows, marks `profiles.guest_migrated_at`. Idempotent.
- **Retention**: guest local data persists until user clears; server-side ephemeral rows purged nightly (7d).
- **Deletion**: "Forget me" clears IndexedDB and calls a purge endpoint keyed by guest id.
- **Memory restrictions**: no `patterns`/`personas`/`formation_snapshots` for guests; only single-session reasoning.

---

## 11. Source Governance

- **Canon profiles**: enum-like text set (`protestant_evangelical`, `reformed`, `anglican`, `catholic`, `orthodox`, `nondenominational`); user-selectable; drives retrieval filter.
- **Bible translation**: default **WEB** (public domain) for shipping; **ESV** allowed only after licensing is confirmed by founder. Translation choice stored on `profiles.translation_pref`; renderer maps citation → chosen translation.
- **Versioning**: every `source_documents` row is `(slug, version)`; edits create a new version and set `supersedes_id`; old version status → `superseded`.
- **Founder corpus (S7)**: same governance path as other tiers; never bypasses approval; never shown without citation.
- **Curator approval**: `status` transitions `draft → approved` require `has_role('curator')`; approval writes `approved_by`, `approved_at`, immutable audit row in `pipeline_runs`-style `source_audit` (add if founder wants full audit trail — see §18 assumptions).
- **Supersede / retire**: retire sets status `retired`, retrieval excludes; existing citations remain valid but flagged.
- **Theological review**: two-curator sign-off required for S1–S3; single curator for S4–S8.

---

## 12. Prompt & Model Ops

- **Storage**: `prompt_versions` table (§2). Templates parameterized with `{{...}}`; schemas embedded.
- **Active selection**: partial unique index on `(stage) where active` guarantees exactly one active per stage.
- **Model config**: `model_configs` with primary + ordered fallbacks, `timeout_ms`, `max_tokens`, `temperature`.
- **Defaults**: chat/reasoning stages → `google/gemini-3-flash-preview`; rerank → small model; embeddings → Lovable AI embeddings model.
- **Latency targets**: p50 pipeline < 6s, p95 < 12s; per-stage budgets in `model_configs`.
- **Cost estimates**: tracked in `pipeline_runs.cost_usd`; daily rollup dashboard.
- **Eval before activation**: new prompt/model version must pass all 150 golden cases at ≥ current baseline and no red-team regressions before `active=true` flip; enforced by a curator server function.
- **Rollback**: flip `active` back to prior version (single SQL update); guarded by admin role.

---

## 13. Test Matrix

- **Unit**: pure functions (contracts, renderer, retrieval scoring, template deck).
- **Structured-output**: Zod round-trip + repair-loop tests per stage.
- **Pipeline integration**: full pipeline against fixtures; asserts stage graph + invariants.
- **RLS**: pgTAP for every access class in §3.
- **Browser journeys** (Playwright): guest → session → sign-up → migration; owner-only visibility; curator approve flow; no-mirror flow.
- **Golden cases**: 150 canonical inputs with expected structured outputs and rendered blocks.
- **Red-team**: prompt injection, jailbreak-to-uncited-claim, cross-user data probes, role escalation.
- **Accessibility**: axe on every route; keyboard-only journey; reduced-motion.
- **Migration**: up/down on ephemeral DB; seed reproducibility.
- **Failure recovery**: timeout, invalid output, provider outage, partial pipeline.

---

## 14. Stage Acceptance Criteria (measurable)

- **Stage A (Foundation)**: Lighthouse a11y ≥ 95; TS strict clean; design tokens only (no raw hex in components); routes render < 100ms TTI on preview.
- **Stage B (Static + mocks)**: 100% of UI blocks render from typed DTOs; renderer has zero LLM calls (grep gate in CI).
- **Stage C (Backend)**: all 24 tables migrated; pgTAP RLS suite green; grants present on every public table; anti-escalation trigger test green.
- **Stage D (Vertical slice)**: end-to-end "helping without boundaries" case passes golden test; p95 pipeline < 12s; prayer-lineage coverage = 100%; no uncited claims (red-team subset green).
- **Stage E (Memory/pattern lifecycle)**: dormancy sweeper correctness on fixtures; pattern confirm/reject audited.
- **Stage F (Formation Timeline)**: snapshot job idempotent; metrics match hand-computed fixtures.
- **Stage G (Curator tools)**: approval flow gated; version bump creates new row; retrieval excludes retired within one cache TTL.
- **Global intelligence gates (PRD)**: golden accuracy ≥ 0.85; grounding ≥ 0.95; refusal correctness on red-team ≥ 0.98; zero source-less prayer lines.

---

## 15. Archetype Corpus Ramp

- **Launch of vertical slice**: 8–10 deeply curated archetypes covering the first pattern family (helping/boundaries/anger/anxiety/shame/comparison/control/despair/pride/loneliness).
- **Path to 40–60 before MVP**: weekly curator cohort (2 curators × 5 archetypes/week × 6 weeks) with two-curator sign-off for S1–S3; retrieval quality regression run after each batch; no batch merges without golden+red-team pass. Corpus growth is gated by review capacity, never by product timeline.

---

## 16. Privacy Ops

- **Minimization**: only stage-necessary fields sent to provider; PII redaction pass before gateway call (names → tokens, contact info stripped).
- **Export**: `/you/export` server function returns full user JSON.
- **Disable memory**: `profiles.memory_enabled=false` short-circuits pattern/persona/formation writes.
- **Deletion**: soft-delete flags for reversible UI actions; hard-delete on account delete via `on delete cascade` + nightly purge of orphaned pipeline_runs.
- **Purge schedule**: daily 03:00 UTC (guest ephemeral, pipeline_runs > 400d, soft-deleted > 30d).
- **Sensitive logging**: no message bodies in logs; only ids, tokens, timings; provider requests logged with hashed prompt fingerprint.
- **Provider context**: rolling window of last N turns capped by tokens; system prompts versioned and stored; never send other users' data.

---

## 17. Observability

- `pipeline_runs` powers dashboards: per-stage latency (p50/p95), failure rate, validation repairs, tokens in/out, cost, retrieval hits, rerank use, prayer-lineage coverage %, pattern accept/reject ratio.
- Structured error taxonomy (`error_json.code`).
- Alerting thresholds: p95 latency, failure rate > 2%, cost per session > budget, grounding gate regression.

---

## 18. Assumptions, Risks, Founder Decisions, Approval Checklist

### Assumptions
- Lovable AI Gateway covers chat, embeddings, and rerank at required latency.
- pgvector is available on the managed Postgres.
- WEB translation acceptable for launch; ESV pending licensing.
- Curator capacity: 2 curators available for 6 weeks pre-MVP.

### Unresolved risks
- Rerank model latency variance.
- Guest→auth migration size caps and abuse.
- Founder-corpus (S7) governance load.
- Cost per session at scale under hybrid retrieval + rerank.

### Founder Decisions Required Before Prompt 1
1. Approve 24-table inventory (§1).
2. Approve Bible translation strategy (WEB default, ESV pending) (§11).
3. Approve canon-profile default (`protestant_evangelical`) (§11).
4. Approve guest strategy: **local-only** vs **local + 7-day ephemeral server shadow** (§10).
5. Approve curator model: two-curator sign-off S1–S3, single S4–S8 (§11).
6. Approve intelligence quality gates (§14 global).
7. Approve retention windows (§16).
8. Confirm rerank stage is in-scope for MVP (§7).

### Approval Checklist (tick before Prompt 1 executes)
- [ ] Table inventory and enums approved
- [ ] RLS matrix approved
- [ ] Stage contracts v1 approved
- [ ] Runtime boundary (createServerFn everywhere; stream route + public webhooks) approved
- [ ] Retrieval design (hybrid + rerank + narrative-fit threshold) approved
- [ ] Deterministic renderer rule approved (no post-stage-11 LLM)
- [ ] Edge-case behaviors approved
- [ ] Guest architecture approved
- [ ] Source governance approved (including translation)
- [ ] Prompt/model ops approved
- [ ] Test matrix and acceptance gates approved
- [ ] Archetype ramp plan approved
- [ ] Privacy ops approved
- [ ] Observability plan approved
- [ ] Founder decisions §18 answered

No code will be written until every box above is ticked.
