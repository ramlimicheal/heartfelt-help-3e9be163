
# Wisdom — Read-Only Architecture & File Audit

No code, DB, config, prompts, or docs were changed. All findings are grounded in file reads, migration inspection, and read-only SQL against the live DB.

---

## 1) Product / Ideology Model (reconstructed from code)

Wisdom is a source-grounded pastoral discernment engine, not a chatbot. From `src/lib/wisdom/unified.schemas.ts`, `unified.orchestrator.ts`, and DB enum `public.session_mode`, there are exactly **four** modes:

- **companion** — mirroring & presence, no durable artifacts required.
- **pattern** — surfaces a proposed pattern + prayer draft + primary practice, backed by cited passages.
- **deep_wisdom** — richer biblical mirroring / lineage.
- **curse_breaker** — two-pass stronghold discernment across 14 interpretive categories (DB enum `interpretation_category`), each deep result must cite ≥1 approved passage (enforced by trigger `stronghold_categories_deep_guard`).

Cross-cutting invariants encoded in the schema and triggers:

- **Memory / DNR** (`src/lib/wisdom/dnr.ts`, triggers `signals_reject_dnr_source`, `persona_facts_guard`, `pattern_evidence_dnr_guard`): a `do_not_remember` message may answer the current turn but must never contribute to signals, persona facts, pattern evidence, or formation events.
- **Session mode lock** (`enforce_session_mode_immutable`, `lock_session_mode_on_first_user_message`): mode is fixed by the first user message; also enforces `sessions.user_id = messages.user_id`.
- **Persona consent**: `persona_facts` marked `sensitive` cannot be accepted without an owner row in `persona_fact_confirmations` (trigger `persona_facts_guard` + append-only `pfc_append_only`).
- **Prayer lineage** (`prayers_finalize_guard`): `prayers.finalized_at` cannot be set unless every `prayer_lines` row has ≥1 `prayer_line_sources`.
- **Source governance** (`enforce_two_approver_publish`, `source_approvals_derive_role`, `sca_ownership_guard`, `admin_audit_append_only`): publish requires two distinct qualified approvers excluding the last editor; audit logs are append-only.
- **Pattern lifecycle** (`patterns_owner_lifecycle_guard`, append-only `pattern_evidence`/`pattern_feedback`): accepted/rejected/reconsidered transitions must flow through server functions, not direct writes.
- **Turn integrity** (`persist_unified_turn`, `fail_unified_turn`, `claim_turn_retry`, `wisdom_turn_rate_limit_v2`): unified-turn state machine with lease timeouts, payload-drift check, attempt cap, 20/5-min rolling rate limit.

RLS is enabled on **all 39 public tables** (verified). Legacy chat is closed (`/api/chat` returns 410).

---

## 2) Current Architecture / Data Flow

Two intelligence paths currently coexist in the repo, reaching the same DB:

```text
                       ┌─────────────────────┐
   /wisdom composer ──►│ POST /api/wisdom/turn│──► runUnifiedTurn ──► persist_unified_turn RPC
   (unified.stream.ts) │  SSE, gate=on        │        │
                       └─────────────────────┘        └──► sessions/messages/wisdom_turns
                                                              interpretations, signals,
                                                              patterns/evidence, prayers/lines/sources,
                                                              practices, formation_events

   /dashboard composer ─► startWisdomSession + runWisdomPipeline (pipeline.functions.ts)
                                          └► runCurseBreakerPipeline (curseBreaker.functions.ts)
                                          └► navigates to /wisdom/$sessionId or /wisdom/curse-breaker
                                                     which read via getSessionSlice / getSessionTelemetry
                                                     (also from pipeline.functions.ts)
```

Auth: `_authenticated/route.tsx` gates the subtree; server fns use `requireSupabaseAuth`; bearer attached via `functionMiddleware` in `src/start.ts`. Gemini via Lovable AI Gateway (`src/lib/ai-gateway.server.ts`).

