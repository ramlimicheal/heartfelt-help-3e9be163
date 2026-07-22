/**
 * Phase 3B — Curse Breaker safety filter.
 *
 * These tests protect the non-negotiables:
 *  1. Forbidden spiritual verdicts are stripped from contributing_influences.
 *  2. Trauma / physiological influences force needs_qualified_help = true
 *     AND inject a qualified_help_notes entry (not duplicated if present).
 *  3. Spiritual-concern rows without user evidence are dropped.
 *  4. pastoral_interpretations without a passage_id are dropped.
 *  5. `insufficient_evidence` becomes true when nothing survives.
 *  6. Every safety-filtered result is pinned to taxonomy_version = 2.
 *  7. Legacy v1 rows read through readCurseBreakerResult() are NEVER
 *     silently promoted to v2 verdicts.
 */
import { describe, it, expect } from "vitest";
import {
  enforceCurseBreakerSafety,
  readCurseBreakerResult,
  DEFAULT_TRAUMA_HELP_NOTE,
  DEFAULT_PHYSIOLOGICAL_HELP_NOTE,
} from "@/lib/wisdom/curseBreakerSafety";
import type { CurseBreakerResult } from "@/lib/wisdom/unified.schemas";

function baseResult(overrides: Partial<CurseBreakerResult> = {}): CurseBreakerResult {
  return {
    mode: "curse_breaker",
    taxonomy_version: 2,
    what_wisdom_heard: "",
    explicit_signals: [],
    inferred_signals: [],
    source_passages: [],
    uncertainty: "",
    user_facing_response: "ok",
    next_question: null,
    stronghold_category: "",
    event_chain: [],
    competing_hypotheses: [{ name: "h", description: "", confidence: 0.5, supporting_evidence: [], counter_evidence: [], missing_evidence: [] }],
    distinguishing_question: "",
    renunciations: [],
    prayer_draft: { title: "Prayer", lines: [{ movement: "blessing", text: "amen", citations: [] }] },
    primary_practice: { kind: "scripture_meditation", title: "p", rationale: "" },
    observed_pattern: { summary: "s", evidence_quotes: [] },
    contributing_influences: [],
    user_reported_spiritual_concern: [],
    pastoral_interpretations: [],
    insufficient_evidence: false,
    uncertainty_notes: [],
    next_faithful_action: { text: "" },
    qualified_help_notes: [],
    ...overrides,
  } as CurseBreakerResult;
}

