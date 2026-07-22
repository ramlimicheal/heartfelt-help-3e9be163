/**
 * WisdomResponse — canonical, mode-aware renderer for a UnifiedResult.
 *
 * Design rules (see coverage-gate report):
 *  - Stable section order across all modes. Mode only decides
 *    visibility, prominence, defaultOpen, and copy.
 *  - Render a section only when its backing canonical field is
 *    present and non-empty. No fabrication.
 *  - Evidence drawers open only when real evidence exists.
 *  - Citation drawers show details only from actual passage/citation
 *    data. Never invent context / derivation / explanation.
 *  - Curse Breaker v2 delegates to <CurseBreakerV2View> for its
 *    layered contract and Accept/Revise/Reject actions, which stay
 *    unchanged.
 */
import { useRef } from "react";
import { Sparkles } from "lucide-react";
import type { UnifiedResult } from "@/lib/wisdom/unified.schemas";
import {
  MovementBadge,
  ScriptureBlock,
  DerivationLegend,
} from "@/components/wisdom/primitives";
import { CurseBreakerV2View } from "@/components/wisdom/CurseBreakerV2View";
import {
  SectionShell,
  UncertaintyChip,
  confidenceToLevel,
  MemoryChip,
  type MemoryDirective,
  EvidenceDrawer,
  CitationDrawer,
  SectionNav,
  StoryMovementList,
  ContinueChips,
  deriveContinueChips,
  usePresentSections,
  type SectionId,
} from "./primitives";
import type { SourceTier } from "@/lib/wisdom/contracts/sourceTier";

/**
 * Session-history summary passed from the caller (already loaded by
 * `loadSessionHistory` on the session route). No new fetch here.
 */
export type SessionHistorySummary = {
  turnCount: number;
  earliestAt?: string;
  latestAt?: string;
  sessionMode?: string;
};

export type ResponseOrientation = {
  createdAt?: string;
  sessionTitle?: string | null;
  memoryDirective?: MemoryDirective;
  /** true while the underlying turn is still streaming */
  streaming?: boolean;
};

