# P2 — Make Wisdom Fully Alive

Goal: remove every mock/seed read from user-facing routes, unify the split-brain session viewer, and wire real Supabase data (via server functions with `requireSupabaseAuth`) into every nav destination. Result: nothing a user clicks shows canned data.

## Scope

### 1. Fix the split-brain session viewer
- Delete `src/routes/wisdom.$sessionId.tsx` (mock).
- Rename `src/routes/wisdom.live.$sessionId.tsx` → `src/routes/wisdom.$sessionId.tsx` and update its `createFileRoute` string.
- Update `AppShell` Recent list, dashboard tiles, and `wisdom.index.tsx` rail to link to the unified route.
- After a turn completes in `/wisdom`, navigate to `/wisdom/$sessionId` so refresh preserves the conversation.

### 2. Delete dead code
- `src/routes/wisdom.map.tsx` (unlinked, points to nonexistent routes).
- `src/lib/wisdom/mock/seed.ts` and `curseBreakerSeed.ts` (after all consumers are rewired).
- Any remaining `HYPOTHESES / PRAYERS / PERSONA_FACTS / ARCHETYPE_INDEX / PASSAGE_INDEX / seededTimeline` imports.

### 3. Wire real data — new server functions
All authenticated, all RLS-scoped, all Zod-validated DTOs. New file `src/lib/wisdom/library.functions.ts`:

- `listPatterns()` — user's patterns from `patterns` + counts by lifecycle.
- `getPattern(id)` — single pattern + `pattern_evidence` + linked passages.
- `listPrayers()` — user's finalized `prayers` + line counts.
- `getPrayer(id)` — prayer + `prayer_lines` + `prayer_line_sources` joined to `source_passages`.
- `listJourney()` — recent `formation_events` and `check_ins` merged by `at`.
- `getPersonaFacts()` + `confirmPersonaFact(id)` / `rejectPersonaFact(id)` for `/you`.

### 4. Rewrite routes against real data
- `patterns.index.tsx`, `patterns.$patternId.tsx` — `useSuspenseQuery` on new fns; empty states from `.lovable/plan.md` copy.
- `prayers.index.tsx`, `prayers.$prayerId.tsx` — same pattern.
- `journey.tsx` — real timeline; empty state.
- `you.tsx` — real persona facts; accept/reject persist via server fn.
- `wisdom.curse-breaker.tsx` — consume `runCurseBreakerPipeline` result (from dashboard nav state / query key) instead of `cbResponse` seed.

### 5. Wire `/settings/privacy`
New server fns in `src/lib/wisdom/privacy.functions.ts`:
- `exportMyData()` — returns JSON of user-owned rows across sessions/messages/patterns/prayers/persona_facts.
- `deleteMyAccount()` — cascades via existing FKs; server-only; requires confirmation string.
- `setMemoryPaused(bool)` — writes to `profiles`.

Wire the three buttons in `settings.privacy.tsx` with real onClick handlers, confirmation dialogs, and toast feedback.

### 6. Cleanup
- Fix all 31 TypeScript errors (will resolve naturally as mock imports are removed).
- Delete unused `AppShell` icons after removing Constellation/Mirrors leftovers.
- Sanity pass: `bunx tsgo --noEmit` clean, existing 112 tests still green.

## Technical Details

- All new server fns follow the canonical pattern: `createServerFn({ method }).middleware([requireSupabaseAuth]).inputValidator(zod).handler(...)`.
- All reads use `context.supabase` (RLS as user). No `supabaseAdmin` for reads.
- `deleteMyAccount` is the only one that loads `supabaseAdmin` inside the handler (auth admin API).
- Zod DTOs live in `src/lib/wisdom/library.schemas.ts` (client-safe).
- Route loaders use `context.queryClient.ensureQueryData(queryOptions)` + `useSuspenseQuery` pattern from `tanstack-query-integration`.
- Every route with a loader defines `errorComponent` + `notFoundComponent`.

## Order of execution

1. Session viewer unification + dead-code deletion (biggest UX win, unblocks refresh).
2. `library.functions.ts` + rewrite `/patterns`, `/prayers`, `/journey`, `/you`.
3. Curse Breaker real wiring.
4. `/settings/privacy` server fns + buttons.
5. Typecheck + test sweep.

## Out of scope
- No schema changes.
- No new UI design — keep current visual language.
- No SEO/OG image work (Dashboard/Wisdom stay auth-gated, not shareable).
- Constellation/Mirrors remain deleted (not restored).

## Deliverable
Every nav destination reads live user data. Zero imports from `mock/`. Typecheck clean. All 112 tests still pass. Screenshot evidence of one populated + one empty state per rewritten route.
