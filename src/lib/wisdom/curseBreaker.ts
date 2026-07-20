/**
 * Curse Breaker / Stronghold Discernment Engine (SDE) — typed contracts.
 *
 * These types shape the mock UI so real pipeline output (Stage D) can slot
 * into the same components without touching them. No backend, no AI calls.
 */

import type {
  PrayerMovement,
  SourcePassage,
  SourceTier,
} from "./schemas";

/** The 14 independent interpretive categories. Enumerated for every session
 *  in Curse Breaker mode, even when confidence is 0. */
export type InterpretationCategory =
  | "chosen_behavior"
  | "habit"
  | "appetite"
  | "belief"
  | "shame"
  | "hidden_agreement"
  | "relationship_pressure"
  | "social_normalization"
  | "family_learning"
  | "generational_repetition"
  | "material_conditions"
  | "spiritual_practice_absence"
  | "user_reported_spiritual_conflict"
  | "direct_biblical_curse_or_stronghold";

export const INTERPRETATION_CATEGORIES: InterpretationCategory[] = [
  "chosen_behavior",
  "habit",
  "appetite",
  "belief",
  "shame",
  "hidden_agreement",
  "relationship_pressure",
  "social_normalization",
  "family_learning",
  "generational_repetition",
  "material_conditions",
  "spiritual_practice_absence",
  "user_reported_spiritual_conflict",
  "direct_biblical_curse_or_stronghold",
];

export interface CBEvidence {
  id: string;
  text: string;
  sourceMessageIds: string[]; // provenance back to user story
  weight: number;             // 0-1
}

export interface CBCitation {
  passageId: string;
  tier: SourceTier;
  note: string;
}

export interface CBInterpretation {
  id: string;
  category: InterpretationCategory;
  /** Two-pass score from stage 7a (cheap). Present even for skipped categories. */
  cheapScore: number;              // 0-1
  /** Deep analysis is only performed when cheapScore ≥ threshold. */
  deepAnalyzed: boolean;
  confidence: number;              // 0-1 (0 if not deep-analyzed)
  supportingEvidence: CBEvidence[];
  counterEvidence: CBEvidence[];
  missingEvidence: string[];
  alternativeExplanations: string[];
  citations: CBCitation[];         // must be non-empty when confidence > 0
  pastoralNote: string;
}

export interface CBGenerationalTimelinePoint {
  id: string;
  generation: string;    // "You", "Parent", "Grandparent", "Great-grandparent" etc.
  approxYear?: string;
  event: string;
  fromUser: boolean;     // true = user-reported, false = model-inferred
}

export interface CBTension {
  id: string;
  categoryA: InterpretationCategory;
  categoryB: InterpretationCategory;
  description: string;
  resolutionQuestion: string;
}

export interface CBPrayerLine {
  id: string;
  primaryMovement: PrayerMovement;
  movements: PrayerMovement[];     // ordered, includes primary at index 0
  text: string;
  citations: CBCitation[];         // ≥1 required
}

export interface CBPrayerLineage {
  id: string;
  title: string;
  lines: CBPrayerLine[];
}

export interface CBPatternBreakingAct {
  id: string;
  title: string;
  rationale: string;
  scale: "small" | "moderate" | "significant";
  proportionateNote: string;       // why not larger, why not smaller
}

export interface CBFormationCheckIn {
  id: string;
  scheduledFor: string;            // ISO date
  observePrompts: string[];
  setbackHandling: string;         // explicit "not a verdict on you"
}

export interface CBDignityFrame {
  refusalOfAutomaticVerdicts: string;
  reversibilityPromise: string;
  humanCounselPointer: string;     // "talk with a trusted pastor / counselor"
}

/** Full Curse Breaker response object — mirrors WisdomResponse for CB mode. */
export interface CurseBreakerResponse {
  id: string;
  sessionId: string;
  createdAt: string;
  whatIHear: string;
  timeline: CBGenerationalTimelinePoint[];
  interpretations: CBInterpretation[];  // exactly 14, ordered per COPY.categoryOrder
  tensions: CBTension[];
  prayerLineage: CBPrayerLineage;
  primaryAct: CBPatternBreakingAct;
  checkIn: CBFormationCheckIn;
  dignity: CBDignityFrame;
  passageIndex: Record<string, SourcePassage>;
}
