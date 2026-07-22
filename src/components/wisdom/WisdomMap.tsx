/**
 * WisdomMap — right-rail contextual summary of the LATEST completed turn.
 *
 * Design rules (see workspace prompt):
 *  - Never duplicates the full response. Concise summaries + "View in response".
 *  - Reads only fields present on the UnifiedResult. No fabrication.
 *  - Streaming/empty/partial states honestly rendered.
 *  - Clicking an item scrolls the corresponding <section data-section=".."/>
 *    inside the passed responseRoot, respecting reduced-motion.
 *  - Not a chart or analytics dashboard — quiet, three-layer, restrained.
 */
import { useCallback, useMemo } from "react";
import { ArrowRight, Compass, Feather, ScrollText } from "lucide-react";
import type { UnifiedResult } from "@/lib/wisdom/unified.schemas";
import type { SectionId } from "@/components/wisdom/response/primitives";

export type WisdomMapMode = "empty" | "streaming" | "ready";

type Item = {
  id: string;
  label: string;
  summary?: string;
  targetSection?: SectionId;
  state?: "new" | "revised" | "unresolved" | "practiced" | "finalized" | "ready" | "draft";
};

type Layer = {
  id: "understand" | "discern" | "respond";
  label: string;
  caption: string;
  Icon: typeof Compass;
  items: Item[];
};

function truncate(s: string | undefined, n = 140): string | undefined {
  if (!s) return undefined;
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= n) return clean;
  return clean.slice(0, n - 1).trimEnd() + "…";
}

