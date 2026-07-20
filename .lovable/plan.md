## Goal
Close the 6 remaining wiring gaps so every surface reflects real pipeline output.

## Scope

### 1. Wisdom map — real signals
- Extend `getConstellation` to compute per-node health from live data: pattern lifecycle + evidence count + recency, persona-fact status + confidence, prayer finalized/recency.
- Return `{ health: "green" | "amber" | "red", score, trend }` per node.
- Update `wisdom.map.tsx` `healthFor` to consume it (drop the neutral stub).

### 2. Prayer lineage
- Add `prayer_pattern_links` table (prayer_id, pattern_id, session_id) + RLS + grants.
- `pipeline.functions.ts`: when composing a prayer, insert link rows for the triggering session and any accepted/pending patterns whose evidence overlaps the session's signals.
- `getPrayerDetail` returns linked pattern summaries + originating session.
- `prayers.$prayerId.tsx` renders a "Roots" section with links back to `/patterns/:id` and `/wisdom/:sessionId`.

### 3. Event-chain cards in transcript
- Pipeline already extracts `event_chain` in interpretation. Surface it in `getSessionSlice` (already partly there) and render an `EventChainCard` in `InlineArtifactStrip` (`wisdom.index.tsx`) — trigger → choice → cost → alt-choice → repair chips.

### 4. Rate limiting + error surfacing on `/api/chat`
- Simple per-user token bucket in Postgres: `chat_rate_limits(user_id, window_start, count)` — 20 msgs / 5 min. Return 429 with `Retry-After`.
- `wisdom.index.tsx` `onError`: toast the message; render a red `pipeline_runs.status="error"` banner in the rail when the latest run failed.

### 5. Memory directive control in composer
- Add a "Don't remember this" toggle next to the send button in `wisdom.index.tsx`.
- Forward as `memoryDirective: "do_not_remember" | "remember"` in the chat body; `/api/chat` writes it onto the user `messages` row. Persona extraction and signals already respect the flag.

### 6. Archetype mirrors surface
- New route `src/routes/mirrors.tsx` + nav entry.
- `mirrors.functions.ts`: `listArchetypeMirrors` (user's `archetype_mirrors` + joined `biblical_archetypes` + `archetype_passages`) and `listAvailableArchetypes` for browsing.
- Pipeline: when interpretation cites an archetype, upsert an `archetype_mirrors` row for the user.

## Verification
- `bun run tsgo` and production build.
- Manual: send a Wisdom turn → confirm inline event-chain card, rail updates, prayer shows lineage after finalize, /you and /journey reflect new proposals, map nodes render non-neutral health, `/mirrors` lists cited archetypes, rate limit trips after ~20 rapid sends.

## Technical notes
- All server fns follow the existing `.middleware([requireSupabaseAuth])` + per-request `context.supabase` pattern; only rate-limit increment and mirror upsert use `supabaseAdmin` behind an authorized handler.
- One migration bundle: `prayer_pattern_links`, `chat_rate_limits`, and a small `archetype_mirrors` grant/policy refresh if needed. No breaking changes to existing tables.
- Query keys added: `["mirrors"]`, `["prayer-lineage", id]`. Existing keys invalidated on their mutations.
- No new external deps.

## Sequencing
Ship in this order so each step is independently verifiable: (1) map signals, (2) event-chain card, (3) memory-directive toggle, (4) prayer lineage (needs migration), (5) rate limiting + error surface (needs migration), (6) mirrors route (needs pipeline hook).
