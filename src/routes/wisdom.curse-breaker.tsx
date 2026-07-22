/**
 * Curse Breaker landing — renders the most recent completed curse_breaker
 * turn from the unified pipeline through the canonical response renderer.
 *
 * - v2 (taxonomy_version = 2): UnifiedResultView → WisdomResponse, which
 *   embeds CurseBreakerV2View in place with its layered contract and
 *   pastoral actions preserved.
 * - v1 (legacy): honest compatibility renderer, no verdict framing.
 * - Empty: onboarding CTA back to the dashboard.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, MovementBadge, DerivationLegend } from "@/components/wisdom/primitives";
import { getLatestCurseBreakerTurn, finalizePrayer } from "@/lib/wisdom/library.functions";
import { readCurseBreakerResult } from "@/lib/wisdom/curseBreakerSafety";
import { UnifiedResultView } from "@/components/wisdom/UnifiedResultView";
import { writePendingInput } from "@/lib/wisdom/handoff";
import { mapWisdomError } from "@/lib/wisdom/errorCopy";

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

type FinalizeState = { status: "idle" | "pending" | "done" | "error"; message?: string };

function CurseBreakerPage() {
  const { data: turn } = useSuspenseQuery(cbQuery);
  const parsed: unknown = turn?.resultJson ? JSON.parse(turn.resultJson) : null;
  const reading = parsed ? readCurseBreakerResult(parsed, turn?.taxonomyVersion) : null;
  const navigate = useNavigate();

  const [finalizeStates, setFinalizeStates] = useState<Record<string, FinalizeState>>({});
  const finalize = useServerFn(finalizePrayer);
  const handleFinalizePrayer = async (prayerId: string) => {
    const current = finalizeStates[prayerId];
    if (current?.status === "pending" || current?.status === "done") return;
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
      const safe = mapWisdomError((err as Error)?.message ?? "unknown");
      setFinalizeStates((m) => ({
        ...m,
        [prayerId]: { status: "error", message: safe.body ?? safe.title },
      }));
    }
  };

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
  const durableMemory = turn.memoryDirective !== "do_not_remember";
  const prayerId = durableMemory && turn.memoryDirective === "normal" ? (turn.prayerId ?? undefined) : undefined;

  const handleContinue = (prompt: string) => {
    // Non-autosubmit continuation into /wisdom, preserving this session.
    writePendingInput({ sessionId: turn.sessionId, prompt });
    void navigate({ to: "/wisdom", search: { sessionId: turn.sessionId } });
  };

  return (
    <div className="space-y-6">
      <Header />
      <UnifiedResultView
        result={r}
        wisdomTurnId={turn.id}
        prayerId={prayerId}
        orientation={{
          createdAt: turn.createdAt,
          sessionTitle: null,
          memoryDirective: turn.memoryDirective as "normal" | "session_only" | "do_not_remember",
          streaming: false,
        }}
        onContinue={handleContinue}
        onFinalizePrayer={handleFinalizePrayer}
        finalizeState={prayerId ? finalizeStates[prayerId] : undefined}
      />
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
                <p className="mt-2 text-[17px] leading-relaxed">{l.text}</p>
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
