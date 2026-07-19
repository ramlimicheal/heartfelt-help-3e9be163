/**
 * Wisdom typed schemas — mirror the PRD data model.
 * Nothing here talks to a backend yet; these types shape the mock data
 * and every UI component so Stage D can drop real AI output into the
 * same shapes without touching the UI.
 */

export type SourceTier =
  | "S1_canonical_direct"
  | "S2_canonical_synthesis"
  | "S3_linguistic_historical"
  | "S4_recognized_interpretation"
  | "S5_extra_canonical_ancient"
  | "S6_founder_framework"
  | "S7_modern_analogy"
  | "S8_model_hypothesis";

export const SOURCE_TIER_LABEL: Record<SourceTier, string> = {
  S1_canonical_direct: "S1 · Canonical direct",
  S2_canonical_synthesis: "S2 · Canonical synthesis",
  S3_linguistic_historical: "S3 · Linguistic / historical",
  S4_recognized_interpretation: "S4 · Recognized interpretation",
  S5_extra_canonical_ancient: "S5 · Extra-canonical ancient",
  S6_founder_framework: "S6 · Founder framework",
  S7_modern_analogy: "S7 · Modern analogy",
  S8_model_hypothesis: "S8 · Model hypothesis",
};

export const SOURCE_TIER_SHORT: Record<SourceTier, string> = {
  S1_canonical_direct: "S1",
  S2_canonical_synthesis: "S2",
  S3_linguistic_historical: "S3",
  S4_recognized_interpretation: "S4",
  S5_extra_canonical_ancient: "S5",
  S6_founder_framework: "S6",
  S7_modern_analogy: "S7",
  S8_model_hypothesis: "S8",
};

export type MemoryStatus =
  | "session_only"
  | "proposed"
  | "accepted"
  | "rejected"
  | "sensitive"
  | "deleted";

export type PatternStatus =
  | "proposed"
  | "exploring"
  | "accepted"
  | "rejected"
  | "improving"
  | "recurring"
  | "resolved"
  | "archived";

export type PrayerMovement =
  | "truth"
  | "remembrance"
  | "request"
  | "surrender"
  | "obedience"
  | "gratitude"
  | "lament"
  | "confession"
  | "intercession";

export type DerivationType =
  | "direct_quote"
  | "paraphrase"
  | "narrative_pattern"
  | "movement_form"
  | "founder_language"
  | "model_composition";

export type FruitTag =
  | "clarity"
  | "peace"
  | "self_control"
  | "honesty"
  | "courage"
  | "forgiveness"
  | "restitution"
  | "relationship_health"
  | "consistency"
  | "service"
  | "patience"
  | "reduced_repetition";

export type UserVerdict = "accurate" | "partly" | "not_accurate" | "unsure";

/* ── Session & messages ─────────────────────────────────────────── */

export interface Message {
  id: string;
  role: "user" | "assistant_artifact" | "system";
  text: string;
  createdAt: string;
  doNotRemember?: boolean;
}

export interface Session {
  id: string;
  title: string;
  intent:
    | "tell_my_story"
    | "understand_pattern"
    | "test_interpretation"
    | "ask_about_verse"
    | "request_prayer"
    | "request_practice"
    | "review_pattern";
  depth: "companion" | "pattern" | "deep";
  createdAt: string;
  messages: Message[];
  responseId?: string;
}

/* ── Signals & event chain ──────────────────────────────────────── */

export interface Signal {
  id: string;
  kind:
    | "person"
    | "event"
    | "emotion"
    | "belief"
    | "desire"
    | "fear"
    | "environment"
    | "repeated_phrase"
    | "spiritual_interpretation"
    | "previous_effort"
    | "outcome"
    | "question";
  evidenceMessageIds: string[];
  paraphrase: string;
  explicit: boolean;
  confidence: number; // 0-1
}

export type EventChainLinkKind =
  | "context"
  | "trigger"
  | "interpretation"
  | "need"
  | "choice"
  | "immediate_reward"
  | "cost"
  | "afterthought"
  | "re_entry";

export interface EventChainLink {
  id: string;
  kind: EventChainLinkKind;
  text: string;
  fromUser: boolean; // true = user-described, false = model-inferred
}

/* ── Persona facts (user-controlled memory) ────────────────────── */