function deriveLayers(result: UnifiedResult): Layer[] {
  const understand: Item[] = [];
  const discern: Item[] = [];
  const respond: Item[] = [];

  // ── UNDERSTAND ─────────────────────────────────────────────────
  const heard = result.what_wisdom_heard || result.user_facing_response;
  if (heard) {
    understand.push({
      id: "heard",
      label: "What I'm hearing",
      summary: truncate(heard, 160),
      targetSection: "heard",
      state: "new",
    });
  }

  const eventChain =
    (result as { event_chain?: Array<{ text: string }> }).event_chain ?? [];
  if (eventChain.length > 0) {
    understand.push({
      id: "story",
      label: "The movement",
      summary: `${eventChain.length} step${eventChain.length === 1 ? "" : "s"} traced from what you shared.`,
      targetSection: "story",
    });
  }

  if (result.mode === "pattern") {
    const p = (result as { proposed_pattern?: { title?: string; description?: string } | null }).proposed_pattern;
    if (p?.title) {
      understand.push({
        id: "pattern",
        label: "Pattern under consideration",
        summary: truncate(p.description || p.title, 140),
        targetSection: "pattern",
        state: "new",
      });
    }
  } else if (result.mode === "deep_wisdom") {
    const h = (result as { hypothesis_under_test?: { name?: string; description?: string } }).hypothesis_under_test;
    if (h?.name) {
      understand.push({
        id: "pattern",
        label: "Hypothesis under test",
        summary: truncate(h.description || h.name, 140),
        targetSection: "pattern",
      });
    }
  } else if (result.mode === "curse_breaker") {
    const observed = (result as { observed_pattern?: { summary?: string } }).observed_pattern;
    if (observed?.summary) {
      understand.push({
        id: "pattern",
        label: "Observed pattern",
        summary: truncate(observed.summary, 160),
        targetSection: "pattern",
      });
    }
  }

  const explicit = result.explicit_signals?.length ?? 0;
  const inferred = result.inferred_signals?.length ?? 0;
  if (explicit + inferred > 0) {
    const parts: string[] = [];
    if (explicit > 0) parts.push(`${explicit} you said`);
    if (inferred > 0) parts.push(`${inferred} inferred`);
    understand.push({
      id: "signals",
      label: "Evidence noted",
      summary: parts.join(" · "),
      targetSection: "discernment",
    });
  }

  // ── DISCERN ────────────────────────────────────────────────────
  if (result.mode === "pattern") {
    const h = (result as { competing_hypotheses?: Array<{ name: string }> }).competing_hypotheses ?? [];
    if (h.length > 0) {
      discern.push({
        id: "hypotheses",
        label: "Possible explanations",
        summary: `${h.length} weighed: ${h.slice(0, 2).map((x) => x.name).join(", ")}${h.length > 2 ? "…" : ""}`,
        targetSection: "pattern",
      });
    }
  } else if (result.mode === "deep_wisdom") {
    const c = (result as { competing_explanations?: Array<{ frame: string }> }).competing_explanations ?? [];
    if (c.length > 0) {
      discern.push({
        id: "hypotheses",
        label: "Possible explanations",
        summary: `${c.length} frames considered.`,
        targetSection: "influences",
      });
    }
  } else if (result.mode === "curse_breaker") {
    const inf = (result as { contributing_influences?: Array<{ label: string }> }).contributing_influences ?? [];
    if (inf.length > 0) {
      discern.push({
        id: "influences",
        label: "What may be contributing",
        summary: `${inf.length} influence${inf.length === 1 ? "" : "s"} weighed.`,
        targetSection: "influences",
      });
    }
    const pastoral = (result as { pastoral_interpretations?: Array<{ summary: string }> }).pastoral_interpretations ?? [];
    if (pastoral.length > 0) {
      discern.push({
        id: "pastoral",
        label: "Pastoral interpretations",
        summary: `${pastoral.length} held as revisable.`,
        targetSection: "pattern",
      });
    }
  }

  const passages = result.source_passages?.length ?? 0;
  if (passages > 0) {
    // If there's a generated mirror/citation-side commentary, call it "Biblical mirror".
    // Otherwise only source passages exist — call it "Scripture grounding".
    const hasMirror =
      (result.mode === "companion" && Boolean((result as { biblical_mirror?: { explanation?: string } }).biblical_mirror?.explanation)) ||
      (result.mode === "deep_wisdom" && ((result as { biblical_mirrors?: unknown[] }).biblical_mirrors?.length ?? 0) > 0);
    discern.push({
      id: "scripture",
      label: hasMirror ? "Biblical mirror" : "Scripture grounding",
      summary: `${passages} passage${passages === 1 ? "" : "s"} cited.`,
      targetSection: "scripture",
    });
  }

  if (result.uncertainty && result.uncertainty.trim().length > 0) {
    discern.push({
      id: "uncertainty",
      label: "Still open",
      summary: truncate(result.uncertainty, 160),
      targetSection: "discernment",
      state: "unresolved",
    });
  }

  if (result.mode === "curse_breaker") {
    const qh = (result as { qualified_help_notes?: string[] }).qualified_help_notes ?? [];
    if (qh.length > 0) {
      discern.push({
        id: "qualified-help",
        label: "Qualified help suggested",
        summary: truncate(qh[0], 140),
        targetSection: "discernment",
      });
    }
  }

  // ── RESPOND ────────────────────────────────────────────────────
  const practice =
    (result as { primary_practice?: { title?: string; rationale?: string } }).primary_practice;
  if (practice?.title) {
    respond.push({
      id: "practice",
      label: "One faithful practice",
      summary: truncate(practice.rationale || practice.title, 160),
      targetSection: "practice",
    });
  }

  if (result.mode === "curse_breaker") {
    const nfa = (result as { next_faithful_action?: { text?: string } }).next_faithful_action;
    if (nfa?.text) {
      respond.push({
        id: "next-action",
        label: "Next faithful action",
        summary: truncate(nfa.text, 160),
        targetSection: "practice",
      });
    }
  }

  const prayer =
    result.mode === "deep_wisdom"
      ? (result as { prayer_lineage_draft?: { lines?: unknown[] } }).prayer_lineage_draft
      : (result as { prayer_draft?: { lines?: unknown[] } }).prayer_draft;
  const prayerLines = prayer?.lines?.length ?? 0;
  if (prayerLines > 0) {
    respond.push({
      id: "prayer",
      label: "Prayer from this discernment",
      summary: `${prayerLines} movement${prayerLines === 1 ? "" : "s"} drafted.`,
      targetSection: "prayer",
      state: "draft",
    });
  }

  if (result.next_question) {
    respond.push({
      id: "next-question",
      label: "One continuation",
      summary: truncate(result.next_question, 140),
      targetSection: "continue",
    });
  }

  return [
    { id: "understand", label: "Understand", caption: "What Wisdom is hearing.", Icon: Compass, items: understand },
    { id: "discern", label: "Discern", caption: "What may be true, and what remains open.", Icon: ScrollText, items: discern },
    { id: "respond", label: "Respond", caption: "Where you can respond in faith.", Icon: Feather, items: respond },
  ];
}

