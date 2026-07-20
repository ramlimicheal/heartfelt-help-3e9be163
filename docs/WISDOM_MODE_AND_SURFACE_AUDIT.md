# Wisdom — Mode and Surface Wiring Audit

**Audit date:** 2026-07-20
**Auditor:** Lovable agent
**Scope:** Verify current repository against `Wisdom_Lovable_Mode_and_Surface_Wiring_Prompt.md` and `Wisdom_Product_Map_and_Wiring_Audit_2026-07-21.md` before any code changes.
**Method:** Read remote Supabase schema (enums, columns, CHECK/UNIQUE constraints), read route/handler/pipeline source, cross-check against the mode and destination contracts.

Status legend: **CONFIRMED** (matches spec), **DIFFERS** (spec violated / gap found), **UNKNOWN** (insufficient evidence).

---

## 1. Mode contract freeze (§1 of instruction)

| Item | Status | Evidence |
|---|---|---|
| Single shared source of truth for mode contracts (server + client) | **DIFFERS** | No `modes.ts` contract module. Mode strings appear inline in `src/routes/api/chat.ts:24-27` (`"companion" \| "pattern" \| "deep" \| "curse_breaker"`) and again in `src/lib/wisdom/pipeline.functions.ts:293` (`"companion" \| "pattern" \| "deep_wisdom" \| "curse_breaker"`). The name for Deep Wisdom already disagrees between the two (`deep` vs `deep_wisdom`). |
| DB `session_mode` enum matches product mode list | **CONFIRMED** | Enum `session_mode = {companion, pattern, deep_wisdom, curse_breaker}`. |
| Companion writes no durable pattern/interpretation/persona/prayer/practice/curse-breaker rows | **DIFFERS** | `runWisdomPipeline` (pipeline.functions.ts) does not read `session.mode`; if invoked for a Companion session it still writes interpretation/prayer/practice. There is no server-side mode gate. |
| Pattern proposes but does not accept patterns | **CONFIRMED (design)** | `patterns.functions.ts:41` inserts `lifecycle: "proposed"`. Accept requires user action. |
| Deep Wisdom is a distinct pipeline profile (not Pattern + longer prompt) | **DIFFERS** | Only `/api/chat` prompt line changes per mode (`chat.ts:36-43`). The structured pipeline is identical for Pattern and Deep Wisdom. |
| Curse Breaker gated by versioned consent | **DIFFERS** | No `consents` table exists (`SELECT … tables … ILIKE '%consent%'` returned zero rows). Consent is in-memory UI only. |
| Mode locked after first message | **DIFFERS** | Sessions store `mode` at insert (`pipeline.functions.ts:303`) but there is no server check preventing later chats from running with a different mode value, and no client lock. |

---

## 2. Split-brain response path (§2)

| Item | Status | Evidence |
|---|---|---|
| Visible answer rendered from the same validated structured result that is persisted | **DIFFERS** | `/api/chat` (chat.ts:20-53) streams a free-form model response from a hard-coded system prompt with no retrieval, no schema, no citation gate. The validated pipeline (`runWisdomPipeline`) runs separately with its own retrieval/composition/citation gate. Two different intelligences. |
| Scripture in the visible answer comes from approved `source_passages` IDs | **DIFFERS** | `/api/chat` has no retrieval step. Model may invent references. |
| Mode prompt/model governed via `prompt_versions` / `model_configs` | **DIFFERS** (chat path only) | `runWisdomPipeline` loads `prompt_versions` + `model_configs` (pipeline.functions.ts:26-34). `/api/chat` hard-codes `google/gemini-3-flash-preview` and the SYSTEM prompt inline. |
| No chain-of-thought / scratchpad exposed | **CONFIRMED** | Only final `streamText` output surfaces. |

---

## 3. Memory directive (§3)

