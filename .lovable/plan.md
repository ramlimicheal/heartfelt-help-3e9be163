# Wisdom MVP — Implementation Plan

Build the Wisdom vertical slice: **Story → signals → event chain → 1–3 pattern hypotheses → approved biblical mirror → source-grounded discernment → prayer with line-level lineage → one next act → accept/edit/reject → timeline event.**

Not a chatbot. Not one LLM call. Structured cards, staged server pipeline, source tiers, user-controlled memory.

Nova will be removed. Wisdom takes `/`.

---

## Stage A — Foundation & calm design system

**Goal:** the visual language and route shell exist; nothing wired to AI.

- Rip Nova out of `src/routes/index.tsx`.
- Update `src/styles.css`: warm-neutral background, deep ink text, muted gold accent, restrained blue/olive secondary, generous whitespace. Serif for reflective long-form (headings), humanist sans for body. Light **and** dark themes as semantic tokens. Reduced-motion respect. WCAG AA contrast.
- App shell in `__root.tsx`: mobile bottom nav (**Wisdom · Patterns · Prayer · Journey · You**), desktop left rail, header with theme toggle and account.
- Head metadata: real Wisdom title/description, no template defaults.

**Checkpoint:** design system + empty routes render on mobile 360 and desktop.

---

## Stage B — Static routes with typed mock intelligence (Prompt 1)

**Goal:** the whole product experience is walkable, with one full seeded example (“Helping without boundaries”), zero backend, zero real AI.

Routes:

```
/welcome
/onboarding
/wisdom                      list of sessions + new
/wisdom/:sessionId           the structured session view
/patterns                    map of patterns by status
/patterns/:patternId         event chain, evidence, alternatives, mirrors, practices
/prayers                     saved prayers
/prayers/:prayerId           lines with expandable Prayer Roots
/journey                     formation timeline
/you                         persona memory: proposed / accepted / rejected
/settings/privacy            export, delete, disable memory, "do not remember" docs
```

Session view is **not** a message stream. It renders these cards in order:

1. What I hear
2. The pattern I see (with confidence + rename/edit)
3. Why I see it (evidence message IDs)
4. Biblical mirror (narrative summary + primary references + Why this connection?)
5. Discernment & uncertainty (alternatives, missing evidence, counter-evidence, one distinguishing question)
6. Prayer (movements, expandable per-line **Prayer Roots**)
7. One next act (+ up to 2 optional practices)
8. Feedback: Accurate / Partly / Not / Unsure — plus rename / edit / reject

Deep-mode reveal adds: Persona Signals, Event Chain (Context→Trigger→Interpretation→Need→Choice→Reward→Cost→Afterthought→Re-entry), Alternative Hypothesis, Hidden Agreement candidate, Flesh/World/Spiritual-conflict lenses, Source Tiers (S1–S8), Prayer Lineage table, Practice Rationale, Fruit to Observe.

Types live in `src/lib/wisdom/schemas.ts` — mirror the PRD data model exactly (patterns, evidence, archetypes, prayer lines with source lineage, formation events, persona facts with memory states). Mock data in `src/lib/wisdom/mock/`.

Seeded example: a user story about helping a friend financially → pattern “Helping without boundaries” → mirror set including Moses/Numbers 11 (overload) and rich young ruler (attachment) → prayer built from Psalm 51 + Numbers 11 movements with per-line lineage → one next act (a bounded conversation script).

**Checkpoint:** user can walk the entire seeded flow, give feedback, and see a mocked formation event.

---

## Stage C — Backend, auth, schema, RLS (Prompt 2)

**Goal:** Lovable Cloud enabled with the 16-table schema and full RLS.

Tables: `user_profiles`, `sessions`, `messages`, `persona_facts`, `patterns`, `pattern_evidence`, `pattern_relations`, `source_documents`, `source_passages`, `biblical_archetypes`, `archetype_passages`, `pattern_archetypes`, `prayers`, `prayer_lines`, `prayer_line_sources`, `practices`, `formation_events`, `model_runs`.

- Enums for every lifecycle field (persona status, pattern status, source tier S1–S8, message role, memory sensitivity, prayer movement, fruit tag).
- `user_roles` table + `has_role` security-definer function. Roles: `user`, `curator`, `admin`. Roles never live on `user_profiles`.
- Every user-owned table: `GRANT` to `authenticated`, `ALL` to `service_role`, `ENABLE ROW LEVEL SECURITY`, policies scoped to `auth.uid()`.
- Source/archetype tables: `GRANT SELECT` to `authenticated`, writes limited to `curator`/`admin` via `has_role`. Curators explicitly **cannot** read private user content — no cross-privilege grant.
- Seed 40–60 approved biblical archetypes from the PRD priority list (Adam & Eve, Cain, Abraham & Sarah, Jacob, Joseph, Moses, wilderness Israel, Joshua, Samson, Hannah, Saul, David, Solomon, Elijah, Elisha, Jehoshaphat, Nehemiah, Esther, Job, Psalms, Proverbs, Daniel, Jonah, Mary, Peter, Martha & Mary, Zacchaeus, rich young ruler, prodigal, Jesus in wilderness, Gethsemane, Paul, early church) — original curator summaries + references (no copyrighted translation text ingested).
- Auth: email/password + Google via Lovable's broker.

**Checkpoint:** RLS review passes; cross-user access denied; curators can't read user sessions.

