/**
 * Canonical renderer for a validated UnifiedResult.
 * Used by the live composer (/wisdom) and the session viewer (/wisdom/$sessionId).
 * Presentation-only: no fetching, no side effects.
 */
import type { UnifiedResult } from "@/lib/wisdom/unified.schemas";

export function UnifiedResultView({ result }: { result: UnifiedResult }) {
  return (
    <div className="space-y-3">
      <p className="text-foreground/90">{result.user_facing_response}</p>

      {result.mode === "pattern" && result.competing_hypotheses.length > 0 && (
        <HypothesesBlock hypotheses={result.competing_hypotheses} distinguishing={result.distinguishing_question} />
      )}

      {result.mode === "deep_wisdom" && (
        <DeepWisdomBlock
          hypothesis={result.hypothesis_under_test}
          explanations={result.competing_explanations}
        />
      )}

      {result.mode === "curse_breaker" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Stronghold discerned</div>
          <div className="mt-1 text-[13px] font-medium">{result.stronghold_category}</div>
          {result.renunciations.length > 0 && (
            <ul className="mt-2 space-y-1 text-[12px] text-foreground/80">
              {result.renunciations.map((r, i) => (
                <li key={i} className="pl-3 border-l-2 border-primary/40 italic">{r}</li>
              ))}
            </ul>
          )}
          {result.distinguishing_question && (
            <p className="mt-2 rounded-lg border border-primary/30 bg-background/40 px-3 py-2 text-[12px]">
              <span className="font-medium">Distinguishing question:</span> {result.distinguishing_question}
            </p>
          )}
        </div>
      )}

      {(result.mode === "pattern" || result.mode === "curse_breaker") && (
        <PrayerDraft title={result.prayer_draft.title} lines={result.prayer_draft.lines} />
      )}
      {result.mode === "deep_wisdom" && (
        <PrayerDraft title={result.prayer_lineage_draft.title} lines={result.prayer_lineage_draft.lines} />
      )}

      {result.mode === "companion" && result.reflection && (
        <div className="rounded-xl border border-panel-border/60 bg-surface/40 p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Reflection</div>
          <p className="mt-1 text-[13px] italic text-foreground/85">{result.reflection}</p>
        </div>
      )}

      {result.mode !== "companion" && (
        <div className="rounded-xl border border-panel-border/60 bg-surface/40 p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Primary practice</div>
          <div className="mt-1 text-[13px] font-medium">{result.primary_practice.title}</div>
          <p className="mt-1 text-[12px] text-muted-foreground">{result.primary_practice.rationale}</p>
        </div>
      )}
    </div>
  );
}

function HypothesesBlock({
  hypotheses,
  distinguishing,
}: {
  hypotheses: Array<{ name: string; description: string; confidence: number }>;
  distinguishing?: string;
}) {
  return (
    <div className="rounded-xl border border-panel-border/60 bg-surface/40 p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Competing hypotheses</div>
      <ul className="mt-2 space-y-1.5">
        {hypotheses.map((h, i) => (
          <li key={i} className="rounded-lg border border-panel-border/50 bg-background/40 px-3 py-2 text-[12px]">
            <div className="font-medium text-foreground/90">{h.name}</div>
            {h.description && <div className="mt-0.5 text-muted-foreground">{h.description}</div>}
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {Math.round(h.confidence * 100)}% confidence
            </div>
          </li>
        ))}
      </ul>
      {distinguishing && (
        <p className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[12px]">
          <span className="font-medium">Distinguishing question:</span> {distinguishing}
        </p>
      )}
    </div>
  );
}

function DeepWisdomBlock({
  hypothesis,
  explanations,
}: {
  hypothesis: { name: string; description: string; confidence: number };
  explanations: Array<{ frame: string; text: string }>;
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-panel-border/60 bg-surface/40 p-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Hypothesis under test</div>
        <div className="mt-1 text-[13px] font-medium">{hypothesis.name}</div>
        {hypothesis.description && (
          <p className="mt-1 text-[12px] text-muted-foreground">{hypothesis.description}</p>
        )}
        <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {Math.round(hypothesis.confidence * 100)}% confidence
        </div>
      </div>
      {explanations.length > 0 && (
        <div className="rounded-xl border border-panel-border/60 bg-surface/40 p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Competing explanations</div>
          <ul className="mt-2 space-y-1.5">
            {explanations.map((e, i) => (
              <li key={i} className="rounded-lg border border-panel-border/50 bg-background/40 px-3 py-2 text-[12px]">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.frame}</div>
                <p className="mt-1 text-foreground/85">{e.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PrayerDraft({
  title,
  lines,
}: {
  title: string;
  lines: Array<{
    movement: string;
    text: string;
    citations: Array<{ passage_id: string; derivation: string; explanation: string }>;
  }>;
}) {
  return (
    <div className="rounded-xl border border-panel-border/60 bg-surface/40 p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Prayer draft</div>
      <div className="mt-1 text-[13px] font-medium">{title}</div>
      <div className="mt-2 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="border-l-2 border-primary/50 pl-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l.movement}</div>
            <p className="text-[13px] italic">{l.text}</p>
            {l.citations.length > 0 && (
              <div className="mt-1 text-[10.5px] text-muted-foreground">
                {l.citations.length} citation{l.citations.length === 1 ? "" : "s"}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