---

## 3) File Inventory (summary — 115 src files, 16 tests, 30 migrations)

Active canonical (unified path):
- Server: `unified.functions.ts`, `unified.orchestrator.ts`, `unified.schemas.ts`, `unified.stream.ts`, `routes/api/wisdom/turn.ts`, `routes/api/wisdom/access.ts`, `gate.ts`.
- Surfaces: `wisdom.index.tsx` (primary composer), `library.functions.ts`, `session.functions.ts`, `dashboard.functions.ts`+`dashboard.schemas.ts`, `privacy.functions.ts`, `pattern.functions.ts`, `persona.functions.ts`, `corpus.functions.ts`.
- Cross-cutting: `dnr.ts`, `modeLock.ts`, `errorCopy.ts`, `copy/v1.ts`.
- Routes: `dashboard.tsx`, `patterns.*`, `prayers.*`, `journey.tsx`, `you.tsx`, `settings.privacy.tsx`, `onboarding.tsx`, `welcome.tsx`, `auth.tsx`, `__root.tsx`, `_authenticated/*`, `index.tsx`.
- Integrations (managed): `integrations/supabase/*`, `integrations/lovable/index.ts`, `ai-gateway.server.ts`, `start.ts`, `router.tsx`, `server.ts`.

Legacy / stale (still imported):
- `src/lib/wisdom/pipeline.functions.ts` (`startWisdomSession`, `runWisdomPipeline`, `getSessionSlice`, `getSessionTelemetry`) — imported by `dashboard.tsx` and `wisdom.$sessionId.tsx`.
- `src/lib/wisdom/pipeline.schemas.ts` — Zod contracts for the legacy pipeline (still used by `pipeline.functions.ts` and `curseBreaker.functions.ts`).
- `src/lib/wisdom/curseBreaker.functions.ts` — imported by `dashboard.tsx`.
- `src/routes/wisdom.curse-breaker.tsx` — legacy CB session view.
- `src/routes/api/chat.ts` — 410 sentinel; may be removed after monitoring window.

Orphaned / dead in shipped code paths (no consumer in `src/routes/**`):
- `src/lib/wisdom/curseBreaker.ts` — mock TypeScript vocabulary (14 different categories from the DB enum); no `import` references anywhere.
- `src/lib/wisdom/persona.functions.ts` — not called from any route.
- `finalizePrayer` (and any prayer-finalize UI) — not wired.
- `src/lib/wisdom/schemas.ts` — only `SourceTier`/`SOURCE_TIER_*` are referenced by `primitives.tsx`; the rest of the file is unused typedefs.

Generated / vendor UI:
- `src/routeTree.gen.ts`, `src/components/ui/**` (shadcn), `src/registry/magicui/*`, `src/components/magicui/light-rays.tsx`.

Tests: 6 unit files, 8 integration files (see §7).

Migrations: 30 files across 2026-07-19 → 2026-07-22, covering roles, sessions/messages/personas, patterns/evidence, corpus, unified turns, hardened SECURITY DEFINER RPCs, prompt V3.

---

## 4) Confirmed Working Contracts

- RLS enabled on all 39 public tables (0 rows in `pg_tables where rowsecurity=false`).
- Mode enum: DB `session_mode = {companion, pattern, deep_wisdom, curse_breaker}` matches `unified.schemas.ts` and UI `wisdom.index.tsx`.
- DNR/persona/mode-lock/pattern-lifecycle triggers exist and match the invariants above.
- Unified turn state machine + rate limiter + retry claim RPCs present, all `SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp`.
- `/api/chat` returns 410; `composerWiring.test.ts` and `unifiedTurn.test.ts` pin the composer to `streamUnifiedTurn`.
- Google OAuth goes through `lovable.auth.signInWithOAuth`.
- Two-approver publish + append-only audit triggers wired.

---

## 5) Inconsistencies / Bugs / Risks (evidence-backed)

