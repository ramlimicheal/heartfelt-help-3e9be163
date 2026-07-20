# Dashboard Wiring — Real Data, No Seed Leakage

## Goal
Replace all seed/mock reads in production Wisdom routes with a single authenticated server function backed by RLS-scoped queries. Every tile gets loading / empty / populated / error states. Enforce the "user confirms, not Wisdom" copy contract.

## 1. Server contract — `getDashboardSlice`
New file `src/lib/wisdom/dashboard.functions.ts`:

- `createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])`
- Runs ~7 parallel `context.supabase` queries scoped to `userId` (RLS re-enforces):
  - `sessions` — most recent by `updated_at`, plus 5 recent
  - `patterns` — counts by `lifecycle` (proposed / accepted / improving / recurring), most-recently-updated row (id, name, lifecycle, confidence, updated_at)
  - `persona_facts` — counts by `status` (`accepted`, `proposed`); **no text, no sensitive rows**
  - `prayers` — latest finalized (id, title, created_at) + `count(prayer_lines)`
  - `formation_events` — last 5 (type, at, note — no fruit scores)
  - `check_ins` — last 1 (state only)
  - `pipeline_runs` — any `status='running'` for the latest session → drives "Live" flag
- Returns a Zod-validated `DashboardSlice` DTO with `emptyFlags` and a `suggestedNext: "start_wisdom" | "review_pattern" | "confirm_memory" | "open_prayer"`.

Contract lives in `src/lib/wisdom/dashboard.schemas.ts` (client-safe).

## 2. Dashboard route rewrite
`src/routes/dashboard.tsx`:
- Remove all imports from `@/lib/wisdom/mock/seed`.
- `useQuery(['dashboard-slice'], useServerFn(getDashboardSlice))`.
- One skeleton grid while loading; per-tile error boundary with retry (`refetch`).
- Tiles rewritten against DTO:
  - **Session** — real title + updated_at; "Live" chip only when `runningPipeline === true`. Empty copy: *No conversation yet — Bring a real situation when you're ready.*
  - **Pattern activity** — real counts + most-recent row; confidence bar only if `confidence != null`. Line: *This remains a candidate until you confirm or refine it.*
  - **Persona Graph** — `"{n} things you've confirmed · {m} proposed memories awaiting review"`; link to `/you`. No fact text.
  - **Prayer scaffold** — latest prayer title + movement count. Empty: *No prayer has been formed yet. A prayer will appear after Wisdom understands the situation and verifies its biblical roots.*
  - **Recent** — real sessions only; empty state points to `/wisdom`.
  - **Fruit** — enum state pill from last formation_event / check_in; no scores, no streaks.

## 3. Wisdom chat route cleanup
`src/routes/wisdom.index.tsx`:
- Delete the right-rail cards that read from `HYPOTHESES / ARCHETYPE_INDEX / PRAYERS`. Replace with a live rail that reads the same slice (lightweight) and shows real "Emerging pattern" only when one exists; otherwise a quiet placeholder.
- Copy fix: `"mirrors it through Scripture—never as a verdict"` (search all routes).
- Remove any wording that says Wisdom "confirms" a pattern.

## 4. Navigation trim
`src/components/wisdom/AppShell.tsx`:
- Keep: Wisdom, Curse Breaker, Dashboard, Patterns, Prayer, Journey, You.
- Remove Constellation (`/wisdom/map`) and Mirrors from the sidebar (files stay, just unlinked).

## 5. Copy sweep
Grep for `never as advice`, `Wisdom confirms`, `Wisdom will confirm` → replace with approved wording. Central strings in `src/lib/wisdom/copy/v1.ts` where possible.

## 6. Responsive + a11y
- Verify grid at 375 / 768 / 1280 / 1600 via Playwright screenshots.
- Re-run axe in dark + light.

## 7. RLS check
Confirm existing policies on `sessions`, `patterns`, `persona_facts`, `prayers`, `prayer_lines`, `formation_events`, `check_ins`, `pipeline_runs` scope to `auth.uid()`. No migration expected; if a gap is found I'll surface a migration for approval before shipping.

## 8. Evidence returned
Changed files list, removed mock imports, DTO shape, table/RLS map, Playwright screenshots (empty + populated, mobile + desktop, dark + light), axe results, confirmation no seed reaches production.

## Out of scope
- No schema changes unless RLS gap discovered.
- Constellation/Mirrors routes untouched (just unlinked).
- Curse Breaker page untouched this pass.
