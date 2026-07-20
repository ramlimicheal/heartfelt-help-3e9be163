/**
 * Wisdom pipeline — shared Zod contracts (client-safe).
 * Server functions in pipeline.functions.ts / curseBreaker.functions.ts
 * validate model output against these schemas.
 */
import { z } from "zod";

export const zSignal = z.object({
  kind: z.enum([
    "person","event","emotion","belief","desire","fear","environment",
    "repeated_phrase","spiritual_interpretation","previous_effort","outcome","question",
  ]),
  paraphrase: z.string().min(1).max(400),
  explicit: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export const zEventChainLink = z.object({
  kind: z.enum([
    "context","trigger","interpretation","need","choice",
    "immediate_reward","cost","afterthought","re_entry",
  ]),
  text: z.string().min(1).max(400),
  fromUser: z.boolean(),
});

export const zExtractionResult = z.object({
  signals: z.array(zSignal).max(30),
  event_chain: z.array(zEventChainLink).max(20),
});
export type ExtractionResult = z.infer<typeof zExtractionResult>;

// Matches DB enum public.prayer_movement (Batch 2).
export const zPrayerMovement = z.enum([
  "adoration","confession","renunciation","forgiveness","deliverance",
  "healing","blessing","commissioning","thanksgiving",
]);

export const zComposition = z.object({
  whatIHear: z.string().min(1).max(1200),
  hypothesis: z.object({
    name: z.string().min(1).max(140),
    description: z.string().min(1).max(600),
    confidence: z.number().min(0).max(1),
    distinguishingQuestion: z.string().min(1).max(280),
  }),
  discernment: z.object({
    contextNote: z.string().max(600),
    directVsInferred: z.string().max(600),
    descriptiveVsPrescriptive: z.string().max(600),
    counterEvidence: z.array(z.string().max(300)).max(6),
  }),
  prayer: z.object({
    title: z.string().min(1).max(120),
    lines: z.array(z.object({
      movement: zPrayerMovement,
      text: z.string().min(1).max(400),
      // passage_id must appear in the retrieval set (validated server-side)
      citations: z.array(z.object({
        passage_id: z.string().uuid(),
        // Matches DB enum public.derivation_type (Batch 2).
        derivation: z.enum(["direct","inferred","pattern_matched"]),
        explanation: z.string().max(400),
      })).min(1).max(4),
    })).min(3).max(6),
  }),
  primaryPractice: z.object({
    kind: z.enum([
      "boundary","confession","forgiveness","restitution","reconciliation",
      "silence","scripture_meditation","journaling","accountability",
      "environmental_change","service","waiting","gratitude","fasting_reflection",
    ]),
    title: z.string().min(1).max(140),
    rationale: z.string().min(1).max(600),
  }),
});
export type Composition = z.infer<typeof zComposition>;

export const INTERPRETATION_CATEGORIES = [
  "chosen_behavior","habit","appetite","belief","shame","hidden_agreement",
  "relationship_pressure","social_normalization","family_learning",
  "generational_repetition","material_conditions","spiritual_practice_absence",
  "user_reported_spiritual_conflict","direct_biblical_curse_or_stronghold",
] as const;

export const zCbCheap = z.object({
  scores: z.array(z.object({
    category: z.enum(INTERPRETATION_CATEGORIES),
    score: z.number().min(0).max(1),
    brief_reason: z.string().max(240),
  })).length(14),
});
export type CbCheap = z.infer<typeof zCbCheap>;

export const zCbDeep = z.object({
  confidence: z.number().min(0).max(1),
  supporting_evidence: z.array(z.string().max(400)).max(8),
  counter_evidence: z.array(z.string().max(400)).max(8),
  alternative_explanations: z.array(z.string().max(400)).max(6),
  citations: z.array(z.object({
    passage_id: z.string().uuid(),
    tier: z.enum(["S1","S2","S3","S4","S5","S6","S7","S8"]),
    note: z.string().max(300),
  })).min(1).max(6),
  pastoral_note: z.string().max(600),
});
export type CbDeep = z.infer<typeof zCbDeep>;