| Item | Status | Evidence |
|---|---|---|
| `do_not_remember` messages excluded from durable signals | **DIFFERS** | `runWisdomPipeline` builds `userTurns` by filtering only on `role === "user"` without checking `memory_directive` (pipeline.functions.ts:77). All user turns—including protected ones—feed extraction. |
| Signals carry their exact `source_message_id` | **DIFFERS** | Every extracted signal is attributed to `firstUserMsgId` (pipeline.functions.ts:108-116). One shared message ID for the whole batch. |
| DNR test proves later protected turn cannot leak | **DIFFERS** | No such test exists in the repo. |
| Persona facts remain proposed by default | **CONFIRMED (schema)** | `persona_fact_status = {session_only, proposed, accepted, rejected, deleted, corrected}`. |

---

## 4. Pattern lifecycle contract (§4)

| Item | Status | Evidence |
|---|---|---|
| Detector uses `proposed` (not `pending`) | **CONFIRMED** | `pattern.functions.ts:41` — `lifecycle: "proposed"`. DB CHECK allows `{proposed, accepted, refined, rejected, archived, reconsidered}`. |
| Acceptance requires feedback | **CONFIRMED (DB)** | CHECK `patterns_accept_requires_feedback` enforces non-empty `acceptance_feedback` when `lifecycle='accepted'`. |
| Server payload always populates required acceptance/rejection fields | **UNKNOWN** | Need to re-read `patterns.functions.ts` mutation code end-to-end. From column list, `rejected_reason`/`rejected_scope`/`rejected_evidence_snapshot` are all required on reject (`patterns_reject_requires_snapshot`). Whether the UI form always sends them is unverified. |
| Reconsideration requires new evidence | **CONFIRMED (DB)** | CHECK `patterns_reconsider_requires_evidence`. Whether the UI enforces this is UNKNOWN. |
| End-to-end test: qualifying evidence → single visible proposed pattern | **DIFFERS** | No such test present. |

---

## 5. Curse Breaker taxonomy (§5) — **primary release blocker**

| Item | Status | Evidence |
|---|---|---|
| One canonical 14-category vocabulary across DB, Zod, prompt, UI, telemetry, tests | **DIFFERS (severe)** | DB `interpretation_category` enum = `{biblical_curse, stronghold, chosen_behavior, trauma_wound, systemic_injustice, physiological, spiritual_attack, generational_sin, identity_lie, vow_or_agreement, unforgiveness, idolatry, fear_bondage, ignorance}` (14 rows, but a completely different framework from the founder/PRD list). Founder list required by the instruction: `{chosen_behavior, habit, appetite, belief, shame, hidden_agreement, relationship_pressure, social_normalization, family_learning, generational_repetition, material_conditions, spiritual_practice_absence, user_reported_spiritual_conflict, direct_biblical_curse_stronghold}`. Only `chosen_behavior` overlaps. |
| Cheap scoring for all 14, deep analysis only above threshold | **CONFIRMED (logic)** | `curseBreaker.functions.ts` two-pass with `onConflict: "session_id,category"` upsert and per-category deep gate. Uses the DB enum, so the logic is right but scores the wrong 14 categories. |
| User-reported spiritual conflict kept separate from model hypothesis | **DIFFERS** | Not represented — no `user_reported_spiritual_conflict` category, no separate user-verdict column at row level distinct from cheap/deep model scores. |
| Never auto-concludes "cursed", "possessed", etc. | **CONFIRMED (prompt/UI)** | Cards render categories as proposals; no verdict language observed. |
| Owned / not mine / unsure / later user verdicts | **DIFFERS (partial)** | `category_verdict` enum = `{accepted, rejected, unsure, deferred}` exists, but no verdict column on `stronghold_categories` was surfaced in the audit query — needs a targeted column check before spec'ing the migration. |
| Consent persisted per session with version + timestamp | **DIFFERS** | No `consents` table; no `consent_version`/`consent_accepted_at` columns on `sessions`. |
| Relevance-ranked retrieval for CB (not first 30) | **DIFFERS** | `curseBreaker.functions.ts` and `pipeline.functions.ts:120-124` both `.limit(24)` or similar over `approved` passages without rank. |
| UI shows reference + translation + tier + excerpt + explanation + derivation + limits (not UUIDs) | **DIFFERS** | Deep-analysis rendering (curseBreakerCards.tsx) surfaces `passage_id` fragments; no join to `source_passages.reference/text`. |

