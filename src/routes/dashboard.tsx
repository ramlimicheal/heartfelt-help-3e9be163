import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Compass,
  Hand,
  HandHelping,
  LogIn,
  ShieldAlert,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { COPY } from "@/lib/wisdom/copy/v1";
import { getDashboardSlice } from "@/lib/wisdom/dashboard.functions";
import type { DashboardSlice } from "@/lib/wisdom/dashboard.schemas";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Wisdom — dashboard" },
      { name: "description", content: "Your patterns, memory, prayer and formation, scoped only to you." },
    ],
  }),
  component: WisdomHome,
});

type CanonicalMode = "companion" | "pattern" | "deep_wisdom" | "curse_breaker";

const SUGGESTIONS: Array<{ Icon: typeof Compass; label: string; prompt: string; mode: CanonicalMode }> = [
  { Icon: Compass, label: "Name a pattern I keep returning to", prompt: "Something keeps happening that I don't fully understand — ", mode: "pattern" },
  { Icon: HandHelping, label: "Help me pray about something honestly", prompt: "I want to pray about this, but I'm not sure what I'm really asking for — ", mode: "pattern" },
  { Icon: BookOpen, label: "Test a spiritual interpretation", prompt: "I've been wondering whether this is spiritual or just — ", mode: "deep_wisdom" },
  { Icon: Hand, label: "Reflect on a repeated setback", prompt: "I said I wouldn't again, and I did. Here's what happened — ", mode: "pattern" },
  { Icon: ShieldAlert, label: "A pattern that keeps returning across generations", prompt: COPY.curseBreaker.heroTilePrompt, mode: "curse_breaker" },
];

const MODES: Array<{ id: CanonicalMode; label: string; hint: string }> = [
  { id: "companion", label: COPY.modes.companion.label, hint: COPY.modes.companion.hint },
  { id: "pattern", label: COPY.modes.pattern.label, hint: COPY.modes.pattern.hint },
  { id: "deep_wisdom", label: COPY.modes.deep.label, hint: COPY.modes.deep.hint },
  { id: "curse_breaker", label: COPY.modes.curse_breaker.label, hint: COPY.modes.curse_breaker.hint },
];

const FORMATION_LABEL: Record<DashboardSlice["formation"]["state"], string> = {
  no_check_in: "No check-in yet",
  one_next_act_selected: "One next act selected",
  check_in_scheduled: "Check-in scheduled",
  fruit_observed: "Fruit observed",
  setback_recorded: "Setback recorded",
};