export function WisdomResponse({
  result,
  orientation,
  wisdomTurnId,
  prayerId,
  onContinue,
  onFinalizePrayer,
  finalizeState,
  sessionHistory,
}: {
  result: UnifiedResult;
  orientation?: ResponseOrientation;
  wisdomTurnId?: string;
  prayerId?: string;
  onContinue?: (prompt: string) => void;
  onFinalizePrayer?: (prayerId: string) => void;
  finalizeState?: { status: "idle" | "pending" | "done" | "error"; message?: string };
  sessionHistory?: SessionHistorySummary;
}) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const passageMap = new Map(
    (result.source_passages ?? []).map((p) => [p.passage_id, p]),
  );

  // ── Derive per-section presence, honestly. ─────────────────────────
  const isCB = result.mode === "curse_breaker";
  const isCompanion = result.mode === "companion";
  const isPattern = result.mode === "pattern";
  const isDeep = result.mode === "deep_wisdom";

  const eventChain =
    isPattern || isDeep || isCB
      ? (result as { event_chain?: Array<{ kind: string; text: string; fromUser: boolean }> })
          .event_chain ?? []
      : [];

  const hasPattern =
    (isPattern && (result as { competing_hypotheses?: unknown[] }).competing_hypotheses !== undefined) ||
    (isDeep && Boolean((result as { hypothesis_under_test?: unknown }).hypothesis_under_test)) ||
    (isCB && ((result as { pastoral_interpretations?: unknown[] }).pastoral_interpretations?.length ?? 0) > 0);

  const hasInfluences =
    (isCB && ((result as { contributing_influences?: unknown[] }).contributing_influences?.length ?? 0) > 0) ||
    (isDeep && ((result as { competing_explanations?: unknown[] }).competing_explanations?.length ?? 0) > 0);

  const hasScripture =
    (isCompanion && Boolean((result as { biblical_mirror?: unknown }).biblical_mirror)) ||
    (isDeep && ((result as { biblical_mirrors?: unknown[] }).biblical_mirrors?.length ?? 0) > 0) ||
    (isCB && Boolean(result.source_passages?.length)) ||
    (isPattern && Boolean(result.source_passages?.length));

  const discernmentHasContent =
    Boolean(result.uncertainty) ||
    (result.explicit_signals?.length ?? 0) > 0 ||
    (result.inferred_signals?.length ?? 0) > 0 ||
    (isPattern && ((result as { competing_hypotheses?: Array<{ counter_evidence?: string[]; missing_evidence?: string[] }> }).competing_hypotheses?.some(
      (h) => (h.counter_evidence?.length ?? 0) > 0 || (h.missing_evidence?.length ?? 0) > 0,
    ) ?? false)) ||
    (isDeep && (
      ((result as { counter_evidence?: string[] }).counter_evidence?.length ?? 0) > 0 ||
      ((result as { contextual_limits?: string[] }).contextual_limits?.length ?? 0) > 0
    )) ||
    (isCB && ((result as { uncertainty_notes?: string[] }).uncertainty_notes?.length ?? 0) > 0);

  const hasPractice =
    (isPattern || isDeep || isCB) &&
    Boolean((result as { primary_practice?: { title?: string } }).primary_practice?.title);

  const hasPrayer =
    (isPattern || isCB) &&
      ((result as { prayer_draft?: { lines?: unknown[] } }).prayer_draft?.lines?.length ?? 0) > 0
    || (isDeep &&
      ((result as { prayer_lineage_draft?: { lines?: unknown[] } }).prayer_lineage_draft?.lines?.length ?? 0) > 0);

  const chips = deriveContinueChips({
    nextQuestion: result.next_question ?? null,
    distinguishingQuestion:
      isPattern
        ? (result as { distinguishing_question?: string }).distinguishing_question
        : undefined,
    hasPattern: Boolean(hasPattern),
    hasScripture: Boolean(hasScripture),
  });

  const present = usePresentSections({
    orientation: true,
    heard: Boolean(result.what_wisdom_heard || result.user_facing_response),
    story: eventChain.length > 0,
    pattern: Boolean(hasPattern),
    influences: Boolean(hasInfluences),
    scripture: Boolean(hasScripture),
    discernment: discernmentHasContent,
    practice: Boolean(hasPractice),
    prayer: Boolean(hasPrayer),
    continue: chips.length > 0,
    history: Boolean(sessionHistory && sessionHistory.turnCount > 1),
  });

  return (
    <div
      ref={scopeRef}
      data-testid="wisdom-response"
      data-mode={result.mode}
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] xl:grid-cols-[minmax(0,1fr)_200px] xl:gap-6"
    >
      <div className="min-w-0 md:columns-2 md:gap-4 md:[&>*]:mb-4 md:[&>*]:break-inside-avoid space-y-4 md:space-y-0">
        {/* Mobile/tablet section navigator sits at the top of the reading column */}
        <div className="lg:hidden">
          <SectionNav containerRef={scopeRef as React.RefObject<HTMLElement | null>} presentSections={present} />
        </div>

        {/* 1. Orientation */}
        <OrientationBlock result={result} orientation={orientation} sessionHistory={sessionHistory} />

        {/* 2. What I'm Hearing — hidden for CB (delegated view leads with observed_pattern) */}
        {!isCB && present.includes("heard") && (
          <SectionShell
            id="heard"
            eyebrow="What I'm hearing"
            title={result.what_wisdom_heard || "What I'm hearing"}
          >
            <p className="text-[13.5px] leading-[1.65] text-foreground/90 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-500">
              {result.user_facing_response}
            </p>
            {isCompanion && (result as { reflection?: string }).reflection && (
              <p className="mt-3 border-l-2 border-primary/40 pl-3 text-[13px] italic leading-relaxed text-foreground/80">
                {(result as { reflection?: string }).reflection}
              </p>
            )}

          </SectionShell>
        )}

        {/* 3. Story as a Movement (pattern / deep / cb) */}
        {present.includes("story") && (
          <SectionShell
            id="story"
            eyebrow="Story as a movement"
            title="How this seems to be moving"
            note="Each step names what kind of step it is and whether you said it directly."
            defaultOpen
            collapsible
          >
            <StoryMovementList chain={eventChain} />
          </SectionShell>
        )}

        {/* 4. Pattern Taking Shape — CB delegates below to CurseBreakerV2View */}
        {present.includes("pattern") && !isCB && (
          <SectionShell
            id="pattern"
            eyebrow="Pattern taking shape"
            title="What may be repeating"
            note="Revisable interpretation, not a verdict."
          >
            {isPattern && (
              <PatternHypotheses
                hypotheses={(result as { competing_hypotheses: Array<{
                  name: string; description: string; confidence: number;
                  supporting_evidence: string[]; counter_evidence: string[]; missing_evidence: string[];
                }> }).competing_hypotheses}
                distinguishing={(result as { distinguishing_question?: string }).distinguishing_question}
                proposedPattern={(result as { proposed_pattern?: { title: string; description: string; confidence: number } | null }).proposed_pattern ?? null}
              />
            )}
            {isDeep && (
              <DeepHypothesis
                hypothesis={(result as { hypothesis_under_test: {
                  name: string; description: string; confidence: number;
                  supporting_evidence: string[]; counter_evidence: string[]; missing_evidence: string[];
                } }).hypothesis_under_test}
              />
            )}
          </SectionShell>
        )}

        {/* 5. Influences — CB (contributing_influences) or Deep Wisdom (competing_explanations) */}
        {present.includes("influences") && !isCB && isDeep && (
          <SectionShell
            id="influences"
            eyebrow="What may be underneath"
            title="Competing explanations"
            note="Different lenses on the same events."
            defaultOpen={false}
            collapsible
          >
            <CompetingExplanations
              explanations={
                (result as { competing_explanations: Array<{ frame: string; text: string }> }).competing_explanations
              }
            />
          </SectionShell>
        )}

        {/* CURSE BREAKER v2 — layered contract owned by CurseBreakerV2View.
            Its internal order is the approved order; we do not restructure it.
            It replaces sections 4+5 for CB. */}
        {isCB && (
          <SectionShell
            id="pattern"
            eyebrow="Layered reading"
            title="What Wisdom is discerning"
            note="Hypotheses, not verdicts. Actions available per interpretation."
          >
            <CurseBreakerV2View
              result={result}
              wisdomTurnId={wisdomTurnId}
              interactive={Boolean(wisdomTurnId)}
            />
          </SectionShell>
        )}

        {/* 6. Biblical Mirrors */}
        {present.includes("scripture") && (
          <SectionShell
            id="scripture"
            eyebrow="Biblical mirrors"
            title="Where Scripture meets your story"
            note="Descriptive passages are not automatic prescriptions."
          >
            <BiblicalMirrorsBlock result={result} passageMap={passageMap} />
          </SectionShell>
        )}

        {/* 7. Discernment */}
        {present.includes("discernment") && (
          <SectionShell
            id="discernment"
            eyebrow="Discernment"
            title="What we know and what remains open"
            defaultOpen={false}
            collapsible
          >
            <DiscernmentBlock result={result} />
          </SectionShell>
        )}

        {/* 8. Practice */}
        {present.includes("practice") && (
          <SectionShell
            id="practice"
            eyebrow="One faithful practice"
            title={(result as { primary_practice: { title: string } }).primary_practice.title}
          >
            <PracticeBlock result={result} />
          </SectionShell>
        )}

        {/* 9. Prayer */}
        {present.includes("prayer") && (
          <SectionShell
            id="prayer"
            eyebrow="Prayer from the discernment"
            title={
              (
                (result as { prayer_draft?: { title?: string }; prayer_lineage_draft?: { title?: string } })
                  .prayer_draft?.title ??
                (result as { prayer_lineage_draft?: { title?: string } })
                  .prayer_lineage_draft?.title ??
                "Draft prayer"
              )
            }
            note="Draft — you finalize it explicitly."
          >
            <PrayerBlock
              result={result}
              prayerId={prayerId}
              onFinalizePrayer={onFinalizePrayer}
              finalizeState={finalizeState}
              memoryDirective={orientation?.memoryDirective ?? "normal"}
            />
          </SectionShell>
        )}

        {/* 10. Continue */}
        {present.includes("continue") && onContinue && (
          <SectionShell
            id="continue"
            eyebrow="Continue the conversation"
            title="What would you like next?"
          >
            <p className="mb-2 text-[12px] text-muted-foreground">
              Tap a suggestion to fill the composer. Nothing is sent until you press begin.
            </p>
            <ContinueChips
              chips={chips}
              onSelect={(c) => onContinue(c.prompt)}
            />
          </SectionShell>
        )}

        {/* 11. Session history (only when the caller passes real prior-turn data) */}
        {present.includes("history") && sessionHistory && (
          <SectionShell
            id="history"
            eyebrow="Session history"
            title={`Earlier this session · ${sessionHistory.turnCount} turn${sessionHistory.turnCount === 1 ? "" : "s"}`}
            note="Only this session. Not a cross-session formation summary."
            defaultOpen={false}
            collapsible
          >
            <p className="text-[12px] text-muted-foreground">
              Wisdom has spoken with you {sessionHistory.turnCount} times in this session
              {sessionHistory.earliestAt ? `, first at ${new Date(sessionHistory.earliestAt).toLocaleString()}` : ""}.
              Session-only and do-not-remember turns are not included in any durable history.
            </p>
          </SectionShell>
        )}
      </div>

      {/* Desktop section nav rail */}
      <aside className="hidden lg:block">
        <SectionNav containerRef={scopeRef as React.RefObject<HTMLElement | null>} presentSections={present} />
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Orientation
// ─────────────────────────────────────────────────────────────────────
const MODE_LABEL: Record<UnifiedResult["mode"], string> = {
  companion: "Companion",
  pattern: "Pattern",
  deep_wisdom: "Deep Wisdom",
  curse_breaker: "Curse Breaker",
};

