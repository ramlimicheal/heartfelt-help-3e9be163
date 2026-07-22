/**
 * Canonical source-tier contract.
 *
 * Mirrors the S1–S8 tier ladder used by the approved biblical corpus
 * (see migration 0007 — public.source_tier) and rendered by the
 * <TierChip /> primitive.
 *
 * Consumers:
 *  - src/components/wisdom/primitives.tsx (TierChip UI)
 *
 * If you need the type in a new module, import it from here.
 */

export type SourceTier = "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8";

export const SOURCE_TIER_LABEL: Record<SourceTier, string> = {
  S1: "Scripture (WEB)",
  S2: "Scripture (translation)",
  S3: "Original languages",
  S4: "Reformed / evangelical creed",
  S5: "Reformed / evangelical commentary",
  S6: "Historic ecumenical creed",
  S7: "Broader ecumenical commentary",
  S8: "Contemporary pastoral",
};

export const SOURCE_TIER_SHORT: Record<SourceTier, string> = {
  S1: "S1", S2: "S2", S3: "S3", S4: "S4",
  S5: "S5", S6: "S6", S7: "S7", S8: "S8",
};
