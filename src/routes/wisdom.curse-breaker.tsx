/**
 * Curse Breaker landing — renders the most recent completed curse_breaker
 * turn from the unified pipeline.
 *
 * - v2 (taxonomy_version = 2): full layered renderer with pastoral actions.
 * - v1 (legacy): honest compatibility renderer, no verdict framing.
 * - Empty: onboarding CTA back to the dashboard.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Card, MovementBadge, DerivationLegend } from "@/components/wisdom/primitives";
import { getLatestCurseBreakerTurn } from "@/lib/wisdom/library.functions";
import { readCurseBreakerResult } from "@/lib/wisdom/curseBreakerSafety";
import { CurseBreakerV2View } from "@/components/wisdom/CurseBreakerV2View";

const cbQuery = queryOptions({
  queryKey: ["library", "curse-breaker-latest"],
  queryFn: () => getLatestCurseBreakerTurn(),
});

export const Route = createFileRoute("/wisdom/curse-breaker")({
  ssr: false,
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
  const parsed: unknown = turn?.resultJson ? JSON.parse(turn.resultJson) : null;
  const reading = parsed ? readCurseBreakerResult(parsed, turn?.taxonomyVersion) : null;

  if (!turn || !reading) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="rounded-2xl border border-panel-border bg-panel/60 px-6 py-10 text-center">
          <p className="text-lg">No stronghold analysis yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Start a Curse Breaker session from the dashboard. Wisdom will listen for evidence,
            weigh contributing influences, and hold interpretations as revisable hypotheses.
          </p>
          <Link to="/dashboard" className="mt-4 inline-block rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground">
            Begin from dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (reading.isLegacy) {
    return <LegacyCurseBreakerView reading={reading} />;
  }

  const r = reading.result;
  return (
    <div className="space-y-6">
      <Header />
      <CurseBreakerV2View result={r} wisdomTurnId={turn.id} />

      {r.prayer_draft && r.prayer_draft.lines.length > 0 && (
        <Card eyebrow="Prayer" title={r.prayer_draft.title || "Draft prayer"}>
          <DerivationLegend />
          <div className="mt-4 space-y-3">
            {r.prayer_draft.lines.map((l, i) => (
              <div
                key={i}
                className="rounded-xl border border-panel-border/60 bg-gradient-to-br from-surface/60 via-surface/30 to-transparent p-4"
              >
                <MovementBadge movement={l.movement} />
                <p className="mt-2 font-serif text-[17px] leading-relaxed">{l.text}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {r.primary_practice && (
        <Card eyebrow="One small faithful practice" title={r.primary_practice.title}>
          <p>{r.primary_practice.rationale}</p>
        </Card>
      )}
    </div>
  );
}

function LegacyCurseBreakerView({
  reading,
}: {
  reading: Extract<ReturnType<typeof readCurseBreakerResult>, { isLegacy: true }>;
}) {
  return (
    <div className="space-y-6">
      <Header />
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px] text-foreground/85">
        This entry was captured under an older Curse Breaker format. It's shown here honestly, without
        being reinterpreted. Start a new Curse Breaker session to use the current layered pipeline.
      </div>

      <Card eyebrow="Interpretation" title={reading.whatWisdomHeard || "What Wisdom heard"}>
        <p>{reading.userFacingResponse}</p>
        {reading.categoryLabel && (
          <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
            Previously stored category · {reading.categoryLabel}
          </p>
        )}
      </Card>

      {reading.competingHypotheses.length > 0 && (
        <Card eyebrow="Discernment" title="Competing hypotheses">
          <ul className="space-y-2">
            {reading.competingHypotheses.map((h, i) => (
              <li key={i} className="rounded-lg border border-panel-border/60 bg-surface/40 px-3 py-2">
                <p className="text-sm font-medium">{h.name}</p>
                {h.description && <p className="mt-1 text-sm text-muted-foreground">{h.description}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {Math.round((h.confidence ?? 0) * 100)}% confidence
                </p>
              </li>
            ))}
          </ul>
          {reading.distinguishingQuestion && (
            <p className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <span className="font-medium">Distinguishing question:</span> {reading.distinguishingQuestion}
            </p>
          )}
        </Card>
      )}

      {reading.renunciations.length > 0 && (
        <Card eyebrow="Previously stored renunciations" title="What was renounced">
          <ul className="space-y-1.5">
            {reading.renunciations.map((line, i) => (
              <li key={i} className="rounded border-l-2 border-destructive/60 bg-destructive/5 px-3 py-1.5 text-sm">
                {line}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reading.prayerDraft && reading.prayerDraft.lines.length > 0 && (
        <Card eyebrow="Prayer" title={reading.prayerDraft.title || "Draft prayer"}>
          <DerivationLegend />
          <div className="mt-4 space-y-3">
            {reading.prayerDraft.lines.map((l, i) => (
              <div key={i} className="rounded-xl border border-panel-border/60 bg-gradient-to-br from-surface/60 via-surface/30 to-transparent p-4">
                <MovementBadge movement={l.movement} />
                <p className="mt-2 font-serif text-[17px] leading-relaxed">{l.text}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {reading.primaryPractice && (
        <Card eyebrow="Practice" title={reading.primaryPractice.title}>
          <p>{reading.primaryPractice.rationale}</p>
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
        Wisdom listens for evidence, names what may be contributing, and holds interpretations as
        revisable hypotheses. Verdicts belong to you and the qualified people alongside you.
      </p>
    </header>
  );
}
