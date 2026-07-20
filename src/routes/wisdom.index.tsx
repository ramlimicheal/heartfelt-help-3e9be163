import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BellRing,
  BookOpen,
  ChevronRight,
  Compass,
  Expand,
  Hand,
  HandHelping,
  Loader2,
  LogIn,
  Maximize2,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  ARCHETYPE_INDEX,
  HYPOTHESES,
  PASSAGE_INDEX,
  PERSONA_FACTS,
  PRAYERS,
  SESSIONS,
} from "@/lib/wisdom/mock/seed";
import { COPY } from "@/lib/wisdom/copy/v1";
import { startWisdomSession, runWisdomPipeline } from "@/lib/wisdom/pipeline.functions";
import { runCurseBreakerPipeline } from "@/lib/wisdom/curseBreaker.functions";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/wisdom/")({
  head: () => ({ meta: [{ title: "Wisdom — dashboard" }] }),
  component: WisdomHome,
});

/* ── config ─────────────────────────────────────────────── */

const SUGGESTIONS = [
  { Icon: Compass, label: "Name a pattern I keep returning to", prompt: "Something keeps happening that I don't fully understand — ", mode: "pattern" as const },
  { Icon: HandHelping, label: "Help me pray about something honestly", prompt: "I want to pray about this, but I'm not sure what I'm really asking for — ", mode: "pattern" as const },
  { Icon: BookOpen, label: "Test a spiritual interpretation", prompt: "I've been wondering whether this is spiritual or just — ", mode: "deep" as const },
  { Icon: Hand, label: "Reflect on a repeated setback", prompt: "I said I wouldn't again, and I did. Here's what happened — ", mode: "pattern" as const },
  { Icon: ShieldAlert, label: "A pattern that keeps returning across generations", prompt: COPY.curseBreaker.heroTilePrompt, mode: "curse_breaker" as const },
];

const MODES = [
  { id: "companion", label: COPY.modes.companion.label, hint: COPY.modes.companion.hint },
  { id: "pattern", label: COPY.modes.pattern.label, hint: COPY.modes.pattern.hint },
  { id: "deep", label: COPY.modes.deep.label, hint: COPY.modes.deep.hint },
  { id: "curse_breaker", label: COPY.modes.curse_breaker.label, hint: COPY.modes.curse_breaker.hint },
] as const;

type ModeId = (typeof MODES)[number]["id"];

const MODE_TO_DB: Record<ModeId, "companion" | "pattern" | "deep_wisdom" | "curse_breaker"> = {
  companion: "companion",
  pattern: "pattern",
  deep: "deep_wisdom",
  curse_breaker: "curse_breaker",
};

/* ── page ────────────────────────────────────────────────── */