**A. Two parallel intelligence paths reach the same DB.**
`src/routes/dashboard.tsx:20-95` calls `startWisdomSession` / `runWisdomPipeline` / `runCurseBreakerPipeline` from the legacy `pipeline.functions.ts` and `curseBreaker.functions.ts`, then navigates to `wisdom.$sessionId.tsx` which reads via legacy `getSessionSlice` / `getSessionTelemetry` (`wisdom.$sessionId.tsx:15,54,59`). Meanwhile `wisdom.index.tsx` submits through the unified turn (`streamUnifiedTurn` → `/api/wisdom/turn`). Result: two prompt sets, two schemas, two persistence flows, one database. Contradicts the "single intelligence path" invariant that `composerWiring.test.ts` asserts for `wisdom.*` routes but does not cover `dashboard.tsx`.

**B. Two disjoint Curse Breaker 14-category vocabularies.**
- DB enum `public.interpretation_category` + `pipeline.schemas.ts` INTERPRETATION_CATEGORIES: `biblical_curse, stronghold, chosen_behavior, trauma_wound, systemic_injustice, physiological, spiritual_attack, generational_sin, identity_lie, vow_or_agreement, unforgiveness, idolatry, fear_bondage, ignorance`.
- `src/lib/wisdom/curseBreaker.ts` (client mock types): `chosen_behavior, habit, appetite, belief, shame, hidden_agreement, relationship_pressure, social_normalization, family_learning, generational_repetition, material_conditions, spiritual_practice_absence, user_reported_spiritual_conflict, direct_biblical_curse_or_stronghold`.
Only ~1 term overlaps. `curseBreaker.ts` has zero importers today, so it is dead — but its presence is the source of persistent product/theology confusion.

**C. Corpus is far below what the UI implies.**
Live DB: `source_passages` = **10 rows**; `source_documents where status='approved'` = **1** (all tier S1). Tiering (S1–S8), two-approver publish, and lineage requirements are wired, but the retrieval set the model must cite from is tiny. `curseBreaker.functions.ts:59-66` throws if retrieval is empty and pulls a hard-coded 30-row window with no ranking beyond `limit(30)` — no relevance signal.

**D. Persona consent is backend-only.**
`persona_facts_guard` blocks accepting a sensitive fact without a confirmation row, and `persona.functions.ts` exposes the server contract, but **no route imports it** (`rg` returns 0 hits under `src/routes`). Sensitive personas can never be accepted through the shipped UI, so any code path that expects an accepted sensitive fact will silently degrade.

**E. Prayer finalization / lineage has no UI.**
`prayers_finalize_guard` enforces "every line has ≥1 source" before `finalized_at` can be set. No `finalizePrayer` server fn is defined and no UI writes `finalized_at`. Prayers persist as drafts forever; the S1–S8 lineage requirement is never surfaced to the user despite being a stated product invariant.

**F. DNR: backend enforced, UI unaware.**
`wisdom.index.tsx:210` hardcodes `memoryDirective: "normal"`. There is no user affordance to mark a turn as `do_not_remember` or `session_only`, so the DB-enforced privacy contract has no way to be triggered from the shipped composer. The backend still refuses to derive durable artifacts from DNR turns, so behavior is safe but the promise is invisible.

**G. Legacy session viewer coexists with unified viewer.**
`wisdom.$sessionId.tsx` reads via `getSessionSlice` / `getSessionTelemetry` (legacy). Sessions created by the unified turn work here only to the extent their persisted shape happens to overlap; any mode-specific artifact keys added post-unified (renunciations, strongholds, etc.) are rendered by `wisdom.index.tsx`'s `UnifiedResultView`, not this route.

**H. `dashboard.functions.ts` is currently the only "dashboard" data source but is fed by whichever path wrote first**, so dashboard slice values reflect a mix of unified-turn and legacy-pipeline artifacts.

