import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  Clock,
  Compass,
  Hand,
  HandHelping,
  Loader2,
  Lock,
  ShieldAlert,
  Sparkles,
  Trash2,

} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getDashboardSlice } from "@/lib/wisdom/dashboard.functions";
import { listRecentSessions, loadSessionHistory, deleteSession } from "@/lib/wisdom/session.functions";
import { useSession } from "@/hooks/useSession";
import { useWisdomAccess } from "@/hooks/useWisdomAccess";
import { FlickeringGrid } from "@/registry/magicui/flickering-grid";
import { ShineBorder } from "@/registry/magicui/shine-border";
import { streamUnifiedTurn, type TurnEvent } from "@/lib/wisdom/unified.stream";
import { mapWisdomError, type UserSafeError } from "@/lib/wisdom/errorCopy";
import type { UnifiedResult } from "@/lib/wisdom/unified.schemas";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedResultView } from "@/components/wisdom/UnifiedResultView";

type WisdomSearch = {
  prompt?: string;
  mode?: "companion" | "pattern" | "deep_wisdom" | "curse_breaker";
  autostart?: boolean;
  sessionId?: string;
};

const ALL_MODES = ["companion", "pattern", "deep_wisdom", "curse_breaker"] as const;

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
  validateSearch: (raw: Record<string, unknown>): WisdomSearch => {
    const mode = ALL_MODES.find((m) => m === raw.mode);
    const autostart = raw.autostart === "1" || raw.autostart === true || raw.autostart === 1;
    return {
      prompt: typeof raw.prompt === "string" && raw.prompt.length > 0 ? raw.prompt : undefined,
      mode,
      autostart: autostart || undefined,
      sessionId: typeof raw.sessionId === "string" ? raw.sessionId : undefined,
    };
  },
});

type Mode = "companion" | "pattern" | "deep_wisdom" | "curse_breaker";

const MODES: { id: Mode; label: string; hint: string; disabled?: boolean; disabledHint?: string }[] = [
  { id: "companion", label: "Companion", hint: "Presence first, discernment second." },
  { id: "pattern", label: "Pattern", hint: "Name what keeps repeating." },
  { id: "deep_wisdom", label: "Deep Wisdom", hint: "Test a spiritual interpretation." },
  { id: "curse_breaker", label: "Curse Breaker", hint: "Discern a possible stronghold." },
];

const SUGGESTIONS = [
  { Icon: Compass, label: "Name a pattern I keep returning to", prompt: "Something keeps happening that I don't fully understand — ", mode: "pattern" as Mode },
  { Icon: HandHelping, label: "Help me pray about something honestly", prompt: "I want to pray about this, but I'm not sure what I'm really asking for — ", mode: "companion" as Mode },
  { Icon: BookOpen, label: "Test a spiritual interpretation", prompt: "I've been wondering whether this is spiritual or just — ", mode: "deep_wisdom" as Mode },
  { Icon: Hand, label: "Reflect on a repeated setback", prompt: "I said I wouldn't again, and I did. Here's what happened — ", mode: "pattern" as Mode },
];

type UserTurn = { kind: "user"; id: string; text: string };
type WisdomTurn = { kind: "wisdom"; id: string; turnId?: string; result?: UnifiedResult; error?: string; phase: "processing" | "done" | "error" };
type Turn = UserTurn | WisdomTurn;

