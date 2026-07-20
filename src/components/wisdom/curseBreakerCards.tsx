/**
 * Curse Breaker card components — mock rendering only.
 * All copy comes from COPY (v1 deck) or the typed CurseBreakerResponse.
 * No LLM calls, no side effects.
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, ShieldAlert } from "lucide-react";
import { Card, ConfidenceBar, TierChip } from "@/components/wisdom/primitives";
import { COPY } from "@/lib/wisdom/copy/v1";
import type {
  CBDignityFrame,
  CBFormationCheckIn,
  CBGenerationalTimelinePoint,
  CBInterpretation,
  CBPatternBreakingAct,
  CBPrayerLineage,
  CBTension,
  InterpretationCategory,
} from "@/lib/wisdom/curseBreaker";
import type { SourcePassage } from "@/lib/wisdom/schemas";

/* 1 · Generational timeline */
export function GenerationalTimelineCard({ points }: { points: CBGenerationalTimelinePoint[] }) {
  return (
    <Card
      eyebrow={COPY.curseBreaker.cardEyebrows.generationalTimeline}
      title={COPY.curseBreaker.cardTitles.generationalTimeline}
    >
      <ol className="space-y-2">
        {points.map((p) => (
          <li
            key={p.id}
            className="flex items-start gap-3 rounded-lg border border-surface-border bg-surface/40 px-3 py-2"
          >
            <span className="mt-0.5 w-32 shrink-0 text-[11px] font-medium uppercase tracking-wide text-primary">
              {p.generation}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground/90">{p.event}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {p.fromUser ? "you said" : "inferred"}
                {p.approxYear ? ` · ${p.approxYear}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* 2 · Fourteen categories grid */
export function FourteenCategoriesCard({ interpretations }: { interpretations: CBInterpretation[] }) {
  const supported = interpretations.filter((i) => i.deepAnalyzed);
  const collapsed = interpretations.filter((i) => !i.deepAnalyzed);

  return (
    <Card
      eyebrow={COPY.curseBreaker.cardEyebrows.fourteenCategories}
      title={COPY.curseBreaker.cardTitles.fourteenCategories}
    >
      <p className="mb-4 text-xs text-muted-foreground">
        Every session in Curse Breaker mode enumerates all 14 categories. Categories with signal are
        analyzed in depth; the rest remain visible with a score.
      </p>
      <div className="space-y-3">
        {supported.map((i) => (
          <CategoryRow key={i.id} i={i} />
        ))}
      </div>

      <details className="mt-4 rounded-lg border border-surface-border bg-surface/40 open:pb-3">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
          Low-signal categories ({collapsed.length})
        </summary>
        <ul className="mt-1 space-y-1 px-3">
          {collapsed.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between rounded border border-surface-border bg-background px-2.5 py-1.5 text-xs"
            >
              <span className="text-foreground/85">
                {COPY.curseBreaker.categoryLabels[i.category as InterpretationCategory]}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {Math.round(i.cheapScore * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function CategoryRow({ i }: { i: CBInterpretation }) {
  const [open, setOpen] = useState(false);
  const label = COPY.curseBreaker.categoryLabels[i.category as InterpretationCategory];
  const oneLiner = COPY.curseBreaker.categoryOneLiners[i.category as InterpretationCategory];
  return (
    <div className="rounded-xl border border-surface-border bg-surface/40 p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground/95">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{oneLiner}</p>
        </div>
        <ConfidenceBar value={i.confidence} />
        {open ? (
          <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="mt-3 space-y-2 border-t border-surface-border pt-3 text-xs">
          <Block label="Supporting" empty={COPY.curseBreaker.empty.noSupport}>
            {i.supportingEvidence.map((e) => (
              <li key={e.id}>{e.text}</li>
            ))}
          </Block>
          <Block label="Counter" empty={COPY.curseBreaker.empty.noCounter}>
            {i.counterEvidence.map((e) => (
              <li key={e.id}>{e.text}</li>
            ))}
          </Block>
          {i.missingEvidence.length > 0 && (
            <Block label="Missing">
              {i.missingEvidence.map((m, idx) => (
                <li key={idx}>{m}</li>
              ))}
            </Block>
          )}
          {i.alternativeExplanations.length > 0 && (
            <Block label="Alternative explanations">
              {i.alternativeExplanations.map((a, idx) => (
                <li key={idx}>{a}</li>
              ))}
            </Block>
          )}
          {i.citations.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Citations
              </p>
              <ul className="mt-1 space-y-1">
                {i.citations.map((c, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <TierChip tier={c.tier} />
                    <span className="text-foreground/85">{c.passageId}</span>
                    <span className="text-muted-foreground">— {c.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {i.pastoralNote && (
            <p className="rounded border border-primary/25 bg-primary/10 px-2 py-1.5 text-foreground/90">
              {i.pastoralNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Block({
  label,
  children,
  empty,
}: {
  label: string;
  children: React.ReactNode;
  empty?: string;
}) {
  const arr = Array.isArray(children) ? children : [children];
  const isEmpty = arr.filter(Boolean).length === 0;
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {isEmpty && empty ? (
        <p className="text-muted-foreground/80">{empty}</p>
      ) : (
        <ul className="ml-4 list-disc space-y-0.5 text-foreground/85">{children}</ul>
      )}
    </div>
  );
}

/* 3 · Competing explanations */
export function CompetingExplanationsCard({
  interpretations,
}: {
  interpretations: CBInterpretation[];
}) {
  const withAlts = interpretations.filter((i) => i.alternativeExplanations.length > 0);
  return (
    <Card
      eyebrow={COPY.curseBreaker.cardEyebrows.competingExplanations}
      title={COPY.curseBreaker.cardTitles.competingExplanations}
    >
      {withAlts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{COPY.curseBreaker.empty.noAlternatives}</p>
      ) : (
        <ul className="space-y-3">
          {withAlts.map((i) => (
            <li key={i.id} className="rounded-lg border border-surface-border bg-surface/40 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
                {COPY.curseBreaker.categoryLabels[i.category as InterpretationCategory]}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-foreground/85">
                {i.alternativeExplanations.map((a, idx) => (
                  <li key={idx}>{a}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* 4 · Tension analysis */
export function TensionAnalysisCard({ tensions }: { tensions: CBTension[] }) {
  return (
    <Card
      eyebrow={COPY.curseBreaker.cardEyebrows.tensionAnalysis}
      title={COPY.curseBreaker.cardTitles.tensionAnalysis}
    >
      <div className="space-y-3">
        {tensions.map((t) => (
          <div key={t.id} className="rounded-lg border border-surface-border bg-surface/40 p-3">
            <p className="text-xs">
              <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">
                {COPY.curseBreaker.categoryLabels[t.categoryA]}
              </span>
              <span className="px-2 text-muted-foreground">held against</span>
              <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">
                {COPY.curseBreaker.categoryLabels[t.categoryB]}
              </span>
            </p>
            <p className="mt-2 text-sm text-foreground/90">{t.description}</p>
            <p className="mt-2 rounded border border-primary/25 bg-primary/10 px-3 py-2 text-sm">
              {t.resolutionQuestion}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* 5 · Prayer lineage */
export function PrayerLineageCard({
  lineage,
  passages,
}: {
  lineage: CBPrayerLineage;
  passages: Record<string, SourcePassage>;
}) {
  return (
    <Card
      eyebrow={COPY.curseBreaker.cardEyebrows.prayerLineage}
      title={lineage.title}
    >
      <p className="mb-4 text-xs text-muted-foreground">
        Each line carries a primary movement and any secondary movements. Every line cites at
        least one source; without a source it would not be rendered.
      </p>
      <ol className="space-y-3">
        {lineage.lines.map((line) => (
          <li key={line.id} className="rounded-lg border border-surface-border bg-surface/30 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-foreground"
                title="Primary movement"
              >
                {line.primaryMovement.replace("_", " ")}
              </span>
              {line.movements.slice(1).map((m) => (
                <span
                  key={m}
                  className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary"
                  title="Secondary movement"
                >
                  {m.replace("_", " ")}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[15px] leading-snug text-foreground/95">{line.text}</p>
            <div className="mt-2 space-y-1">
              {line.citations.map((c, idx) => {
                const passage = passages[c.passageId];
                return (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center gap-2 rounded border border-surface-border bg-background px-2.5 py-1.5 text-xs"
                  >
                    <TierChip tier={c.tier} />
                    <span className="font-medium">{passage?.reference ?? c.passageId}</span>
                    <span className="text-muted-foreground">— {c.note}</span>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* 6 · One pattern-breaking act */
export function PatternBreakingActCard({ act }: { act: CBPatternBreakingAct }) {
  return (
    <Card
      eyebrow={COPY.curseBreaker.cardEyebrows.patternBreakingAct}
      title={act.title}
    >
      <p>{act.rationale}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-surface-border bg-surface px-2.5 py-0.5 text-muted-foreground">
          Scale: {act.scale}
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{act.proportionateNote}</p>
    </Card>
  );
}

/* 7 · Formation check-in */
export function FormationCheckInCard({ checkIn }: { checkIn: CBFormationCheckIn }) {
  return (
    <Card
      eyebrow={COPY.curseBreaker.cardEyebrows.formationCheckIn}
      title={COPY.curseBreaker.cardTitles.formationCheckIn}
    >
      <p className="text-xs text-muted-foreground">
        Scheduled for {new Date(checkIn.scheduledFor).toLocaleDateString()}.
      </p>
      <ul className="mt-3 space-y-2">
        {checkIn.observePrompts.map((p, i) => (
          <li key={i} className="rounded-lg border border-surface-border bg-surface/40 px-3 py-2 text-sm">
            {p}
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded border border-surface-border bg-surface/40 px-3 py-2 text-xs text-muted-foreground">
        {checkIn.setbackHandling}
      </p>
    </Card>
  );
}

/* 8 · Dignity & safety */
export function DignityAndSafetyCard({ dignity }: { dignity: CBDignityFrame }) {
  return (
    <Card
      eyebrow={COPY.curseBreaker.cardEyebrows.dignityAndSafety}
      title={COPY.curseBreaker.cardTitles.dignityAndSafety}
    >
      <div className="space-y-2 text-sm text-foreground/90">
        <p className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
          <span>{dignity.refusalOfAutomaticVerdicts}</span>
        </p>
        <p>{dignity.reversibilityPromise}</p>
        <p className="text-muted-foreground">{dignity.humanCounselPointer}</p>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {COPY.curseBreaker.disclaimers.notADeclaration}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {COPY.curseBreaker.disclaimers.referenceOnly}
      </p>
    </Card>
  );
}
