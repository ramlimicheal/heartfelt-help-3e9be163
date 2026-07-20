# Sync remaining 8 routes to real data

Same pattern as `dashboard` / `wisdom/index`: routes stay top-level, data is fetched via `useServerFn` + `useQuery` in the component (never in a loader), all queries scoped by `requireSupabaseAuth`. Every route gets loading / error / empty states and drops its `mock/seed` import.

## Fidelity policy (important)

Some mock structures don't have a full DB counterpart yet (composite `WisdomResponse`, hypothesis→archetype linkage graph, per-line prayer roots, "confidence" per pattern). Rules:

- Fetch every field the schema actually stores.
- For fields with no backing table/column, **omit that UI block** rather than fabricate. No mock values injected as fallbacks. No fake confidence / fake health colours.
- Keep the copy contract intact ("never as a verdict", "recorded, never identity", etc.).

## Files added

Client-safe server-fn modules under `src/lib/wisdom/`:

- `journey.functions.ts` — `getJourneyTimeline` → `formation_events` for user (asc/desc, limit).
- `you.functions.ts` — `listPersonaFacts`, `setPersonaFactStatus` (mutation goes through service role after ownership check, same shape as existing persona fns).
- `prayers.functions.ts` — `listPrayers`, `getPrayerDetail` (join `prayer_lines` + `prayer_line_sources` + `source_passages`).
- `patterns.functions.ts` — `listPatterns`, `getPatternDetail` (pattern + `pattern_evidence` + `practices` via `practice_assignments`; hypothesis-graph fields left out).
- `session.functions.ts` — `getSessionDetail` (session + `messages` + latest `interpretations` row + `discernments` + linked `prayers`/`practices`).
- `constellation.functions.ts` — `getConstellation` for `/wisdom/map`: user's patterns, persona facts (non-rejected), prayers, and archetype references pulled from `pattern_evidence`/`interpretations`.

## Files changed

- `src/routes/journey.tsx` — swap `seededTimeline` for `getJourneyTimeline`; keep the timeline UI and TYPE_LABEL map.
- `src/routes/you.tsx` — swap `PERSONA_FACTS` for `listPersonaFacts`; buttons call `setPersonaFactStatus` and invalidate the query. No local `useState` seed.
- `src/routes/prayers.index.tsx` — swap `PRAYERS` for `listPrayers`.
- `src/routes/prayers.$prayerId.tsx` — swap loader-side mock lookup for a `useQuery` on `getPrayerDetail(prayerId)`; keep expandable Prayer Roots.
- `src/routes/patterns.index.tsx` — swap `HYPOTHESES` for `listPatterns`.
- `src/routes/patterns.$patternId.tsx` — swap `ARCHETYPE_INDEX / HYPOTHESES / PRACTICES / RESPONSES` for `getPatternDetail`; render only sections backed by real data.
- `src/routes/wisdom.$sessionId.tsx` — swap `SESSIONS / RESPONSES / …` for `getSessionDetail`; render messages + interpretation + discernment + linked prayer/practices. Sections without backing data (hypothesis alternatives, per-line roots when absent) are hidden, not faked.
- `src/routes/wisdom.map.tsx` — swap the seed graph for `getConstellation`; keep the visual shell (categories, sort, filter, chat dock). Empty categories render an empty state instead of seed nodes.

Zero routes move under `_authenticated/`. Data fetching lives in the component via `useServerFn` — matches the existing dashboard/wisdom-index pattern and avoids the SSR-bearer-token pitfall.

## Verification

- `bun run tsgo` (typecheck), `bun run build` (production build).
- Preview-side spot check on `/journey`, `/you`, `/prayers`, `/patterns`, and `/wisdom/map` while signed in to confirm no console errors and empty states render before real data exists.

## Technical notes

- All new server fns follow the existing `pattern.functions.ts` shape: `.middleware([requireSupabaseAuth])`, per-request `context.supabase` for reads, `await import('@/integrations/supabase/client.server')` only when a write needs to bypass RLS (`setPersonaFactStatus`).
- No new tables or migrations. If a section legitimately needs new tables (e.g. persistent `WisdomResponse` composite), that's called out as follow-up and not silently modelled here.
- Query keys: `["journey"]`, `["persona-facts"]`, `["prayers"]`, `["prayer", id]`, `["patterns"]`, `["pattern", id]`, `["session", id]`, `["constellation"]`. Invalidated on relevant mutations.