describe("enforceCurseBreakerSafety", () => {
  it("pins taxonomy_version to 2", () => {
    const out = enforceCurseBreakerSafety(baseResult({ taxonomy_version: 2 }));
    expect(out.taxonomy_version).toBe(2);
  });

  it("strips forbidden verdict kinds from contributing_influences", () => {
    const out = enforceCurseBreakerSafety(
      baseResult({
        contributing_influences: [
          { id: "a", kind: "generational_curse" as never, label: "x", explanation: "", supporting_evidence: [], counter_evidence: [], uncertainty: "", needs_qualified_help: false },
          { id: "b", kind: "habit_or_choice", label: "y", explanation: "", supporting_evidence: [], counter_evidence: [], uncertainty: "", needs_qualified_help: false },
        ],
      }),
    );
    expect(out.contributing_influences.map((i) => i.kind)).toEqual(["habit_or_choice"]);
  });

  it("forces needs_qualified_help and injects help notes for trauma/physiology", () => {
    const out = enforceCurseBreakerSafety(
      baseResult({
        contributing_influences: [
          { id: "t", kind: "trauma_related", label: "t", explanation: "", supporting_evidence: [], counter_evidence: [], uncertainty: "", needs_qualified_help: false },
          { id: "p", kind: "physiological", label: "p", explanation: "", supporting_evidence: [], counter_evidence: [], uncertainty: "", needs_qualified_help: false },
        ],
        pastoral_interpretations: [
          { id: "i", summary: "s", biblical_lens: { passage_id: "11111111-1111-1111-1111-111111111111", derivation: "inferred", explanation: "", direct_vs_inferred: "inferred", descriptive_vs_prescriptive: "descriptive" }, supporting_evidence: [], counter_evidence: [], uncertainty: "" },
        ],
      }),
    );
    expect(out.contributing_influences.every((i) => i.needs_qualified_help)).toBe(true);
    expect(out.qualified_help_notes).toContain(DEFAULT_TRAUMA_HELP_NOTE);
    expect(out.qualified_help_notes).toContain(DEFAULT_PHYSIOLOGICAL_HELP_NOTE);
  });

  it("does not duplicate an existing trauma/physiology help note", () => {
    const custom = "Please talk to a licensed therapist before continuing.";
    const out = enforceCurseBreakerSafety(
      baseResult({
        qualified_help_notes: [custom],
        contributing_influences: [
          { id: "t", kind: "trauma_related", label: "t", explanation: "", supporting_evidence: [], counter_evidence: [], uncertainty: "", needs_qualified_help: false },
        ],
        pastoral_interpretations: [
          { id: "i", summary: "s", biblical_lens: { passage_id: "11111111-1111-1111-1111-111111111111", derivation: "inferred", explanation: "", direct_vs_inferred: "inferred", descriptive_vs_prescriptive: "descriptive" }, supporting_evidence: [], counter_evidence: [], uncertainty: "" },
        ],
      }),
    );
    expect(out.qualified_help_notes).toEqual([custom]);
  });

  it("drops spiritual-concern rows without user evidence", () => {
    const out = enforceCurseBreakerSafety(
      baseResult({
        user_reported_spiritual_concern: [
          { concern: "generational curse", evidence_from_user: "" },
          { concern: "hexed", evidence_from_user: "my grandmother told me before she died that the house was cursed" },
        ],
        pastoral_interpretations: [
          { id: "i", summary: "s", biblical_lens: { passage_id: "11111111-1111-1111-1111-111111111111", derivation: "inferred", explanation: "", direct_vs_inferred: "inferred", descriptive_vs_prescriptive: "descriptive" }, supporting_evidence: [], counter_evidence: [], uncertainty: "" },
        ],
      }),
    );
    expect(out.user_reported_spiritual_concern).toHaveLength(1);
    expect(out.user_reported_spiritual_concern[0].concern).toBe("hexed");
  });

  it("drops pastoral_interpretations that lack a passage_id", () => {
    const out = enforceCurseBreakerSafety(
      baseResult({
        pastoral_interpretations: [
          { id: "bad", summary: "s", biblical_lens: { passage_id: "", derivation: "inferred", explanation: "", direct_vs_inferred: "inferred", descriptive_vs_prescriptive: "descriptive" }, supporting_evidence: [], counter_evidence: [], uncertainty: "" },
          { id: "good", summary: "s", biblical_lens: { passage_id: "11111111-1111-1111-1111-111111111111", derivation: "inferred", explanation: "", direct_vs_inferred: "inferred", descriptive_vs_prescriptive: "descriptive" }, supporting_evidence: [], counter_evidence: [], uncertainty: "" },
        ],
        contributing_influences: [
          { id: "c", kind: "habit_or_choice", label: "c", explanation: "", supporting_evidence: [], counter_evidence: [], uncertainty: "", needs_qualified_help: false },
        ],
      }),
    );
    expect(out.pastoral_interpretations.map((i) => i.id)).toEqual(["good"]);
  });

  it("marks insufficient_evidence when nothing survives and empties interpretations", () => {
    const out = enforceCurseBreakerSafety(
      baseResult({
        contributing_influences: [],
        user_reported_spiritual_concern: [],
        pastoral_interpretations: [
          { id: "i", summary: "s", biblical_lens: { passage_id: "11111111-1111-1111-1111-111111111111", derivation: "inferred", explanation: "", direct_vs_inferred: "inferred", descriptive_vs_prescriptive: "descriptive" }, supporting_evidence: [], counter_evidence: [], uncertainty: "" },
        ],
      }),
    );
    expect(out.insufficient_evidence).toBe(true);
    expect(out.pastoral_interpretations).toEqual([]);
  });
});

describe("readCurseBreakerResult", () => {
  it("returns null for empty input", () => {
    expect(readCurseBreakerResult(null, null)).toBeNull();
    expect(readCurseBreakerResult(undefined, 2)).toBeNull();
  });

  it("returns the v2 result when taxonomy_version=2 on the row", () => {
    const raw = baseResult({ observed_pattern: { summary: "hi", evidence_quotes: [] } });
    const out = readCurseBreakerResult(raw, 2);
    expect(out && !out.isLegacy).toBe(true);
    if (out && !out.isLegacy) {
      expect(out.result.observed_pattern.summary).toBe("hi");
    }
  });

  it("treats missing taxonomy_version as v1 legacy — never promotes to v2", () => {
    const legacy = {
      mode: "curse_breaker",
      stronghold_category: "prideful ambition",
      competing_hypotheses: [{ name: "h", description: "d", confidence: 0.4 }],
      renunciations: ["I renounce X"],
      distinguishing_question: "what?",
      user_facing_response: "resp",
      what_wisdom_heard: "heard",
    };
    const out = readCurseBreakerResult(legacy, null);
    expect(out?.isLegacy).toBe(true);
    if (out?.isLegacy) {
      expect(out.categoryLabel).toBe("prideful ambition");
      expect(out.renunciations).toEqual(["I renounce X"]);
    }
  });
});
