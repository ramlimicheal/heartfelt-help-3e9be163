/**
 * Unified Wisdom Turn contracts — v2 (beta-loosened).
 *
 * Design notes:
 * - Every string min was raised from 1 to 0-tolerant via `.default('')` on
 *   optional-narrative fields, and hard `min(1)` kept only where the field
 *   is semantically required (user_facing_response, mode, passage_id).
 * - Array mins relaxed: hypotheses min 1, prayer lines min 1, citations
 *   min 0 (grounding-validator strips fabricated ids gracefully).
 * - Length caps kept as safety net.
 */
import { z } from "zod";
import { zPrayerMovement } from "./pipeline.schemas";

// ── Shared primitives ────────────────────────────────────────────────
const zConfidence = z.preprocess((value) => {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0.5;
  const normalized = number > 1 && number <= 100 ? number / 100 : number;
  return Math.min(1, Math.max(0, normalized));
}, z.number().min(0).max(1));
const zTextArray = z.preprocess(
  (value) => Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)).slice(0, 400))
    : value,
  z.array(z.string().max(400)).max(12).default([]),
);
const prayerMovementValues = zPrayerMovement.options;

export const zSharedSignal = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return {
    ...record,
    kind: record.kind ?? record.type ?? "observation",
    paraphrase: record.paraphrase ?? record.text ?? record.summary ?? "",
  };
}, z.object({
  kind: z.string().min(1).max(80).default("observation"),
  paraphrase: z.string().max(600).default(""),
  confidence: zConfidence.default(0.5),
}));

export const zSourcePassageRef = z.object({
  passage_id: z.string().uuid(),
  reference: z.string().min(1).max(160),
  translation: z.string().min(1).max(40).default("WEB"),
  canon_profile: z.string().min(1).max(80).default("protestant_66"),
  source_tier: z.enum(["S1","S2","S3","S4","S5","S6","S7","S8"]).default("S1"),
  text: z.string().min(1).max(6000),
});

export const zCitation = z.object({
  passage_id: z.string().uuid(),
  derivation: z.enum(["direct", "inferred", "pattern_matched"]).default("direct"),
  explanation: z.string().max(800).default(""),
  contextual_limit: z.string().max(800).optional(),
});

export const zBiblicalMirror = z.object({
  passage_id: z.string().uuid(),
  derivation: z.enum(["direct", "inferred", "pattern_matched"]).default("direct"),
  direct_vs_inferred: z.enum(["direct", "inferred"]).default("direct"),
  descriptive_vs_prescriptive: z.enum(["descriptive", "prescriptive"]).default("descriptive"),
  explanation: z.string().max(800).default(""),
  contextual_limit: z.string().max(800).optional(),
});

export const zSharedResultBase = z.object({
  what_wisdom_heard: z.string().max(2000).default(""),
  explicit_signals: z.array(zSharedSignal).max(30).default([]),
  inferred_signals: z.array(zSharedSignal).max(30).default([]),
  source_passages: z.array(zSourcePassageRef).max(32).default([]),
  uncertainty: z.string().max(1200).default(""),
  user_facing_response: z.string().min(1).max(6000),
  next_question: z.string().max(600).nullable().default(null),
});

// ── Companion ────────────────────────────────────────────────────────
export const zCompanionResult = zSharedResultBase.extend({
  mode: z.literal("companion"),
  reflection: z.string().max(2000).default(""),
  biblical_mirror: zBiblicalMirror,
});
export type CompanionResult = z.infer<typeof zCompanionResult>;

// ── Pattern ──────────────────────────────────────────────────────────
const eventKinds = [
  "context","trigger","interpretation","need","choice",
  "immediate_reward","cost","afterthought","re_entry",
] as const;

export const zEventChainLink = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const rawKind = String(record.kind ?? record.type ?? "context");
  const kind = eventKinds.includes(rawKind as typeof eventKinds[number]) ? rawKind : "context";
  return {
    ...record,
    kind,
    text: record.text ?? record.description ?? record.summary ?? "",
    fromUser: record.fromUser ?? record.from_user ?? true,
  };
}, z.object({
  kind: z.enum(eventKinds).default("context"),
  text: z.string().max(600).default(""),
  fromUser: z.boolean().default(true),
}));

export const zHypothesis = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return {
    ...record,
    name: record.name ?? record.label ?? record.title ?? "Working hypothesis",
    description: record.description ?? record.text ?? record.summary ?? "",
    supporting_evidence: record.supporting_evidence ?? record.supportingEvidence ?? record.evidence ?? [],
    counter_evidence: record.counter_evidence ?? record.counterEvidence ?? [],
    missing_evidence: record.missing_evidence ?? record.missingEvidence ?? [],
  };
}, z.object({
  name: z.string().min(1).max(200).default("Working hypothesis"),
  description: z.string().max(1200).default(""),
  confidence: zConfidence.default(0.5),
  supporting_evidence: zTextArray,
  counter_evidence: zTextArray,
  missing_evidence: zTextArray,
}));