---

## 6. Stable turn identity (§6)

| Item | Status | Evidence |
|---|---|---|
| Triggering user-message UUID = idempotency key | **DIFFERS** | `runWisdomPipeline.inputValidator` accepts an optional `idempotencyKey` string but the dashboard invocation (dashboard.tsx:76-77) does not pass one. No DB unique on `(session_id, triggering_message_id, stage)`. |
| One artifact set per session + triggering turn + stage | **DIFFERS** | Every call to `runWisdomPipeline` inserts a new row into `interpretations`, `prayers`, `practices`, `discernments`. Retries duplicate. |
| One evolving interpretation / prayer draft / primary practice per session | **DIFFERS** | Insert-only, no upsert on `(session_id)` for these rows. |
| Only finalized prayers appear in library | **UNKNOWN** | `prayers.finalized_at` is set immediately after insert (pipeline.functions.ts:254). Effectively every prayer is "finalized" → library shows drafts. Contradicts the spec. |

---

## 7. Destination pages (§7)

| Page | Status | Notes |
|---|---|---|
| `/wisdom` sole creation surface | **DIFFERS** | Dashboard has its own `startWisdomSession + runWisdomPipeline` composer (dashboard.tsx:76-77). |
| `/dashboard` read-only orientation | **DIFFERS** | Composer invokes pipeline directly instead of prefilling `/wisdom`. |
| `/patterns` hypothesis inbox with lifecycle controls | **CONFIRMED (present)**; **UNKNOWN (payload completeness for reject/reconsider)** | Route exists; server-payload adequacy for CHECK constraints needs a follow-up read. |
| `/prayers` finalized library w/ full lineage per line | **DIFFERS (partial)** | Prayer line sources join is present, but every prayer is finalized on insert → draft rows leak. |
| `/mirrors` | **DIFFERS** | No `mirrors` route file present. |
| `/journey` with practice/check-in workflow | **DIFFERS** | Route exists but check-in workflow not wired (needs a targeted read of `journey.tsx` to confirm). |
| `/you` persona graph with full status set | **CONFIRMED (schema)** | Enum supports all six statuses. |
| `/settings/privacy` Export / Delete / Disable Memory wired | **DIFFERS** | Buttons render (settings.privacy.tsx:44-52) with no `onClick` handlers. |

---

## 8. Competing / stale flows (§8)

| Item | Status | Evidence |
|---|---|---|
| Dashboard composer enters `/wisdom` (not runs pipeline directly) | **DIFFERS** | See §7 above. |
| Single canonical session result view | **DIFFERS** | Both `src/routes/wisdom.$sessionId.tsx` and `src/routes/wisdom.live.$sessionId.tsx` exist. |
| `/wisdom/map` decision (feature-flag or remove) | **DIFFERS** | Route file present, unlinked from sidebar, still directly routable. |
| Duplicated Wisdom nav item / 6-in-5 mobile grid | **UNKNOWN** | Needs targeted read of `AppShell.tsx` mobile grid. |

---

## 9. Migration reproducibility (§9)

| Item | Status | Evidence |
|---|---|---|
| Remote ledger inspected before touching historical migrations | **CONFIRMED (this pass)** | 12 migrations listed under `supabase/migrations/`; remote schema matches columns/enums/checks queried above. |
| Fresh replay proven | **UNKNOWN** | Not executed. |
| Consolidated migration duplicating earlier objects | **UNKNOWN** | Needs migration-by-migration diff. |

---

## 10. Executable evidence (§9 verification list)