function OrientationBlock({
  result,
  orientation,
  sessionHistory,
}: {
  result: UnifiedResult;
  orientation?: ResponseOrientation;
  sessionHistory?: SessionHistorySummary;
}) {
  const created = orientation?.createdAt ? new Date(orientation.createdAt) : null;
  return (
    <section
      id="orientation"
      aria-labelledby="wr-orientation-heading"
      data-section="orientation"
      className="scroll-mt-24 relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-surface/70 via-surface/40 to-transparent px-4 py-4 md:px-6 md:py-5"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
              <Sparkles className="size-3" aria-hidden />
              {MODE_LABEL[result.mode]}
            </span>
            {orientation?.memoryDirective && (
              <MemoryChip directive={orientation.memoryDirective} />
            )}
            {orientation?.streaming && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary"
                role="status"
              >
                Streaming
              </span>
            )}
          </div>
          <h2
            id="wr-orientation-heading"
            className="mt-2 text-[14px] font-medium leading-snug tracking-[-0.005em] text-foreground md:text-[15px]"
          >
            {orientation?.sessionTitle
              ? orientation.sessionTitle
              : (result.what_wisdom_heard || "This response")}
          </h2>

          <p className="mt-1 text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground">
            {created ? created.toLocaleString() : "Just now"}
            {sessionHistory && sessionHistory.turnCount > 1
              ? ` · ${sessionHistory.turnCount} turns in this session`
              : ""}
          </p>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Pattern hypotheses
// ─────────────────────────────────────────────────────────────────────
function PatternHypotheses({
  hypotheses,
  distinguishing,
  proposedPattern,
}: {
  hypotheses: Array<{
    name: string; description: string; confidence: number;
    supporting_evidence: string[]; counter_evidence: string[]; missing_evidence: string[];
  }>;
  distinguishing?: string;
  proposedPattern: { title: string; description: string; confidence: number } | null;
}) {
  return (
    <div className="space-y-3">
      {proposedPattern && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[12.5px] font-medium">{proposedPattern.title}</div>
            <UncertaintyChip level={confidenceToLevel(proposedPattern.confidence)} />
          </div>
          {proposedPattern.description && (
            <p className="mt-1 text-[12px] text-muted-foreground">{proposedPattern.description}</p>
          )}
        </div>
      )}
      <ul className="space-y-2">
        {hypotheses.map((h, i) => (
          <li key={i} className="rounded-lg border border-panel-border/60 bg-background/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 text-[13px] font-medium truncate">{h.name}</div>
              <UncertaintyChip level={confidenceToLevel(h.confidence)} />
            </div>
            {h.description && (
              <p className="mt-1 text-[12px] text-foreground/85">{h.description}</p>
            )}
            <EvidenceDrawer
              label="Evidence & counter-evidence"
              support={h.supporting_evidence}
              counter={h.counter_evidence}
            />
            {h.missing_evidence.length > 0 && (
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                <span className="text-[10px] uppercase tracking-wider">Still open: </span>
                {h.missing_evidence.join(" · ")}
              </p>
            )}
          </li>
        ))}
      </ul>
      {distinguishing && (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[13px]">
          <span className="font-medium">Distinguishing question:</span> {distinguishing}
        </p>
      )}
    </div>
  );
}

