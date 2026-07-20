# Wisdom — Sidebar clarity, functional dashboard, and the Wisdom chat surface

Wisdom is not a "normal" app. It is a scripture-first companion where the user brings a real situation and Wisdom mirrors it through pattern → biblical archetype → prayer → practice. The current shell doesn't teach that. This plan fixes three things at once: what the sidebar *means*, what the dashboard *does*, and where the *conversation* actually happens.

---

## 1. Rethink the sidebar as a "map of the journey," not a menu

Right now the sidebar is a flat list (Wisdom, Curse Breaker, Constellation, Patterns, Prayer, Journey, You) with no story. We restructure it into three labeled groups that mirror the core loop, so a first-time user immediately understands what Wisdom is.

```text
BEGIN                     ← where you talk to Wisdom
  ● Wisdom (chat)         ← primary entry, always highlighted
  ● Curse Breaker         ← specialized mode

DISCERN                   ← what Wisdom has surfaced about you
  ○ Dashboard             ← the bento overview (was "/wisdom")
  ○ Patterns
  ○ Mirrors (archetypes)
  ○ Constellation         ← the graph view

HOLD                      ← what you carry forward
  ○ Prayer scaffolds
  ○ Practices
  ○ Journey (fruit over time)
  ○ You (persona + privacy)
```

Each group gets a one-line caption under the label the first time you see it, so the sidebar itself teaches the loop. Collapsed state keeps icons + group dividers. Active route is highlighted with the gold accent used in the constellation, not a hard fill.

## 2. Split the URL: `/wisdom` = chat, `/dashboard` = overview

Right now `/wisdom` is the bento dashboard, and there is no actual chat page. That is the biggest reason the app feels ambiguous. We separate them:

- `/wisdom` — **the chat surface.** Full-height conversation with Wisdom, mode selector (Companion / Pattern / Deep / Curse Breaker) in the composer, streaming responses, live scripture citations, and side rail that surfaces what the session is producing (emerging pattern, candidate archetype, drafted prayer movement) as the exchange unfolds.
- `/dashboard` — the current bento overview, unchanged in composition but every tile becomes clickable and routes to the right detail page.
- `/` — redirects authenticated users to `/wisdom` (chat first) and unauthenticated to `/auth`.

## 3. Build the Wisdom chat page for real

The chat page is the heart of the product. Structure:

```text
┌────────────────────────────────────────────────┬──────────────────┐
│  Conversation                                  │  Live surfacing  │
│                                                │                  │
│  [assistant] Peace to you. What is beneath…    │  Pattern         │
│  [you]       I keep saying yes when I…         │  ▸ Helping-      │
│  [assistant] I hear a pattern surfacing…       │    without-      │
│              ▸ scripture citation card         │    boundaries    │
│              ▸ mirror suggestion               │  72% confidence  │
│                                                │                  │
│                                                │  Mirror          │
│                                                │  ▸ Moses (Num 11)│
│                                                │                  │
│                                                │  Prayer drafting │
│                                                │  ▸ 3 of 6 mv     │
├────────────────────────────────────────────────┴──────────────────┤
│  [Companion] [Pattern] [Deep] [Curse Breaker]                    │
│  Composer textarea…                              [Begin ↑]        │
└───────────────────────────────────────────────────────────────────┘
```

- Composer stays sticky at the bottom, mode chips inline.
- Assistant messages render markdown, scripture blocks, and derivation tags (S1/S2 tier).
- The right rail is not decoration — it reads the same session state the pipeline produces and updates as stages complete.
- Empty state (new session) shows the four suggestion prompts we already have, laid out as tiles under the composer.

## 4. Make the dashboard tiles actually do something

Every tile on `/dashboard` becomes functional, not visual filler:

- **Alerts** — each row navigates to its origin (pattern → `/patterns/$id`, belief → `/you`, prayer → `/prayers/$id`, mirror → `/mirrors/$id`). "All" opens a filterable alert list.
- **Mirror card** — click opens the archetype detail; the passage reference links to the passage.
- **Pattern activity** — D/W/M tabs actually switch the bar chart data; the count links to `/patterns`.
- **Prayer scaffold** — "Open" already links; the movement bars become a compact stepper you can advance.
- **Persona graph** — each belief bar opens the belief edit sheet with DNR / edit / delete controls.
- **Recent sessions** — routes to the live session view.
- **Fruit this cycle** — metrics link to Journey filtered by that metric.

Suggestion tiles under the hero composer route into the chat page pre-seeded with the prompt AND the correct mode already selected.

## 5. Copy that teaches, in three places only

Overexplaining kills the calm tone. We add one line in exactly three places:

- Under the sidebar `BEGIN` group: *"Talk to Wisdom. It listens for the pattern beneath."*
- Empty state of `/wisdom` chat: *"Bring a real situation. Wisdom will mirror it through scripture, not advice."*
- Top of `/dashboard` (small, muted): *"What Wisdom has surfaced from your recent sessions."*

Nothing else. The UI itself carries the rest.

---

## Technical section

**Routes**
- New `src/routes/wisdom.index.tsx` becomes the chat surface. Rename current content to `src/routes/dashboard.tsx`.
- Update `src/routes/index.tsx` to redirect: authed → `/wisdom`, guest → `/auth`.
- All internal `<Link to="/wisdom">` audited; dashboard links updated to `/dashboard`.

**Chat implementation**
- Follow `chat-agent-ui-contract`: ask nothing — Wisdom already has sessions in the DB, so it is **threaded + database-backed**. Each `session` row is the thread. `/wisdom` shows the newest active session; `/wisdom/$sessionId` loads a specific one.
- Use AI SDK `useChat` with `DefaultChatTransport` pointing at a new `src/routes/api/chat.ts` server route.
- The server route wraps the existing `runWisdomPipeline` / `runCurseBreakerPipeline` staged pipeline. Stream assistant text via `toUIMessageStreamResponse`; emit stage completions as message parts so the right rail can react without polling.
- Install AI Elements primitives: `bun x ai-elements@latest add conversation message prompt-input shimmer`. Custom scripture-block and derivation-tag renderers live in `src/components/wisdom/chat/`.
- Assistant messages render with `MessageResponse` (markdown built-in). No `Sparkles` icon as agent identity — reuse the existing Wisdom mark from `AppShell`.

**Sidebar restructure**
- Edit `src/components/wisdom/AppShell.tsx`: replace the flat nav array with three grouped arrays (`BEGIN`, `DISCERN`, `HOLD`) rendered with group labels and a subtle divider. Active state uses the gold accent token already in the constellation page.
- Mobile bottom nav collapses to 5 primary items: Wisdom, Dashboard, Constellation, Prayer, You.

**Dashboard wiring**
- Wrap each tile in `<Link>` where the tile has a single natural target; use inline buttons for multi-target tiles (Alerts).
- D/W/M tabs on Pattern activity get real state; data derived from the existing signals mock (grouped by day).
- Persona graph bars become buttons opening a shadcn `Sheet` with edit controls that call the existing persona server functions.

**Files touched**
- `src/components/wisdom/AppShell.tsx` — grouped nav, gold active state
- `src/routes/index.tsx` — redirect
- `src/routes/wisdom.index.tsx` — replaced with chat surface
- `src/routes/dashboard.tsx` — new, holds current bento
- `src/routes/api/chat.ts` — new streaming route
- `src/components/wisdom/chat/*` — Conversation, ScriptureBlock, DerivationTag, LiveRail
- Various `<Link to="/wisdom">` → `/dashboard` in the shell and tiles

**Out of scope for this pass**
- New DB migrations (sessions/messages tables already exist).
- Changing pipeline contracts or prompts.
- Curse Breaker chat variant beyond mode selection (its dedicated `/wisdom/curse-breaker` page stays as-is; the chat route still supports the mode).