---

## Stage D — Vertical intelligence slice (Prompt 3)

**Goal:** one real end-to-end pipeline replaces the mock. Multi-stage, provider-neutral, streaming truthful status.

Server functions (TanStack `createServerFn`, not Edge Functions — this is a TanStack Start project):

| Stage | Function | Output |
|---|---|---|
| 0 | `classify-intent` | intent enum |
| 1 | `extract-signals` | signals[] with evidence_message_ids, explicit/inferred, confidence |
| 2 | `propose-persona-update` | accepted_facts (retrieved) + proposed_facts (never auto-accepted) |
| 3 | `build-event-chain` | ordered links; user-fact vs inferred flag on each |
| 4 | `propose-patterns` | 1–3 hypotheses w/ evidence, counter-evidence, hidden-agreement candidate, distinguishing question, confidence |
| 5 | `retrieve-biblical-mirrors` | pulls only from `curator_status='approved'`; narrative-fit reranked |
| 6 | `evaluate-discernment` | tests context, alternatives, descriptive vs prescriptive, source tiers |
| 7 | `compose-response-plan` | approved plan — the renderer may not add claims outside it |
| 8 | `compose-prayer` | lines with source_passage_ids, derivation_type, explanation, movement, confidence; no line stored without lineage |
| 9 | `select-practice` | one primary act + ≤2 optional |
| — | `wisdom-session` | **orchestrator** — streams status events only: `mapping_story`, `testing_patterns`, `finding_biblical_mirrors`, `preparing_prayer`, `rendering_response`. Never streams chain-of-thought. |

Every stage: Zod schema validation → one schema-repair retry → fail gracefully. Every model call logged to `model_runs` (provider, model, prompt version, latency, tokens, validation result — no unnecessary user content).

Model routing via a `WisdomModelGateway` interface backed by the Lovable AI Gateway (`google/gemini-3-flash-preview` for fast structured extraction, a stronger reasoning model for hypothesis + discernment). All keys server-side.

Refusals encoded in the pipeline: no possession/curse verdicts, no manifestation guarantees, no "God says…" first person, no auto-40-day fasting from numeric recurrence, no diagnosis from a face.

**Checkpoint:** the seeded story now returns real generated output, all cards populated, prayer has 100% line-level lineage coverage, at least one alternative hypothesis appears on ambiguous input.

---

## Stage E — Memory & pattern lifecycle (Prompt 4)

- Persona states: `session_only`, `proposed`, `accepted`, `rejected`, `sensitive`, `deleted`. Model-created facts start `proposed`. Sensitive/identity requires explicit confirmation. "Do not remember" per message.
- Pattern states: `proposed`, `exploring`, `accepted`, `rejected`, `improving`, `recurring`, `resolved`, `archived`. Rename + edit preserved.
- Context assembler retrieves only relevant accepted facts + accepted/rejected patterns — never whole history.
- Rejected facts never silently return; deleted rows excluded from all retrieval; DNR messages never yield persona proposals.

---

## Stage F — Formation Timeline & check-ins (Prompt 5)

- Event types: story_shared, pattern_proposed/accepted/edited/rejected, prayer_created/edited, practice_selected, checkin_completed, setback_recorded, fruit_observed, confidence_changed, archived.
- Fruit tags: clarity, peace, self-control, honesty, courage, forgiveness, restitution, relationship_health, consistency, service, patience, reduced_repetition.
- Check-in compares outcome vs prior hypothesis, proposes confidence delta or missing link — cannot silently rewrite the pattern.
- **No streaks, ranks, faith scores, shame notifications, deteriorating imagery.** Setback = data, never identity judgment.

---

## Stage G — Curator + evaluation foundation (Prompt 6)

Admin-only routes for source docs, archetypes, prompt versions, and a golden-case runner. Curator role cannot access user conversations. Deferred until D–F are green.

---

## Not in MVP

Hope Mirror (Prompt 7), voice, full multilingual, advanced numerical patterns, broad extra-canonical ingestion, full fasting planner, couple accounts, church dashboards, payments, public feeds.

---

## Technical notes

- Stack stays as-is: TanStack Start v1 + React 19 + Tailwind v4. No `src/pages/`, no React Router DOM.
- All AI calls via `createServerFn` handlers using the Lovable AI Gateway helper. `LOVABLE_API_KEY` never client-side.
- Every AI-produced JSON validated with Zod before any DB write; no `.min/.max/format` inside `Output` schemas (constrain in prompt, clamp in code).
- Every route with a loader: `errorComponent` + `notFoundComponent`. Root: `notFoundComponent`. Router: `defaultErrorComponent`.
- Auth routes live under `_authenticated/`. Public routes (welcome, auth) top-level.
- Tests: Vitest + RTL for card behavior, feedback controls, prayer-root expansion, memory controls. Direct server-fn tests for schema validation, ambiguous input, malformed model output, source-less prayer rejection, rejected-pattern behavior.

---

## What I'm doing next (if you approve)

Execute **Stage A + Stage B** in one pass: remove Nova, ship the calm design system, build all 11 routes with the full "Helping without boundaries" seeded example and typed schemas — no backend yet. You'll be able to walk the whole product before we enable Cloud.

If you want a different starting stage (e.g. plan Cloud/schema first and skip the mocked frontend), tell me and I'll re-cut the sequence.