export const zPrayerLine = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const raw = String(record.movement ?? record.type ?? "blessing").toLowerCase();
  const movement = prayerMovementValues.includes(raw as typeof prayerMovementValues[number])
    ? raw
    : raw.includes("confess") ? "confession"
    : raw.includes("renounc") ? "renunciation"
    : raw.includes("forgiv") ? "forgiveness"
    : raw.includes("deliver") ? "deliverance"
    : raw.includes("heal") ? "healing"
    : raw.includes("thank") ? "thanksgiving"
    : raw.includes("commission") ? "commissioning"
    : "blessing";
  return {
    ...record,
    movement,
    text: record.text ?? record.line ?? "",
    citations: record.citations ?? (record.passage_id ? [{
      passage_id: record.passage_id,
      derivation: "inferred",
      explanation: record.derivation ?? record.explanation ?? "Applied to this prayer line.",
    }] : []),
  };
}, z.object({
  movement: zPrayerMovement,
  text: z.string().min(1).max(600),
  citations: z.array(zCitation).max(6).default([]),
}));

export const zPrayerDraft = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return {
    ...record,
    title: record.title ?? record.name ?? "Prayer draft",
    lines: record.lines ?? record.prayer_lines ?? record.movements ?? [],
  };
}, z.object({
  title: z.string().min(1).max(200).default("Prayer draft"),
  lines: z.array(zPrayerLine).min(1).max(8),
}));

const practiceKinds = [
  "boundary","confession","forgiveness","restitution","reconciliation",
  "silence","scripture_meditation","journaling","accountability",
  "environmental_change","service","waiting","gratitude","fasting_reflection",
] as const;

export const zPrimaryPractice = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const raw = String(record.kind ?? record.type ?? "scripture_meditation").toLowerCase();
  return {
    ...record,
    kind: practiceKinds.includes(raw as typeof practiceKinds[number]) ? raw : "scripture_meditation",
    title: record.title ?? record.name ?? "A small faithful practice",
  };
}, z.object({
  kind: z.enum([
    "boundary","confession","forgiveness","restitution","reconciliation",
    "silence","scripture_meditation","journaling","accountability",
    "environmental_change","service","waiting","gratitude","fasting_reflection",
  ]),
  title: z.string().min(1).max(200),
  rationale: z.string().max(800).default(""),
}));

export const zPatternResult = zSharedResultBase.extend({
  mode: z.literal("pattern"),
  event_chain: z.array(zEventChainLink).max(24).default([]),
  competing_hypotheses: z.array(zHypothesis).min(1).max(4),
  distinguishing_question: z.string().max(600).default(""),
  proposed_pattern_eligible: z.boolean().default(false),
  proposed_pattern: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(800).default(""),
    confidence: z.number().min(0).max(1).default(0.5),
  }).nullable().default(null),
  prayer_draft: zPrayerDraft,
  primary_practice: zPrimaryPractice,
});
export type PatternResult = z.infer<typeof zPatternResult>;

// ── Deep Wisdom ──────────────────────────────────────────────────────
const explanationFrames = ["ordinary","relational","situational","embodied","spiritual"] as const;

export const zCompetingExplanation = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const raw = String(record.frame ?? record.kind ?? record.type ?? "ordinary").toLowerCase();
  return {
    ...record,
    frame: explanationFrames.includes(raw as typeof explanationFrames[number]) ? raw : "ordinary",
    text: record.text ?? record.description ?? record.summary ?? "",
  };
}, z.object({
  frame: z.enum(["ordinary","relational","situational","embodied","spiritual"]),
  text: z.string().min(1).max(800),
}));

export const zProposedPersonaFact = z.object({
  category: z.string().min(1).max(80),
  text: z.string().min(1).max(600),
  status: z.literal("proposed").default("proposed"),
  sensitivity: z.enum(["normal","sensitive","hidden"]).default("normal"),
});

export const zDeepWisdomResult = zSharedResultBase.extend({
  mode: z.literal("deep_wisdom"),
  event_chain: z.array(zEventChainLink).max(24).default([]),
  hypothesis_under_test: zHypothesis,
  competing_explanations: z.array(zCompetingExplanation).min(1).max(8).default([]),
  biblical_mirrors: z.array(zBiblicalMirror).max(8).default([]),
  counter_evidence: z.array(z.string().max(600)).max(12).default([]),
  contextual_limits: z.array(z.string().max(600)).max(8).default([]),
  prayer_lineage_draft: zPrayerDraft,
  primary_practice: zPrimaryPractice,
  proposed_persona_facts: z.array(zProposedPersonaFact).max(8).default([]),
});
export type DeepWisdomResult = z.infer<typeof zDeepWisdomResult>;

export const zUnifiedResult = z.discriminatedUnion("mode", [
  zCompanionResult,
  zPatternResult,
  zDeepWisdomResult,
]);
export type UnifiedResult = z.infer<typeof zUnifiedResult>;

export type UnifiedMode = "companion" | "pattern" | "deep_wisdom";