function WisdomHome() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ModeId>("pattern");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, ready } = useSession();

  const startFn = useServerFn(startWisdomSession);
  const runWisdom = useServerFn(runWisdomPipeline);
  const runCb = useServerFn(runCurseBreakerPipeline);

  const openSeed = () => navigate({ to: "/wisdom/$sessionId", params: { sessionId: SESSIONS[0].id } });

  const begin = async () => {
    if (!text.trim() || busy) return;
    if (ready && !user) { navigate({ to: "/auth", search: { redirect: "/wisdom" } }); return; }
    setBusy(true);
    setError(null);
    try {
      const { sessionId } = await startFn({ data: { mode: MODE_TO_DB[mode], text: text.trim() } });
      if (mode === "curse_breaker") { await runCb({ data: { sessionId } }); navigate({ to: "/wisdom/curse-breaker" }); }
      else { await runWisdom({ data: { sessionId } }); navigate({ to: "/wisdom/live/$sessionId", params: { sessionId } }); }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const now = new Date();
  const hour = now.getHours();
  const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
  const greeting = hour < 5 ? "Peace to you tonight" : hour < 12 ? "Peace to you this morning" : hour < 18 ? "Peace to you this afternoon" : "Peace to you this evening";
  const displayName = (user?.email?.split("@")[0] ?? "friend").replace(/[._-]/g, " ");

  const alerts = useMemo(() => {
    const facts = PERSONA_FACTS.filter((f) => f.status !== "rejected" && f.status !== "deleted");
    return [
      { title: "Pattern surfacing", body: "Helping-without-boundaries has appeared 4× this cycle.", tag: "pattern" },
      { title: "Belief to test", body: facts[0]?.value ?? "A remembered belief awaits review.", tag: "belief" },
      { title: "Prayer waiting", body: "A confession-and-renunciation scaffold is drafted.", tag: "prayer" },
      { title: "New mirror", body: "Moses (Numbers 11) surfaced as a possible archetype.", tag: "mirror" },
    ];
  }, []);

  const primaryHyp = Object.values(HYPOTHESES)[0];
  const seededArchetype = ARCHETYPE_INDEX[primaryHyp.archetypes[0]?.archetypeId ?? "archetype_moses_overload"];
  const seededPassage = seededArchetype ? PASSAGE_INDEX[seededArchetype.primaryPassages[0]?.id] : undefined;
  const seededPrayer = Object.values(PRAYERS)[0];

  const facts = PERSONA_FACTS.filter((f) => f.status !== "rejected" && f.status !== "deleted").slice(0, 5);
  const patternConfPct = Math.round(primaryHyp.confidence * 100);

  return (
    <div className="min-h-[calc(100vh-6rem)] pb-8">
      {/* ── Bento grid ── */}
      <div className="grid grid-cols-12 gap-3 md:gap-4">
        {/* HERO — identity + composer */}
        <section className="col-span-12 lg:col-span-5 row-span-2 rounded-3xl border border-panel-border bg-surface/60 p-6 md:p-8 flex flex-col">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-5xl md:text-6xl font-light tracking-tight leading-none">{timeStr}</div>
              <div className="mt-4 text-[13px] text-muted-foreground">{greeting},</div>
              <div className="mt-0.5 text-lg font-medium capitalize">{displayName}</div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-primary">
              <span className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary-glow)]" />
              All held
            </div>
          </div>

          <div className="mt-6 flex-1 flex flex-col">
            <h1 className="text-2xl md:text-[28px] leading-snug tracking-tight">
              What is happening beneath the surface,
              <span className="text-muted-foreground"> that you'd like to see clearly?</span>
            </h1>

            <div className="mt-5 rounded-2xl border border-panel-border bg-background/40 p-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tell Wisdom what's been repeating…"
                className="h-24 w-full resize-none bg-transparent px-2 py-1 text-[14px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-panel-border/70 pt-2.5 mt-1">
                <div className="flex items-center gap-0.5 rounded-full border border-panel-border bg-background/60 p-0.5">
                  {MODES.map((m) => {
                    const active = mode === m.id;
                    return (
                      <button key={m.id} onClick={() => setMode(m.id)} title={m.hint}
                        className={["rounded-full px-2.5 py-1 text-[11px] transition", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}>
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <button onClick={openSeed} className="inline-flex items-center gap-1 rounded-full border border-panel-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">
                    <Sparkles className="size-3" strokeWidth={2} /> Example
                  </button>
                  <button onClick={begin} disabled={text.trim().length === 0 || busy}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                    {busy ? (<><Loader2 className="size-3 animate-spin" /> Composing…</>)
                      : ready && !user ? (<><LogIn className="size-3" /> Sign in</>)
                      : (<>Begin <ArrowUp className="size-3" /></>)}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{error}</p>
            )}

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

        {/* ALERTS */}
        <section className="col-span-12 md:col-span-6 lg:col-span-3 rounded-3xl border border-panel-border bg-surface/60 p-5 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <BellRing className="size-3.5 text-primary" strokeWidth={2} />
              Alerts
              <span className="text-muted-foreground">{alerts.length}</span>
            </div>
            <button className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground rounded-full border border-panel-border px-2 py-0.5 hover:text-foreground">All</button>
          </div>
          <div className="mt-4 space-y-3 flex-1">
            {alerts.map((a) => (
              <div key={a.title} className="group flex items-start gap-2 border-b border-panel-border/50 last:border-0 pb-3 last:pb-0">
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{a.title}</div>
                  <div className="text-[11.5px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">{a.body}</div>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
          <button className="mt-2 grid place-items-center h-6 text-muted-foreground hover:text-foreground">
            <ChevronRight className="size-4 rotate-90" />
          </button>
        </section>

        {/* MIRROR — biblical archetype (sun/warmth analog) */}
        <BentoLink to="/patterns/$patternId" params={{ patternId: primaryHyp.id }} className="col-span-12 md:col-span-6 lg:col-span-4 row-span-1 rounded-3xl border border-panel-border overflow-hidden relative min-h-[280px]">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 55% at 50% 78%, oklch(0.78 0.14 60 / 0.55), transparent 65%), linear-gradient(180deg, oklch(0.22 0.02 260) 0%, oklch(0.14 0.01 260) 100%)" }} />
          <div className="absolute bottom-[-40%] left-1/2 -translate-x-1/2 w-[85%] aspect-square rounded-full" style={{ background: "radial-gradient(circle, oklch(0.85 0.16 70) 0%, oklch(0.6 0.18 40) 45%, transparent 70%)", filter: "blur(2px)", opacity: 0.8 }} />
          <div className="relative p-5 h-full flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[13px] font-medium">{seededArchetype?.person ?? "Mirror"}</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-0.5">Biblical mirror · S1</div>
              </div>
              <BookOpen className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="mt-3 text-[52px] md:text-[60px] font-light tracking-tight leading-none">
              {patternConfPct}<span className="text-[22px] text-muted-foreground align-top ml-0.5">%</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">confidence · {seededPassage?.reference ?? "—"}</div>
            <div className="mt-auto flex items-end justify-between">
              <div className="max-w-[75%]">
                <div className="text-[13px] font-medium">{seededArchetype?.headline ?? primaryHyp.name}</div>
                <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">Warmer clarity tomorrow · sit with the mirror</div>
              </div>
              <Maximize2 className="size-3.5 text-muted-foreground" />
            </div>
          </div>
        </BentoLink>

        {/* PATTERN ACTIVITY — bar chart */}
        <section className="col-span-12 md:col-span-6 lg:col-span-3 row-span-1 rounded-3xl border border-panel-border bg-surface/60 p-5 flex flex-col min-h-[280px]">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[13px] font-medium leading-tight">Pattern<br/>activity</div>
            </div>
            <RangeTabs />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <div className="text-[42px] font-light tracking-tight leading-none tabular-nums">12</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">signals</div>
            <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-destructive/15 text-destructive text-[10px] px-1.5 py-0.5">
              <TrendingUp className="size-3" /> 3
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" /> HIGH-CONF <span className="text-foreground/80">{patternConfPct}%</span>
          </div>
          <Waveform values={[2,3,2,4,3,5,4,6,5,7,6,4,5,7,8,6,5,4,3,5,6,7,8,6,5,4,3,5,6,4]} highlightAt={22} />
          <div className="mt-2 flex justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
            {["M","T","W","TH","F","S","SU"].map((d) => <span key={d}>{d}</span>)}
          </div>
        </section>

        {/* PRAYER — like thermostat: current temp = movements */}
        <section className="col-span-12 md:col-span-8 rounded-3xl border border-panel-border bg-surface/60 p-5 relative overflow-hidden min-h-[240px]">
          <div className="flex items-start justify-between">
            <div className="text-[13px] font-medium">Prayer scaffold</div>
            <Link to="/prayers/$prayerId" params={{ prayerId: seededPrayer.id }}
              className="text-[10px] uppercase tracking-[0.14em] rounded-full border border-panel-border px-2 py-0.5 text-muted-foreground hover:text-foreground">
              Open
            </Link>
          </div>
          <div className="mt-3 flex items-end gap-6 flex-wrap">
            <div>
              <div className="text-[52px] font-light tracking-tight leading-none tabular-nums">
                {seededPrayer.lines.length}<span className="text-[22px] text-muted-foreground align-top ml-0.5">mv</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">movements · lineage held</div>
            </div>
            <div className="flex gap-6 text-[11px]">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Mode</div>
                <div className="text-foreground/90 mt-0.5">{seededPrayer.mode}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Tier</div>
                <div className="text-foreground/90 mt-0.5">S1</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Sources</div>
                <div className="text-foreground/90 mt-0.5 tabular-nums">{seededPrayer.lines[0]?.sources.length ?? 1}</div>
              </div>
            </div>
          </div>
          {/* movement waveform */}
          <div className="mt-6 flex items-end gap-[3px] h-16">
            {Array.from({ length: 68 }).map((_, i) => {
              const active = i === 40;
              const h = 28 + ((i * 41) % 60);
              return (
                <span key={i} className="w-[3px] rounded-sm" style={{
                  height: `${h}%`,
                  background: active ? "var(--primary)" : i > 34 && i < 46 ? "oklch(0.78 0.11 40)" : "oklch(1 0 0 / 0.15)",
                }} />
              );
            })}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground text-center tabular-nums">now · movement 3 of {seededPrayer.lines.length}</div>
        </section>

        {/* PERSONA — like water usage bars */}
        <section className="col-span-12 md:col-span-4 rounded-3xl border border-panel-border bg-surface/60 p-5 flex flex-col min-h-[240px]">
          <div className="flex items-start justify-between">
            <div className="text-[13px] font-medium">Persona graph</div>
            <RangeTabs />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-[42px] font-light tracking-tight leading-none tabular-nums">{facts.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">beliefs</div>
            <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-primary/15 text-primary text-[10px] px-1.5 py-0.5">
              <TrendingDown className="size-3" /> 2
            </span>
          </div>
          <div className="mt-4 space-y-2 flex-1">
            {facts.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-[11.5px]">
                <div className="w-24 truncate text-muted-foreground">{f.domain ?? "belief"}</div>
                <div className="flex-1 h-1.5 rounded-full bg-background/60 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(15, Math.round(f.confidence * 100))}%`, background: "var(--primary)" }} />
                </div>
                <div className="tabular-nums text-muted-foreground w-8 text-right">{Math.round(f.confidence * 100)}%</div>
              </div>
            ))}
          </div>
          <Link to="/you" className="mt-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            Open persona <ArrowUpRight className="size-3" />
          </Link>
        </section>

        {/* RECENT SESSIONS */}
        <section className="col-span-12 lg:col-span-8 rounded-3xl border border-panel-border bg-surface/60 p-5">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-medium">Recent sessions</div>
            <Link to="/wisdom/map" className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Constellation <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {SESSIONS.map((s) => (
              <Link key={s.id} to="/wisdom/$sessionId" params={{ sessionId: s.id }}
                className="group flex items-start gap-3 rounded-2xl border border-panel-border/70 bg-background/30 px-3.5 py-3 transition hover:border-primary/40 hover:bg-surface">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                  <Sparkles className="size-3.5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium leading-snug">{s.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground leading-snug">{s.messages[0].text}</p>
                  <p className="mt-1.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    {s.depth} · {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <ArrowRight className="mt-1 size-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            ))}
            <Link to="/wisdom/curse-breaker"
              className="group flex items-start gap-3 rounded-2xl border border-dashed border-panel-border px-3.5 py-3 transition hover:border-primary/40 hover:bg-surface">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-destructive/15 text-destructive">
                <ShieldAlert className="size-3.5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-snug">Open Curse Breaker</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground leading-snug">Stronghold discernment across 12 categories with lineage-aware prayer.</p>
              </div>
              <ArrowRight className="mt-1 size-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
            </Link>
          </div>
        </section>

        {/* FRUIT / SNAPSHOT metrics */}
        <section className="col-span-12 lg:col-span-4 rounded-3xl border border-panel-border bg-surface/60 p-5">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-medium">Fruit this cycle</div>
            <Expand className="size-3.5 text-muted-foreground" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Metric label="Mirrors surfaced" value="4" delta="+1" />
            <Metric label="Prayers prayed" value="7" delta="+3" />
            <Metric label="Practices held" value="2" delta="0" muted />
            <Metric label="Beliefs revised" value="3" delta="+2" />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────── */

function BentoLink({
  children,
  className = "",
  to,
  params,
}: {
  children: React.ReactNode;
  className?: string;
  to: any;
  params?: any;
}) {
  return (
    <Link to={to} params={params} className={`${className} block hover:border-primary/30 transition-colors`}>
      {children}
    </Link>
  );
}

function RangeTabs() {
  const [r, setR] = useState<"D" | "W" | "M">("W");
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-panel-border bg-background/50 p-0.5 text-[9px] uppercase tracking-wider">
      {(["D", "W", "M"] as const).map((k) => (
        <button key={k} onClick={() => setR(k)}
          className={["px-2 py-0.5 rounded-full transition", r === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"].join(" ")}>
          {k}
        </button>
      ))}
    </div>
  );
}

function Waveform({ values, highlightAt }: { values: number[]; highlightAt: number }) {
  const max = Math.max(...values);
  return (
    <div className="mt-4 flex items-end gap-[3px] h-20">
      {values.map((v, i) => {
        const active = i === highlightAt;
        return (
          <span key={i} className="flex-1 rounded-sm" style={{
            height: `${(v / max) * 100}%`,
            background: active ? "var(--primary)" : "oklch(1 0 0 / 0.14)",
          }} />
        );
      })}
    </div>
  );
}

function Metric({ label, value, delta, muted }: { label: string; value: string; delta: string; muted?: boolean }) {
  const positive = delta.startsWith("+");
  return (
    <div className="rounded-2xl border border-panel-border/70 bg-background/30 p-3">
      <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <div className="text-[26px] font-light tracking-tight leading-none tabular-nums">{value}</div>
        <span className={["text-[10px] rounded px-1 py-px", muted ? "text-muted-foreground bg-muted/40" : positive ? "text-primary bg-primary/15" : "text-destructive bg-destructive/15"].join(" ")}>
          {delta}
        </span>
      </div>
    </div>
  );
}
