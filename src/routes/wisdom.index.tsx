import { createFileRoute, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { useServerFn } from "@tanstack/react-start";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  BookOpen,
  Compass,
  EyeOff,

  Hand,
  HandHelping,
  History,
  Loader2,
  Plus,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getDashboardSlice } from "@/lib/wisdom/dashboard.functions";
import { getSessionSlice, getSessionTelemetry } from "@/lib/wisdom/pipeline.functions";
import { toast } from "sonner";
import { listRecentSessions, getSessionDetail } from "@/lib/wisdom/session.functions";
import { useSession } from "@/hooks/useSession";
import { FlickeringGrid } from "@/registry/magicui/flickering-grid";
import { ShineBorder } from "@/registry/magicui/shine-border";



export const Route = createFileRoute("/wisdom/")({
  head: () => ({
    meta: [
      { title: "Wisdom — talk to Wisdom" },
      {
        name: "description",
        content:
          "Bring a real situation. Wisdom listens for the pattern beneath and mirrors it through scripture.",
      },
    ],
  }),
  component: WisdomChat,
});

type Mode = "companion" | "pattern" | "deep" | "curse_breaker";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "companion", label: "Companion", hint: "Presence first, discernment second." },
  { id: "pattern", label: "Pattern", hint: "Name what keeps repeating." },
  { id: "deep", label: "Deep Wisdom", hint: "Test a spiritual interpretation." },
  { id: "curse_breaker", label: "Curse Breaker", hint: "Discern a possible stronghold." },
];

const SUGGESTIONS = [
  { Icon: Compass, label: "Name a pattern I keep returning to", prompt: "Something keeps happening that I don't fully understand — ", mode: "pattern" as Mode },
  { Icon: HandHelping, label: "Help me pray about something honestly", prompt: "I want to pray about this, but I'm not sure what I'm really asking for — ", mode: "companion" as Mode },
  { Icon: BookOpen, label: "Test a spiritual interpretation", prompt: "I've been wondering whether this is spiritual or just — ", mode: "deep" as Mode },
  { Icon: Hand, label: "Reflect on a repeated setback", prompt: "I said I wouldn't again, and I did. Here's what happened — ", mode: "pattern" as Mode },
  { Icon: ShieldAlert, label: "A pattern across generations", prompt: "This keeps showing up across my family — ", mode: "curse_breaker" as Mode },
];

