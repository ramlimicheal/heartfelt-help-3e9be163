/**
 * Checkpoint 3A — Unified Wisdom Turn contracts.
 *
 * One validated structured object per turn drives BOTH the visible answer
 * and the persisted artifacts. Pattern and Deep Wisdom use distinct
 * contracts and cannot be substituted for each other.
 */
import { z } from "zod";
import { zPrayerMovement } from "./pipeline.schemas";

// ── Shared primitives ────────────────────────────────────────────────
export const zSharedSignal = z.object({
  kind: z.string().min(1).max(60),
  paraphrase: z.string().min(1).max(400),
  confidence: z.number().min(0).max(1),
});

export const zSourcePassageRef = z.object({
  passage_id: z.string().uuid(),
  reference: z.string().min(1).max(120),
  translation: z.string().min(1).max(40),
  canon_profile: z.string().min(1).max(80),
  source_tier: z.enum(["S1","S2","S3","S4","S5","S6","S7","S8"]),
  text: z.string().min(1).max(4000),
});

export const zCitation = z.object({
  passage_id: z.string().uuid(),
  derivation: z.enum(["direct", "inferred", "pattern_matched"]),
  explanation: z.string().min(1).max(600),
  // Required when derivation === "pattern_matched" (server-validated).
  contextual_limit: z.string().max(600).optional(),
});

export const zBiblicalMirror = z.object({
  passage_id: z.string().uuid(),
  derivation: z.enum(["direct", "inferred", "pattern_matched"]),
  direct_vs_inferred: z.enum(["direct", "inferred"]),
  descriptive_vs_prescriptive: z.enum(["descriptive", "prescriptive"]),
  explanation: z.string().min(1).max(600),
  contextual_limit: z.string().max(600).optional(),
});

export const zSharedResultBase = z.object({
  what_wisdom_heard: z.string().min(1).max(1200),
  explicit_signals: z.array(zSharedSignal).max(20),
  inferred_signals: z.array(zSharedSignal).max(20),
  source_passages: z.array(zSourcePassageRef).max(24),
  uncertainty: z.string().max(600),
  user_facing_response: z.string().min(1).max(4000),
  next_question: z.string().min(1).max(400).nullable(),
});

// ── Companion ────────────────────────────────────────────────────────
export const zCompanionResult = zSharedResultBase.extend({
  mode: z.literal("companion"),
  reflection: z.string().min(1).max(1200),
  biblical_mirror: zBiblicalMirror,
});
export type CompanionResult = z.infer<typeof zCompanionResult>;

// ── Pattern ──────────────────────────────────────────────────────────
export const zEventChainLink = z.object({
  kind: z.enum([
    "context","trigger","interpretation","need","choice",
    "immediate_reward","cost","afterthought","re_entry",
  ]),
  text: z.string().min(1).max(400),
  fromUser: z.boolean(),
});

export const zHypothesis = z.object({
  name: z.string().min(1).max(140),
  description: z.string().min(1).max(800),
  confidence: z.number().min(0).max(1),
  supporting_evidence: z.array(z.string().max(300)).max(8),
  counter_evidence: z.array(z.string().max(300)).max(8),
  missing_evidence: z.array(z.string().max(300)).max(8),
});

export const zPrayerLine = z.object({
  movement: zPrayerMovement,
  text: z.string().min(1).max(400),
  citations: z.array(zCitation).min(1).max(4),
});

export const zPrayerDraft = z.object({
  title: z.string().min(1).max(140),
  lines: z.array(zPrayerLine).min(3).max(6),
});

export const zPrimaryPractice = z.object({
  kind: z.enum([
    "boundary","confession","forgiveness","restitution","reconciliation",
    "silence","scripture_meditation","journaling","accountability",
    "environmental_change","service","waiting","gratitude","fasting_reflection",
  ]),
  title: z.string().min(1).max(140),
  rationale: z.string().min(1).max(600),
});

export const zPatternResult = zSharedResultBase.extend({
  mode: z.literal("pattern"),
  event_chain: z.array(zEventChainLink).min(1).max(20),
  competing_hypotheses: z.array(zHypothesis).min(2).max(3),
  distinguishing_question: z.string().min(1).max(400),
  proposed_pattern_eligible: z.boolean(),
  proposed_pattern: z.object({
    title: z.string().min(1).max(160),
    description: z.string().min(1).max(600),
    confidence: z.number().min(0).max(1),
  }).nullable(),
  prayer_draft: zPrayerDraft,
  primary_practice: zPrimaryPractice,
});
export type PatternResult = z.infer<typeof zPatternResult>;

// ── Deep Wisdom ──────────────────────────────────────────────────────
export const zCompetingExplanation = z.object({
  frame: z.enum(["ordinary","relational","situational","embodied","spiritual"]),
  text: z.string().min(1).max(600),
});

export const zProposedPersonaFact = z.object({
  category: z.string().min(1).max(60),
  text: z.string().min(1).max(400),
  status: z.literal("proposed"), // Deep Wisdom NEVER auto-accepts persona facts
  sensitivity: z.enum(["normal","sensitive","hidden"]),
});

export const zDeepWisdomResult = zSharedResultBase.extend({
  mode: z.literal("deep_wisdom"),
  event_chain: z.array(zEventChainLink).min(1).max(20),
  hypothesis_under_test: zHypothesis,
  competing_explanations: z.array(zCompetingExplanation).min(3).max(8),
  biblical_mirrors: z.array(zBiblicalMirror).min(1).max(6),
  counter_evidence: z.array(z.string().max(400)).max(8),
  contextual_limits: z.array(z.string().max(400)).max(6),
  prayer_lineage_draft: zPrayerDraft,
  primary_practice: zPrimaryPractice,
  proposed_persona_facts: z.array(zProposedPersonaFact).max(6),
});
export type DeepWisdomResult = z.infer<typeof zDeepWisdomResult>;

// ── Discriminated union ──────────────────────────────────────────────
export const zUnifiedResult = z.discriminatedUnion("mode", [
  zCompanionResult,
  zPatternResult,
  zDeepWisdomResult,
]);
export type UnifiedResult = z.infer<typeof zUnifiedResult>;

export type UnifiedMode = "companion" | "pattern" | "deep_wisdom";
