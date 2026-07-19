import type { SourceTier } from "@/lib/wisdom/schemas";
import { SOURCE_TIER_LABEL, SOURCE_TIER_SHORT } from "@/lib/wisdom/schemas";

const TIER_STYLES: Record<SourceTier, string> = {
  S1_canonical_direct: "bg-tier-canonical/15 text-tier-canonical border-tier-canonical/30",
  S2_canonical_synthesis: "bg-tier-synthesis/15 text-tier-synthesis border-tier-synthesis/30",
  S3_linguistic_historical: "bg-tier-context/15 text-tier-context border-tier-context/30",
  S4_recognized_interpretation: "bg-tier-tradition/15 text-tier-tradition border-tier-tradition/30",
  S5_extra_canonical_ancient:
    "bg-tier-extracanonical/15 text-tier-extracanonical border-tier-extracanonical/30",
  S6_founder_framework: "bg-tier-founder/15 text-tier-founder border-tier-founder/30",
  S7_modern_analogy: "bg-tier-analogy/15 text-tier-analogy border-tier-analogy/30",
  S8_model_hypothesis: "bg-tier-hypothesis/15 text-tier-hypothesis border-tier-hypothesis/30",
};

export function TierChip({ tier, verbose = false }: { tier: SourceTier; verbose?: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
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
  tone = "default",
}: {
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  tone?: "default" | "primary";
}) {
  return (
    <section
      className={[
        "rounded-2xl border px-5 py-5 md:px-6 md:py-6 transition",
        tone === "primary"
          ? "border-primary/30 bg-surface glow-lime"
          : "border-panel-border bg-surface/60",
      ].join(" ")}
    >
      {(eyebrow || title || aside) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="mt-1.5 text-xl font-semibold leading-tight text-foreground md:text-2xl">
                {title}
              </h2>
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
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}
