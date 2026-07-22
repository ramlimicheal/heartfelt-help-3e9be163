/**
 * Canonical source-tier contract.
 *
 * Mirrors the S1–S8 tier ladder used by the approved biblical corpus
 * and rendered by the <TierChip /> primitive.
 *
 * Consumers:
 *  - src/components/wisdom/primitives.tsx (TierChip UI)
 *
 * If you need the type in a new module, import it from here.
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
