import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Compass,
  HandHelping,
  Hand,
  Loader2,
  LogIn,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { SESSIONS } from "@/lib/wisdom/mock/seed";
import { COPY } from "@/lib/wisdom/copy/v1";
import { startWisdomSession, runWisdomPipeline } from "@/lib/wisdom/pipeline.functions";
import { runCurseBreakerPipeline } from "@/lib/wisdom/curseBreaker.functions";
import { useSession } from "@/hooks/useSession";


export const Route = createFileRoute("/wisdom/")({
  head: () => ({ meta: [{ title: "Wisdom — begin a session" }] }),
  component: WisdomHome,
});

const SUGGESTIONS = [
  {
    Icon: Compass,
    label: "Name a pattern I keep returning to",
    prompt: "Something keeps happening that I don't fully understand — ",
    mode: "pattern" as const,
  },
  {
    Icon: HandHelping,
    label: "Help me pray about something honestly",
    prompt: "I want to pray about this, but I'm not sure what I'm really asking for — ",
    mode: "pattern" as const,
  },
  {
    Icon: BookOpen,
    label: "Test a spiritual interpretation",
    prompt: "I've been wondering whether this is spiritual or just — ",
    mode: "deep" as const,
  },
  {
    Icon: Hand,
    label: "Reflect on a repeated setback",
    prompt: "I said I wouldn't again, and I did. Here's what happened — ",
    mode: "pattern" as const,
  },
  {
    Icon: ShieldAlert,
    label: "A pattern that keeps returning across generations",
    prompt: COPY.curseBreaker.heroTilePrompt,
    mode: "curse_breaker" as const,
  },
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

function WisdomHome() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ModeId>("pattern");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startFn = useServerFn(startWisdomSession);
  const runWisdom = useServerFn(runWisdomPipeline);
  const runCb = useServerFn(runCurseBreakerPipeline);

  const openSeed = () => {
    navigate({ to: "/wisdom/$sessionId", params: { sessionId: SESSIONS[0].id } });
  };

  const begin = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { sessionId } = await startFn({
        data: { mode: MODE_TO_DB[mode], text: text.trim() },
      });
      if (mode === "curse_breaker") {
        await runCb({ data: { sessionId } });
        navigate({ to: "/wisdom/curse-breaker" });
      } else {
        await runWisdom({ data: { sessionId } });
        navigate({ to: "/wisdom/live/$sessionId", params: { sessionId } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };



  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col">
      {/* Hero */}
      <section className="glow-lime rounded-3xl border border-panel-border px-6 py-10 md:px-10 md:py-14">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
          Peace to you
        </p>
        <h1 className="mt-3 text-3xl leading-tight md:text-[42px] md:leading-[1.1]">
          What is happening beneath the surface,
          <br />
          <span className="text-muted-foreground">that you'd like to see clearly?</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Write in your own words. Wisdom will respond in structured cards — what it hears,
          the pattern beneath, a biblical mirror, a prayer with lineage, and one next act.
          Not a chatbot; not a verse-finder.
        </p>

        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map(({ Icon, label, prompt, mode: sugMode }) => (
            <button
              key={label}
              onClick={() => {
                setText(prompt);
                setMode(sugMode);
              }}
              className="group flex items-center gap-3 rounded-2xl border border-panel-border bg-surface/60 px-4 py-3 text-left text-sm transition hover:border-primary/40 hover:bg-surface"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary transition group-hover:bg-primary/25">
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <span className="text-foreground/90">{label}</span>
              <ArrowRight
                className="ml-auto size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground"
                strokeWidth={1.75}
              />
            </button>
          ))}
        </div>

      </section>

      {/* Composer */}
      <section className="mt-6 rounded-3xl border border-panel-border bg-surface/60 p-3 md:p-4">
        <label htmlFor="story" className="sr-only">
          Your story
        </label>
        <textarea
          id="story"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell Wisdom what's been repeating…"
          className="h-28 w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-panel-border/70 pt-3">
          <div className="flex items-center gap-1 rounded-full border border-panel-border bg-background/60 p-0.5">
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs transition",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                  title={m.hint}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="hidden text-[11px] text-muted-foreground md:block">
            {COPY.modes[mode === "curse_breaker" ? "curse_breaker" : mode].hint}
          </p>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={openSeed}
              className="inline-flex items-center gap-1.5 rounded-full border border-panel-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="size-3.5" strokeWidth={2} />
              Seeded example
            </button>
            <button
              onClick={begin}
              disabled={text.trim().length === 0 || busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  Composing…
                </>
              ) : (
                <>
                  Begin session
                  <ArrowUp className="size-3.5" strokeWidth={2} />
                </>
              )}
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </section>


      {/* Recent */}
      <section className="mt-10 space-y-3">
        <h2 className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Recent sessions
        </h2>
        {SESSIONS.map((s) => (
          <Link
            key={s.id}
            to="/wisdom/$sessionId"
            params={{ sessionId: s.id }}
            className="group flex items-start gap-4 rounded-2xl border border-panel-border bg-surface/60 px-4 py-4 transition hover:bg-surface"
          >
            <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium leading-snug">{s.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                {s.messages[0].text}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                {s.depth} mode · {new Date(s.createdAt).toLocaleDateString()}
              </p>
            </div>
            <ArrowRight
              className="mt-2 size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground"
              strokeWidth={1.75}
            />
          </Link>
        ))}
      </section>
    </div>
  );
}