function WisdomChat() {
  const [mode, setMode] = useState<Mode>("pattern");
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [dontRemember, setDontRemember] = useState(false);
  const modeRef = useRef(mode);
  const sessionIdRef = useRef<string | null>(null);
  const dontRememberRef = useRef(dontRemember);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { dontRememberRef.current = dontRemember; }, [dontRemember]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          mode: modeRef.current,
          sessionId: sessionIdRef.current,
          memoryDirective: dontRememberRef.current ? "do_not_remember" : "normal",
        }),
        headers: async (): Promise<Record<string, string>> => {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        fetch: async (input, init) => {
          const res = await fetch(input, init);
          const sid = res.headers.get("x-wisdom-session-id");
          if (sid && sid !== sessionIdRef.current) {
            sessionIdRef.current = sid;
            setSessionId(sid);
          }
          return res;
        },
      }),
    [],
  );


  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
    onError: (e) => {
      console.error("chat error", e);
      // Try to parse structured rate-limit payload from the server route.
      let msg = e.message || "Wisdom couldn't reach the model. Try again in a moment.";
      try {
        const parsed = JSON.parse(msg) as { error?: string; message?: string };
        if (parsed?.message) msg = parsed.message;
      } catch { /* not JSON */ }
      toast.error(msg);
    },
  });

  const [historyOpen, setHistoryOpen] = useState(false);
  const fetchRecentSessions = useServerFn(listRecentSessions);
  const fetchSessionDetail = useServerFn(getSessionDetail);
  const recent = useQuery({
    queryKey: ["recent-sessions"],
    queryFn: () => fetchRecentSessions(),
    enabled: historyOpen,
    staleTime: 15_000,
  });

  const resumeSession = async (sid: string, sMode: string) => {
    setHistoryOpen(false);
    const detail = await fetchSessionDetail({ data: { sessionId: sid } });
    if (!detail) return;
    const modeMap: Record<string, Mode> = {
      companion: "companion", pattern: "pattern",
      deep_wisdom: "deep", curse_breaker: "curse_breaker",
    };
    setMode(modeMap[sMode] ?? "pattern");
    sessionIdRef.current = sid;
    setSessionId(sid);
    setMessages(
      detail.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          parts: [{ type: "text", text: m.content }],
        })) as UIMessage[],
    );
  };

  const newSession = () => {
    sessionIdRef.current = null;
    setSessionId(null);
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  };


  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    textareaRef.current?.focus();
  }, [messages.length]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";
  const isEmpty = messages.length === 0;

  const submit = () => {
    const t = input.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  const { user, ready } = useSession();
  const fetchSlice = useServerFn(getDashboardSlice);
  const slice = useQuery({
    queryKey: ["dashboard-slice", user?.id ?? "anon"],
    queryFn: () => fetchSlice(),
    enabled: ready && !!user,
    staleTime: 30_000,
  });
  const d = slice.data;

  // Live session artifacts (interpretation / prayer / practice) surfaced from the pipeline.
  const fetchSessionSlice = useServerFn(getSessionSlice);
  const sessionSlice = useQuery({
    queryKey: ["session-slice", sessionId ?? "none"],
    queryFn: () => fetchSessionSlice({ data: { sessionId: sessionId! } }),
    enabled: !!sessionId && !!user,
    // Poll while a turn is being processed; slow down when idle.
    refetchInterval: busy ? 2500 : 15000,
    staleTime: 1000,
  });
  const artifacts = sessionSlice.data;

  // Pipeline telemetry — surface last failed stage as a banner in the rail.
  const fetchTelemetry = useServerFn(getSessionTelemetry);
  const telemetry = useQuery({
    queryKey: ["session-telemetry", sessionId ?? "none"],
    queryFn: () => fetchTelemetry({ data: { sessionId: sessionId! } }),
    enabled: !!sessionId && !!user,
    refetchInterval: busy ? 3000 : 20000,
  });
  const latestRuns = telemetry.data?.runs ?? [];
  const lastErrorRun = [...latestRuns].reverse().find((r) => r.status === "error") as
    | { stage: string; error: string | null; created_at: string }
    | undefined;





  return (
    <div className="relative flex h-[calc(100vh-6rem)] gap-4 md:gap-6">
      {/* Diagonal flickering grid band across the top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[220px] overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(115deg, black 0%, rgba(0,0,0,0.6) 40%, transparent 78%), linear-gradient(to bottom, black 0%, black 35%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(115deg, black 0%, rgba(0,0,0,0.6) 40%, transparent 78%), linear-gradient(to bottom, black 0%, black 35%, transparent 100%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      >
        <FlickeringGrid
          className="h-full w-full [&_canvas]:!h-full [&_canvas]:!w-full"
          squareSize={3}
          gridGap={6}
          flickerChance={0.35}
          color="#E8DFC8"
          maxOpacity={0.55}
        />
      </div>

      {/* Conversation column — framed */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col pt-6 md:pt-10">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-panel-border bg-surface/40 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.65)] backdrop-blur-sm">
          {/* Frame header */}
          <div className="flex items-center justify-between gap-3 border-b border-panel-border/70 bg-background/40 px-5 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                <Sparkles className="size-3" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Wisdom · {MODES.find((m) => m.id === mode)?.label}</div>
                <div className="truncate text-[12px] text-foreground/80">{MODES.find((m) => m.id === mode)?.hint}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {isEmpty ? "New session" : `${messages.length} exchange${messages.length === 1 ? "" : "s"}`}
              </span>
              <button
                onClick={newSession}
                title="Start a new session"
                className="inline-flex items-center gap-1 rounded-full border border-panel-border bg-background/50 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
              >
                <Plus className="size-3" /> New
              </button>
              <div className="relative">
                <button
                  onClick={() => setHistoryOpen((v) => !v)}
                  title="Resume a past session"
                  className="inline-flex items-center gap-1 rounded-full border border-panel-border bg-background/50 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
                >
                  <History className="size-3" /> History
                </button>
                {historyOpen && (
                  <div className="absolute right-0 top-full z-40 mt-1 w-[320px] max-h-[440px] overflow-y-auto rounded-xl border border-panel-border bg-surface/95 p-2 shadow-2xl backdrop-blur">
                    <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Recent sessions
                    </div>
                    {recent.isLoading && (
                      <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> Loading…
                      </div>
                    )}
                    {recent.data && recent.data.length === 0 && (
                      <div className="px-2 py-3 text-[11px] text-muted-foreground">
                        No prior sessions yet.
                      </div>
                    )}
                    <ul className="flex flex-col">
                      {recent.data?.map((s) => (
                        <li key={s.id}>
                          <button
                            onClick={() => resumeSession(s.id, s.mode)}
                            className={[
                              "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left transition hover:bg-background/60",
                              s.id === sessionId ? "bg-primary/10" : "",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="line-clamp-1 text-[12px] text-foreground/90">
                                {s.title || "Untitled thread"}
                              </span>
                              <span className="shrink-0 text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
                                {s.mode.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                              <span>·</span>
                              <span>{s.messageCount} msg</span>
                              {s.hasPrayer && <span className="text-primary/80">· prayer</span>}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scroll region */}
          <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 md:px-6">
            {isEmpty ? (
              <EmptyState onPick={(p, m) => { setInput(p); setMode(m); textareaRef.current?.focus(); }} />
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-8 py-8">
                {messages.map((m, idx) => {
                  const isLastAssistant =
                    m.role === "assistant" && idx === messages.length - 1;
                  return (
                    <div key={m.id} className="space-y-4">
                      <MessageBubble message={m} />
                      {isLastAssistant && mode !== "companion" && (
                        <InlineArtifactStrip
                          artifacts={artifacts as unknown as SessionArtifacts}
                          busy={busy}
                          hasSession={!!sessionId}
                        />
                      )}
                    </div>
                  );
                })}
                {status === "submitted" && (
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Wisdom is listening…
                  </div>
                )}
                {error && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                    {error.message}
                  </div>
                )}
              </div>

            )}
          </div>

          {/* Composer, inside the frame */}
          <div className="border-t border-panel-border/70 bg-background/50 px-4 py-4 md:px-6">
            <div className="mx-auto w-full max-w-3xl">
              <div className="relative overflow-hidden rounded-2xl border border-panel-border bg-surface/70 p-3 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)]">
                <ShineBorder borderWidth={1.5} duration={3.2} shineColor={["#E8DFC8", "#FFFFFF", "#B8A470"]} />
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
                  }}
                  rows={2}
                  placeholder="Bring a real situation. Wisdom mirrors it through Scripture—never as a verdict."
                  className="w-full resize-none bg-transparent px-2 py-1 text-[14px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-panel-border/60 pt-2">
                  <div className="flex items-center gap-0.5 rounded-full border border-panel-border bg-background/60 p-0.5">
                    {MODES.map((m) => {
                      const active = mode === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setMode(m.id)}
                          title={m.hint}
                          className={[
                            "rounded-full px-2.5 py-1 text-[11px] transition",
                            active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                          ].join(" ")}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setDontRemember((d) => !d)}
                    title="This turn won't be used to derive durable memory."
                    className={[
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition",
                      dontRemember
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-panel-border bg-background/60 text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    <EyeOff className="size-3" />
                    {dontRemember ? "Don't remember" : "Remember"}
                  </button>
                  <button
                    onClick={submit}
                    disabled={busy || input.trim().length === 0}
                    className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? <><Loader2 className="size-3 animate-spin" /> Composing…</> : <>Begin <ArrowUp className="size-3" /></>}
                  </button>
                </div>

              </div>
              <p className="mt-2 px-2 text-center text-[10px] text-muted-foreground">
                Scripture citations are checked against curated passages · nothing is remembered without your permission.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Live surfacing rail */}
      <aside className="hidden w-[300px] shrink-0 flex-col gap-3 overflow-y-auto pt-6 md:pt-10 lg:flex">
        <RailCard label="Session" head={sessionId ? "Live · persisted" : "Live"}>
          <div className="text-[12px] text-muted-foreground">
            {isEmpty ? "Waiting for your first message." : `${messages.length} exchange${messages.length === 1 ? "" : "s"} · mode ${mode}`}
          </div>
          {busy && mode !== "companion" && (
            <div className="mt-2 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-primary/80">
              <Loader2 className="size-3 animate-spin" /> Running discernment pipeline…
            </div>
          )}
        </RailCard>

        {lastErrorRun && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] leading-relaxed text-destructive">
            <div className="flex items-center gap-1.5 font-medium uppercase tracking-[0.14em]">
              <ShieldAlert className="size-3" /> Pipeline · {lastErrorRun.stage} failed
            </div>
            <p className="mt-1 text-destructive/90">
              {lastErrorRun.error?.slice(0, 220) || "Discernment stage errored. Retry the last message or try a shorter turn."}
            </p>
          </div>
        )}

        {/* Live interpretation from the pipeline */}
        {artifacts?.interpretation ? (
          <RailCard
            label="Interpretation"
            head={((artifacts.interpretation as { hypothesis_name?: string | null }).hypothesis_name) || "Working hypothesis"}
          >
            {(() => {
              const it = artifacts.interpretation as {
                hypothesis_description?: string | null;
                confidence?: number | null;
                distinguishing_question?: string | null;
              };
              return (
                <div className="space-y-2">
                  {it.hypothesis_description && (
                    <p className="line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">
                      {it.hypothesis_description}
                    </p>
                  )}
                  {typeof it.confidence === "number" && <ConfidenceBar value={it.confidence} />}
                  {it.distinguishing_question && (
                    <p className="mt-1 border-l-2 border-primary/40 pl-2 text-[11px] italic text-foreground/80">
                      {it.distinguishing_question}
                    </p>
                  )}
                </div>
              );
            })()}
          </RailCard>
        ) : sessionId && !busy ? (
          <RailCard label="Interpretation" head="Forming…">
            <p className="text-[11.5px] text-muted-foreground">
              Wisdom is weighing signals into a testable hypothesis.
            </p>
          </RailCard>
        ) : null}

        {/* Live prayer from the pipeline */}
        {artifacts?.prayer ? (
          <RailCard
            label="Prayer"
            head={(artifacts.prayer as { title?: string | null }).title || "Composed prayer"}
          >
            {(() => {
              const p = artifacts.prayer as {
                id: string;
                prayer_lines?: { movement: string }[] | null;
              };
              const movements = Array.from(
                new Set((p.prayer_lines ?? []).map((l) => l.movement)),
              );
              return (
                <>
                  {movements.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {movements.map((m) => (
                        <span key={m} className="rounded-full border border-panel-border/60 bg-background/60 px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                  <Link
                    to="/prayers/$prayerId"
                    params={{ prayerId: p.id }}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                  >
                    Open prayer →
                  </Link>
                </>
              );
            })()}
          </RailCard>
        ) : d?.latestPrayer ? (
          <RailCard label="Latest prayer" head={`${d.latestPrayer.movementCount} movements`}>
            <p className="line-clamp-2 text-[11.5px] text-muted-foreground">{d.latestPrayer.title}</p>
            <Link
              to="/prayers/$prayerId"
              params={{ prayerId: d.latestPrayer.id }}
              className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
            >
              Open prayer →
            </Link>
          </RailCard>
        ) : (
          <RailCard label="Prayer" head="Not formed yet">
            <p className="text-[11.5px] text-muted-foreground">
              A prayer will appear after Wisdom understands the situation and verifies its biblical roots.
            </p>
          </RailCard>
        )}

        {/* Primary practice */}
        {artifacts?.practices?.length ? (
          (() => {
            const list = artifacts.practices as {
              is_primary?: boolean;
              kind: string;
              rationale?: string | null;
            }[];
            const primary = list.find((p) => p.is_primary) ?? list[0];
            return (
              <RailCard label="Primary practice" head={primary.kind.replace(/_/g, " ")}>
                {primary.rationale && (
                  <p className="line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">
                    {primary.rationale}
                  </p>
                )}
              </RailCard>
            );
          })()

        ) : d?.patterns.mostRecent ? (
          <RailCard label="Emerging pattern" head={d.patterns.mostRecent.title}>
            <p className="text-[11.5px] text-muted-foreground">
              {d.patterns.mostRecent.lifecycle} · updated {new Date(d.patterns.mostRecent.updatedAt).toLocaleDateString()}
            </p>
          </RailCard>
        ) : null}
      </aside>

    </div>
  );
}


function EmptyState({ onPick }: { onPick: (prompt: string, mode: Mode) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary shadow-[0_0_40px_-8px_var(--primary-glow)]">
        <Sparkles className="size-5" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-2xl font-light tracking-tight md:text-3xl">
        What is happening beneath the surface,
        <span className="text-muted-foreground"> that you'd like to see clearly?</span>
      </h1>
      <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground">
        Bring a real situation. Wisdom listens for the pattern, then mirrors it through
        Scripture—never as a verdict.
      </p>
      <div className="mt-8 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map(({ Icon, label, prompt, mode }) => (
          <button
            key={label}
            onClick={() => onPick(prompt, mode)}
            className="group flex items-center gap-2.5 rounded-xl border border-panel-border/70 bg-surface/40 px-3 py-2.5 text-left text-[12.5px] transition hover:border-primary/40 hover:bg-surface"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
              <Icon className="size-3.5" strokeWidth={1.75} />
            </span>
            <span className="text-foreground/85">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");

  if (isUser) {
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[14px] leading-relaxed text-primary-foreground shadow-sm">
        {text}
      </div>
    );
  }

  const sections = splitSections(text);

  return (
    <div className="flex gap-3">
      <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="size-3.5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        {sections.length === 0 ? (
          <ProseBlock text={text} />
        ) : (
          sections.map((s, i) => (
            <section
              key={i}
              className="group rounded-2xl border border-panel-border/60 bg-surface/40 px-4 py-3 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.6)] transition hover:border-panel-border"
            >
              {s.heading && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
                  <span className="text-[10px] uppercase tracking-[0.18em] text-primary/90">
                    {s.heading}
                  </span>
                  <span className="h-px flex-[3] bg-gradient-to-l from-panel-border to-transparent" />
                </div>
              )}
              <ProseBlock text={s.body} />
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function ProseBlock({ text }: { text: string }) {
  return (
    <div className="text-[14px] leading-relaxed text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
          h1: ({ children }) => <h1 className="mt-4 mb-2 text-lg font-semibold text-foreground first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-4 mb-2 text-base font-semibold text-foreground first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-3 mb-1.5 text-[15px] font-semibold text-foreground first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="mt-3 mb-1 text-[14px] font-semibold text-foreground first:mt-0">{children}</h4>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-primary/70">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-primary/70">{children}</ol>,
          li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-primary/60 pl-3 italic text-foreground/85">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isBlock = /language-/.test(className ?? "");
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-lg border border-panel-border bg-surface/70 p-3 text-[12.5px] font-mono text-foreground/90">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-surface/70 px-1.5 py-0.5 text-[12.5px] font-mono text-foreground/90">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
          hr: () => <hr className="my-3 border-panel-border/60" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-panel-border px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-panel-border/50 px-2 py-1 align-top">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** Split a Wisdom reply into labeled sections by top-level **Bold** headings. */
function splitSections(text: string): { heading: string | null; body: string }[] {
  const lines = text.split(/\r?\n/);
  // Heading line: entirely a bold token, optionally followed by an em-dash tail we drop.
  const HEADING = /^\s*\*\*(.+?)\*\*\s*(?:—|-|:)?\s*$/;
  const sections: { heading: string | null; body: string }[] = [];
  let current: { heading: string | null; buf: string[] } = { heading: null, buf: [] };

  for (const line of lines) {
    const m = HEADING.exec(line);
    if (m) {
      if (current.heading || current.buf.some((l) => l.trim())) {
        sections.push({ heading: current.heading, body: current.buf.join("\n").trim() });
      }
      current = { heading: m[1].trim(), buf: [] };
    } else {
      current.buf.push(line);
    }
  }
  if (current.heading || current.buf.some((l) => l.trim())) {
    sections.push({ heading: current.heading, body: current.buf.join("\n").trim() });
  }

  // If there's only one section and it has no heading, treat as unsectioned.
  if (sections.length === 1 && !sections[0].heading) return [];
  return sections.filter((s) => s.heading || s.body);
}

function RailCard({ label, head, children }: { label: string; head: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-panel-border bg-surface/50 p-4">
      <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[13px] font-medium">{head}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}



function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Confidence</span>
        <span className="text-foreground tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type EventChainLink = {
  kind:
    | "context" | "trigger" | "interpretation" | "need" | "choice"
    | "immediate_reward" | "cost" | "afterthought" | "re_entry";
  text: string;
  fromUser?: boolean;
};

type SessionArtifacts = {
  interpretation?: {
    hypothesis_name?: string | null;
    hypothesis_description?: string | null;
    confidence?: number | null;
    distinguishing_question?: string | null;
    event_chain?: EventChainLink[] | null;
  } | null;
  prayer?: {
    id: string;
    title?: string | null;
    prayer_lines?: { movement: string; text?: string | null; order_index?: number | null }[] | null;
  } | null;
  practices?: {
    is_primary?: boolean;
    kind: string;
    rationale?: string | null;
  }[] | null;
  signals?: { kind: string; label?: string | null }[] | null;
} | undefined | null;

function InlineArtifactStrip({
  artifacts,
  busy,
  hasSession,
}: {
  artifacts: SessionArtifacts;
  busy: boolean;
  hasSession: boolean;
}) {
  const hasAny =
    !!artifacts?.interpretation ||
    !!artifacts?.prayer ||
    (artifacts?.practices?.length ?? 0) > 0 ||
    (artifacts?.signals?.length ?? 0) > 0;

  if (!hasSession) return null;

  if (!hasAny) {
    if (!busy) return null;
    return (
      <div className="ml-10 flex items-center gap-2 rounded-xl border border-dashed border-panel-border/70 bg-surface/30 px-3 py-2 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin text-primary" />
        Discernment pipeline running · extracting signals, weighing interpretations, composing prayer…
      </div>
    );
  }

  const it = artifacts?.interpretation ?? null;
  const pr = artifacts?.prayer ?? null;
  const primary =
    artifacts?.practices?.find((p) => p.is_primary) ?? artifacts?.practices?.[0] ?? null;
  const signals = artifacts?.signals ?? [];
  const chain = (it?.event_chain ?? []).filter((l) => l?.text);

  return (
    <div className="ml-10 space-y-2">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
        <span>Discernment artifacts</span>
        <span className="h-px flex-[3] bg-gradient-to-l from-panel-border to-transparent" />
      </div>

      {chain.length > 0 && (
        <ArtifactCard icon="⟶" label={`Event chain · ${chain.length}`} tone="primary">
          <ol className="flex flex-wrap items-center gap-1.5">
            {chain.map((link, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 text-[10px]",
                    link.fromUser
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-panel-border/60 bg-background/60 text-muted-foreground",
                  ].join(" ")}
                  title={link.kind}
                >
                  <span className="mr-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                    {link.kind.replace(/_/g, " ")}
                  </span>
                  {link.text}
                </span>
                {i < chain.length - 1 && <span className="text-muted-foreground/60">›</span>}
              </li>
            ))}
          </ol>
        </ArtifactCard>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {signals.length > 0 && (
          <ArtifactCard icon="◆" label={`Signals · ${signals.length}`} tone="muted">
            <div className="flex flex-wrap gap-1">
              {signals.slice(0, 10).map((s, i) => (
                <span
                  key={i}
                  className="rounded-full border border-panel-border/60 bg-background/50 px-1.5 py-0.5 text-[10px] text-foreground/75"
                  title={s.kind}
                >
                  {s.label ?? s.kind}
                </span>
              ))}
            </div>
          </ArtifactCard>
        )}

        {it && (
          <ArtifactCard icon="✻" label="Interpretation" tone="primary">
            {it.hypothesis_name && (
              <div className="text-[12.5px] font-medium text-foreground">{it.hypothesis_name}</div>
            )}
            {it.hypothesis_description && (
              <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">
                {it.hypothesis_description}
              </p>
            )}
            {typeof it.confidence === "number" && (
              <div className="mt-2">
                <ConfidenceBar value={it.confidence} />
              </div>
            )}
            {it.distinguishing_question && (
              <p className="mt-2 border-l-2 border-primary/40 pl-2 text-[11px] italic text-foreground/80">
                {it.distinguishing_question}
              </p>
            )}
          </ArtifactCard>
        )}

        {pr && (
          <ArtifactCard icon="✦" label="Prayer">
            <div className="text-[12.5px] font-medium text-foreground">
              {pr.title || "Composed prayer"}
            </div>
            {(() => {
              const movements = Array.from(new Set((pr.prayer_lines ?? []).map((l) => l.movement)));
              return movements.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {movements.map((m) => (
                    <span
                      key={m}
                      className="rounded-full border border-panel-border/60 bg-background/60 px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              ) : null;
            })()}
            <Link
              to="/prayers/$prayerId"
              params={{ prayerId: pr.id }}
              className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-primary/90 hover:text-primary"
            >
              Open prayer →
            </Link>
          </ArtifactCard>
        )}

        {primary && (
          <ArtifactCard icon="◈" label="Primary practice">
            <div className="text-[12.5px] font-medium capitalize text-foreground">
              {primary.kind.replace(/_/g, " ")}
            </div>
            {primary.rationale && (
              <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">
                {primary.rationale}
              </p>
            )}
          </ArtifactCard>
        )}
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-primary/70">
          <Loader2 className="size-3 animate-spin" /> refining…
        </div>
      )}
    </div>
  );
}

function ArtifactCard({
  icon,
  label,
  tone = "muted",
  children,
}: {
  icon: string;
  label: string;
  tone?: "primary" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "rounded-xl border bg-surface/50 px-3 py-2.5 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.6)]",
        tone === "primary" ? "border-primary/30" : "border-panel-border/60",
      ].join(" ")}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className={tone === "primary" ? "text-primary" : "text-foreground/60"}>{icon}</span>
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

