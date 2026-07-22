/**
 * Response primitives — shared building blocks for the canonical
 * Wisdom response experience.
 *
 * All primitives are presentation-only. They never fetch data, mutate
 * server state, or introspect the model. Every drawer/expandable is
 * built on native <details> so keyboard, focus, and reduced-motion are
 * handled by the browser without extra libraries.
 *
 * Nothing here fabricates content. If the caller passes empty data,
 * the primitive renders nothing so the parent's `omit` decision is
 * honored.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SourceTier } from "@/lib/wisdom/contracts/sourceTier";
import { TierChip } from "@/components/wisdom/primitives";

// ─────────────────────────────────────────────────────────────────────
// Canonical section identifiers. The order here is the single stable
// reading order across all four modes. Mode differences only decide
// visibility, prominence, defaultOpen, and copy — never order.
// ─────────────────────────────────────────────────────────────────────
export const SECTION_IDS = [
  "orientation",
  "heard",
  "story",
  "pattern",
  "influences",
  "scripture",
  "discernment",
  "practice",
  "prayer",
  "continue",
  "history",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_LABEL: Record<SectionId, string> = {
  orientation: "Overview",
  heard: "What I'm hearing",
  story: "Story as a movement",
  pattern: "Pattern taking shape",
  influences: "What may be underneath",
  scripture: "Biblical mirrors",
  discernment: "Discernment",
  practice: "One faithful practice",
  prayer: "Prayer from the discernment",
  continue: "Continue the conversation",
  history: "Session history",
};

// ─────────────────────────────────────────────────────────────────────
// SectionShell — semantic <section> with anchor id, eyebrow, title,
// optional note, and optional defaultOpen collapsible behavior on
// small screens. Screen readers get proper heading hierarchy.
// ─────────────────────────────────────────────────────────────────────
export function SectionShell({
  id,
  eyebrow,
  title,
  note,
  headingLevel = 2,
  defaultOpen = true,
  collapsible = false,
  aside,
  "data-testid": testId,
  children,
}: {
  id: SectionId;
  eyebrow?: string;
  title: string;
  note?: string;
  headingLevel?: 2 | 3;
  defaultOpen?: boolean;
  collapsible?: boolean;
  aside?: React.ReactNode;
  "data-testid"?: string;
  children: React.ReactNode;
}) {
  const H = headingLevel === 3 ? "h3" : "h2";
  const headingId = `wr-${id}-heading`;
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `wr-${id}-body`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-section={id}
      data-testid={testId ?? `wr-section-${id}`}
      className="scroll-mt-24 rounded-xl border border-panel-border/70 bg-surface/40 px-3.5 py-3 md:px-4 md:py-3.5 transition-colors"
    >
      <header className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
              {eyebrow}
            </p>
          )}
          {collapsible ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((v) => !v)}
              className="mt-1 inline-flex items-center gap-1.5 text-left"
            >
              {open ? (
                <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
              )}
              <H
                id={headingId}
                className="text-[13.5px] font-medium leading-snug tracking-[-0.005em] text-foreground md:text-[14.5px]"
              >
                {title}
              </H>
            </button>
          ) : (
            <H
              id={headingId}
              className="mt-1 text-[13.5px] font-medium leading-snug tracking-[-0.005em] text-foreground md:text-[14.5px]"
            >
              {title}
            </H>
          )}
          {note && (
            <p className="mt-1 text-[11px] italic text-muted-foreground">{note}</p>
          )}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      {(!collapsible || open) && (
        <div
          id={bodyId}
          className="text-[13.5px] leading-[1.65] text-foreground/90 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"

        >
          {children}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// UncertaintyChip — plain, non-color-only labels. Never renders a
// percentage. Consumers translate numeric confidence to a band.
// ─────────────────────────────────────────────────────────────────────
export type UncertaintyLevel =
  | "strongly_supported"
  | "plausible"
  | "tentative"
  | "insufficient_evidence"
  | "user_reported"
  | "unresolved";

const UNCERTAINTY_META: Record<
  UncertaintyLevel,
  { label: string; symbol: string; cls: string }
> = {
  strongly_supported: {
    label: "Strongly supported",
    symbol: "●●●",
    cls: "border-primary/50 text-primary",
  },
  plausible: {
    label: "Plausible",
    symbol: "●●○",
    cls: "border-primary/30 text-foreground/85",
  },
  tentative: {
    label: "Tentative",
    symbol: "●○○",
    cls: "border-amber-500/40 text-amber-400",
  },
  insufficient_evidence: {
    label: "Insufficient evidence",
    symbol: "○○○",
    cls: "border-muted-foreground/40 text-muted-foreground",
  },
  user_reported: {
    label: "User-reported",
    symbol: "◆",
    cls: "border-primary/40 text-primary",
  },
  unresolved: {
    label: "Unresolved",
    symbol: "…",
    cls: "border-muted-foreground/40 text-muted-foreground",
  },
};

export function UncertaintyChip({ level }: { level: UncertaintyLevel }) {
  const m = UNCERTAINTY_META[level];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${m.cls}`}
      aria-label={`Certainty: ${m.label}`}
    >
      <span aria-hidden className="text-[9px]">{m.symbol}</span>
      {m.label}
    </span>
  );
}

/** Translate a 0..1 confidence to an honest band label. */
export function confidenceToLevel(confidence: number | undefined): UncertaintyLevel {
  const c = typeof confidence === "number" ? Math.max(0, Math.min(1, confidence)) : 0.5;
  if (c >= 0.75) return "strongly_supported";
  if (c >= 0.5) return "plausible";
  if (c > 0) return "tentative";
  return "insufficient_evidence";
}