export interface PersonaFact {
  id: string;
  domain: "values" | "goals" | "relationships" | "environment" | "pattern" | "identity";
  key: string;
  value: string;
  status: MemoryStatus;
  sensitivity: "normal" | "sensitive";
  confidence: number;
  evidenceMessageIds: string[];
  userEdited: boolean;
}

/* ── Biblical archetypes & sources ─────────────────────────────── */

export interface SourcePassage {
  id: string;
  reference: string;        // "Numbers 11:10-17"
  translationNote: string;  // "Founder default profile · reference only"
  tier: SourceTier;
  curatorSummary: string;   // Original text; no copyrighted translation stored.
}

export interface BiblicalArchetype {
  id: string;
  person: string;
  headline: string;         // one-line orientation
  narrativeSummary: string; // curator-written narrative overview
  eventChain: string[];
  prayerMovements: PrayerMovement[];
  practiceMovements: string[];
  primaryPassages: SourcePassage[];
  descriptiveOrPrescriptive: "descriptive" | "prescriptive" | "mixed";
  curatorStatus: "approved" | "draft" | "retired";
}

export interface PatternArchetypeLink {
  archetypeId: string;
  whyThisConnection: string;   // narrative comparison for progressive disclosure
  fitScore: number;            // 0-1
}

/* ── Patterns ──────────────────────────────────────────────────── */

export interface PatternHypothesis {
  id: string;
  name: string;
  description: string;
  status: PatternStatus;
  confidence: number;
  hiddenAgreementCandidate: string;
  domains: string[];
  evidenceSignalIds: string[];
  counterOrMissingEvidence: string[];
  distinguishingQuestion: string;
  archetypes: PatternArchetypeLink[];
  userVerdict?: UserVerdict;
  userEditedName?: string;
}

/* ── Prayer with per-line lineage ──────────────────────────────── */

export interface PrayerLineSource {
  passageId: string;
  derivation: DerivationType;
  explanation: string;
  tier: SourceTier;
}

export interface PrayerLine {
  id: string;
  movement: PrayerMovement;
  text: string;
  sources: PrayerLineSource[]; // must be non-empty at compose time
  confidence: number;
  userEdited: boolean;
}

export interface Prayer {
  id: string;
  patternId: string;
  archetypeIds: string[];
  title: string;
  mode: "concise" | "full" | "guided" | "journal";
  lines: PrayerLine[];
  createdAt: string;
}

/* ── One next act + optional practices ─────────────────────────── */

export interface Practice {
  id: string;
  patternId: string;
  kind:
    | "boundary"
    | "confession"
    | "forgiveness"
    | "restitution"
    | "reconciliation"
    | "silence"
    | "scripture_meditation"
    | "journaling"
    | "accountability"
    | "environmental_change"
    | "service"
    | "waiting"
    | "gratitude"
    | "fasting_reflection";
  title: string;
  rationale: string;
  isPrimary: boolean;
}

/* ── Formation timeline ────────────────────────────────────────── */

export type FormationEventType =
  | "story_shared"
  | "pattern_proposed"
  | "pattern_accepted"
  | "pattern_edited"
  | "pattern_rejected"
  | "prayer_created"
  | "prayer_edited"
  | "practice_selected"
  | "checkin_completed"
  | "setback_recorded"
  | "fruit_observed"
  | "pattern_confidence_changed"
  | "pattern_archived";

export interface FormationEvent {
  id: string;
  type: FormationEventType;
  at: string;
  patternId?: string;
  prayerId?: string;
  practiceId?: string;
  note: string;
  fruit?: FruitTag[];
}

/* ── The composed session response ─────────────────────────────── */

export interface WisdomResponse {
  id: string;
  sessionId: string;
  createdAt: string;
  whatIHear: string;                       // Card 1
  signals: Signal[];                       // deep mode
  eventChain: EventChainLink[];            // deep mode
  hypotheses: PatternHypothesis[];         // 1-3, first = strongest
  primaryHypothesisId: string;             // Card 2 subject
  whyISeeIt: string;                       // Card 3
  discernment: {                           // Card 5
    contextNote: string;
    directVsInferred: string;
    descriptiveVsPrescriptive: string;
    counterEvidence: string[];
    distinguishingQuestion: string;
  };
  prayer: Prayer;                          // Card 6
  primaryAct: Practice;                    // Card 7
  optionalPractices: Practice[];           // Card 7 (≤ 2)
  proposedPersonaFacts: PersonaFact[];     // deep mode / You page
  fruitToObserve: FruitTag[];              // deep mode
}
