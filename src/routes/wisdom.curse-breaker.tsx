/**
 * Curse Breaker — shows the most recent completed curse_breaker turn from
 * the unified pipeline. If none exists, guides the user to start one.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Card, MovementBadge, DerivationLegend } from "@/components/wisdom/primitives";
import { getLatestCurseBreakerTurn } from "@/lib/wisdom/library.functions";
import type { CurseBreakerResult } from "@/lib/wisdom/unified.schemas";

const cbQuery = queryOptions({
  queryKey: ["library", "curse-breaker-latest"],
  queryFn: () => getLatestCurseBreakerTurn(),
});

export const Route = createFileRoute("/wisdom/curse-breaker")({
  head: () => ({
    meta: [
      { title: "Curse Breaker — Wisdom" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(cbQuery);
  },
  errorComponent: () => (
    <p className="text-sm text-destructive">Curse Breaker couldn't load.</p>
  ),
  component: CurseBreakerPage,
});

function CurseBreakerPage() {
  const { data: turn } = useSuspenseQuery(cbQuery);

  if (!turn || !turn.result) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="rounded-2xl border border-panel-border bg-panel/60 px-6 py-10 text-center">
          <p className="text-lg">No stronghold analysis yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Start a Curse Breaker session from the dashboard. Wisdom will trace the tension, weigh competing explanations, and compose a lineage prayer.
          </p>
          <Link to="/dashboard" className="mt-4 inline-block rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground">
            Begin from dashboard
          </Link>
        </div>
      </div>
    );
  }

  const r = turn.result as CurseBreakerResult;

  return (
    <div className="space-y-6">
      <Header />

      <Card eyebrow="Interpretation" title={r.what_wisdom_heard || "What Wisdom heard"}>
        <p>{r.user_facing_response}</p>
        {r.stronghold_category && (
          <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
            Stronghold category · {r.stronghold_category}
          </p>
        )}
      </Card>

      {r.competing_hypotheses.length > 0 && (
        <Card eyebrow="Discernment" title="Competing hypotheses">
          <ul className="space-y-2">
            {r.competing_hypotheses.map((h, i) => (
              <li key={i} className="rounded-lg border border-panel-border/60 bg-surface/40 px-3 py-2">
                <p className="text-sm font-medium">{h.name}</p>
                {h.description && <p className="mt-1 text-sm text-muted-foreground">{h.description}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {Math.round(h.confidence * 100)}% confidence
                </p>
              </li>
            ))}
          </ul>
          {r.distinguishing_question && (
            <p className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <span className="font-medium">Distinguishing question:</span> {r.distinguishing_question}
            </p>
          )}
        </Card>
      )}

      {r.renunciations.length > 0 && (
        <Card eyebrow="Renunciation" title="What to renounce">
          <ul className="space-y-1.5">
            {r.renunciations.map((line, i) => (
              <li key={i} className="rounded border-l-2 border-destructive/60 bg-destructive/5 px-3 py-1.5 text-sm">
                {line}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {r.prayer_draft && r.prayer_draft.lines.length > 0 && (
        <Card eyebrow="Prayer" title={r.prayer_draft.title || "Draft prayer"}>
          <DerivationLegend />
          <div className="mt-4 space-y-3">
            {r.prayer_draft.lines.map((l, i) => (
              <div key={i} className="rounded-xl border border-panel-border/60 bg-gradient-to-br from-surface/60 via-surface/30 to-transparent p-4">
                <MovementBadge movement={l.movement} />
                <p className="mt-2 font-serif text-[17px] leading-relaxed">{l.text}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {r.primary_practice && (
        <Card eyebrow="Practice" title={r.primary_practice.title}>
          <p>{r.primary_practice.rationale}</p>
        </Card>
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
        Curse Breaker
      </p>
      <h1 className="text-3xl leading-tight">Stronghold discernment.</h1>
      <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
        Wisdom weighs competing explanations, holds the tension, and — only when the ground is real — composes a renunciation and a lineage prayer.
      </p>
    </header>
  );
}