function newId() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function WisdomChat() {
  const [mode, setMode] = useState<Mode>("pattern");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [routeError, setRouteError] = useState<UserSafeError | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inflightRef = useRef(false); // hard double-submit guard

  const { user, ready } = useSession();
  const access = useWisdomAccess();

  const composerEnabled = access.status === "allowed" && !!user;

  // Session rail: past sessions + hydration on click
  const fetchSessions = useServerFn(listRecentSessions);
  const fetchHistory = useServerFn(loadSessionHistory);
  const sessionsQ = useQuery({
    queryKey: ["wisdom-sessions", user?.id ?? "anon"],
    queryFn: () => fetchSessions(),
    enabled: ready && !!user,
    staleTime: 15_000,
  });

  const openSession = async (sid: string) => {
    if (busy) return;
    setRouteError(null);
    try {
      const hist = await fetchHistory({ data: { sessionId: sid } });
      const userMsgs = new Map(hist.messages.filter((m) => m.role === "user").map((m) => [m.id, m]));
      const rebuilt: Turn[] = [];
      for (const t of hist.turns) {
        const um = t.triggeringUserMessageId ? userMsgs.get(t.triggeringUserMessageId) : undefined;
        if (um) rebuilt.push({ kind: "user", id: um.id, text: um.content });
        rebuilt.push({
          kind: "wisdom",
          id: t.id,
          turnId: t.id,
          result: t.result ?? undefined,
          phase: t.status === "completed" ? "done" : t.status === "failed" ? "error" : "processing",
        });
      }
      setTurns(rebuilt);
      setSessionId(sid);
      const m = (hist.session.mode as Mode);
      if (m) setMode(m);
    } catch {
      setRouteError(mapWisdomError("session not found"));
    }
  };

  const newSession = () => {
    if (busy) return;
    setTurns([]);
    setSessionId(null);
    setRouteError(null);
    setInput("");
  };

  const removeSession = useServerFn(deleteSession);
  const handleDeleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    if (!confirm("Delete this session and all its messages? This cannot be undone.")) return;
    try {
      await removeSession({ data: { sessionId: sid } });
      if (sessionId === sid) newSession();
      void sessionsQ.refetch();
    } catch {
      setRouteError(mapWisdomError("Could not delete session"));
    }
  };

  // Create a session lazily on first send (mode is authoritative once locked).
  const ensureSession = async (chosenMode: Mode): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (!user) return null;
    const { data, error } = await supabase
      .from("sessions")
      .insert({ user_id: user.id, mode: chosenMode })
      .select("id")
      .single();
    if (error || !data) {
      setRouteError(mapWisdomError("session not found"));
      return null;
    }
    setSessionId(data.id);
    void sessionsQ.refetch();
    return data.id;
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (composerEnabled) textareaRef.current?.focus(); }, [turns.length, composerEnabled]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const isEmpty = turns.length === 0;

  const submit = async (retryOf?: string, modeOverride?: Mode) => {
    const text = retryOf ?? input.trim();
    if (!text) return;
    // Hard double-submit guard (state can race across handlers)
    if (inflightRef.current || busy) return;
    if (!user) {
      setRouteError(mapWisdomError("unauthenticated"));
      return;
    }
    if (access.status !== "allowed") {
      const reason = access.status === "denied" ? access.reason : "unified_disabled";
      setRouteError(mapWisdomError(reason));
      return;
    }
    const effectiveMode: Mode = modeOverride ?? mode;
    const chosen = MODES.find((m) => m.id === effectiveMode);
    if (chosen?.disabled) {
      setRouteError(mapWisdomError("curse_breaker_unavailable"));
      return;
    }

    inflightRef.current = true;
    setRouteError(null);
    const sid = await ensureSession(effectiveMode);
    if (!sid) { inflightRef.current = false; return; }

    const messageId = newId();
    const userTurn: UserTurn = { kind: "user", id: messageId, text };
    const wisdomId = newId();
    const wisdomTurn: WisdomTurn = { kind: "wisdom", id: wisdomId, phase: "processing" };
    setTurns((t) => [...t, userTurn, wisdomTurn]);
    if (!retryOf) setInput("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const ev of streamUnifiedTurn({
        sessionId: sid,
        triggeringUserMessageId: messageId,
        userText: text,
        memoryDirective: "normal",
        clientRequestedMode: effectiveMode,
      }, controller.signal)) {
        applyEvent(setTurns, wisdomId, ev);
      }
    } catch {
      applyEvent(setTurns, wisdomId, { type: "error", error: "network_error" });
    } finally {
      setBusy(false);
      inflightRef.current = false;
      abortRef.current = null;
    }
  };

  // Canonical entry from other routes (e.g. /dashboard).
  // Consumes ?prompt&mode&autostart&sessionId once, then submits via streamUnifiedTurn.
  const search = Route.useSearch();
  const navigate = useNavigateRoute();
  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    if (!ready) return;
    // If a specific session is requested, load it.
    if (search.sessionId) {
      bootRef.current = true;
      void openSession(search.sessionId);
      return;
    }
    // Prefill from search params.
    if (search.prompt) {
      setInput(search.prompt);
      if (search.mode) setMode(search.mode);
    }
    // Only auto-submit when explicitly asked AND access is allowed.
    if (search.autostart && search.prompt && user && access.status === "allowed") {
      bootRef.current = true;
      const m: Mode = search.mode ?? mode;
      setMode(m);
      // Clear the search params so a reload doesn't re-submit the same prompt.
      void navigate({ to: "/wisdom", search: {}, replace: true });
      void submit(search.prompt, m);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, access.status, search.prompt, search.mode, search.autostart, search.sessionId]);


  const fetchSlice = useServerFn(getDashboardSlice);
  const slice = useQuery({
    queryKey: ["dashboard-slice", user?.id ?? "anon"],
    queryFn: () => fetchSlice(),
    enabled: ready && !!user,
    staleTime: 30_000,
  });
  const d = slice.data;

  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!historyOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!historyRef.current?.contains(e.target as Node)) setHistoryOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [historyOpen]);

  const activeModeMeta = MODES.find((m) => m.id === mode);
  const exchangeCount = turns.filter((t) => t.kind === "user").length;

  return (
    <div className="relative flex h-[calc(100vh-3rem)] w-full gap-4 xl:gap-6">
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

      {/* Main column — fluid, centered content, composer anchored bottom */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Top bar with session status + history */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="inline-block size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
            <span className="truncate">
              {sessionId ? `${activeModeMeta?.label} · ${exchangeCount} exchange${exchangeCount === 1 ? "" : "s"}` : "New session"}
            </span>
          </div>
          <div className="relative flex items-center gap-2" ref={historyRef}>
            <button
              type="button"
              onClick={newSession}
              className="rounded-full border border-panel-border bg-surface/60 px-3 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
            >
              + New
            </button>
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-panel-border bg-surface/60 px-3 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
              aria-haspopup="menu"
              aria-expanded={historyOpen}
            >
              <Clock className="size-3" />
              History
              {(sessionsQ.data?.length ?? 0) > 0 && (
                <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 text-[10px] text-primary">
                  {sessionsQ.data!.length}
                </span>
              )}
            </button>
            {historyOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-2 max-h-[60vh] w-72 overflow-y-auto rounded-2xl border border-panel-border bg-surface/95 p-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)] backdrop-blur"
              >
                <div className="px-2 pb-1 pt-1 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  Past sessions
                </div>
                {(sessionsQ.data ?? []).length === 0 ? (
                  <div className="px-2 py-3 text-[11px] text-muted-foreground">No past sessions yet.</div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {(sessionsQ.data ?? []).map((s) => (
                      <div
                        key={s.id}
                        className={[
                          "group relative flex items-center gap-1 rounded-md transition",
                          sessionId === s.id
                            ? "bg-primary/15 text-foreground"
                            : "text-muted-foreground hover:bg-surface hover:text-foreground",
                        ].join(" ")}
                      >
                        <button
                          onClick={() => { openSession(s.id); setHistoryOpen(false); }}
                          className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[12px]"
                          title={s.title ?? new Date(s.updatedAt).toLocaleString()}
                        >
                          <div className="truncate">{s.title ?? `${s.mode} · ${new Date(s.updatedAt).toLocaleDateString()}`}</div>
                          <div className="text-[9.5px] uppercase tracking-wider opacity-60">{s.mode}</div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          aria-label="Delete session"
                          title="Delete session"
                          className="mr-1 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/15 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scroll region — empty state centers vertically, filled state scrolls */}
        <div ref={scrollerRef} className="flex flex-1 flex-col overflow-y-auto pr-1">
          {isEmpty ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState onPick={(p, m) => { setInput(p); setMode(m); textareaRef.current?.focus(); }} />
            </div>
          ) : (
            <div className="flex w-full flex-col gap-6 py-6">
              {turns.map((t) => t.kind === "user"
                ? <UserBubble key={t.id} text={t.text} />
                : <WisdomBubble key={t.id} turn={t} />
              )}
              {routeError && (
                <div
                  role="alert"
                  data-testid="wisdom-error"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
                >
                  <div className="font-medium">{routeError.title}</div>
                  <div className="text-destructive/85">{routeError.body}</div>
                  {routeError.retryable && (
                    <button
                      type="button"
                      onClick={() => submit()}
                      className="mt-1 text-[11px] underline underline-offset-2"
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Insight strip — keeps the canvas fluid instead of reserving a fixed right rail */}
        <div className="mt-3 grid w-full grid-cols-1 gap-2 lg:grid-cols-3">
          <InsightCard label="Session" head={isEmpty ? "Live" : `${exchangeCount} exchange${exchangeCount === 1 ? "" : "s"}`}>
            <p className="text-[11.5px] text-muted-foreground">
              {isEmpty ? "Waiting for your first message." : `Mode · ${activeModeMeta?.label}`}
            </p>
          </InsightCard>

          {d?.patterns.mostRecent ? (
            <InsightCard label="Emerging pattern" head={d.patterns.mostRecent.title}>
              <p className="text-[11.5px] text-muted-foreground">
                {d.patterns.mostRecent.lifecycle} · updated {new Date(d.patterns.mostRecent.updatedAt).toLocaleDateString()}
              </p>
            </InsightCard>
          ) : (
            <InsightCard label="Emerging pattern" head="Nothing surfaced yet">
              <p className="text-[11.5px] text-muted-foreground">
                Patterns appear after you describe a real situation.
              </p>
            </InsightCard>
          )}

          {d?.latestPrayer ? (
            <InsightCard label="Latest prayer" head={`${d.latestPrayer.movementCount} movements`}>
              <p className="truncate text-[11.5px] text-muted-foreground">{d.latestPrayer.title}</p>
              <Link
                to="/prayers/$prayerId"
                params={{ prayerId: d.latestPrayer.id }}
                className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
              >
                Open prayer →
              </Link>
            </InsightCard>
          ) : (
            <InsightCard label="Prayer" head="Not formed yet">
              <p className="text-[11.5px] text-muted-foreground">
                Appears after Wisdom understands the situation.
              </p>
            </InsightCard>
          )}
        </div>

        {/* Composer */}
        <div className="mt-3 w-full">
          {!composerEnabled && <PrivateBetaBanner access={access} user={user} />}
          <div
            className="relative overflow-hidden rounded-2xl border border-panel-border bg-surface/70 p-3 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] backdrop-blur"
            aria-disabled={!composerEnabled}
          >
            <ShineBorder borderWidth={1.5} duration={3.2} shineColor={["#E8DFC8", "#FFFFFF", "#B8A470"]} />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={2}
              placeholder="Bring a real situation. Wisdom mirrors it through Scripture—never as a verdict."
              className="w-full resize-none bg-transparent px-2 py-1 text-[14px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-panel-border/60 pt-2">
              <div className="flex items-center gap-0.5 rounded-full border border-panel-border bg-background/60 p-0.5">
                {MODES.map((m) => {
                  const active = mode === m.id;
                  const locked = turns.length > 0;
                  const disabled = m.disabled || (locked && !active);
                  return (
                    <button
                      key={m.id}
                      onClick={() => !disabled && setMode(m.id)}
                      disabled={disabled}
                      title={m.disabled ? m.disabledHint : locked ? "Mode locks after the first message. Start a new session to switch." : m.hint}
                      className={[
                        "rounded-full px-2.5 py-1 text-[11px] transition",
                        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                        disabled ? "cursor-not-allowed opacity-40" : "",
                      ].join(" ")}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <span className="hidden text-[10px] uppercase tracking-[0.14em] text-muted-foreground md:inline">
                {turns.length > 0
                  ? `Locked · ${activeModeMeta?.label}`
                  : activeModeMeta?.hint}
              </span>
              <button
                type="button"
                data-testid="wisdom-submit"
                onClick={() => submit()}
                disabled={busy || input.trim().length === 0 || !composerEnabled}
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
  );
}


function applyEvent(
  setTurns: React.Dispatch<React.SetStateAction<Turn[]>>,
  wisdomId: string,
  ev: TurnEvent,
) {
  setTurns((prev) => prev.map((t) => {
    if (t.kind !== "wisdom" || t.id !== wisdomId) return t;
    if (ev.type === "status") return { ...t, phase: "processing" };
    if (ev.type === "result") return { ...t, phase: "done", turnId: ev.turnId, result: ev.result };
    if (ev.type === "error") return { ...t, phase: "error", error: ev.message ?? ev.error };
    if (ev.type === "done") return t.phase === "processing" ? { ...t, phase: "error", error: t.error ?? "no_result" } : t;
    return t;
  }));
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[min(72ch,85%)] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[14px] leading-relaxed text-primary-foreground shadow-sm">
      {text}
    </div>
  );
}

function WisdomBubble({ turn }: { turn: WisdomTurn }) {
  const r = turn.result;
  return (
    <div className="flex max-w-[min(88ch,92%)] gap-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="size-3.5" strokeWidth={1.75} />
      </span>
      <div className="flex-1 space-y-3 text-[14px] leading-relaxed text-foreground/90">
        {turn.phase === "processing" && (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Wisdom is listening…
          </div>
        )}
        {turn.phase === "error" && (() => {
          const raw = turn.error ?? "unknown";
          const retryAfter = raw.startsWith("retry_after:") ? Number(raw.slice(12)) : undefined;
          const code = retryAfter ? "rate_limited" : raw;
          const safe = mapWisdomError(code, { retryAfter });
          return (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
              <div className="font-medium">{safe.title}</div>
              <div className="text-destructive/85">{safe.body}</div>
            </div>
          );
        })()}
        {r && <UnifiedResultView result={r} />}
      </div>
    </div>
  );
}


function EmptyState({ onPick }: { onPick: (prompt: string, mode: Mode) => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary shadow-[0_0_40px_-8px_var(--primary-glow)]">
        <Sparkles className="size-5" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-2xl font-light tracking-tight md:text-3xl">
        What is happening beneath the surface,
        <span className="text-muted-foreground"> that you'd like to see clearly?</span>
      </h1>
      <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
        Bring a real situation. Wisdom listens for the pattern, then mirrors it through
        Scripture—never as a verdict.
      </p>
      <div className="mt-8 grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
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

function InsightCard({
  label,
  head,
  children,
}: {
  label: string;
  head: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-panel-border bg-surface/50 px-4 py-3.5 backdrop-blur">
      <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-[13px] font-medium">{head}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}


function PrivateBetaBanner({
  access,
  user,
}: {
  access: ReturnType<typeof useWisdomAccess>;
  user: ReturnType<typeof useSession>["user"];
}) {
  const signedOut = !user;
  const title = signedOut ? "Sign in to continue" : "Checking access…";
  const body = signedOut
    ? "Sign in to start a Wisdom conversation."
    : "One moment.";
  return (
    <div
      role="status"
      data-testid="wisdom-private-beta"
      className="mb-3 flex items-start gap-3 rounded-2xl border border-panel-border bg-surface/60 px-4 py-3 text-[12px] text-muted-foreground"
    >
      <Lock className="mt-0.5 size-4 text-primary/80" aria-hidden />
      <div className="flex-1">
        <div className="text-[12.5px] font-medium text-foreground">{title}</div>
        <p className="mt-0.5 leading-relaxed">{body}</p>
        {signedOut && (
          <Link to="/auth" className="mt-1 inline-block text-[11px] text-primary underline underline-offset-2">
            Sign in →
          </Link>
        )}
      </div>
    </div>
  );
}
