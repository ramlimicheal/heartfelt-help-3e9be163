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
  Map as MapIcon,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { WisdomMap, type WisdomMapMode } from "@/components/wisdom/WisdomMap";
import { useQuery } from "@tanstack/react-query";
import { getDashboardSlice } from "@/lib/wisdom/dashboard.functions";
import { listRecentSessions, loadSessionHistory, deleteSession } from "@/lib/wisdom/session.functions";
import { finalizePrayer } from "@/lib/wisdom/library.functions";
import { useSession } from "@/hooks/useSession";
import { useWisdomAccess } from "@/hooks/useWisdomAccess";


import { streamUnifiedTurn, type TurnEvent } from "@/lib/wisdom/unified.stream";
import { mapWisdomError, type UserSafeError } from "@/lib/wisdom/errorCopy";
import type { UnifiedResult } from "@/lib/wisdom/unified.schemas";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedResultView } from "@/components/wisdom/UnifiedResultView";
import { consumeHandoff, consumePendingInput } from "@/lib/wisdom/handoff";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type WisdomSearch = {
  // Opaque nonce that references a sessionStorage payload. Never contains user text.
  handoff?: string;
  // Non-sensitive mode identifier. Only honored for NEW sessions; existing
  // sessions ignore this in favor of the DB-locked mode.
  mode?: "companion" | "pattern" | "deep_wisdom" | "curse_breaker";
  // Existing session to hydrate. Ownership is verified server-side by
  // `loadSessionHistory` (RLS + explicit user_id check); the route param
  // alone is never treated as evidence of ownership.
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
    return {
      handoff: typeof raw.handoff === "string" && raw.handoff.length > 0 ? raw.handoff : undefined,
      mode,
      sessionId: typeof raw.sessionId === "string" ? raw.sessionId : undefined,
    };
  },
});

type Mode = "companion" | "pattern" | "deep_wisdom" | "curse_breaker";

type TagKind = "affirm" | "attend" | "alert" | "insight" | "prayer";

const MODES: { id: Mode; label: string; hint: string; tag: TagKind; disabled?: boolean; disabledHint?: string }[] = [
  { id: "companion",     label: "Companion",     hint: "Presence first, discernment second.", tag: "prayer" },
  { id: "pattern",       label: "Pattern",       hint: "Name what keeps repeating.",           tag: "insight" },
  { id: "deep_wisdom",   label: "Deep Wisdom",   hint: "Test a spiritual interpretation.",     tag: "attend" },
  { id: "curse_breaker", label: "Curse Breaker", hint: "Discern a possible stronghold.",       tag: "alert" },
];


const SUGGESTIONS = [
  { Icon: Compass, label: "Name a pattern I keep returning to", prompt: "Something keeps happening that I don't fully understand — ", mode: "pattern" as Mode },
  { Icon: HandHelping, label: "Help me pray about something honestly", prompt: "I want to pray about this, but I'm not sure what I'm really asking for — ", mode: "companion" as Mode },
  { Icon: BookOpen, label: "Test a spiritual interpretation", prompt: "I've been wondering whether this is spiritual or just — ", mode: "deep_wisdom" as Mode },
  { Icon: Hand, label: "Reflect on a repeated setback", prompt: "I said I wouldn't again, and I did. Here's what happened — ", mode: "pattern" as Mode },
];

type UserTurn = { kind: "user"; id: string; text: string; createdAt: string; memoryDirective: MemoryDirective };
type WisdomTurn = {
  kind: "wisdom";
  id: string;
  turnId?: string;
  result?: UnifiedResult;
  error?: string;
  phase: "processing" | "done" | "error";
  createdAt: string;
  memoryDirective: MemoryDirective;
  prayerId?: string;
  mode: Mode;
};
type Turn = UserTurn | WisdomTurn;

function newId() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

type MemoryDirective = "normal" | "session_only" | "do_not_remember";

