import type { SourceTier } from "@/lib/wisdom/schemas";
import { SOURCE_TIER_LABEL, SOURCE_TIER_SHORT } from "@/lib/wisdom/schemas";

const TIER_STYLES: Record<SourceTier, string> = {
  S1_canonical_direct: "bg-tier-canonical/15 text-tier-canonical border-tier-canonical/25",
  S2_canonical_synthesis: "bg-tier-synthesis/15 text-tier-synthesis border-tier-synthesis/25",
  S3_linguistic_historical: "bg-tier-context/15 text-tier-context border-tier-context/25",
  S4_recognized_interpretation: "bg-tier-tradition/15 text-tier-tradition border-tier-tradition/25",
  S5_extra_canonical_ancient:
    "bg-tier-extracanonical/15 text-tier-extracanonical border-tier-extracanonical/25",
  S6_founder_framework: "bg-tier-founder/15 text-tier-founder border-tier-founder/25",
  S7_modern_analogy: "bg-tier-analogy/15 text-tier-analogy border-tier-analogy/25",
  S8_model_hypothesis: "bg-tier-hypothesis/15 text-tier-hypothesis border-tier-hypothesis/25",
};

export function TierChip({ tier, verbose = false }: { tier: SourceTier; verbose?: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        TIER_STYLES[tier],
      ].join(" ")}
      title={SOURCE_TIER_LABEL[tier]}
    >
      {verbose ? SOURCE_TIER_LABEL[tier] : SOURCE_TIER_SHORT[tier]}
    </span>
  );
}

export function Card({
  eyebrow,
  title,
  children,
  aside,
}: {
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-panel-border bg-panel px-5 py-5 md:px-7 md:py-6">
      {(eyebrow || title || aside) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-gold">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="mt-1 font-serif text-2xl leading-tight text-foreground">{title}</h2>
            )}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </header>
      )}
      <div className="text-[15px] leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex items-center gap-2" aria-label={`Confidence ${pct} percent`}>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}
