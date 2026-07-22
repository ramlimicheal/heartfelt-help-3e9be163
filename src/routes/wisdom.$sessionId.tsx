/**
 * Canonical Wisdom session viewer.
 *
 * Reads through `loadSessionHistory` (messages + wisdom_turns.result) and
 * renders each turn with the same UnifiedResultView the /wisdom composer
 * uses. This route is presentation-only — no legacy pipeline calls, no
 * bypass of the unified turn contract.
 *
 * To resume a live conversation, we hand the sessionId to /wisdom, which
 * hydrates history through the same server function and continues via
 * streamUnifiedTurn → /api/wisdom/turn.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { loadSessionHistory } from "@/lib/wisdom/session.functions";
import { UnifiedResultView } from "@/components/wisdom/UnifiedResultView";
import { mapWisdomError } from "@/lib/wisdom/errorCopy";

export const Route = createFileRoute("/wisdom/$sessionId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Wisdom — session" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(historyQuery(params.sessionId));
  },
  pendingComponent: () => (
    <div className="space-y-4">
      <div className="h-6 w-1/2 animate-pulse rounded bg-surface/60" />
      <div className="h-24 animate-pulse rounded-xl bg-surface/40" />
      <div className="h-40 animate-pulse rounded-xl bg-surface/40" />
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const safe = mapWisdomError((error as Error)?.message ?? "unknown");
    return (
      <div className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
        <p className="text-sm font-medium text-destructive">{safe.title}</p>
        <p className="text-xs text-muted-foreground break-words">{safe.body}</p>
        <button
          onClick={() => reset()}
          className="rounded-full border border-panel-border bg-surface px-4 py-1.5 text-xs hover:bg-background"
        >
          Try again
        </button>
        <Link to="/wisdom" className="ml-2 text-xs text-muted-foreground hover:text-foreground">
          Back to Wisdom
        </Link>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="rounded-2xl border border-panel-border bg-surface/60 p-6 text-sm text-muted-foreground">
      Session not found. <Link to="/wisdom" className="text-primary underline underline-offset-2">Start a new one</Link>.
    </div>
  ),
  component: SessionView,
});

const historyQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ["wisdom-session-history", sessionId],
    queryFn: () => loadSessionHistory({ data: { sessionId } }),
  });

function SessionView() {
  const { sessionId } = Route.useParams();
  const { data } = useSuspenseQuery(historyQuery(sessionId));

  const userMsgs = new Map(
    data.messages.filter((m) => m.role === "user").map((m) => [m.id, m]),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link to="/wisdom" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to Wisdom
        </Link>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {data.session.mode.replace(/_/g, " ")} · {data.turns.length} turn{data.turns.length === 1 ? "" : "s"}
        </div>
        <h1 className="text-2xl font-light leading-tight md:text-3xl">
          {data.session.title ?? "Untitled session"}
        </h1>
        <Link
          to="/wisdom"
          search={{ sessionId }}
          className="inline-flex items-center gap-1 rounded-full border border-panel-border bg-surface/60 px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Continue this session →
        </Link>
      </header>

      {data.turns.length === 0 && (
        <p className="rounded-2xl border border-panel-border bg-surface/60 p-6 text-sm text-muted-foreground">
          This session has no completed turns yet.
        </p>
      )}

      <div className="space-y-6">
        {data.turns.map((t) => {
          const userMsg = t.triggeringUserMessageId
            ? userMsgs.get(t.triggeringUserMessageId)
            : undefined;
          return (
            <article
              key={t.id}
              className="space-y-3"
              data-testid="wisdom-turn"
              data-turn-mode={t.mode}
              data-turn-status={t.status}
            >
              {userMsg && (
                <div className="ml-auto max-w-[min(72ch,85%)] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[14px] leading-relaxed text-primary-foreground shadow-sm">
                  {userMsg.content}
                </div>
              )}
              <div className="flex max-w-[min(88ch,92%)] gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Sparkles className="size-3.5" strokeWidth={1.75} />
                </span>
                <div className="flex-1 space-y-3 text-[14px] leading-relaxed text-foreground/90">
                  {t.status === "completed" && t.result ? (
                    <UnifiedResultView result={t.result} />
                  ) : t.status === "failed" ? (
                    <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                      This turn did not complete. You can start a new one from the composer.
                    </p>
                  ) : (
                    <p className="text-[12px] text-muted-foreground">This turn is still processing.</p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