const MEMORY_CHOICES: {
  id: MemoryDirective;
  label: string;
  short: string;
  helper: string;
}[] = [
  {
    id: "normal",
    label: "Remember normally",
    short: "Remembered",
    helper:
      "This message may contribute to durable Wisdom artifacts — patterns, prayers, practices, and persona memory (subject to your consent on the You page).",
  },
  {
    id: "session_only",
    label: "Session only",
    short: "Session only",
    helper:
      "May be used within this session, but will not become cross-session persona memory or accepted long-term context.",
  },
  {
    id: "do_not_remember",
    label: "Do not remember",
    short: "Not remembered",
    helper:
      "Used only to answer this turn. No durable signals, patterns, prayers, practices, persona facts, or formation events are created.",
  },
];

function WisdomChat() {
  const [mode, setMode] = useState<Mode>("pattern");
  const [input, setInput] = useState("");
  // Per-message memory directive. Default is explicit: "normal".
  const [memoryDirective, setMemoryDirective] = useState<MemoryDirective>("normal");
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
        if (um) rebuilt.push({
          kind: "user",
          id: um.id,
          text: um.content,
          createdAt: um.createdAt,
          memoryDirective: (um.memoryDirective as MemoryDirective) ?? "normal",
        });
        rebuilt.push({
          kind: "wisdom",
          id: t.id,
          turnId: t.id,
          result: t.result ?? undefined,
          phase: t.status === "completed" ? "done" : t.status === "failed" ? "error" : "processing",
          createdAt: t.createdAt,
          memoryDirective: (t.memoryDirective as MemoryDirective) ?? "normal",
          prayerId: (t.artifactIds?.prayer_id as string | undefined) ?? undefined,
          mode: (t.mode as Mode),
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const requestDeleteSession = (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    setPendingDeleteId(sid);
  };
  const confirmDeleteSession = async () => {
    const sid = pendingDeleteId;
    if (!sid) return;
    setDeleting(true);
    try {
      await removeSession({ data: { sessionId: sid } });
      if (sessionId === sid) newSession();
      void sessionsQ.refetch();
      setPendingDeleteId(null);
    } catch {
      setRouteError(mapWisdomError("Could not delete session"));
    } finally {
      setDeleting(false);
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
    // Session-mode authority:
    //   - New session (no sessionId yet) → honor the caller's mode override.
    //   - Existing session → the DB-locked mode wins. `mode` is hydrated from
    //     the DB by openSession, and mode_locked_at is enforced server-side.
    //     A `modeOverride` (e.g. from a handoff or a stale tab click) is
    //     ignored for existing sessions to avoid silently steering a locked
    //     conversation into a different mode.
    const effectiveMode: Mode = sessionId ? mode : (modeOverride ?? mode);
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
    const nowIso = new Date().toISOString();
    const userTurn: UserTurn = { kind: "user", id: messageId, text, createdAt: nowIso, memoryDirective };
    const wisdomId = newId();
    const wisdomTurn: WisdomTurn = {
      kind: "wisdom",
      id: wisdomId,
      phase: "processing",
      createdAt: nowIso,
      memoryDirective,
      mode: effectiveMode,
    };
    setTurns((t) => [...t, userTurn, wisdomTurn]);
    if (!retryOf) setInput("");
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // The composer sends the user-selected memory directive on every turn.
      // The backend enforces DNR at the RPC layer (persist_unified_turn) and
      // the DB layer (signals/persona_facts triggers). session_only is
      // preserved through the RPC and blocked from cross-session acceptance
      // by the persona server functions and updatePersonaFactStatus guard.
      // We never silently upgrade session_only or do_not_remember to normal.
      for await (const ev of streamUnifiedTurn({
        sessionId: sid,
        triggeringUserMessageId: messageId,
        userText: text,
        memoryDirective,
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
  //
  // Sensitive user text is NOT read from the URL. The dashboard writes a
  // one-time payload to sessionStorage keyed by an opaque nonce, and only
  // the nonce (+ non-sensitive mode) travels in `search`. `consumeHandoff`
  // both returns and destroys the payload atomically, and records the
  // nonce in a consumed set — so remount, Strict Mode double-invocation,
  // refresh, and back/forward navigation cannot fire a second submit.
  //
  // Session-mode authority:
  //   - New session → use the mode carried by the handoff.
  //   - Existing sessionId → DB mode wins (loaded by openSession); any
  //     mode query param is ignored. mode_locked_at is enforced server-side.
  const search = Route.useSearch();
  const navigate = useNavigate();
  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    if (!ready) return;

    // Existing session takes priority; ownership is verified server-side.
    if (search.sessionId) {
      bootRef.current = true;
      void openSession(search.sessionId);
      // Non-autosubmit continuation: if the session viewer pushed a
      // suggested prompt into sessionStorage, drop it into the composer
      // and focus — never auto-submit.
      const pending = consumePendingInput();
      if (pending && pending.sessionId === search.sessionId) {
        setInput(pending.prompt);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
      // Strip the query param so back/forward doesn't retrigger.
      void navigate({ to: "/wisdom", search: {}, replace: true });
      return;
    }

    // Handoff-driven autostart (dashboard → wisdom).
    if (search.handoff) {
      // Consume atomically; any second effect run finds nothing.
      const payload = consumeHandoff(search.handoff);
      // Always strip the nonce from the URL so it can't be shared/replayed.
      void navigate({ to: "/wisdom", search: {}, replace: true });
      if (!payload) return;
      if (!user || access.status !== "allowed") return;

      bootRef.current = true;
      // Handoff always begins a fresh session so its mode cannot silently
      // override a previously locked session's mode.
      setTurns([]);
      setSessionId(null);
      setInput("");
      const m: Mode = payload.mode;
      setMode(m);
      void submit(payload.prompt, m);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, access.status, search.handoff, search.sessionId]);


  const fetchSlice = useServerFn(getDashboardSlice);
  const slice = useQuery({
    queryKey: ["dashboard-slice", user?.id ?? "anon"],
    queryFn: () => fetchSlice(),
    enabled: ready && !!user,
    staleTime: 30_000,
  });
  const d = slice.data;

  const [historyOpen, setHistoryOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
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

  // Latest Wisdom turn drives the map (and only completed ones expose sections).
  const latestWisdom = [...turns].reverse().find((t) => t.kind === "wisdom") as WisdomTurn | undefined;
  const mapMode: WisdomMapMode = !latestWisdom
    ? "empty"
    : latestWisdom.phase === "processing"
      ? "streaming"
      : latestWisdom.result
        ? "ready"
        : "empty";

  // Rail entry for current session (for orientation session title).
  const sessionTitleFromRail = sessionId
    ? (sessionsQ.data?.find((s) => s.id === sessionId)?.title ?? null)
    : null;

  const handleContinue = (prompt: string) => {
    setInput(prompt);
    // Focus without submitting.
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // Explicit prayer finalization state, keyed by prayerId so multiple
  // drafts in one session stay independent.
  const [finalizeStates, setFinalizeStates] = useState<Record<string, FinalizeState>>({});
  const finalize = useServerFn(finalizePrayer);
  const handleFinalizePrayer = async (prayerId: string) => {
    if (!prayerId) return;
    const current = finalizeStates[prayerId];
    if (current?.status === "pending" || current?.status === "done") return; // duplicate-submit guard
    setFinalizeStates((m) => ({ ...m, [prayerId]: { status: "pending" } }));
    try {
      const res = await finalize({ data: { prayerId } });
      setFinalizeStates((m) => ({
        ...m,
        [prayerId]: {
          status: "done",
          message: res.alreadyFinalized ? "Already in your prayer library." : "Added to your prayer library.",
        },
      }));
    } catch (err) {
      const raw = (err as Error)?.message ?? "unknown";
      const safe = mapWisdomError(raw);
      setFinalizeStates((m) => ({
        ...m,
        [prayerId]: { status: "error", message: safe.body ?? safe.title },
      }));
    }
  };


  // Right-rail derivations from the latest wisdom result
  const latestResult = latestWisdom?.result as (UnifiedResult & {
    proposed_pattern?: { title?: string; description?: string } | null;
    pattern?: { title?: string; description?: string } | null;
    prayer?: { title?: string; body?: string; text?: string } | null;
  }) | undefined;
  const emergingPattern = latestResult?.proposed_pattern?.title
    ?? latestResult?.pattern?.title
    ?? d?.patterns.mostRecent?.title
    ?? null;
  const emergingPatternDesc = latestResult?.proposed_pattern?.description
    ?? latestResult?.pattern?.description
    ?? (d?.patterns.mostRecent
      ? `${d.patterns.mostRecent.lifecycle} · updated ${new Date(d.patterns.mostRecent.updatedAt).toLocaleDateString()}`
      : null);
  const latestPrayerText = latestResult?.prayer?.body
    ?? latestResult?.prayer?.text
    ?? null;
  const latestPrayerTitle = latestResult?.prayer?.title
    ?? d?.latestPrayer?.title
    ?? null;
  const latestPrayerMeta = !latestPrayerText && d?.latestPrayer
    ? `${d.latestPrayer.movementCount} movement${d.latestPrayer.movementCount === 1 ? "" : "s"}`
    : null;
  const latestPrayerLinkId = !latestPrayerText ? d?.latestPrayer?.id ?? null : null;


  return (
    <div className="relative flex h-[calc(100dvh-7rem)] w-full gap-4">
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
            {!isEmpty && (
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                aria-label="Open Wisdom Map"
                className="inline-flex items-center gap-1.5 rounded-full border border-tag-insight/40 bg-tag-insight/10 px-3 py-1 text-[11px] text-tag-insight transition hover:bg-tag-insight/15"
              >
                <MapIcon className="size-3" strokeWidth={1.75} />
                Map
              </button>
            )}
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
                          onClick={(e) => requestDeleteSession(s.id, e)}
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
            <div className="flex flex-1 items-start justify-start">
              <EmptyState onPick={(p, m) => { setInput(p); setMode(m); textareaRef.current?.focus(); }} />
            </div>
          ) : (
            <div className="flex w-full flex-col gap-6 py-6">
              {turns.map((t) => t.kind === "user"
                ? <UserBubble key={t.id} text={t.text} />
                : <WisdomBubble
                    key={t.id}
                    turn={t}
                    sessionTitle={sessionTitleFromRail}
                    onContinue={handleContinue}
                    onFinalizePrayer={handleFinalizePrayer}
                    finalizeState={t.prayerId ? finalizeStates[t.prayerId] : undefined}
                  />
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

        {/* Split-focus separator: anchors the composer as a distinct bottom bar. */}
        <div className="my-3 h-px w-full bg-gradient-to-r from-transparent via-panel-border to-transparent" />

        {/* Composer — minimal, no border animation */}
        <div className="w-full shrink-0 space-y-2">
          {!composerEnabled && <PrivateBetaBanner access={access} user={user} />}

          <div
            className="relative overflow-hidden rounded-2xl border border-panel-border/70 bg-surface/40 transition focus-within:border-panel-border focus-within:bg-surface/60"
            aria-disabled={!composerEnabled}
          >
            {/* Top row: mode chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto px-3 pt-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {MODES.map((m) => {
                const active = mode === m.id;
                const locked = turns.length > 0;
                const disabled = m.disabled || (locked && !active);
                const tagColor = `var(--color-tag-${m.tag})`;
                return (
                  <button
                    key={m.id}
                    onClick={() => !disabled && setMode(m.id)}
                    disabled={disabled}
                    title={m.disabled ? m.disabledHint : locked ? "Mode locks after the first message. Start a new session to switch." : m.hint}
                    className={[
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition",
                      active
                        ? "bg-background/70 text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                      disabled ? "cursor-not-allowed opacity-40" : "",
                    ].join(" ")}
                    style={active ? { color: tagColor } : undefined}
                  >
                    <span
                      className="inline-block size-1.5 rounded-full"
                      style={{ background: tagColor }}
                      aria-hidden
                    />
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Text area */}
            <div className="px-3 py-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                rows={1}
                placeholder="Bring a real situation. Wisdom mirrors it through Scripture—never as a verdict."
                className="max-h-32 min-h-[24px] w-full resize-none bg-transparent py-1 text-[15px] leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>

            {/* Bottom row: memory + submit */}
            <div className="flex items-center justify-between gap-2 border-t border-panel-border/40 px-2 py-1.5">
              <MemoryDirectiveControl
                value={memoryDirective}
                onChange={setMemoryDirective}
                disabled={!composerEnabled || busy}
              />
              <button
                type="button"
                data-testid="wisdom-submit"
                onClick={() => submit()}
                disabled={busy || input.trim().length === 0 || !composerEnabled}
                aria-label={busy ? "Composing" : "Send"}
                className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUp className="size-3.5" strokeWidth={2} />}
              </button>
            </div>
          </div>

          <p className="px-1 text-center text-[10px] leading-tight text-muted-foreground/70">
            Scripture citations are checked against curated passages · nothing is remembered without your permission.
          </p>
        </div>
      </div>

      {/* Right rail — persistent on xl+, quiet summary of the live turn */}
      <aside className="hidden w-[300px] shrink-0 flex-col gap-3 overflow-y-auto pr-1 xl:flex">
        {/* Session */}
        <div className="rounded-2xl border border-panel-border/70 bg-surface/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Session</span>
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ background: `var(--color-tag-${activeModeMeta?.tag ?? "insight"})` }}
              aria-hidden
            />
          </div>
          <div className="mt-1.5 truncate text-[13px] text-foreground">
            {sessionTitleFromRail ?? (sessionId ? activeModeMeta?.label : "New session")}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {activeModeMeta?.label} · {exchangeCount} exchange{exchangeCount === 1 ? "" : "s"}
          </div>
        </div>

        {/* Live */}
        <div className="rounded-2xl border border-panel-border/70 bg-surface/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Live</span>
            {mapMode === "streaming" ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-tag-attend">
                <span className="inline-block size-1.5 rounded-full bg-tag-attend" />
                Listening
              </span>
            ) : mapMode === "ready" ? (
              <span className="text-[10px] text-tag-affirm">Ready</span>
            ) : (
              <span className="text-[10px] text-muted-foreground">Idle</span>
            )}
          </div>
          <div className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/85">
            {mapMode === "streaming"
              ? "Wisdom is listening…"
              : mapMode === "ready"
                ? "Response is anchored. Tap Map for the full three-layer view."
                : "Waiting for your first message."}
          </div>
        </div>

        {/* Emerging pattern */}
        <div className="rounded-2xl border border-panel-border/70 bg-surface/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Emerging pattern</span>
            <span className="inline-block size-1.5 rounded-full bg-tag-insight" aria-hidden />
          </div>
          {emergingPattern ? (
            <>
              <div className="mt-1.5 text-[13px] font-medium text-foreground">{emergingPattern}</div>
              {emergingPatternDesc && (
                <div className="mt-0.5 line-clamp-3 text-[11.5px] leading-snug text-muted-foreground">
                  {emergingPatternDesc}
                </div>
              )}
            </>
          ) : (
            <div className="mt-1.5 text-[12px] text-muted-foreground/80">
              Patterns surface after a few exchanges.
            </div>
          )}
        </div>

        {/* Latest prayer */}
        <div className="rounded-2xl border border-panel-border/70 bg-surface/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Latest prayer</span>
            <span className="inline-block size-1.5 rounded-full bg-tag-prayer" aria-hidden />
          </div>
          {latestPrayerText ? (
            <>
              {latestPrayerTitle && (
                <div className="mt-1.5 text-[13px] font-medium text-foreground">{latestPrayerTitle}</div>
              )}
              <div className="mt-1 line-clamp-4 text-[12px] italic leading-snug text-foreground/80">
                “{latestPrayerText}”
              </div>
            </>
          ) : latestPrayerTitle && latestPrayerLinkId ? (
            <>
              <div className="mt-1.5 text-[13px] font-medium text-foreground">{latestPrayerTitle}</div>
              {latestPrayerMeta && (
                <div className="mt-0.5 text-[11px] text-muted-foreground">{latestPrayerMeta}</div>
              )}
              <Link
                to="/prayers/$prayerId"
                params={{ prayerId: latestPrayerLinkId }}
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
              >
                Open prayer →
              </Link>
            </>
          ) : (
            <div className="mt-1.5 text-[12px] text-muted-foreground/80">
              A prayer will form alongside the response.
            </div>
          )}

        </div>
      </aside>


      {/* Wisdom Map — slide-in drawer from the right (all viewports) */}
      {mapOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Wisdom Map">
          <button
            type="button"
            aria-label="Close Wisdom Map"
            onClick={() => setMapOpen(false)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-fade-in"
          />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-panel-border bg-panel/95 p-4 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-slide-in-right">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <MapIcon className="size-3.5 text-tag-insight" strokeWidth={1.75} />
                Wisdom Map
              </span>
              <button
                type="button"
                onClick={() => setMapOpen(false)}
                aria-label="Close"
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground"
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <WisdomMap
                result={latestWisdom?.result}
                mode={mapMode}
                responseRoot={scrollerRef.current}
                onClose={() => setMapOpen(false)}
                streamingStage={mapMode === "streaming" ? "Wisdom is listening" : undefined}
                compact
              />
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(o) => { if (!o && !deleting) setPendingDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the session and all of its messages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); void confirmDeleteSession(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    if (ev.type === "result") {
      const aids = (ev.artifactIds ?? null) as { prayer_id?: string } | null;
      return { ...t, phase: "done", turnId: ev.turnId, result: ev.result, prayerId: aids?.prayer_id };
    }
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

type FinalizeState = { status: "idle" | "pending" | "done" | "error"; message?: string };

function WisdomBubble({
  turn,
  sessionTitle,
  onContinue,
  onFinalizePrayer,
  finalizeState,
}: {
  turn: WisdomTurn;
  sessionTitle?: string | null;
  onContinue: (prompt: string) => void;
  onFinalizePrayer: (prayerId: string) => void;
  finalizeState?: FinalizeState;
}) {
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
        {r && (
          <UnifiedResultView
            result={r}
            wisdomTurnId={turn.turnId}
            prayerId={turn.memoryDirective === "normal" ? turn.prayerId : undefined}
            orientation={{
              createdAt: turn.createdAt,
              sessionTitle,
              memoryDirective: turn.memoryDirective,
              streaming: turn.phase === "processing",
            }}
            onContinue={onContinue}
            onFinalizePrayer={onFinalizePrayer}
            finalizeState={finalizeState}
          />
        )}
      </div>
    </div>
  );
}


function EmptyState({ onPick }: { onPick: (prompt: string, mode: Mode) => void }) {
  return (
    <div className="flex w-full flex-col items-start pt-10 text-left sm:pt-14 md:pt-20">
      <span className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary shadow-[0_0_40px_-8px_var(--primary-glow)]">
        <Sparkles className="size-4" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 max-w-2xl text-2xl font-light tracking-tight md:text-4xl">
        What is happening beneath the surface,
        <span className="text-muted-foreground"> that you'd like to see clearly?</span>
      </h1>
      <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
        Bring a real situation. Wisdom listens for the pattern, then mirrors it through
        Scripture—never as a verdict.
      </p>
      <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
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

function MemoryDirectiveControl({
  value,
  onChange,
  disabled,
}: {
  value: MemoryDirective;
  onChange: (v: MemoryDirective) => void;
  disabled?: boolean;
}) {
  return (
    <div
      data-testid="memory-directive-control"
      className="flex items-center gap-1.5"
    >
      <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        Memory
      </span>
      <div
        role="radiogroup"
        aria-label="Memory directive for this message"
        className="flex items-center gap-0.5 rounded-full border border-panel-border/60 bg-background/50 p-0.5"
      >
        {MEMORY_CHOICES.map((c) => {
          const isActive = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={c.label}
              data-testid={`memory-directive-${c.id}`}
              data-active={isActive ? "true" : "false"}
              onClick={() => onChange(c.id)}
              disabled={disabled}
              title={c.helper}
              className={[
                "rounded-full px-2 py-0.5 text-[10px] transition",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
                disabled ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

