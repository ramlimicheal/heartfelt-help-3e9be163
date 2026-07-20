import { createFileRoute, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowUp,
  BookOpen,
  Compass,
  Hand,
  HandHelping,
  Loader2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getDashboardSlice } from "@/lib/wisdom/dashboard.functions";
import { useSession } from "@/hooks/useSession";

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
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ mode: modeRef.current }),
      }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    onError: (e) => console.error("chat error", e),
  });

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


  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4 md:gap-6">
      {/* Conversation column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={scrollerRef} className="flex-1 overflow-y-auto pr-2">
          {isEmpty ? (
            <EmptyState onPick={(p, m) => { setInput(p); setMode(m); textareaRef.current?.focus(); }} />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
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

        {/* Sticky composer */}
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-2xl border border-panel-border bg-surface/70 p-3 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] backdrop-blur">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
              rows={2}
              placeholder="Bring a real situation. Wisdom will mirror it through scripture, not advice."
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
              <span className="hidden text-[10px] uppercase tracking-[0.14em] text-muted-foreground md:inline">
                {MODES.find((m) => m.id === mode)?.hint}
              </span>
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

      {/* Live surfacing rail */}
      <aside className="hidden w-[300px] shrink-0 flex-col gap-3 overflow-y-auto lg:flex">
        <RailCard label="Session" head="Live">
          <div className="text-[12px] text-muted-foreground">
            {isEmpty ? "Waiting for your first message." : `${messages.length} exchange${messages.length === 1 ? "" : "s"} · mode ${mode}`}
          </div>
        </RailCard>

        {d?.patterns.mostRecent ? (
          <RailCard label="Emerging pattern" head={d.patterns.mostRecent.title}>
            <p className="text-[11.5px] text-muted-foreground">
              {d.patterns.mostRecent.lifecycle} · updated {new Date(d.patterns.mostRecent.updatedAt).toLocaleDateString()}
            </p>
            <p className="mt-2 line-clamp-3 text-[11.5px] italic text-muted-foreground">
              This remains a candidate until you confirm or refine it.
            </p>
          </RailCard>
        ) : (
          <RailCard label="Emerging pattern" head="Nothing surfaced yet">
            <p className="text-[11.5px] text-muted-foreground">
              Patterns appear only after you describe a real situation.
            </p>
          </RailCard>
        )}

        {d?.latestPrayer ? (
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
        scripture — never as advice.
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
  return (
    <div className="flex max-w-[92%] gap-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="size-3.5" strokeWidth={1.75} />
      </span>
      <div className="prose prose-sm prose-invert max-w-none flex-1 text-[14px] leading-relaxed text-foreground/90 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/60 [&_blockquote]:pl-3 [&_blockquote]:text-foreground/85 [&_blockquote]:italic">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </div>
  );
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