function WisdomHome() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<CanonicalMode>("pattern");
  const { user, ready } = useSession();

  const fetchSlice = useServerFn(getDashboardSlice);

  const slice = useQuery({
    queryKey: ["dashboard-slice", user?.id ?? "anon"],
    queryFn: () => fetchSlice(),
    enabled: ready && !!user,
    staleTime: 30_000,
  });

  // Canonical path: never call legacy pipeline runners directly.
  // Hand off to /wisdom, which submits every mode through streamUnifiedTurn → /api/wisdom/turn.
  const begin = () => {
    const prompt = text.trim();
    if (!prompt) return;
    if (ready && !user) {
      navigate({ to: "/auth", search: { redirect: "/dashboard" } });
      return;
    }
    navigate({
      to: "/wisdom",
      search: { prompt, mode, autostart: "1" as unknown as boolean },
    });
  };

  const [clock, setClock] = useState<{ timeStr: string; greeting: string } | null>(null);
  useEffect(() => {
    const compute = () => {
      const n = new Date();
      const h = n.getHours();
      setClock({
        timeStr: n.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase(),
        greeting: h < 5 ? "Peace to you tonight" : h < 12 ? "Peace to you this morning" : h < 18 ? "Peace to you this afternoon" : "Peace to you this evening",
      });
    };
    compute();
    const t = setInterval(compute, 30_000);
    return () => clearInterval(t);
  }, []);
  const timeStr = clock?.timeStr ?? "";
  const greeting = clock?.greeting ?? "Peace to you";
  const displayName = (user?.email?.split("@")[0] ?? "friend").replace(/[._-]/g, " ");


  return (
    <div className="min-h-[calc(100vh-6rem)] pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
        {/* HERO — composer */}
        <section className="lg:col-span-5 rounded-3xl border border-panel-border bg-surface/60 p-6 md:p-8 flex flex-col">

          <div className="flex items-start justify-between">
            <div>
              <div className="text-5xl md:text-6xl font-light tracking-tight leading-none">{timeStr}</div>
              <div className="mt-4 text-[13px] text-muted-foreground">{greeting},</div>
              <div className="mt-0.5 text-lg font-medium capitalize">{displayName}</div>
            </div>
          </div>

          <div className="mt-6 flex-1 flex flex-col">
            <h1 className="text-2xl md:text-[28px] leading-snug tracking-tight">
              What is happening beneath the surface,
              <span className="text-muted-foreground"> that you'd like to see clearly?</span>
            </h1>

            <div className="mt-5 rounded-2xl border border-panel-border bg-background/40 p-3">
              <label htmlFor="dash-composer" className="sr-only">Tell Wisdom what's been repeating</label>
              <textarea
                id="dash-composer"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tell Wisdom what's been repeating…"
                className="h-24 w-full resize-none bg-transparent px-2 py-1 text-[14px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-panel-border/70 pt-2.5 mt-1">
                <div role="tablist" aria-label="Session mode" className="flex items-center gap-0.5 rounded-full border border-panel-border bg-background/60 p-0.5">
                  {MODES.map((m) => {
                    const active = mode === m.id;
                    return (
                      <button key={m.id} role="tab" aria-selected={active} onClick={() => setMode(m.id)} title={m.hint}
                        className={["rounded-full px-2.5 py-1 text-[11px] transition", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}>
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                <button onClick={begin} disabled={text.trim().length === 0}
                  className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                  {ready && !user ? (<><LogIn className="size-3" /> Sign in</>)
                    : (<>Begin <ArrowUp className="size-3" /></>)}
                </button>
              </div>
            </div>


            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {SUGGESTIONS.slice(0, 4).map(({ Icon, label, prompt, mode: sm }) => (
                <button key={label} onClick={() => { setText(prompt); setMode(sm); }}
                  className="group flex items-center gap-2 rounded-xl border border-panel-border/70 bg-background/30 px-3 py-2 text-left text-[12px] transition hover:border-primary/40 hover:bg-surface">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                    <Icon className="size-3.5" strokeWidth={1.75} />
                  </span>
                  <span className="text-foreground/85 truncate">{label}</span>
                  <ArrowRight className="ml-auto size-3 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" strokeWidth={1.75} />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* TILES — uniform grid */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 auto-rows-[minmax(220px,1fr)] gap-3 md:gap-4">
        {/* SESSION TILE */}

        <Tile
          title="Session"
          query={slice}
          empty={
            <EmptyBody
              head="No conversation yet"
              body="Bring a real situation when you're ready."
              ctaTo="/wisdom"
              ctaLabel="Talk to Wisdom"
            />
          }
          render={(d) =>
            d.currentSession ? (
              <div className="flex h-full flex-col">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {d.runningPipeline ? (
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <span className="size-1.5 rounded-full bg-primary animate-pulse" /> Live
                    </span>
                  ) : (
                    <>Latest · {new Date(d.currentSession.updatedAt).toLocaleDateString()}</>
                  )}
                </div>
                <div className="mt-2 text-[15px] font-medium leading-snug line-clamp-2">
                  {d.currentSession.title ?? "Untitled session"}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground uppercase tracking-wider">
                  {d.currentSession.mode.replace(/_/g, " ")}
                </div>
                <Link
                  to="/wisdom/$sessionId"
                  params={{ sessionId: d.currentSession.id }}
                  className="mt-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                >
                  Continue <ArrowUpRight className="size-3" />
                </Link>
              </div>
            ) : null
          }
          isEmpty={(d) => !d.currentSession}
          className="h-full min-h-[220px]"
        />

        {/* PATTERN ACTIVITY */}
        <Tile
          title="Pattern activity"
          query={slice}
          empty={
            <EmptyBody
              head="No patterns yet"
              body="Wisdom proposes patterns after you describe a real situation. You confirm, refine, reject or remain unsure."
            />
          }
          render={(d) => (
            <div className="flex h-full flex-col gap-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                <Stat n={d.patterns.counts.proposed} l="Proposed" />
                <Stat n={d.patterns.counts.accepted} l="Accepted" />
                <Stat n={d.patterns.counts.improving} l="Improving" />
                <Stat n={d.patterns.counts.recurring} l="Recurring" />
              </div>
              {d.patterns.mostRecent && (
                <Link
                  to="/patterns/$patternId"
                  params={{ patternId: d.patterns.mostRecent.id }}
                  className="rounded-xl border border-panel-border/70 bg-background/30 p-3 transition hover:border-primary/40"
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Most recent</div>
                  <div className="mt-1 text-[13px] font-medium line-clamp-1">{d.patterns.mostRecent.title}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {d.patterns.mostRecent.lifecycle} · {new Date(d.patterns.mostRecent.updatedAt).toLocaleDateString()}
                  </div>
                  <div className="mt-2 text-[11px] italic text-muted-foreground">
                    This remains a candidate until you confirm or refine it.
                  </div>
                </Link>
              )}
            </div>
          )}
          isEmpty={(d) => d.emptyFlags.noPatterns}
          className="h-full min-h-[220px]"
        />

        {/* PERSONA GRAPH */}
        <Tile
          title="Persona graph"
          query={slice}
          empty={
            <EmptyBody
              head="Nothing remembered yet"
              body="Anything you confirm becomes part of how Wisdom holds you. Nothing is remembered without your permission."
              ctaTo="/you"
              ctaLabel="Open memory"
            />
          }
          render={(d) => (
            <div className="flex h-full flex-col gap-2">
              <div className="text-[13px] leading-relaxed">
                <span className="text-2xl font-light tabular-nums">{d.persona.acceptedCount}</span>{" "}
                <span className="text-muted-foreground">things you've confirmed</span>
              </div>
              <div className="text-[13px] leading-relaxed">
                <span className="text-2xl font-light tabular-nums">{d.persona.proposedCount}</span>{" "}
                <span className="text-muted-foreground">proposed memories awaiting review</span>
              </div>
              <Link to="/you" className="mt-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
                Open memory <ArrowUpRight className="size-3" />
              </Link>
            </div>
          )}
          isEmpty={(d) => d.emptyFlags.noPersona}
          className="h-full min-h-[220px]"
        />

        {/* PRAYER SCAFFOLD */}
        <Tile
          title="Prayer scaffold"
          query={slice}
          empty={
            <EmptyBody
              head="No prayer has been formed yet"
              body="A prayer will appear after Wisdom understands the situation and verifies its biblical roots."
            />
          }
          render={(d) =>
            d.latestPrayer ? (
              <div className="flex h-full flex-col">
                <div className="text-[13px] font-medium line-clamp-2">{d.latestPrayer.title}</div>
                <div className="mt-3 flex items-baseline gap-2">
                  <div className="text-[42px] font-light tracking-tight leading-none tabular-nums">
                    {d.latestPrayer.movementCount}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">movements</div>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {d.latestPrayer.mode} · {d.latestPrayer.finalizedAt ? "finalized" : "in progress"}
                </div>
                <Link
                  to="/prayers/$prayerId"
                  params={{ prayerId: d.latestPrayer.id }}
                  className="mt-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                >
                  Open prayer <ArrowUpRight className="size-3" />
                </Link>
              </div>
            ) : null
          }
          isEmpty={(d) => d.emptyFlags.noPrayer}
          className="h-full min-h-[220px]"
        />

        {/* RECENT SESSIONS */}
        <Tile
          title="Recent"
          query={slice}
          empty={
            <EmptyBody
              head="Nothing here yet"
              body="Your sessions will land here after you talk to Wisdom."
              ctaTo="/wisdom"
              ctaLabel="Talk to Wisdom"
            />
          }
          render={(d) => (
            <div className="grid gap-2 sm:grid-cols-2">
              {d.recentSessions.map((s) => (
                <Link
                  key={s.id}
                  to="/wisdom/$sessionId"
                  params={{ sessionId: s.id }}
                  className="group flex items-start gap-3 rounded-2xl border border-panel-border/70 bg-background/30 px-3.5 py-3 transition hover:border-primary/40 hover:bg-surface"
                >
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                    <Sparkles className="size-3.5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium leading-snug">
                      {s.title ?? "Untitled session"}
                    </p>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                      {s.mode.replace(/_/g, " ")} · {new Date(s.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 size-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              ))}
            </div>
          )}
          isEmpty={(d) => d.emptyFlags.noSessions}
          className="h-full min-h-[220px]"
        />

        {/* FRUIT */}
        <Tile
          title="Fruit"
          query={slice}
          empty={
            <EmptyBody
              head="No check-in yet"
              body="Formation shows up here as observations, never scores or streaks."
            />
          }
          render={(d) => (
            <div className="flex h-full flex-col">
              <div className="text-[15px] font-medium">{FORMATION_LABEL[d.formation.state]}</div>
              {d.formation.lastEventAt && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(d.formation.lastEventAt).toLocaleString()}
                </div>
              )}
              <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                Setbacks are information, not failure. Fruit appears only when observed.
              </p>
              <Link to="/journey" className="mt-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
                Open journey <ArrowUpRight className="size-3" />
              </Link>
            </div>
          )}
          isEmpty={(d) => d.emptyFlags.noFormation}
          className="h-full min-h-[220px]"
        />
        </div>
      </div>

    </div>
  );
}

/* ── shared tile ─────────────────────────────────────────── */

type QueryLike = ReturnType<typeof useQuery<DashboardSlice, Error>>;

function Tile({
  title,
  query,
  render,
  empty,
  isEmpty,
  className = "",
}: {
  title: string;
  query: QueryLike;
  render: (d: DashboardSlice) => React.ReactNode;
  empty: React.ReactNode;
  isEmpty: (d: DashboardSlice) => boolean;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={`rounded-3xl border border-panel-border bg-surface/60 p-5 flex flex-col ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-medium">{title}</h2>
        {query.isFetching && !query.isLoading && (
          <RefreshCw className="size-3 animate-spin text-muted-foreground" aria-label="Refreshing" />
        )}
      </div>
      <div className="min-h-0 flex-1">
        {query.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-3 w-2/3 animate-pulse rounded bg-background/60" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-background/60" />
            <div className="h-16 w-full animate-pulse rounded bg-background/40" />
          </div>
        ) : query.isError ? (
          <div className="flex h-full flex-col items-start justify-center gap-2 text-[12px]">
            <p role="alert" className="text-destructive">
              Couldn't load this section.
            </p>
            <button
              onClick={() => query.refetch()}
              className="inline-flex items-center gap-1 rounded-full border border-panel-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3" /> Try again
            </button>
          </div>
        ) : query.data && isEmpty(query.data) ? (
          empty
        ) : query.data ? (
          render(query.data)
        ) : null}
      </div>
    </section>
  );
}

function EmptyBody({
  head,
  body,
  ctaTo,
  ctaLabel,
}: {
  head: string;
  body: string;
  ctaTo?: "/wisdom" | "/you";
  ctaLabel?: string;
}) {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-2">
      <div className="text-[13px] font-medium">{head}</div>
      <p className="text-[12px] leading-relaxed text-muted-foreground">{body}</p>
      {ctaTo && ctaLabel && (
        <Link
          to={ctaTo}
          className="mt-1 inline-flex items-center gap-1 rounded-full border border-panel-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {ctaLabel} <ArrowUpRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="rounded-xl border border-panel-border/70 bg-background/30 py-2">
      <div className="text-[22px] font-light tabular-nums">{n}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{l}</div>
    </div>
  );
}