// ─────────────────────────────────────────────────────────────────────
// MemoryChip — plain-language rendering of memory directives.
// Enum values are never shown.
// ─────────────────────────────────────────────────────────────────────
export type MemoryDirective = "normal" | "session_only" | "do_not_remember";

const MEMORY_META: Record<MemoryDirective, { label: string; helper: string; cls: string }> = {
  normal: {
    label: "Can contribute to your Wisdom journey",
    helper: "May inform durable patterns, prayers, and persona memory.",
    cls: "border-primary/40 text-primary",
  },
  session_only: {
    label: "Kept only in this session",
    helper: "Visible here; not carried into cross-session memory.",
    cls: "border-amber-500/40 text-amber-400",
  },
  do_not_remember: {
    label: "Not saved after this response",
    helper: "Used only to answer this turn; nothing durable is written.",
    cls: "border-muted-foreground/40 text-muted-foreground",
  },
};

export function MemoryChip({ directive }: { directive: MemoryDirective }) {
  const m = MEMORY_META[directive];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${m.cls}`}
      title={m.helper}
    >
      {m.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// EvidenceDrawer — collapsible list of verbatim user-origin quotes or
// evidence bullets. Renders NOTHING when both lists are empty (that's
// the "only show drawers when evidence exists" rule).
// ─────────────────────────────────────────────────────────────────────
export function EvidenceDrawer({
  label = "Show evidence",
  support = [],
  counter = [],
  quotes = [],
}: {
  label?: string;
  support?: string[];
  counter?: string[];
  quotes?: string[];
}) {
  const total = support.length + counter.length + quotes.length;
  if (total === 0) return null;
  return (
    <details className="mt-2 group rounded-lg border border-panel-border/60 bg-background/40">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-3 transition-transform group-open:rotate-90" aria-hidden />
        {label} · {total}
      </summary>
      <div className="space-y-2 px-3 pb-3 pt-1">
        {quotes.length > 0 && (
          <ul className="space-y-1">
            {quotes.map((q, i) => (
              <li
                key={`q-${i}`}
                className="rounded border-l-2 border-primary/50 bg-surface/40 px-2 py-1 text-[12px] italic text-foreground/85"
              >
                “{q}”
              </li>
            ))}
          </ul>
        )}
        {support.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              What supports this
            </div>
            <ul className="mt-1 space-y-1 text-[12px] text-foreground/85">
              {support.map((s, i) => (
                <li key={`s-${i}`} className="border-l-2 border-primary/40 pl-2">{s}</li>
              ))}
            </ul>
          </div>
        )}
        {counter.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              What complicates it
            </div>
            <ul className="mt-1 space-y-1 text-[12px] text-foreground/85">
              {counter.map((s, i) => (
                <li key={`c-${i}`} className="border-l-2 border-amber-500/40 pl-2">{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CitationDrawer — passage details. Renders only if we have real
// passage text; otherwise we show reference + tier only.
// ─────────────────────────────────────────────────────────────────────
export function CitationDrawer({
  reference,
  tier,
  translation,
  text,
  contextNote,
  derivation,
  explanation,
  contextualLimit,
  why,
}: {
  reference: string;
  tier?: SourceTier;
  translation?: string;
  text?: string;
  contextNote?: string;
  derivation?: string;
  explanation?: string;
  contextualLimit?: string;
  why?: string;
}) {
  const hasDetails =
    Boolean(text) ||
    Boolean(explanation) ||
    Boolean(contextualLimit) ||
    Boolean(contextNote) ||
    Boolean(why);
  return (
    <details className="rounded-lg border border-panel-border/60 bg-background/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[12px] hover:bg-surface/40">
        <span className="inline-flex items-center gap-2 min-w-0">
          <ChevronRight className="size-3 shrink-0 transition-transform [details[open]>&_&]:rotate-90" aria-hidden />
          <span className="truncate font-medium text-foreground/90">{reference}</span>
          {translation && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {translation}
            </span>
          )}
        </span>
        {tier && <TierChip tier={tier} />}
      </summary>
      {hasDetails && (
        <div className="space-y-2 border-t border-panel-border/40 px-3 py-2 text-[12.5px] text-foreground/85">
          {text && (
            <blockquote className="border-l-2 border-primary/40 pl-3 italic leading-relaxed">
              “{text}”
            </blockquote>
          )}
          {contextNote && (
            <p><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Context: </span>{contextNote}</p>
          )}
          {explanation && (
            <p><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Why used: </span>{explanation}</p>
          )}
          {derivation && (
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Derivation · {derivation}
            </p>
          )}
          {contextualLimit && (
            <p className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11.5px]">
              <span className="text-[10px] uppercase tracking-wider text-amber-400">Where we should be careful: </span>
              {contextualLimit}
            </p>
          )}
          {why && (
            <p className="text-[12px] text-muted-foreground">{why}</p>
          )}
        </div>
      )}
    </details>
  );
}

// ─────────────────────────────────────────────────────────────────────
// StreamingStages — five stable stage labels. Progress is driven by
// how many are marked "done" by the caller. Never fabricates a
// percentage. Respects prefers-reduced-motion (no spinner animation).
// ─────────────────────────────────────────────────────────────────────
export const STREAMING_STAGES = [
  { id: "listening", label: "Listening to your story" },
  { id: "tracing", label: "Tracing the movement" },
  { id: "patterns", label: "Looking for patterns" },
  { id: "scripture", label: "Grounding in Scripture" },
  { id: "forming", label: "Forming practice and prayer" },
] as const;
export type StreamingStageId = (typeof STREAMING_STAGES)[number]["id"];

export function StreamingStages({
  activeIndex,
}: {
  /** Current stage index. When undefined the first stage pulses. */
  activeIndex?: number;
}) {
  const active = activeIndex ?? 0;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Wisdom is composing the response"
      className="rounded-xl border border-panel-border/60 bg-surface/40 px-4 py-3"
    >
      <ol className="space-y-1.5">
        {STREAMING_STAGES.map((s, i) => {
          const state = i < active ? "done" : i === active ? "active" : "pending";
          return (
            <li key={s.id} className="flex items-center gap-2 text-[12px]">
              <span
                aria-hidden
                className={[
                  "grid size-4 shrink-0 place-items-center rounded-full border text-[9px]",
                  state === "done"
                    ? "border-primary/60 bg-primary/20 text-primary"
                    : state === "active"
                      ? "border-primary/50 bg-primary/10 text-primary motion-safe:animate-pulse"
                      : "border-panel-border text-muted-foreground/60",
                ].join(" ")}
              >
                {state === "done" ? "✓" : ""}
              </span>
              <span
                className={
                  state === "pending"
                    ? "text-muted-foreground/60"
                    : state === "active"
                      ? "text-foreground"
                      : "text-foreground/70 line-through decoration-primary/30"
                }
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SectionNav — sticky in-response navigator on desktop; collapsible
// chip row on tablet/mobile. Highlights the section in view.
// ─────────────────────────────────────────────────────────────────────
export function SectionNav({
  containerRef,
  presentSections,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  presentSections: SectionId[];
}) {
  const [active, setActive] = useState<SectionId>(presentSections[0] ?? "orientation");
  const observedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const root = containerRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    observedIdsRef.current = new Set(presentSections);
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!observedIdsRef.current.has(e.target.id)) continue;
          if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
          else visible.delete(e.target.id);
        }
        if (visible.size === 0) return;
        const best = [...visible.entries()].sort((a, b) => b[1] - a[1])[0][0];
        setActive(best as SectionId);
      },
      { root: null, rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const id of presentSections) {
      const el = root.querySelector(`#${id}`);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [containerRef, presentSections]);

  if (presentSections.length <= 1) return null;

  return (
    <nav aria-label="Response sections" className="w-full">
      {/* Desktop: sticky vertical list */}
      <div className="hidden lg:block sticky top-4">
        <ol className="space-y-0.5 border-l border-panel-border/60 pl-3">
          {presentSections.map((id) => {
            const isActive = id === active;
            return (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={[
                    "block rounded px-1.5 py-1 text-[11.5px] transition",
                    isActive
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                  aria-current={isActive ? "true" : undefined}
                >
                  {SECTION_LABEL[id]}
                </a>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Tablet & mobile: horizontal chip row (scrollable, no clipping) */}
      <div className="lg:hidden -mx-2 overflow-x-auto pb-1">
        <ul className="flex min-w-max items-center gap-1 px-2">
          {presentSections.map((id) => {
            const isActive = id === active;
            return (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={[
                    "inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] transition",
                    isActive
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-panel-border text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                  aria-current={isActive ? "true" : undefined}
                >
                  {SECTION_LABEL[id]}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────
// StoryMovementList — renders event_chain honestly. Each item labels
// what kind of step it is (context, trigger, interpretation, etc.)
// and marks whether the user stated it directly. Vertical on mobile,
// horizontal-scrolling on wide screens without clipping.
// ─────────────────────────────────────────────────────────────────────
const STORY_KIND_LABEL: Record<string, string> = {
  context: "Context",
  trigger: "Trigger",
  interpretation: "Meaning made",
  need: "Underlying need",
  choice: "Choice",
  immediate_reward: "Immediate reward",
  cost: "Cost",
  afterthought: "Afterthought",
  re_entry: "Re-entry",
};

export function StoryMovementList({
  chain,
}: {
  chain: Array<{ kind: string; text: string; fromUser: boolean }>;
}) {
  if (chain.length === 0) return null;
  return (
    <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {chain.map((step, i) => (
        <li
          key={i}
          className="min-w-0 rounded-lg border border-panel-border/60 bg-background/40 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-primary">
              {i + 1}. {STORY_KIND_LABEL[step.kind] ?? step.kind.replace(/_/g, " ")}
            </span>
            <span
              className={[
                "rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
                step.fromUser
                  ? "border-primary/40 text-primary"
                  : "border-muted-foreground/40 text-muted-foreground",
              ].join(" ")}
              title={step.fromUser ? "You directly said this" : "Wisdom inferred this"}
            >
              {step.fromUser ? "You said" : "Wisdom noticed"}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] text-foreground/90">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ContinueChips — populate the composer (never auto-submit). The
// caller is responsible for wiring `onSelect` to a state setter that
// focuses the composer textarea.
// ─────────────────────────────────────────────────────────────────────
export type ContinueChip = { id: string; label: string; prompt: string };

export function ContinueChips({
  chips,
  onSelect,
}: {
  chips: ContinueChip[];
  onSelect?: (chip: ContinueChip) => void;
}) {
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            data-testid={`wr-continue-${c.id}`}
            onClick={() => onSelect?.(c)}
            className="rounded-full border border-panel-border bg-background/60 px-3 py-1.5 text-[12px] text-foreground/85 transition hover:border-primary/40 hover:text-foreground"
          >
            {c.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

// Convenience: chips are pure derivations of canonical fields. If a
// field is missing, the chip is not added — no fabrication.
export function deriveContinueChips(opts: {
  nextQuestion?: string | null;
  distinguishingQuestion?: string;
  hasPattern: boolean;
  hasScripture: boolean;
}): ContinueChip[] {
  const chips: ContinueChip[] = [];
  if (opts.nextQuestion) {
    chips.push({
      id: "next",
      label: opts.nextQuestion.length > 60
        ? opts.nextQuestion.slice(0, 57) + "…"
        : opts.nextQuestion,
      prompt: opts.nextQuestion,
    });
  }
  if (opts.distinguishingQuestion) {
    chips.push({
      id: "distinguish",
      label: "Answer the distinguishing question",
      prompt: opts.distinguishingQuestion,
    });
  }
  if (opts.hasPattern) {
    chips.push({
      id: "missing",
      label: "Something here doesn't fit",
      prompt: "Something in your reading doesn't fit what I actually mean. Here's what I'd change: ",
    });
    chips.push({
      id: "examine",
      label: "Help me examine the pattern",
      prompt: "Help me examine the pattern you named more closely. What I'd look at: ",
    });
  }
  if (opts.hasScripture) {
    chips.push({
      id: "deeper",
      label: "Go deeper into the biblical lens",
      prompt: "Take me deeper into the biblical lens you used. Where does the comparison hold, and where does it stop?",
    });
  }
  chips.push({
    id: "afterwards",
    label: "Add what happened afterwards",
    prompt: "Here's what happened afterwards that you should know: ",
  });
  return chips;
}

// Utility: expose which sections actually contain data for the SectionNav.
// Caller passes booleans keyed by SectionId; we return the ordered list.
export function orderedPresentSections(
  present: Partial<Record<SectionId, boolean>>,
): SectionId[] {
  return SECTION_IDS.filter((id) => present[id]);
}

// Keep this import used elsewhere too; re-export for consumers.
export { TierChip };

// Small helper that memoizes ordered present sections.
export function usePresentSections(present: Partial<Record<SectionId, boolean>>) {
  return useMemo(() => orderedPresentSections(present), [
    present.orientation,
    present.heard,
    present.story,
    present.pattern,
    present.influences,
    present.scripture,
    present.discernment,
    present.practice,
    present.prayer,
    present.continue,
    present.history,
  ]);
}