| Item | Status |
|---|---|
| `tsc --noEmit` | **UNKNOWN** (build runs automatically in Lovable; not executed as a standalone check this pass) |
| Production build | **UNKNOWN** |
| Lint | **UNKNOWN** |
| Auth owner isolation / cross-user denial tests | **DIFFERS** (no test files) |
| Client bundle contains no service-role / Lovable API secrets | **CONFIRMED (design)** — `client.server.ts` is server-only; `LOVABLE_API_KEY` read inside handler bodies |
| Mode-switch test | **DIFFERS** |
| Protected-message leakage test | **DIFFERS** |
| Pattern lifecycle end-to-end test | **DIFFERS** |
| Curse Breaker 14-taxonomy test | **DIFFERS** |
| Prayer citation/lineage test | **DIFFERS** |
| Retry/idempotency test | **DIFFERS** |

---

## Release-critical findings ranked

1. **Curse Breaker taxonomy is the wrong 14 categories.** Requires a data migration + enum replacement + prompt/UI/Zod alignment. Historical rows must be mapped, not destructively coerced.
2. **`/api/chat` is split-brain.** Visible answer bypasses retrieval, citation gate, and prompt-version governance. Must be replaced by an orchestrator that streams a deterministic rendering of the validated structured result.
3. **DNR is not enforced in the general pipeline.** Protected turns leak into extraction and are attributed to the first user message. Fixing this needs (a) filtering `memory_directive='do_not_remember'` from `userTurns`, and (b) per-signal `source_message_id`.
4. **No consent table for Curse Breaker.** Requires `consents` (or `sessions.consent_version` + `consent_accepted_at`) and a server gate before CB pipeline runs.
5. **No stable turn identity.** Pipeline retries duplicate prayers/interpretations/practices. Needs `triggering_message_id` on artifact rows + unique constraints.
6. **Every prayer is finalized on insert.** Draft accumulation floods the library. Needs one-evolving-draft-per-session upsert and explicit finalize action.
7. **Dashboard bypasses `/wisdom`.** Composer must prefill and navigate, not run its own pipeline.
8. **Privacy Export/Delete/Disable buttons are non-functional.** Hide or implement — do not ship non-working privacy controls.
9. **`/mirrors` route missing.** Instruction §7 lists it as a required destination.
10. **Two session-result views (`wisdom.$sessionId` + `wisdom.live.$sessionId`).** Collapse to one.

---

## Recommended execution order (matches §10 checkpoints)

1. **Checkpoint 1 — Foundations (this document + contract module).**
   - Add `src/lib/wisdom/modes.ts` shared contract.
   - Create `consents` table + `sessions.mode_locked_at` migration.
   - Add `triggering_message_id` column to `interpretations`, `prayers`, `practices` with unique `(session_id, triggering_message_id)`.
2. **Checkpoint 2 — Privacy + mode lock + Pattern repair.**
   - Enforce DNR filtering and per-signal `source_message_id`.
   - Lock mode on first message; introduce linked-session on switch.
   - Verify `patterns` reject/reconsider payloads satisfy CHECK constraints; add end-to-end test.
3. **Checkpoint 3 — Unified orchestrator.**
   - New `respondInWisdom` server function that runs retrieval + validated composition and returns a stream of user-facing fields.
   - `/api/chat` becomes a thin wrapper that streams that same result.
   - `/dashboard` composer prefills `/wisdom`.
4. **Checkpoint 4 — Curse Breaker taxonomy / retrieval / consent.**
   - Migration: introduce `interpretation_category_v2` with the founder 14, add mapping table, backfill, rename.
   - Consent gate + versioned record.
   - Rank retrieval and render passage detail in cards.
5. **Checkpoint 5 — Destination page wiring.**
   - Add `/mirrors`, collapse `wisdom.live.$sessionId` into the canonical view, wire Journey check-ins, wire or hide privacy actions.
6. **Checkpoint 6 — Migration/build/release proof.**
   - Reproducible replay; smoke tests; verdict.

Each checkpoint returns only the six evidence bullets required by §10.

---

## Final verdict for this checkpoint

**NOT READY.** Ten release-critical wiring gaps are open. No user-visible changes were made in this pass; this document is the deliverable for checkpoint 1 evidence gate. Awaiting approval to proceed with Checkpoint 2 (Privacy + mode lock + Pattern repair).