function DeepHypothesis({
  hypothesis,
}: {
  hypothesis: {
    name: string; description: string; confidence: number;
    supporting_evidence: string[]; counter_evidence: string[]; missing_evidence: string[];
  };
}) {
  return (
    <div className="rounded-lg border border-panel-border/60 bg-background/40 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-[13px] font-medium">{hypothesis.name}</div>
        <UncertaintyChip level={confidenceToLevel(hypothesis.confidence)} />
      </div>
      {hypothesis.description && (
        <p className="mt-1 text-[12px] text-foreground/85">{hypothesis.description}</p>
      )}
      <EvidenceDrawer
        label="Supporting and counter-evidence"
        support={hypothesis.supporting_evidence}
        counter={hypothesis.counter_evidence}
      />
      {hypothesis.missing_evidence.length > 0 && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          <span className="text-[10px] uppercase tracking-wider">Still open: </span>
          {hypothesis.missing_evidence.join(" · ")}
        </p>
      )}
    </div>
  );
}

function CompetingExplanations({
  explanations,
}: {
  explanations: Array<{ frame: string; text: string }>;
}) {
  const FRAME_LABEL: Record<string, string> = {
    ordinary: "Ordinary",
    relational: "Relational",
    situational: "Situational",
    embodied: "Embodied",
    spiritual: "Spiritual",
  };
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {explanations.map((e, i) => (
        <li key={i} className="rounded-lg border border-panel-border/60 bg-background/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-primary">
            {FRAME_LABEL[e.frame] ?? e.frame}
          </div>
          <p className="mt-1 text-[13px] text-foreground/90">{e.text}</p>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Biblical mirrors
// ─────────────────────────────────────────────────────────────────────
function BiblicalMirrorsBlock({
  result,
  passageMap,
}: {
  result: UnifiedResult;
  passageMap: Map<string, {
    passage_id: string; reference: string; translation: string;
    source_tier: string; text: string;
  }>;
}) {
  // Map source_tier "S1" → SourceTier enum member.
  const tierFor = (short?: string): SourceTier => {
    switch (short) {
      case "S2": return "S2_canonical_synthesis";
      case "S3": return "S3_linguistic_historical";
      case "S4": return "S4_recognized_interpretation";
      case "S5": return "S5_extra_canonical_ancient";
      case "S6": return "S6_founder_framework";
      case "S7": return "S7_modern_analogy";
      case "S8": return "S8_model_hypothesis";
      case "S1":
      default: return "S1_canonical_direct";
    }
  };

  // Mode-specific mirror lists.
  if (result.mode === "companion") {
    const m = result.biblical_mirror;
    const p = passageMap.get(m.passage_id);
    if (!p) {
      // Reference-only fallback — no fabricated context.
      return (
        <p className="text-[12px] text-muted-foreground italic">
          Wisdom pointed to a passage but its full context wasn't attached to this response.
        </p>
      );
    }
    return (
      <div className="space-y-3">
        <ScriptureBlock reference={p.reference} text={p.text} translation={p.translation} />
        <CitationDrawer
          reference={p.reference}
          tier={tierFor(p.source_tier)}
          translation={p.translation}
          text={p.text}
          explanation={m.explanation}
          derivation={m.derivation}
          contextualLimit={m.contextual_limit}
        />
      </div>
    );
  }

  if (result.mode === "deep_wisdom") {
    const mirrors = result.biblical_mirrors;
    if (mirrors.length === 0 && (result.source_passages ?? []).length === 0) return null;
    return (
      <div className="space-y-2">
        {mirrors.map((m, i) => {
          const p = passageMap.get(m.passage_id);
          const ref = p?.reference ?? "Passage";
          return (
            <CitationDrawer
              key={i}
              reference={ref}
              tier={p ? tierFor(p.source_tier) : undefined}
              translation={p?.translation}
              text={p?.text}
              explanation={m.explanation}
              derivation={m.derivation}
              contextualLimit={m.contextual_limit}
            />
          );
        })}
        {mirrors.length === 0 && (
          <p className="mb-2 text-[12px] text-muted-foreground italic">
            Passages referenced without pastoral explanation are shown by reference only.
          </p>
        )}
        {mirrors.length === 0 &&
          (result.source_passages ?? []).map((p) => (
            <CitationDrawer
              key={p.passage_id}
              reference={p.reference}
              tier={tierFor(p.source_tier)}
              translation={p.translation}
              text={p.text}
            />
          ))}
      </div>
    );
  }

  // Pattern & Curse Breaker: only reference-level source_passages, or the
  // prayer-line citations (which render in the Prayer block). Show the
  // passages here as reference/tier drawers — no invented explanation.
  const passages = result.source_passages ?? [];
  if (passages.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted-foreground">
        Passages Wisdom leaned on. Explanations live under the prayer lines that cite them.
      </p>
      {passages.map((p) => (
        <CitationDrawer
          key={p.passage_id}
          reference={p.reference}
          tier={tierFor(p.source_tier)}
          translation={p.translation}
          text={p.text}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Discernment
// ─────────────────────────────────────────────────────────────────────
function DiscernmentBlock({ result }: { result: UnifiedResult }) {
  const explicit = result.explicit_signals ?? [];
  const inferred = result.inferred_signals ?? [];
  return (
    <div className="space-y-3">
      {result.uncertainty && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[13px] text-foreground/85">
          <span className="text-[10px] uppercase tracking-wider text-amber-400">Uncertainty · </span>
          {result.uncertainty}
        </p>
      )}
      {(explicit.length > 0 || inferred.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {explicit.length > 0 && (
            <div className="rounded-lg border border-panel-border/60 bg-background/40 p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <UncertaintyChip level="user_reported" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">You directly said</span>
              </div>
              <ul className="space-y-1 text-[12.5px] text-foreground/90">
                {explicit.map((s, i) => <li key={i}>“{s.paraphrase}”</li>)}
              </ul>
            </div>
          )}
          {inferred.length > 0 && (
            <div className="rounded-lg border border-panel-border/60 bg-background/40 p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <UncertaintyChip level="plausible" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Wisdom noticed</span>
              </div>
              <ul className="space-y-1 text-[12.5px] text-foreground/85">
                {inferred.map((s, i) => <li key={i}>{s.paraphrase}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      {result.mode === "deep_wisdom" && (
        <>
          {result.counter_evidence.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Counter-evidence</div>
              <ul className="mt-1 space-y-1 text-[12.5px] text-foreground/85">
                {result.counter_evidence.map((c, i) => (
                  <li key={i} className="border-l-2 border-amber-500/40 pl-2">{c}</li>
                ))}
              </ul>
            </div>
          )}
          {result.contextual_limits.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Where we should be careful</div>
              <ul className="mt-1 space-y-1 text-[12.5px] text-foreground/85">
                {result.contextual_limits.map((c, i) => (
                  <li key={i} className="border-l-2 border-primary/40 pl-2">{c}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {result.next_question && (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[13px]">
          <span className="font-medium">A question to hold: </span>
          {result.next_question}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Practice
// ─────────────────────────────────────────────────────────────────────
function PracticeBlock({ result }: { result: UnifiedResult }) {
  if (result.mode === "companion") return null;
  const primary = (result as { primary_practice: { title: string; rationale: string; kind: string } }).primary_practice;
  const cbAction =
    result.mode === "curse_breaker"
      ? result.next_faithful_action
      : undefined;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[13px] text-foreground/90">{primary.rationale}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Kind · {primary.kind.replace(/_/g, " ")}
        </p>
      </div>
      {cbAction?.text && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[13px]">
          <div className="text-[10px] uppercase tracking-wider text-primary">Where the pattern can break</div>
          <p className="mt-1">{cbAction.text}</p>
          {cbAction.escalation_hint && (
            <p className="mt-1 text-[11px] uppercase tracking-wider text-amber-400">
              Consider {cbAction.escalation_hint.replace("_", " ")} support
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Prayer
// ─────────────────────────────────────────────────────────────────────
function PrayerBlock({
  result,
  prayerId,
  onFinalizePrayer,
  finalizeState,
  memoryDirective,
}: {
  result: UnifiedResult;
  prayerId?: string;
  onFinalizePrayer?: (prayerId: string) => void;
  finalizeState?: { status: "idle" | "pending" | "done" | "error"; message?: string };
  memoryDirective: MemoryDirective;
}) {
  const draft =
    result.mode === "deep_wisdom"
      ? result.prayer_lineage_draft
      : (result as { prayer_draft?: { title: string; lines: Array<{ movement: string; text: string; citations: Array<{ passage_id: string; derivation: string; explanation: string }> }> } }).prayer_draft;
  if (!draft) return null;

  const allLinesCited = draft.lines.every((l) => l.citations.length > 0);
  const memoryOk = memoryDirective === "normal";
  const canFinalize = allLinesCited && memoryOk && Boolean(prayerId) && Boolean(onFinalizePrayer);

  return (
    <div className="space-y-3">
      <DerivationLegend />
      <div className="space-y-3">
        {draft.lines.map((l, i) => (
          <div
            key={i}
            className="rounded-xl border border-panel-border/60 bg-gradient-to-br from-surface/60 via-surface/30 to-transparent p-3"
          >
            <MovementBadge movement={l.movement} />
            <p className="mt-2 text-[16px] italic leading-relaxed">{l.text}</p>
            {l.citations.length > 0 && (
              <p className="mt-2 text-[10.5px] text-muted-foreground">
                {l.citations.length} citation{l.citations.length === 1 ? "" : "s"} ·
                {" "}
                {l.citations.map((c) => c.derivation).join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Finalization checklist */}
      <div className="rounded-lg border border-panel-border bg-background/40 p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          To add this prayer to your library
        </div>
        <ul className="mt-2 space-y-1 text-[12px]">
          <ChecklistRow ok={draft.lines.length > 0} label="Draft has at least one line" />
          <ChecklistRow ok={allLinesCited} label="Every line has at least one Scripture citation" />
          <ChecklistRow ok={memoryOk} label='Memory is set to "Remember normally"' />
          <ChecklistRow ok={Boolean(prayerId)} label="Prayer is saved from a completed turn" />
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canFinalize || finalizeState?.status === "pending"}
            data-testid="wr-finalize-prayer"
            onClick={() => prayerId && onFinalizePrayer?.(prayerId)}
            className="rounded-full border border-primary bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {finalizeState?.status === "pending"
              ? "Finalizing…"
              : finalizeState?.status === "done"
                ? "Finalized"
                : "Finalize prayer"}
          </button>
          {finalizeState?.status === "error" && finalizeState.message && (
            <span className="text-[11px] text-destructive" role="alert">
              {finalizeState.message}
            </span>
          )}
          {finalizeState?.status === "done" && (
            <span className="text-[11px] text-primary" role="status">
              Added to your prayer library.
            </span>
          )}
        </div>
        {!memoryOk && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            This turn's memory is not set to "Remember normally", so its prayer draft cannot become durable.
          </p>
        )}
      </div>
    </div>
  );
}

function ChecklistRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className={[
          "grid size-4 place-items-center rounded-full border text-[9px]",
          ok
            ? "border-primary/60 bg-primary/20 text-primary"
            : "border-muted-foreground/40 text-muted-foreground",
        ].join(" ")}
      >
        {ok ? "✓" : "—"}
      </span>
      <span className={ok ? "text-foreground/90" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}
