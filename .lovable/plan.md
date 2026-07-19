# Wisdom MVP — Implementation Plan v3

> Status: DRAFT for founder approval. No application code will be written until the approval checklist in §20 is fully ticked. File is UTF-8; no mojibake sequences.

---

## 0. Scope and Non-Negotiables

Wisdom is a Scripture-first discernment companion. Core loop: Person → Pattern → Biblical mirror → Discernment → Prayer → Practice → Fruit. The intelligence layer is a staged, server-side pipeline with structured outputs, explicit PRD source tiers (S1–S8), and deterministic rendering — never a single LLM call. Nothing user-visible may introduce theological claims outside approved, cited sources.

**Curse Breaker** ships as a first-class MVP mode alongside the general Companion mode. Its internal intelligence module is the **Stronghold Discernment Engine (SDE)**. Wisdom must not reduce every curse claim to psychology, and must not automatically declare a person or family cursed. Every conclusion carries evidence, counter-evidence, missing evidence, biblical support, source tier, confidence, and alternative explanations.

---

## 1. Source Constitution (PRD tiers, verbatim)

Source tiers used across retrieval, discernment, prayer lineage, and curator review:

- **S1 — Canonical direct text** (Scripture, in the user's canon profile)
- **S2 — Canonical synthesis** (cross-canon synthesis constrained to S1 material)
- **S3 — Linguistic or historical context** (lexical, grammatical, cultural background)
- **S4 — Recognized theological interpretation** (approved interpretive tradition)
- **S5 — Extra-canonical ancient text** (Second Temple, patristic-era, non-canonical antiquity)
- **S6 — Founder framework** (Wisdom founder's approved teaching frames)
- **S7 — Modern analogy** (contemporary illustration, curator-approved)
- **S8 — Model hypothesis** (LLM-generated candidate; never rendered as claim without promotion)

Tradition (`reformed`, `anglican`, `catholic`, `orthodox`, `nondenominational`, `founder`, etc.) and historical period (`patristic`, `medieval`, `reformation`, `modern`, etc.) are **separate metadata fields** on every source row. Tiers are not tradition labels.

---

## 2. Canon Profiles (PRD)

- **`founder_default`** — the founder's curated canon for Wisdom's out-of-the-box behavior.
- **`protestant_66`** — Protestant 66-book canon.
- **`ethiopian_orthodox_tewahedo_research`** — research profile including the broader Tewahedo canon.
- **`comparative_early_christian_literature`** — research profile spanning early-Christian literature outside any single canon.

Catholic, Eastern Orthodox, and other tradition profiles are explicitly out-of-scope for MVP and can be added later without schema change (canon profile is a text key). Tradition ≠ canon membership; both are tracked independently.

---

## 3. Table Inventory

Total: **31 tables** in `public`. Grouped by concern.

Identity & governance (4): `profiles`, `user_roles`, `admin_audit`, `source_audit`.

Session I/O (3): `sessions`, `messages`, `signals`.

Persona graph (2): `personas`, `persona_facts`.

Pattern graph (5): `patterns`, `pattern_events`, `pattern_evidence`, `pattern_relationships`, `pattern_feedback`.

Curse Breaker / SDE (2): `interpretations`, `stronghold_categories`.

Biblical & practice corpus (6): `source_documents`, `source_passages`, `biblical_archetypes`, `archetype_mirrors`, `practices`, `practice_assignments`.

Discernment & prayer (4): `discernments`, `prayers`, `prayer_lines`, `prayer_line_sources`.

Formation & feedback (2): `formation_events`, `check_ins`.

Ops (3): `prompt_versions`, `model_configs`, `pipeline_runs`.

Evaluation (2): `eval_cases`, `eval_runs` (+ `eval_results` as child of `eval_runs`, counted with it here as one logical eval store; broken out physically as two tables → makes physical count **32**). Physical count used from here on: **32 tables**.

Guest data stays client-side (IndexedDB); optional 7-day ephemeral shadow is a founder decision (§20).

---

## 4. Database Design

### 4.1 Enums

- `app_role` = `admin | curator | user | support`
- `source_tier` = `S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8`
- `tradition` = free text with a controlled vocabulary check (`founder`, `protestant_evangelical`, `reformed`, `anglican`, `catholic_roman`, `orthodox_eastern`, `orthodox_oriental`, `pentecostal`, `nondenominational`, `academic_neutral`, …)
- `period` = `biblical | second_temple | patristic | medieval | reformation | early_modern | modern | contemporary`
- `canon_profile` = `founder_default | protestant_66 | ethiopian_orthodox_tewahedo_research | comparative_early_christian_literature`
- `source_status` = `draft | approved | superseded | retired`
- `session_mode` = `companion | pattern | deep_wisdom | curse_breaker`
- `persona_fact_status` = `session_only | proposed | accepted | rejected | sensitive | deleted`
- `pattern_status` = `proposed | exploring | accepted | rejected | improving | recurring | resolved | archived`
- `pattern_relation` = `causes | reinforces | triggers | masks | contradicts | shares_root_with | occurs_after | improves_with | worsens_in | replaced_by`
- `hypothesis_status` = `candidate | supported | refuted | superseded`
- `interpretation_category` (SDE, 14 independent layers):
  `chosen_behavior | habit | appetite | belief | shame | hidden_agreement | relationship_pressure | social_normalization | family_learning | generational_repetition | material_conditions | spiritual_practice_absence | user_reported_spiritual_conflict | direct_biblical_curse_or_stronghold`
- `prayer_movement` = `repentance | confession | renunciation | forgiveness | deliverance | restoration | blessing | identity_in_christ | obedience`
- `derivation_type` = `direct_quote | paraphrase | allusion | thematic_echo | pastoral_synthesis | founder_frame | model_composition`
- `formation_event_type` = `story_shared | pattern_proposed | pattern_accepted | pattern_edited | pattern_rejected | prayer_created | prayer_edited | practice_selected | checkin_completed | setback_recorded | fruit_observed | pattern_confidence_changed | pattern_archived`
- `check_in_result` = `fruit | struggle | neutral | skipped | setback`
- `run_status` = `ok | partial | failed | timeout | invalid_output`
- `eval_dimension` = `grounding | citation_validity | category_coverage | refusal_correctness | pastoral_tone | prayer_lineage_coverage | pattern_precision | pattern_recall | latency | cost | safety`

### 4.2 Standard columns

Every domain row: `id uuid pk default gen_random_uuid()`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (trigger). Owner-scoped rows: `user_id uuid not null references auth.users(id) on delete cascade`.

**Idempotency**: every write-producing pipeline stage accepts an `idempotency_key text` and persists it uniquely per `(user_id, table, key)` — retries never duplicate prayers, patterns, formation events, interpretations, or assignments.

### 4.3 Table-by-table (columns, keys, indexes, retention)

- **profiles** — `user_id pk`, `display_name`, `canon_profile canon_profile default 'founder_default'`, `translation_pref text default 'WEB'`, `memory_enabled bool default true`, `guest_migrated_at`. Retention: while account exists; cascade delete.
- **user_roles** — `user_id`, `role app_role`, unique `(user_id, role)`. Anti-escalation trigger.
- **admin_audit** — append-only. `actor_id`, `action`, `target jsonb`, `reason`, `ip_hash`. Mandatory.
- **source_audit** — append-only. `actor_id (curator)`, `source_document_id`, `from_status`, `to_status`, `diff jsonb`. Mandatory.
- **sessions** — `user_id`, `title`, `mode session_mode`, `status`. Idx `(user_id, created_at desc)`.
- **messages** — `session_id fk cascade`, `user_id`, `role`, `content_text`, `redacted bool`. Idx `(session_id, created_at)`.
- **signals** — `message_id fk cascade`, `user_id`, `kind`, `value jsonb`, `confidence numeric(3,2)`. GIN idx on `value`.
- **personas** — `user_id`, `label`, `relation`, `last_seen_at`. Unique `(user_id, lower(label), relation)`. Names/relations only; facts live in `persona_facts`.
- **persona_facts** — `persona_id fk cascade`, `user_id`, `fact_text`, `evidence jsonb` (array of `{message_id, span}`), `source_message_ids uuid[]`, `confidence numeric(3,2)`, `sensitivity text` (`normal|sensitive|hidden`), `status persona_fact_status`, `user_verdict text` (`unset|accepted|rejected|redacted`), `first_seen_at`, `last_seen_at`. Idx `(persona_id, status)`. Retention: `session_only` purged at session end; `deleted` hard-purged nightly.
- **patterns** — `user_id`, `label`, `pattern_type`, `status pattern_status`, `pattern_scope text` (`personal|family|generational|communal`), `first_seen_at`, `last_seen_at`, `confidence`, `dormant_after interval default '90 days'`. Unique `(user_id, lower(label))`.
- **pattern_events** — `pattern_id fk cascade`, `session_id`, `user_id`, `generation_offset int` (0 self, negative = ancestor, positive = descendant), `weight numeric`. Idx `(pattern_id, created_at)`.
- **pattern_evidence** — `pattern_id fk cascade`, `user_id`, `kind text` in (`supporting|counter|missing|hidden_agreement_candidate`), `text`, `source_message_ids uuid[]`, `domain text`, `trigger text`, `need text`, `reward text`, `cost text`, `people jsonb`, `environments jsonb`. Idx `(pattern_id, kind)`. **Rejected-as-negative-constraint** evidence lives here with `kind='counter'` and is never merged into accepted factual context used by downstream stages.
- **pattern_relationships** — `from_pattern_id`, `to_pattern_id`, `relation pattern_relation`, `confidence`, `evidence jsonb`. Unique `(from_pattern_id, to_pattern_id, relation)`.
- **pattern_feedback** — `pattern_id fk cascade`, `user_id`, `verdict text` (`confirm|refine|reject`), `note`, `outcome text` (`fruit|struggle|neutral|setback`). Feeds `formation_events`.
- **interpretations** (SDE) — `session_id fk`, `user_id`, `category interpretation_category`, `confidence numeric(3,2)`, `supporting_evidence jsonb`, `counter_evidence jsonb`, `missing_evidence jsonb`, `alternative_explanations jsonb`, `source_refs jsonb` (tier + passage refs), `pastoral_notes jsonb`, `status hypothesis_status`. Unique `(session_id, category)` — every session enumerates all 14 categories, even at zero confidence.
- **stronghold_categories** — global curator-owned taxonomy for the 14 categories; anchors (S1–S5), discerning questions, non-anchors (what this category is *not*), `status source_status`, `version int`.
- **source_documents** — `slug`, `tier source_tier`, `tradition tradition`, `period period`, `canon_profiles canon_profile[]`, `title`, `author`, `license`, `version int`, `supersedes_id`, `status source_status`, `approved_by`, `approved_at`. Unique `(slug, version)`.
- **source_passages** — passage-level rows. `source_document_id fk`, `translation text` (e.g. `WEB`), `canon_profile canon_profile`, `reference text` (e.g. `Deut 28:15-19`), `book text`, `chapter int`, `verse_start int`, `verse_end int`, `body text`, `embedding vector(1536)`. Ivfflat + FTS indexes. Citations resolve here, not to document-level JSON.
- **biblical_archetypes** — global. `slug unique`, `title`, `summary`, `canon_profiles canon_profile[]`, `status source_status`, `version int`.
- **archetype_mirrors** — `archetype_id fk`, `pattern_type`, `category_map jsonb` (interpretation_category → narrative_fit), `passage_refs jsonb` (array of `{source_passage_id, weight}`), `status source_status`. Unique `(archetype_id, pattern_type)`.
- **practices** — global library. `slug unique`, `kind text`, `title`, `body`, `category_tags interpretation_category[]`, `status source_status`.
- **practice_assignments** — `user_id`, `practice_id`, `session_id`, `due_at`, `status`, `idempotency_key`. Idx `(user_id, due_at)`.
- **discernments** — `session_id`, `user_id`, `stance`, `blocks jsonb` (typed blocks), `citations jsonb` (array of `{source_passage_id, tier}`), `prompt_version_id`, `model_config_id`, `idempotency_key`.
- **prayers** — `session_id`, `user_id`, `title`, `structure text` (e.g. `ACTS`, `lineage`), `mode session_mode`, `prompt_version_id`, `idempotency_key`.
- **prayer_lines** — `prayer_id fk cascade`, `ordinal int`, `text`, `movement prayer_movement not null`, `user_edited bool default false`, `edited_text text`, `confidence numeric(3,2)`. Unique `(prayer_id, ordinal)`.
- **prayer_line_sources** (normalized many-to-many) — `prayer_line_id fk cascade`, `source_passage_id fk`, `derivation derivation_type not null`, `explanation text not null`, `tier source_tier not null`, `weight numeric`. Unique `(prayer_line_id, source_passage_id, derivation)`. **A prayer line must have ≥1 row here or it fails validation and is not rendered.**
- **formation_events** — append-only. `user_id`, `event_type formation_event_type`, `payload jsonb`, `related_pattern_id`, `related_prayer_id`, `related_practice_id`, `idempotency_key`. Idx `(user_id, created_at desc)`. No UPDATE, no DELETE (except full account deletion cascade). Snapshots are a derived read model, not a replacement.
- **check_ins** — `user_id`, `practice_assignment_id fk cascade`, `result check_in_result`, `note`. Emits a `formation_event` (`checkin_completed`, `fruit_observed`, or `setback_recorded`).
- **prompt_versions** — `stage`, `version int`, `template`, `schema_json`, `active bool`, `created_by`. Partial unique `(stage) where active`.
- **model_configs** — `stage`, `primary_model`, `fallback_models text[]`, `timeout_ms`, `max_tokens`, `temperature`, `active bool`. Partial unique `(stage) where active`.
- **pipeline_runs** — `session_id`, `stage`, `status run_status`, `latency_ms`, `tokens_in`, `tokens_out`, `cost_usd numeric`, `repairs int`, `retrieval_hits int`, `error jsonb`. Idx `(session_id, stage)`.
- **eval_cases** — `slug unique`, `kind` (`golden|red_team`), `mode session_mode`, `input jsonb`, `expected jsonb`, `gates jsonb`.
- **eval_runs** — `prompt_version_id`, `model_config_id`, `started_at`, `finished_at`, `summary jsonb`.
- **eval_results** — `eval_run_id fk cascade`, `eval_case_id fk`, `dimension eval_dimension`, `score numeric`, `passed bool`, `details jsonb`.

### 4.4 Retention, migration order, rollback

- Retention: `messages`, `signals`, `pipeline_runs`, `eval_results` — 400 days; `formation_events`, `patterns`, `interpretations` — indefinite while account active. `persona_facts.status='deleted'` and `session_only` purged nightly. Hard delete on account deletion via cascade.
- Migration order: enums → identity/governance → session I/O → persona graph → pattern graph → SDE → corpus (documents/passages/archetypes/mirrors/practices) → discernment/prayer/formation → ops → evaluation → seeds.
- Rollback: each migration is single-transaction with a paired `down` file. Destructive schema changes go through a superseding migration; never in-place mutation of prior migrations.

---

## 5. RLS Policy Matrix

Roles: `anon`, `authenticated`, `user`, `curator`, `admin`, `support`, `service_role`. Helper: `has_role(_user_id uuid, _role app_role) security definer`.

**Curators have NO read access to any private user data.** This is the single most important RLS rule in the system.

| Table | anon | authenticated (self) | curator | admin | support | service_role |
|---|---|---|---|---|---|---|
| profiles | none | RW own | **none** | none | conditional (see below) | ALL |
| sessions, messages, signals | none | RW own | **none** | none | conditional | ALL |
| personas, persona_facts | none | RW own | **none** | none | conditional | ALL |
| patterns, pattern_events, pattern_evidence, pattern_relationships, pattern_feedback | none | RW own | **none** | none | conditional | ALL |
| interpretations | none | RW own | **none** | none | conditional | ALL |
| discernments, prayers, prayer_lines, prayer_line_sources | none | RW own (child via parent join) | **none** | none | conditional | ALL |
| practice_assignments, check_ins, formation_events | none | RW own (formation_events INSERT-only from server) | **none** | none | conditional | ALL |
| stronghold_categories, biblical_archetypes, archetype_mirrors, practices | R approved | R approved | RW draft/approve | R | R | ALL |
| source_documents, source_passages | none | R minimal fields where approved | RW | R | R | ALL |
| prompt_versions, model_configs, eval_cases, eval_runs, eval_results | none | none | RW eval + prompts | R | none | ALL |
| user_roles | none | R own | R | RW via server fn only (anti-escalation trigger) | none | ALL |
| admin_audit, source_audit | none | none | R source_audit only | R | R own actions | ALL |
| pipeline_runs | none | none | R (aggregate only via views; no message payloads) | R | none | ALL |

**"Conditional support access"** is not a normal RLS grant. It is implemented as: (a) explicit user consent record with expiry; (b) time-boxed token minted by an admin server function; (c) every access writes to `admin_audit`. In steady-state RLS, `support` has `none` on user-owned tables; the access token elevates through a `has_support_grant(user_id)` SECURITY DEFINER check.

Child ownership is always resolved via `EXISTS (select 1 from parent p where p.id = child.parent_id and p.user_id = auth.uid())` — never a denormalized `user_id` alone.

Grants: `GRANT SELECT,INSERT,UPDATE,DELETE ON <table> TO authenticated; GRANT ALL TO service_role;` on every public table. `anon` grants only on approved-corpus tables.

---

## 6. Intelligence Pipeline — Versioned Contracts

Every stage has a Zod contract in `src/lib/wisdom/contracts/v1/**`. Structured output validated → one repair attempt on failure → second failure returns `invalid_output` and pipeline degrades gracefully.

### 6.1 Companion / Pattern / Deep Wisdom modes (shared stages)

1. `intent_classification`
2. `signal_extraction`
3. `persona_retrieval_and_fact_proposals` (writes to `persona_facts` with `status='proposed'`)
4. `event_chain_construction`
5. `competing_hypotheses`
6. `pattern_type_classification`
7. `biblical_retrieval` (see §7)
8. `discernment`
9. `response_planning`
10. `prayer_composition` (emits `prayer_lines` + `prayer_line_sources`)
11. `practice_selection`
12. `deterministic_rendering` (see §8)
13. `feedback_processing`
14. `formation_update` (appends to `formation_events`)

### 6.2 Curse Breaker mode — exact stages

**Flow**: Repeated experience → event/generational pattern → possible root → biblical curse/stronghold categories → competing explanations → discernment → Prayer Lineage → one pattern-breaking act → formation check-in.

Stages (executed in this order, gated by `session.mode='curse_breaker'`):

1. `cb_intent_and_consent` — confirms Curse Breaker mode, records consent, sets pastoral tone.
2. `cb_repeated_experience_extraction` — extracts recurrences and their contexts.
3. `cb_event_generational_pattern_construction` — assembles events and generational offsets into a chain.
4. `cb_possible_root_generation` — generates candidate roots with evidence.
5. `cb_stronghold_category_hypothesis_generation` — emits one `Interpretation` per **14 categories** in §4.1 (exhaustive; zero-confidence categories included with `missing_evidence`).
6. `cb_competing_explanations_analysis` — produces `Tension[]` across categories, including alternative explanations for each.
7. `cb_biblical_retrieval_curse_stronghold` — retrieval scoped to curse/stronghold archetypes + user's canon profile (§7).
8. `cb_discernment` — per-category "supports / counters / missing / alternatives" plus overall pastoral stance; refuses to collapse categories and refuses blanket verdicts.
9. `cb_prayer_lineage_composition` — emits `prayer_lines` grouped by `prayer_movement` (repentance, confession, renunciation, forgiveness, deliverance, restoration, blessing, identity_in_christ, obedience); each line normalized into `prayer_line_sources`.
10. `cb_pattern_breaking_act_selection` — exactly one practice from approved library, tagged with the categories it addresses and the rationale.
11. `cb_deterministic_render`
12. `cb_formation_checkin_scheduling` — schedules and later ingests the check-in, appending `formation_events`.

Curse Breaker never renders a bare "you are cursed" or bare "this is just psychology" statement; both are red-team gated (§13).

---

## 7. Biblical Retrieval

- Query construction: pattern_type + persona relations + signals + user's `canon_profile` + (SDE) target interpretation categories. Deterministic template rewrite before embedding.
- Filters: `status='approved'`, `canon_profile` membership, tier whitelist per stage (retrieval S1–S6; prayer requires ≥1 S1 line per lineage).
- Retrieval: **hybrid** — pgvector ANN over `source_passages.embedding` ∪ Postgres FTS on passage body/title. Dedupe per `source_passage_id`.
- Narrative-fit scoring: weighted (cosine 0.5, FTS rank 0.2, curator-rated fit 0.3); threshold 0.55.
- Rerank: small cross-encoder over top-20 → top-5; falls back to base score on timeout.
- Citation verification: every citation resolves to a `source_passages` row with matching `translation` and `canon_profile`. Bad refs discarded.
- No-valid-mirror behavior: pipeline emits `no_mirror` outcome; renderer shows a "sit with this" card; prayer falls back to S1-only lament/petition templates.

---

## 8. Deterministic Rendering

Post-stage-11 UI is a pure function `render(approvedDTO) → ReactTree`. No LLM call after rendering begins. All copy is: (a) user text, (b) approved source excerpts with citations, or (c) fixed strings from a versioned copy deck. Any DTO that fails Zod invariants (e.g. a prayer line missing `prayer_line_sources`, or a Curse Breaker discernment with fewer than 14 categories) is refused by the renderer.

---

## 9. Curse Breaker UI Cards

Rendered deterministically from approved DTOs:

- **Repeated Experience** — timeline with generational offsets.
- **Possible Roots** — condensed root hypotheses.
- **Fourteen-Category Discernment Grid** — one row per category: confidence bar, top supporting citation (tier chip + passage), top counter, missing evidence, alternative explanations.
- **Competing Explanations** — cross-category tensions in plain language.
- **Biblical Mirrors** — approved archetypes with passage-level citations.
- **Prayer Lineage** — grouped by `prayer_movement`; per-line citation chips (tier + passage) with derivation type and explanation on hover; edit affordance sets `user_edited`.
- **Pattern-Breaking Act** — the single practice, rationale, check-in date.
- **Formation Check-in** — capture post-attempt.

---

## 10. Runtime Boundary

TanStack `createServerFn` fully replaces Supabase Edge Functions for app-internal logic. Chat streaming lives as a server route at `src/routes/api/wisdom/stream.ts`. Webhooks / cron under `src/routes/api/public/*` with signature verification. `requireSupabaseAuth` middleware attaches per-user client; RLS enforces ownership. Admin operations lazy-import `client.server` **after** verifying role via `has_role`. Secrets read via `process.env` inside handlers only. Rate limits via Postgres token bucket keyed by `user_id` and stage. Timeouts per §4.1 `model_configs`, capped at PRD latency budgets (§14).

---

## 11. Source Governance

- Canon profiles (§2) are text keys; translation is a separate profile field.
- Bible translation: **WEB** is the approved MVP default and is stored as the actual database default (`profiles.translation_pref default 'WEB'`). Other translations require licensing sign-off before enablement.
- Every corpus row is `(slug, version)`; edits create new versions and set `supersedes_id`. Status transitions require curator role and write to **`source_audit`** (mandatory).
- Founder frames are S6, governed by the same approval flow as S1–S5.
- Two-curator sign-off for S1–S5; single curator for S6–S8.

---

## 12. Prompt & Model Ops

- Stored in `prompt_versions` / `model_configs` with partial-unique-on-active.
- Defaults: reasoning stages → `google/gemini-3-flash-preview`; rerank → small model; embeddings → Lovable AI embeddings.
- **Latency targets (PRD, p95)**: **Companion 8s**, **Pattern 18s**, **Deep Wisdom 35s**. Curse Breaker inherits Deep Wisdom's 35s p95.
- Cost tracked per `pipeline_runs.cost_usd`.
- Activation requires passing the full evaluation matrix (§13) at ≥ baseline on every dimension; enforced by a curator server function.
- Rollback = flip `active` back; guarded by admin role and logged in `admin_audit`.

---

## 13. Evaluation Matrix

### 13.1 Dimensions (each scored independently — no combined "accuracy" score)

`grounding`, `citation_validity`, `category_coverage` (SDE only), `refusal_correctness`, `pastoral_tone`, `prayer_lineage_coverage`, `pattern_precision`, `pattern_recall`, `latency`, `cost`, `safety`.

### 13.2 150 golden cases — distribution

- 40 Companion (everyday discernment)
- 30 Pattern (multi-session pattern recognition)
- 30 Deep Wisdom (long-form theological discernment)
- 10 Curse / generational-pattern cases
- 15 Persona graph (fact proposal, sensitivity, verdicts)
- 10 Prayer Lineage (movement selection, derivation correctness)
- 10 Formation Timeline (event correctness, idempotency)
- 5 Guest → auth migration

### 13.3 Red-team cases (separate set)

Prompt injection, role escalation, cross-user probes, pressure toward blanket "cursed" or blanket "psychology only," attempts to skip the 14-category grid, attempts to produce source-less prayer lines, attempts to name a third party as cursed, PII exfiltration, translation swap without license.

### 13.4 Persistence

Runs recorded in `eval_runs`; per-case per-dimension outcomes in `eval_results`. Every prompt/model activation must reference a passing `eval_run_id`.

### 13.5 Other tests

Unit, RLS (pgTAP for every access class including curator-denied), Playwright browser journeys, accessibility (axe on every route), migration up/down, failure-recovery (timeout, invalid output, provider outage, partial pipeline), idempotency (retry produces zero duplicates in `prayers`, `patterns`, `interpretations`, `formation_events`, `practice_assignments`).

---

## 14. Acceptance Criteria (measurable)

- All 14 SDE categories present in every Curse Breaker response (coverage = 100%).
- Zero blanket cursed / non-cursed declarations across red-team.
- Prayer Lineage: 100% of lines have ≥1 `prayer_line_sources` row; ≥1 S1 citation per lineage.
- Discernment `grounding` ≥ 0.95 on goldens; `refusal_correctness` ≥ 0.98 on red-team.
- Latency p95: Companion ≤ 8s, Pattern ≤ 18s, Deep Wisdom ≤ 35s, Curse Breaker ≤ 35s.
- Idempotency: repeated submission of the same `idempotency_key` produces zero duplicate rows across `prayers`, `patterns`, `interpretations`, `formation_events`, `practice_assignments`.
- Curator RLS test suite: zero reads of any user-owned table succeed under curator role.
- Formation Timeline: append-only invariant verified (no UPDATE/DELETE outside cascade).
- Passage-level citations: 100% of rendered citations resolve to a `source_passages` row with matching translation and canon.

---

## 15. Persona Graph — memory states and controls

`persona_facts.status` moves through: `session_only → proposed → accepted | rejected | sensitive | deleted`. Facts store `fact_text`, `evidence`, `source_message_ids`, `confidence`, `sensitivity`, `user_verdict`. User controls: promote, reject, mark sensitive, delete, disable memory globally (`profiles.memory_enabled=false` short-circuits proposal writes). `session_only` facts never persist past session end.

---

## 16. Pattern Graph — lifecycle and relationships

Lifecycle: `proposed → exploring → accepted | rejected → improving | recurring | resolved → archived`. Every pattern accumulates: supporting/counter/missing evidence, hidden-agreement candidates, domains, triggers, needs, rewards, costs, people, environments, biblical mirrors, practices, feedback, outcome history. Relationships between patterns cover: `causes`, `reinforces`, `triggers`, `masks`, `contradicts`, `shares_root_with`, `occurs_after`, `improves_with`, `worsens_in`, `replaced_by`. Rejected patterns are used as **negative constraints** in retrieval and are never merged into accepted factual context supplied to later stages.

---

## 17. Prayer Lineage — normalized

`prayer_lines` stores generated text, movement, edit flag, edited text, confidence. `prayer_line_sources` (normalized many-to-many) stores per source: `source_passage_id`, `derivation_type`, `explanation`, `tier`, `weight`. Rendering requires ≥1 row here per line. A single `source_ref jsonb` is explicitly rejected.

---

## 18. Formation Timeline — append-only event stream

`formation_events` is append-only (no UPDATE, no DELETE outside account cascade). Event types include: `story_shared`, `pattern_proposed`, `pattern_accepted`, `pattern_edited`, `pattern_rejected`, `prayer_created`, `prayer_edited`, `practice_selected`, `checkin_completed`, `setback_recorded`, `fruit_observed`, `pattern_confidence_changed`, `pattern_archived`. Snapshots are a derived read model over this stream, not a substitute.

---

## 19. Edge Cases, Guest Sessions, Privacy, Observability

Kept from v2 in principle:

- **Edge cases**: insufficient evidence, ambiguous patterns, contradictory evidence, no approved biblical mirror, provider timeout/outage, invalid structured output, source-less prayer lines (rejected at validator), partial-stage failure, unauthorized access (typed Forbidden; no data leak), rate limiting (429 + Retry-After).
- **Guest sessions**: default local-only (IndexedDB); optional 7-day server-side ephemeral shadow pending founder decision (§20). Auth transition via signed migration server function; idempotent; sets `profiles.guest_migrated_at`. No `persona_facts`, `patterns`, `formation_events` for guests.
- **Privacy ops**: data minimization, redaction pass before gateway calls, export server function, memory disable, hard vs soft delete, nightly purge, no message bodies in logs, versioned system prompts, rolling context window capped by tokens.
- **Observability**: `pipeline_runs` drives per-stage latency (p50/p95), failure rate, validation repairs, tokens, cost, retrieval hits, prayer-lineage coverage %, pattern accept/reject ratio, category-coverage %. Structured error taxonomy. Alerts on latency, failure rate, cost per session, grounding regressions.

---

## 20. Founder Decisions Required Before Prompt 1

1. Approve 32-table inventory (§3).
2. Approve the four canon profiles (§2) and `founder_default` as system default.
3. Confirm WEB as the actual DB default translation (§11).
4. Approve the 14 SDE interpretation categories (§4.1) verbatim.
5. Approve the nine prayer movements (§4.1).
6. Approve Curse Breaker as a first-class MVP mode alongside Companion.
7. Approve PRD latency targets (Companion 8s / Pattern 18s / Deep Wisdom 35s / Curse Breaker 35s).
8. Approve curator RLS: **no** read access to any user-owned table; support access is separately consented, time-boxed, and audited.
9. Approve two-curator sign-off for S1–S5 sources.
10. Approve guest strategy: local-only vs local + 7-day ephemeral server shadow.
11. Approve mandatory `admin_audit` and `source_audit` logging.
12. Approve the 150-case golden distribution (§13.2) including 10 curse/generational cases.
13. Approve evaluation-run persistence gating prompt/model activation.
14. Approve idempotency-key requirement on all write-producing stages.

### Approval checklist

- [ ] §1 Source constitution (S1–S8)
- [ ] §2 Canon profiles
- [ ] §3 Table inventory (32)
- [ ] §4 Schema, enums, retention, migration order
- [ ] §5 RLS matrix (curator = none on user data)
- [ ] §6 Pipeline stages including Curse Breaker
- [ ] §7 Retrieval design
- [ ] §8 Deterministic rendering
- [ ] §9 Curse Breaker UI cards
- [ ] §10 Runtime boundary
- [ ] §11 Source governance (WEB default)
- [ ] §12 Prompt/model ops (PRD latency)
- [ ] §13 Evaluation matrix and 150-case distribution
- [ ] §14 Acceptance criteria
- [ ] §15 Persona graph memory states
- [ ] §16 Pattern graph lifecycle and relationships
- [ ] §17 Prayer Lineage normalization
- [ ] §18 Formation Timeline append-only
- [ ] §19 Edge cases, guest, privacy, observability
- [ ] §20 Founder decisions 1–14

No application code will be written until every box above is ticked.

---

## 21. Frozen Amendments (v3.1)

v3 is approved in principle and frozen. The following amendments are binding; where they conflict with earlier sections, §21 wins.

### 21.1 Curse Breaker performance — two-pass + progressive streaming

Curse Breaker stage 5 (`cb_stronghold_category_hypothesis_generation`) is split:

- **Pass 1 — cheap signal scoring.** Single small-model call scores all 14 categories on `signal_present ∈ {none, weak, moderate, strong}` with a one-sentence rationale each. Every category produces an `interpretations` row (auditable, even at `signal=none`).
- **Pass 2 — deep analysis.** Only categories with `weak+` signal proceed to full evidence / counter-evidence / missing-evidence / biblical retrieval / alternative explanations. Zero-signal categories keep the pass-1 rationale as their audit trail.

Parallelization: `cb_possible_root_generation`, `cb_competing_explanations_analysis`, and `cb_biblical_retrieval_curse_stronghold` run in parallel per surviving category once pass 1 completes. Fan-in barrier before `cb_discernment`.

Streaming: UI renders cards progressively via the `/api/wisdom/stream` server route. Order: pass-1 grid skeleton → per-category deep cards as they resolve → discernment → Prayer Lineage → pattern-breaking act.

UI grouping (amends §9): "Supported categories" (weak+) rendered by default; "Other explanations examined" is a collapsed section listing zero-signal categories with pass-1 rationale.

Latency: **35s p95 remains the initial target.** During the vertical slice, measured p95 is recorded weekly in `pipeline_runs`. If real p95 exceeds 35s across two consecutive weeks with a stable prompt/model, the target is revised and re-approved before beta.

### 21.2 Deterministic rendering enforcement (broadened)

- Prohibited browser-side AI imports across **all** client code: `src/components/**`, `src/routes/**` (component/loader body), `src/lib/**` that is not `*.server.ts` or `*.functions.ts` handler body, `src/hooks/**`.
- ESLint `no-restricted-imports` blocks `ai`, `@ai-sdk/*`, `openai`, `@anthropic-ai/*`, and any Lovable AI Gateway helper outside server-only modules.
- CI job "browser-bundle-inspection" builds the client bundle and greps the emitted chunks for AI SDK symbols; failure blocks merge.
- All model calls live in `*.server.ts` or inside `.handler()` bodies of `*.functions.ts` / server routes. No exceptions.

### 21.3 Prayer movements — primary + multi

`prayer_lines` amended: `primary_movement prayer_movement not null`, `movements prayer_movement[] not null default '{}'` with a check that `primary_movement = any(movements)`. Rendering groups by `primary_movement`; secondary movements shown as chips.

### 21.4 Persona memory — sensitivity is independent

- `persona_facts.status persona_fact_status` enum reduced to lifecycle only: `session_only | proposed | accepted | rejected | deleted`.
- `persona_facts.sensitivity text` in `{normal, sensitive}` is independent of `status`.
- Promotion rule: a fact with `sensitivity='sensitive'` cannot move `proposed → accepted` without an explicit second confirmation event (`formation_event` type `pattern_edited` reused with `payload.kind='sensitive_persona_fact_confirmation'` — or a new event type added at Prompt 2 if the founder prefers).

### 21.5 Rejected-pattern handling — scoped, not global-NOT

- `pattern_feedback` (rejections) stores `reason text`, `scope text` (`this_session | this_topic | this_persona | permanent`), `evidence_snapshot jsonb`, `rejected_at timestamptz`.
- Retrieval behavior:
  - Suppress return of the **exact rejected claim** as fact within `scope`.
  - Downrank (not exclude) closely equivalent hypotheses within `scope`.
  - Never a permanent global NOT filter unless `scope='permanent'` **and** admin-audited.
- Reconsideration: allowed only when new evidence exists that materially changes `pattern_evidence.kind='supporting'`; the reconsideration writes a `formation_event` (`pattern_confidence_changed`) with an explicit rationale referencing the new evidence rows.

### 21.6 Support access — hardened

- Only `admin` can mint a support grant (server function; `curator` explicitly denied and audited on attempt).
- Grant record fields: `user_id`, `granted_by (admin)`, `purpose text`, `table_scope text[]` (minimum necessary), `granted_at`, `expires_at`, `revoked_at`, `consent_event_id`.
- User consent required before the grant activates (in-app modal; consent event stored).
- Visible in-app notifications: banner when access begins, banner when it ends; both recorded in `admin_audit`.
- Every read/write under a support grant writes an `admin_audit` row (immutable, append-only).
- Curators cannot mint, inherit, or be delegated support access.

### 21.7 Evaluation activation rules

Two-tier gate for activating a `prompt_version` or `model_config`:

**Hard invariants — zero regression permitted:**
- Cross-user privacy (no cross-user data leak in any red-team case)
- Citation validity (every rendered citation resolves; correct translation/canon)
- Prayer Lineage structural coverage (100% lines have ≥1 `prayer_line_sources` row; ≥1 S1 per lineage)
- Source-tier correctness for direct claims (claim tier matches supporting source tier)
- No invented first-person statements attributed to God

**Scored qualitative dimensions:**
- Each activation runs the golden set N=5 times.
- A dimension regresses only if the new mean is (a) statistically significantly lower than the active baseline (Welch's t, p<0.05) **and** (b) more than 2 percentage points below baseline.
- Any regression blocks activation.

Every activation and rollback writes an immutable `admin_audit` row referencing the `eval_run_id`.

### 21.8 Guest migration

- Payload limits: ≤ 500 KB compressed; ≤ 200 messages; ≤ 20 sessions per migration call.
- Every imported object validated by Zod at the server boundary; unknown fields dropped.
- Conflict rule when the authenticated account already has data:
  - Sessions are always imported as **new** records (never merged into existing sessions).
  - Accepted `patterns` and `persona_facts` on the authed account are **never** overwritten or silently merged.
  - Imported memories arrive with `status='proposed'` and require user confirmation in a review screen before promotion.
- Migration is idempotent per `idempotency_key` (guest-device id + timestamp); replays return the same server response.

### 21.9 Stronghold corpus — named ownership and phased seeding

- Corpus owners named before implementation: **Founder** (source-of-truth, S6 approval), **Curator A** (S1–S3), **Curator B** (S4–S5). Recorded in `source_documents.approved_by` and in a `CORPUS_OWNERS.md` under `docs/` (added at Prompt 2).
- Vertical-slice seeding: only the stronghold categories and biblical anchors required for the first slice ("helping without boundaries" + one Curse Breaker case).
- Private beta gate: all 14 categories reviewed and `status='approved'` with S1–S5 anchors present; two-curator sign-off recorded in `source_audit`.

### 21.10 Four distinct modes on shared infrastructure

`session.mode` retains all four values; each has a distinct pipeline profile over the shared stage library (§6.1):

- **Companion** — listening + clarification. No `patterns.status='proposed'` write; no `persona_facts` promotion beyond `session_only`; renders reflection + optional prayer.
- **Pattern** — event chain + competing hypotheses + proposed pattern memory (writes `patterns.status='proposed'`, `persona_facts.status='proposed'`).
- **Deep Wisdom** — full stage graph with maximum source depth, alternatives, and counter-evidence surfaced.
- **Curse Breaker** — SDE stages (§6.2) with the 14-category two-pass process (§21.1).

Latency budgets per §12 (Companion 8s / Pattern 18s / Deep Wisdom 35s / Curse Breaker 35s initial).

### 21.11 Prompt 1 — audit-only, not rebuild

Existing static UI is retained. Only the following missing elements will be added (typed mocks, no backend):

- Curse Breaker entry point (mode chip + hero suggestion + optional dedicated route `/wisdom/curse-breaker`).
- Composer mode extended to four modes with distinct placeholders and explanatory copy per §21.10.
- Typed mock Curse Breaker result cards: Repeated Experience, Possible Roots, Fourteen-Category Discernment Grid (supported + "Other explanations examined" collapsed), Competing Explanations, Biblical Mirrors, Prayer Lineage (with `primary_movement` + chips), Pattern-Breaking Act, Formation Check-in.
- Responsive verification (mobile 375, tablet 768, desktop ≥ 1280) and accessibility pass (axe on every route, keyboard-only journey, reduced-motion).

Frozen. Any further change requires a new numbered amendment in §22+.

---

## 22. Existing-UI Gap Report (against §21.11)

Audited files: `src/routes/wisdom.index.tsx`, `src/routes/wisdom.$sessionId.tsx`, `src/components/wisdom/{AppShell,primitives}.tsx`, `src/lib/wisdom/{schemas.ts,mock/*}`.

**Present**
- Wisdom home with hero, suggestions grid, and composer (`src/routes/wisdom.index.tsx`).
- Three-mode selector: `companion | pattern | deep` with per-mode hint copy.
- Session view route and seeded example.
- App shell with sidebar/nav and design tokens (parchment/gold on dark canvas).
- Typed schemas in `src/lib/wisdom/schemas.ts` (patterns, prayers, prayer lines, biblical mirrors).

**Missing (to add during audit pass, typed mocks only)**
1. Fourth mode `curse_breaker` in the composer mode chip group, with distinct label, hint, placeholder ("What keeps returning that you sense is more than habit?"), and explanatory line.
2. Curse Breaker hero suggestion tile on `/wisdom` (e.g. "Something keeps returning in my family").
3. Route `src/routes/wisdom.curse-breaker.tsx` — dedicated entry that pre-selects the mode and shows a short pastoral preamble + consent line before the composer.
4. Typed contracts under `src/lib/wisdom/contracts/v1/sde/*.ts` and mock DTOs under `src/lib/wisdom/mock/curseBreaker.ts` for the eight card types in §21.11.
5. Card components in `src/components/wisdom/curseBreaker/`:
   - `RepeatedExperienceCard`
   - `PossibleRootsCard`
   - `FourteenCategoryGrid` (supported default + collapsed "Other explanations examined")
   - `CompetingExplanationsCard`
   - `BiblicalMirrorsCard` (passage-level citation chips)
   - `PrayerLineageCard` (grouped by `primary_movement`, secondary movement chips, tier chips, derivation tooltip, edit affordance)
   - `PatternBreakingActCard`
   - `FormationCheckInCard`
6. Per-mode composer copy map replacing the current inline ternary (Companion / Pattern / Deep Wisdom / Curse Breaker).
7. Session view (`/wisdom/$sessionId`) branches on `session.mode` and renders the Curse Breaker card stack for the seeded Curse Breaker example.
8. Responsive audit: verify hero, composer, mode chips, and card stack at 375 / 768 / 1280 CSS px; fix wrap/overflow.
9. Accessibility audit: axe pass on `/wisdom`, `/wisdom/curse-breaker`, `/wisdom/$sessionId`; keyboard reachability of mode chips and collapsed section; `prefers-reduced-motion` disables card entrance transitions.
10. Copy deck entry for Curse Breaker in `src/lib/wisdom/copy/v1.ts` (create the file if absent) so the renderer stays deterministic.

**Not-in-scope for the audit pass** (per §21.11): any backend, any AI call, any real streaming — only typed mocks + static cards. Backend migrations are deferred pending the final review of the 32-table schema and RLS matrix (§20).


---

## 21.12 Frozen Amendments (v3.2) — clarifications applied during audit pass

1. **Guest migration idempotency.** `migration_id` is a stable random UUID minted on the guest device, persisted in IndexedDB under `wisdom.guest.migrationId`, and reused verbatim for every retry of the guest → account migration server function. Deriving the key from `created_at` or any timestamp is prohibited. Server-side upsert key: `unique (user_id, migration_id)`.

2. **Two-curator source approval is normalized.** New governance table `source_approvals` (added to §3 identity/governance count; final physical count moves from 32 → 33):
   - `id uuid pk`, `source_document_id fk`, `source_version int not null`, `reviewer_id uuid references auth.users(id) not null`, `role app_role not null`, `decision text check in ('approve','reject','request_changes')`, `notes text`, `created_at timestamptz not null`.
   - Unique `(source_document_id, source_version, reviewer_id)` — a reviewer approves a specific version once.
   - Publication rule: `source_documents.status = 'approved'` requires **≥ 2 `approve` rows from distinct reviewer_ids** for the current `version`. Enforced by a `before update` trigger on `source_documents` and by a nightly `source_governance_audit` job.
   - `source_documents.approved_by` is removed; that single-owner field cannot express two independent approvals.

3. **Placeholder corpus owners removed before private beta.** "Curator A", "Curator B", and any other unnamed placeholder in §19 / §21.9 are permitted only in mock-UI seeds. Before private beta corpus approval, every `stronghold_categories` row, every `biblical_archetypes` row, and every `source_documents` row must reference accountable `reviewer_id` values (real user IDs) via `source_approvals`, and every governance owner must be a named role (`founder`, `theological_editor`, `pastoral_reviewer`) — never an anonymous placeholder.

4. **Evaluation compares the same golden cases across versions.**
   - Primary comparison: **paired case-level** on the 150 golden cases (same case, version A vs version B), with the delta reported per case.
   - Aggregate significance: **paired bootstrap over the 150 case deltas with ≥ 3 model runs per case per version** to absorb sampling variance. Report the 95% CI of the mean delta.
   - Independent Welch's t on five aggregate runs is **not** an acceptable substitute and is removed from the acceptance criteria in §14.
   - Hard invariants (privacy leak, missing citation on any prayer line, structural schema violation, refusal-correctness on red-team cases) remain **zero-tolerance** regardless of the paired-bootstrap outcome. Qualitative dimensions retain the 2pp regression ceiling from §21.7.

5. **Nova branding audit result.** No Nova strings remain in `src/`, `.lovable/`, or `public/`. `index.html` does not exist in this template (TanStack Start owns the shell via `src/routes/__root.tsx`). Head metadata (`WISDOM_TITLE`, `WISDOM_DESC`) already reads "Wisdom — Scripture-first pattern and prayer intelligence"; the template default "Lovable Generated Project" was replaced in Stage A. Curse Breaker leaf route sets its own `title` and `robots: noindex`.

**Effect on counts and matrices**
- §3 Table Inventory: identity/governance 4 → **5** (added `source_approvals`); physical total 32 → **33**.
- §4.3: append `source_approvals` row per the columns above.
- §5 RLS: `source_approvals` — `anon: none`, `authenticated: none`, `curator: RW own reviewer rows + R all`, `admin: R`, `support: none`, `service_role: ALL`. Grants: `GRANT SELECT,INSERT,UPDATE ON source_approvals TO authenticated` restricted by policy to rows where `reviewer_id = auth.uid()`. Reject or supersede via new `source_approvals` row, never `UPDATE`/`DELETE` of a decided row (append-only decisions; a superseding row references the prior via `supersedes_approval_id`).
- §14 acceptance criteria: replace Welch t-test line with paired bootstrap over 150 cases × ≥ 3 runs, 95% CI.
- §20 founder decisions: add "reviewer_id assignments for founder / theological_editor / pastoral_reviewer roles" as a Prompt 1 blocker.

---

## 21.13 Frozen Amendments (v3.3) — §§3–5 corrections

The following supersedes the corresponding text in §§3–5. Physical inventory is derived directly from the table-by-table list, not from group subtotals.

### §3 (superseded v3.4) — Physical table inventory: **39**

Mechanically enumerated, one physical table per row (no collapsing):

1. profiles
2. user_roles
3. admin_audit
4. source_audit
5. source_approvals
6. stronghold_category_approvals
7. archetype_approvals
8. sessions
9. messages
10. signals
11. personas
12. persona_facts
13. persona_fact_confirmations
14. patterns
15. pattern_events
16. pattern_evidence
17. pattern_relationships
18. pattern_feedback
19. interpretations
20. stronghold_categories
21. source_documents
22. source_passages
23. biblical_archetypes
24. archetype_mirrors
25. archetype_passages
26. practices
27. practice_assignments
28. discernments
29. prayers
30. prayer_lines
31. prayer_line_sources
32. formation_events
33. check_ins
34. prompt_versions
35. model_configs
36. pipeline_runs
37. eval_cases
38. eval_runs
39. eval_results

**Diff vs prior stated inventory (v3.3 said "35"):**

- `stronghold_category_approvals` — **added to numbered list**. Declared in §21.13 §4.3 and present in the §5 matrix, but omitted from the prior numbered list. Not a new table this turn.
- `archetype_approvals` — **added to numbered list**. Same reconciliation as above.
- `eval_cases` — **added to numbered list**. Previously collapsed into a single row 35 alongside the next two.
- `eval_runs` — **added to numbered list**. Same collapse.
- `eval_results` — **added to numbered list**. Same collapse.
- All other 34 entries — unchanged.

No `removed`, no `renamed from`, no `merged into` entries. Removing the `support` role and its policies removed enum values and RLS rows, not tables. `archetype_mirrors` retains its row — only its `passage_refs jsonb` column is dropped in §4.3; `archetype_passages` is a new normalized sibling, not a rename or merge.

**Final mechanically calculated count: 39 physical tables**, plus the single security-barrier view `pipeline_runs_curator_v` (view, not counted). Guest data stays on-device.

### §4.1 (superseded) — Enums

- `app_role` = `admin | curator | user`
- `source_tier` = `S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8`
- `tradition` (controlled vocab, unchanged)
- `period` (unchanged)
- **`canon_profile` = `protestant_66 | ethiopian_orthodox_tewahedo_research | comparative_early_christian_literature`** — canon only, no `founder_default` here.
- **`source_profile` = `founder_default`** (extensible). A `source_profile` row selects one `canon_profile` as its base and an ordered list of optional source layers (patristic depth, tradition weighting, etc.). `founder_default` is never a canon.
- `source_status` = `draft | in_review | approved | superseded | retired`
- `session_mode` = `companion | pattern | deep_wisdom | curse_breaker`
- **`persona_fact_status` = `session_only | proposed | accepted | rejected | deleted`** (`sensitive` removed).
- **`sensitivity` = `normal | sensitive | hidden`** (independent column; not part of lifecycle).
- **`memory_directive` = `normal | session_only | do_not_remember`** (message-level).
- **`signal_origin` = `explicit | inferred`**
- `pattern_status` (unchanged)
- `pattern_relation` (unchanged)
- `hypothesis_status` (unchanged)
- `interpretation_category` (unchanged 14 layers)
- `prayer_movement` (unchanged 9)
- `derivation_type` (unchanged)
- `formation_event_type` (unchanged)
- `check_in_result` (unchanged)
- `run_status` (unchanged)
- **`eval_dimension` = `persona_fidelity | event_chain_fidelity | hypothesis_quality | counter_evidence | biblical_grounding | context_integrity | source_tier_accuracy | prayer_pattern_fit | prayer_lineage | action_fit | non_shaming_tone | unsupported_certainty | user_correction_behavior | citation_validity | category_coverage | refusal_correctness | latency | cost | safety`** — PRD dimensions restored in full.

### §4.3 (deltas — only rows that change or are added)

- **profiles**: `canon_profile canon_profile not null default 'protestant_66'`, `source_profile source_profile not null default 'founder_default'` (replaces the single-column design).
- **messages**: add `memory_directive memory_directive not null default 'normal'`. A message with `do_not_remember` may be used in the current response but the pipeline MUST NOT persist any downstream row that references it (signals, persona_facts, patterns, formation_events). Enforced by (a) a `messages_do_not_remember_guard` trigger on `signals`, `persona_facts.source_message_ids`, `pattern_evidence.source_message_ids`, `formation_events.payload->>'source_message_id'`, and (b) pipeline stage validators.
- **signals**: `origin signal_origin not null`, `source_message_id uuid not null references messages(id) on delete cascade`, `source_span jsonb not null` (`{start:int,end:int}`), `confidence numeric(3,2) not null check (confidence between 0 and 1)`. Provenance is required, not optional.
- **persona_facts**: `status persona_fact_status` (per new enum). Sensitive facts (`sensitivity in ('sensitive','hidden')`) may enter `proposed` but transition to `accepted` ONLY after a matching row exists in `persona_fact_confirmations`. Enforced by trigger.
- **persona_fact_confirmations** *(new)*: `id`, `persona_fact_id fk cascade`, `user_id`, `confirmed_at timestamptz`, `method text` (`explicit_ui|dedicated_prompt`), `evidence_message_id uuid`. Unique `(persona_fact_id)`. Row exists ⇒ user explicitly confirmed. No row ⇒ acceptance blocked for sensitive facts.
- **prayer_lines**: remove singular `movement`. Add `primary_movement prayer_movement not null`, `movements prayer_movement[] not null check (array_length(movements,1) >= 1 and primary_movement = ANY(movements))`.
- **archetype_mirrors**: `passage_refs jsonb` is DROPPED. Passage relationships move to `archetype_passages`.
- **archetype_passages** *(new)*: `id`, `archetype_id fk cascade`, `source_passage_id fk`, `weight numeric(3,2) not null check (weight between 0 and 1)`, `narrative_role text not null` (`protagonist|antagonist|witness|type|antitype|chorus|frame`), `classification text not null check in ('descriptive','prescriptive','mixed')`, `notes text`. Unique `(archetype_id, source_passage_id, narrative_role)`.
- **source_approvals**: `role app_role not null` is DERIVED SERVER-SIDE from `has_role(reviewer_id, ...)` at insert time via a `before insert` trigger — never client-provided. `decision` in (`approve|reject|request_changes`). Append-only. Publication trigger on `source_documents`:
  - `status` may transition to `approved` only if **≥ 2 distinct `reviewer_id` rows with `decision='approve'` for the current `version`, each with role in (`curator`,`admin`), and reviewer_id ≠ the row's most-recent editor**.
  - The same rule applies to `stronghold_categories` and `biblical_archetypes` via mirror tables `stronghold_category_approvals` and `archetype_approvals` (identical shape/unique constraints/triggers).
- Remove all mentions of "support" from user tables (see §5).

### §4.4 Idempotency — exact per-target constraints

Every write-producing pipeline target carries `idempotency_key text not null`, unique per user (or per session where noted):

- `patterns` — `unique (user_id, idempotency_key)`
- `pattern_events` — `unique (user_id, idempotency_key)`
- `interpretations` — `unique (session_id, category)` already exists; add `unique (session_id, idempotency_key)`
- `discernments` — `unique (session_id, idempotency_key)`
- `prayers` — `unique (session_id, idempotency_key)`
- `practice_assignments` — `unique (user_id, idempotency_key)`
- `formation_events` — `unique (user_id, idempotency_key)`
- `check_ins` — `unique (user_id, idempotency_key)`
- `pipeline_runs` — `unique (session_id, stage, idempotency_key)`
- Guest→account migration — `unique (user_id, migration_id)` on every migrated row family (see §21.12).

Reads outside these constraints do not have idempotency claims. Server functions accept and forward the key; retries with the same key are guaranteed no-ops at the DB layer, not the app layer.

### §4.5 Prayer-line source enforcement (transactional)

"Every prayer line has ≥ 1 `prayer_line_sources` row" is enforced database-side, not in app code:

1. `prayers.status text not null default 'draft'` with `check in ('draft','committed','retracted')`.
2. Constraint trigger `prayers_commit_requires_sources`, **DEFERRABLE INITIALLY DEFERRED, FOR EACH ROW**, on `UPDATE OF status ON prayers WHEN (NEW.status = 'committed')`: raises if any `prayer_lines` row for the prayer has zero `prayer_line_sources` children.
3. Server function `commitPrayer` wraps prayer + lines + sources + `UPDATE prayers SET status='committed'` in a single transaction. The deferred trigger fires at COMMIT; an incomplete prayer aborts the whole transaction.
4. Read paths (`getPrayer`, session card renderer, formation timeline) filter `status = 'committed'`. Draft prayers are never rendered.

Combined effect: an incomplete prayer cannot exist in `committed` state, and no reader ever sees `draft` prayers — the invariant is unbreakable across retries, partial failures, and concurrent writers.

### §5 (superseded) — RLS Policy Matrix + Grants (least-privilege)

Roles: `anon`, `authenticated` (owner via `auth.uid()`), `curator`, `admin`, `service_role`. **`support` is removed from the MVP schema entirely.** No standing support policies exist. If support tooling is built post-MVP, it is a set of narrowly-scoped server functions that (a) verify a per-user consent grant, (b) write an immutable `admin_audit` row before any read, and (c) use `service_role` — never a base-table RLS elevation.

**Curators have no read access to any user-owned table.** Curators have no base-table access to `pipeline_runs`; instead they read `pipeline_runs_curator_v` (a `security_barrier = true` view exposing only `stage, status, latency_ms, tokens_in, tokens_out, cost_usd, retrieval_hits, created_at::date`, with no `session_id`, `user_id`, `prompt`, `output`, or `error` columns).

**Per-table matrix (RLS + grants)**

| Table | Owner (`authenticated`, `auth.uid()=user_id`) | curator | admin | anon | service_role |
|---|---|---|---|---|---|
| profiles | SELECT, UPDATE | none | none | none | ALL |
| user_roles | SELECT own | none | (RW via server fn only, anti-escalation trigger) | none | ALL |
| admin_audit | none | none | SELECT | none | INSERT, SELECT |
| source_audit | none | SELECT | SELECT | none | INSERT, SELECT |
| source_approvals | none | INSERT, SELECT | SELECT | none | ALL |
| stronghold_category_approvals | none | INSERT, SELECT | SELECT | none | ALL |
| archetype_approvals | none | INSERT, SELECT | SELECT | none | ALL |
| sessions | SELECT, INSERT, UPDATE, DELETE own | none | none | none | ALL |
| messages | SELECT, INSERT own (no UPDATE, no DELETE) | none | none | none | ALL |
| signals | SELECT own via parent join (no direct writes) | none | none | none | INSERT via server fn, ALL |
| personas | SELECT, INSERT, UPDATE, DELETE own | none | none | none | ALL |
| persona_facts | SELECT, UPDATE own (INSERT via server fn only) | none | none | none | ALL |
| persona_fact_confirmations | SELECT, INSERT own (append-only) | none | none | none | ALL |
| patterns | SELECT, UPDATE own (INSERT via server fn) | none | none | none | ALL |
| pattern_events | SELECT own via parent (no direct writes) | none | none | none | ALL |
| pattern_evidence | SELECT own via parent (no direct writes) | none | none | none | ALL |
| pattern_relationships | SELECT own via parent (no direct writes) | none | none | none | ALL |
| pattern_feedback | SELECT, INSERT own | none | none | none | ALL |
| interpretations | SELECT own via parent (no direct writes) | none | none | none | ALL |
| discernments | SELECT own via parent (no direct writes) | none | none | none | ALL |
| prayers | SELECT, UPDATE own (INSERT/status-transition via server fn) | none | none | none | ALL |
| prayer_lines | SELECT own via parent; UPDATE `user_edited`, `edited_text` only | none | none | none | ALL |
| prayer_line_sources | SELECT own via parent (no direct writes) | none | none | none | ALL |
| practice_assignments | SELECT, UPDATE own (INSERT via server fn) | none | none | none | ALL |
| check_ins | SELECT, INSERT own | none | none | none | ALL |
| formation_events | SELECT own (NO direct INSERT/UPDATE/DELETE; all writes through server fn) | none | none | none | INSERT, SELECT |
| stronghold_categories | SELECT approved | SELECT all, INSERT, UPDATE draft rows | SELECT | SELECT approved | ALL |
| biblical_archetypes | SELECT approved | SELECT all, INSERT, UPDATE draft rows | SELECT | SELECT approved | ALL |
| archetype_mirrors | SELECT approved | SELECT all, INSERT, UPDATE draft rows | SELECT | SELECT approved | ALL |
| archetype_passages | SELECT approved | SELECT all, INSERT, UPDATE draft rows | SELECT | SELECT approved | ALL |
| practices | SELECT approved | SELECT all, INSERT, UPDATE draft rows | SELECT | SELECT approved | ALL |
| source_documents | SELECT approved | SELECT all, INSERT, UPDATE draft rows | SELECT | none | ALL |
| source_passages | SELECT approved | SELECT all, INSERT, UPDATE draft rows | SELECT | none | ALL |
| prompt_versions | none | SELECT, INSERT, UPDATE draft (NO activation) | SELECT, UPDATE `active` only | none | ALL |
| model_configs | none | SELECT, INSERT, UPDATE draft (NO activation) | SELECT, UPDATE `active` only | none | ALL |
| pipeline_runs | none | none (curators read `pipeline_runs_curator_v`) | SELECT | none | ALL |
| eval_cases | none | SELECT, INSERT, UPDATE | SELECT | none | ALL |
| eval_runs | none | SELECT, INSERT | SELECT | none | ALL |
| eval_results | none | SELECT, INSERT via parent | SELECT | none | ALL |

**Grants correspond to the matrix — no blanket grants.** Illustrative:

```sql
-- messages: owners insert/select their own; no update/delete
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

-- formation_events: no direct write for owners
GRANT SELECT ON public.formation_events TO authenticated;
GRANT SELECT, INSERT ON public.formation_events TO service_role;

-- source_documents: owners read only approved
GRANT SELECT ON public.source_documents TO authenticated;
GRANT SELECT ON public.source_documents TO curator;
GRANT INSERT, UPDATE ON public.source_documents TO curator;  -- policy scopes to draft rows
GRANT ALL ON public.source_documents TO service_role;

-- source_approvals: curator INSERT + SELECT only; no UPDATE, no DELETE
GRANT SELECT, INSERT ON public.source_approvals TO curator;
GRANT ALL ON public.source_approvals TO service_role;

-- pipeline_runs: no direct grant to curator; view is the only surface
GRANT SELECT ON public.pipeline_runs_curator_v TO curator;
GRANT ALL ON public.pipeline_runs TO service_role;

-- user_roles: read own; writes only via server fn
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
```

Child ownership continues to resolve via `EXISTS (select 1 from parent p where p.id = child.parent_id and p.user_id = auth.uid())` — never denormalized `user_id`. `has_role` remains the only path for role checks (SECURITY DEFINER, `stable`, `search_path = public`).

---

## First migration batch proposal (Prompt 2)

Not to be executed until §21.13 is signed off. Ordered, single-transaction files:

1. `0001_enums.sql` — every enum in §4.1 (canon_profile, source_profile, source_status, session_mode, persona_fact_status, sensitivity, memory_directive, signal_origin, prayer_movement, derivation_type, formation_event_type, check_in_result, hypothesis_status, pattern_status, pattern_relation, run_status, eval_dimension, interpretation_category, tradition-check, period, app_role, source_tier).
2. `0002_extensions.sql` — `create extension if not exists pgcrypto; create extension if not exists vector; create extension if not exists pg_trgm;`.
3. `0003_identity_and_governance.sql` — `profiles`, `user_roles`, `has_role()`, `admin_audit`, `source_audit`, role anti-escalation trigger, `update_updated_at_column()` + triggers.
4. `0004_governance_approvals.sql` — `source_approvals`, `stronghold_category_approvals`, `archetype_approvals` with server-side `role` derivation trigger and unique constraints.
5. `0005_session_io.sql` — `sessions`, `messages` (incl. `memory_directive`), `signals` (with required provenance + FK), `messages_do_not_remember_guard()` trigger stub referenced by later tables.
6. `0006_persona_graph.sql` — `personas`, `persona_facts`, `persona_fact_confirmations`, sensitive-accept trigger.
7. `0007_pattern_graph.sql` — `patterns`, `pattern_events`, `pattern_evidence`, `pattern_relationships`, `pattern_feedback`, idempotency constraints, do-not-remember guard wiring.
8. `0008_sde.sql` — `stronghold_categories`, `interpretations` (unique per session×category + idempotency).
9. `0009_corpus.sql` — `source_documents`, `source_passages` (pgvector + FTS indexes), publication triggers referencing `source_approvals`.
10. `0010_archetypes_practices.sql` — `biblical_archetypes`, `archetype_mirrors`, `archetype_passages`, `practices`, `practice_assignments`.
11. `0011_discernment_prayer.sql` — `discernments`, `prayers` (with `status`), `prayer_lines` (with `primary_movement`, `movements[]`, check), `prayer_line_sources`, deferrable `prayers_commit_requires_sources` constraint trigger.
12. `0012_formation.sql` — `formation_events` (append-only; INSERT revoked from `authenticated`), `check_ins`, emit trigger for check-in → formation_event.
13. `0013_ops.sql` — `prompt_versions`, `model_configs`, `pipeline_runs`, `pipeline_runs_curator_v` view (`security_barrier=true`), activation policies restricting `UPDATE ... active` to `admin`.
14. `0014_eval.sql` — `eval_cases`, `eval_runs`, `eval_results` with parent-scoped INSERT policy.
15. `0015_rls_grants.sql` — every GRANT + POLICY exactly as §5 above; verifies with a `pg_policies` self-test.
16. `0016_seed_governance.sql` — insert `founder_default` source_profile row, seed `stronghold_categories` (draft), seed accountable reviewer role assignments for the two named curators + one theological editor (real `auth.users.id` provided at seed time — no placeholders).

Every file includes GRANTs immediately after each CREATE TABLE and enables RLS before creating policies, per platform rules. No `ALTER DATABASE` statements.

Amend §22: awaiting sign-off before Prompt 2 / database migrations. (Prompt 1's UI audit is complete.)