**I. Retrieval is un-scored.** No hybrid (semantic + lexical) ranking; both `curseBreaker.functions.ts` and unified orchestrator select passages by `limit(N)` without vector search or relevance scoring. Combined with (C), the "grounded" claim is currently weak.

**J. Theological-safety risk from (B) + (C) + (F).** With the wrong vocabulary in a stale file, only 1 approved source doc, and no user-visible DNR/consent, the surface "Curse Breaker discerns strongholds with cited scripture" is under-supported by the running system.

**K. Live DB turn stats confirm instability:** `wisdom_turns` shows 8 rows — 3 completed / 5 failed across companion, pattern, curse_breaker; matches recent enum-mismatch failures the user reported.

---

## 6) Stale Documents vs Current Code

- `.lovable/plan.md` (v3.5, ~40 tables) — DB currently has 39 public tables; plan text says "35 → 40" through revisions, product prose references modes named "Correction" and "Discernment" that do NOT exist in the code (only 4 modes in the enum).
- `docs/WISDOM_MODE_AND_SURFACE_AUDIT.md` — pre-unified-turn snapshot; still lists pipeline.functions as the primary path.
- `src/routes/README.md` — cursory; not aligned to the `_authenticated` layout convention now in use.
- Uploaded `Wisdom_PRD_for_Lovable.md`, `Wisdom_Lovable_Project_Knowledge.md`, `Wisdom_Lovable_Build_Prompts.md`, `Wisdom_Lovable_Mode_and_Surface_Wiring_Prompt.md`, `Wisdom_Product_Map_and_Wiring_Audit_2026-07-21.md` describe surfaces (persona consent, prayer finalize, DNR UI, correction mode) that are not wired.

---

## 7) Test / Build Status (read-only run)

`bun run test`: **83 passed, 22 skipped, 1 failed suite** — `tests/integration/preflightTurn2a.test.ts` fails at load time because it requires the Supabase CA at `/tmp/supabase-ca.crt` (or `SUPABASE_CA_CERT_PATH`) which is not present in this sandbox. It is an environment prerequisite, not a code regression. All unit + other integration suites pass, including DNR, mode-lock, pattern-lifecycle, signal contract, composer wiring, and unified turn.

Typecheck/build are covered by the harness in normal CI; not re-run here.

---

## 8) Prioritized Next Phase (no changes here — for the next build turn to consider)

P0 — collapse to one intelligence path:
1. Move `/dashboard` "Begin Wisdom" and "Begin Curse Breaker" onto `streamUnifiedTurn` (same as `/wisdom`), then delete `startWisdomSession`, `runWisdomPipeline`, `runCurseBreakerPipeline`, `getSessionSlice`, `getSessionTelemetry`, `pipeline.functions.ts`, `curseBreaker.functions.ts`, and legacy `wisdom.$sessionId.tsx` / `wisdom.curse-breaker.tsx`.
2. Delete `src/lib/wisdom/curseBreaker.ts` (unused, and its 14-category list contradicts the DB enum).

P1 — surface the invariants the DB already enforces:
3. Wire a DNR / "session_only" toggle in the composer (currently hardcoded to `"normal"`).
4. Wire persona consent (`persona.functions.ts` → a settings surface for sensitive facts).
5. Add `finalizePrayer` server fn + UI so prayers actually leave draft state, respecting `prayers_finalize_guard`.

P2 — theology-safety:
6. Grow the approved corpus beyond 1 document / 10 passages; add a real ranker to retrieval (embedding column + hybrid search) so cited passages are relevant, not just present.
7. Reconcile `.lovable/plan.md` and uploaded PRD/audit docs against the 4-mode reality; delete Correction/Discernment references or design them.

P3 — infra:
8. Provide the Supabase CA cert for `preflightTurn2a` so the full test suite is green in this sandbox.

No cosmetic UI work is proposed; every item above closes a documented invariant or removes a shipped contradiction.
