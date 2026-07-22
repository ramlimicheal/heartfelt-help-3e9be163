/**
 * Phase 3B — Curse Breaker safety filter and legacy compatibility.
 *
 * Enforces at the code layer (not just the prompt) the rules founder
 * D3 and D4 approved:
 *
 *  - Wisdom NEVER automatically asserts biblical_curse, spiritual_attack,
 *    generational_sin, stronghold, or an equivalent verdict as a
 *    contributing influence. Any such item emitted by the model is stripped.
 *  - trauma_related and physiological contributing influences ALWAYS carry
 *    needs_qualified_help = true and MUST have a qualified_help_notes entry.
 *  - user_reported_spiritual_concern entries MUST carry user-origin
 *    evidence; ungrounded entries are dropped.
 *  - taxonomy_version is coerced to 2 on all new Curse Breaker results.
 *  - When nothing else remains, `insufficient_evidence` is set true so the
 *    renderer shows the honest empty state instead of a fabricated verdict.
 *
 * Pure function; no I/O. Safe to unit test.
 */
import {
  CB_CONTRIBUTING_KINDS,
  CB_FORBIDDEN_VERDICT_KINDS,
  CB_KINDS_REQUIRING_QUALIFIED_HELP,
  type CurseBreakerResult,
} from "./unified.schemas";

const FORBIDDEN = new Set<string>(CB_FORBIDDEN_VERDICT_KINDS);
const QUALIFIED_HELP_NEEDED = new Set<string>(CB_KINDS_REQUIRING_QUALIFIED_HELP);
const KIND_SET = new Set<string>(CB_CONTRIBUTING_KINDS);

export const DEFAULT_TRAUMA_HELP_NOTE =
  "Trauma-related patterns are best walked through with a licensed mental-health professional alongside a trusted pastor. Wisdom cannot replace that care.";
export const DEFAULT_PHYSIOLOGICAL_HELP_NOTE =
  "Physiological factors belong with qualified medical guidance. Please consult a doctor; Wisdom is not a substitute for medical care.";

export function enforceCurseBreakerSafety(result: CurseBreakerResult): CurseBreakerResult {
  const out: CurseBreakerResult = { ...result, taxonomy_version: 2 };

  // 1. Strip forbidden verdicts from contributing influences.
  const cleanedInfluences = (out.contributing_influences ?? [])
    .filter((inf) => {
      if (FORBIDDEN.has(inf.kind as string)) return false;
      if (!KIND_SET.has(inf.kind as string)) return false;
      return true;
    })
    .map((inf) => {
      if (QUALIFIED_HELP_NEEDED.has(inf.kind)) {
        return { ...inf, needs_qualified_help: true };
      }
      return inf;
    });

  // 2. Ensure qualified-help notes exist whenever trauma/physiology surface.
  const helpNotes = [...(out.qualified_help_notes ?? [])];
  const hasTrauma = cleanedInfluences.some((i) => i.kind === "trauma_related");
  const hasPhys = cleanedInfluences.some((i) => i.kind === "physiological");
  if (hasTrauma && !helpNotes.some((n) => /trauma|therap|counsel|mental[- ]?health/i.test(n))) {
    helpNotes.push(DEFAULT_TRAUMA_HELP_NOTE);
  }
  if (hasPhys && !helpNotes.some((n) => /medic|doctor|physician|health\b/i.test(n))) {
    helpNotes.push(DEFAULT_PHYSIOLOGICAL_HELP_NOTE);
  }

  // 3. User-reported spiritual concern MUST have user-origin evidence.
  //    An entry whose evidence_from_user is empty is Wisdom-invented — drop it.
  const concerns = (out.user_reported_spiritual_concern ?? [])
    .filter((c) => typeof c.evidence_from_user === "string" && c.evidence_from_user.trim().length >= 3)
    .filter((c) => typeof c.concern === "string" && c.concern.trim().length >= 1);

  // 4. Pastoral interpretations: keep only those with a biblical_lens.passage_id.
  //    (Grounding validation upstream already pruned fabricated ids from the
  //    citation pool; here we ensure the lens field survived that.)
  const interps = (out.pastoral_interpretations ?? []).filter(
    (i) => typeof i.biblical_lens?.passage_id === "string" && i.biblical_lens.passage_id.length > 0,
  );

  // 5. If the model produced no honest layered content, mark insufficient.
  const anyContent =
    cleanedInfluences.length > 0 || interps.length > 0 || concerns.length > 0;
  const insufficient = anyContent ? Boolean(out.insufficient_evidence) : true;

  return {
    ...out,
    contributing_influences: cleanedInfluences,
    qualified_help_notes: helpNotes,
    user_reported_spiritual_concern: concerns,
    pastoral_interpretations: insufficient ? [] : interps,
    insufficient_evidence: insufficient,
  };
}

// ─── Legacy v1 compatibility ────────────────────────────────────────
//
// A v1 Curse Breaker turn stored only a flat `stronghold_category` string
// plus competing_hypotheses/renunciations. We RENDER it honestly through a
// compatibility adapter — we do NOT silently reinterpret its category as a
// v2 verdict.

export type LegacyCurseBreakerReading = {
  isLegacy: true;
  categoryLabel: string;      // shown as "Previously stored category" (no verdict framing)
  competingHypotheses: Array<{ name: string; description: string; confidence: number }>;
  renunciations: string[];
  distinguishingQuestion: string;
  userFacingResponse: string;
  whatWisdomHeard: string;
  prayerDraft: CurseBreakerResult["prayer_draft"] | null;
  primaryPractice: CurseBreakerResult["primary_practice"] | null;
};

export type ReadCurseBreakerResult =
  | { isLegacy: false; result: CurseBreakerResult }
  | LegacyCurseBreakerReading;

export function readCurseBreakerResult(
  raw: unknown,
  turnTaxonomyVersion: number | null | undefined,
): ReadCurseBreakerResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  // Detect v2: either taxonomy_version === 2 on the row OR the JSON itself
  // carries taxonomy_version === 2.
  const isV2 =
    turnTaxonomyVersion === 2 ||
    (typeof r.taxonomy_version === "number" && r.taxonomy_version >= 2);

  if (isV2) {
    return { isLegacy: false, result: raw as CurseBreakerResult };
  }

  return {
    isLegacy: true,
    categoryLabel: typeof r.stronghold_category === "string" ? r.stronghold_category : "",
    competingHypotheses: Array.isArray(r.competing_hypotheses)
      ? (r.competing_hypotheses as Array<{ name: string; description: string; confidence: number }>)
      : [],
    renunciations: Array.isArray(r.renunciations) ? (r.renunciations as string[]) : [],
    distinguishingQuestion: typeof r.distinguishing_question === "string" ? r.distinguishing_question : "",
    userFacingResponse: typeof r.user_facing_response === "string" ? r.user_facing_response : "",
    whatWisdomHeard: typeof r.what_wisdom_heard === "string" ? r.what_wisdom_heard : "",
    prayerDraft: (r.prayer_draft as CurseBreakerResult["prayer_draft"] | undefined) ?? null,
    primaryPractice: (r.primary_practice as CurseBreakerResult["primary_practice"] | undefined) ?? null,
  };
}