export function WisdomMap({
  result,
  mode,
  streamingStage,
  responseRoot,
  onClose,
  compact = false,
}: {
  result?: UnifiedResult;
  mode: WisdomMapMode;
  /** Optional stage label for streaming state (e.g. "Grounding in Scripture"). */
  streamingStage?: string;
  /** Root element of the latest response, used to scope section scrolling. */
  responseRoot?: HTMLElement | null;
  /** Called after a map item is activated on mobile (to close the sheet). */
  onClose?: () => void;
  compact?: boolean;
}) {
  const layers = useMemo<Layer[] | null>(
    () => (mode === "ready" && result ? deriveLayers(result) : null),
    [result, mode],
  );

  const scrollTo = useCallback(
    (section: SectionId | undefined) => {
      if (!section) return;
      const scope = responseRoot ?? (typeof document !== "undefined" ? document : null);
      if (!scope) return;
      // Prefer the last matching section (latest turn) if scoping to document.
      const candidates = Array.from(
        (scope as ParentNode).querySelectorAll(`[data-section="${section}"]`),
      ) as HTMLElement[];
      const el = candidates.length > 0 ? candidates[candidates.length - 1] : null;
      if (!el) return;
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      // Move focus onto the section heading for keyboard users, without changing tab order.
      const heading = el.querySelector<HTMLElement>(`#wr-${section}-heading`);
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
      onClose?.();
    },
    [responseRoot, onClose],
  );

  return (
    <aside
      aria-label="Wisdom Map"
      data-testid="wisdom-map"
      className={[
        "flex h-full min-h-0 flex-col gap-3 text-[13px]",
        compact ? "" : "px-1",
      ].join(" ")}
    >
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
            Wisdom Map
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
            The current understanding — a navigational summary, not a verdict.
          </p>
        </div>
      </header>

      {mode === "empty" && (
        <div className="rounded-2xl border border-dashed border-panel-border/70 bg-surface/30 p-4 text-[12px] leading-relaxed text-muted-foreground">
          The map will fill in as Wisdom listens — what it's hearing, what may
          be underneath, and where you can respond. Nothing appears here until
          you've shared something real.
        </div>
      )}

      {mode === "streaming" && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-panel-border/70 bg-surface/40 p-4 text-[12px] leading-relaxed text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block size-1.5 animate-pulse rounded-full bg-primary"
              aria-hidden
            />
            <span className="text-foreground/80">
              {streamingStage ?? "Listening"}
            </span>
          </div>
          <ul className="mt-3 space-y-1 text-[11.5px]">
            {[
              "Listening",
              "Tracing the movement",
              "Looking for patterns",
              "Grounding in Scripture",
              "Forming practice and prayer",
            ].map((s) => (
              <li key={s} className="flex items-center gap-2 text-muted-foreground/80">
                <span
                  className="inline-block size-1 rounded-full bg-muted-foreground/40"
                  aria-hidden
                />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === "ready" && layers && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {layers.map((layer) => (
            <MapLayer key={layer.id} layer={layer} onActivate={scrollTo} />
          ))}
        </div>
      )}
    </aside>
  );
}

function MapLayer({
  layer,
  onActivate,
}: {
  layer: Layer;
  onActivate: (section: SectionId | undefined) => void;
}) {
  const { Icon } = layer;
  const isEmpty = layer.items.length === 0;
  return (
    <section
      aria-label={layer.label}
      data-map-layer={layer.id}
      className="rounded-2xl border border-panel-border/70 bg-surface/40 p-3.5"
    >
      <header className="mb-2 flex items-start gap-2">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
          <Icon className="size-3.5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-foreground/80">
            {layer.label}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {layer.caption}
          </p>
        </div>
      </header>

      {isEmpty ? (
        <p className="px-1 text-[11.5px] text-muted-foreground/70">
          Nothing supported yet in this layer.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {layer.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onActivate(item.targetSection)}
                disabled={!item.targetSection}
                className="group flex w-full items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition hover:border-panel-border hover:bg-background/60 disabled:cursor-default disabled:opacity-70"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-medium text-foreground/90">
                      {item.label}
                    </span>
                    {item.state && (
                      <span
                        className="rounded-full border border-panel-border/60 px-1.5 py-[1px] text-[9px] uppercase tracking-wider text-muted-foreground"
                        aria-label={`Status: ${item.state}`}
                      >
                        {item.state}
                      </span>
                    )}
                  </div>
                  {item.summary && (
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">
                      {item.summary}
                    </p>
                  )}
                </div>
                {item.targetSection && (
                  <ArrowRight
                    className="mt-1 size-3 shrink-0 text-muted-foreground/60 transition group-hover:text-primary"
                    aria-hidden
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
