import type { SourceTier } from "@/lib/wisdom/contracts/sourceTier";
import { SOURCE_TIER_LABEL, SOURCE_TIER_SHORT } from "@/lib/wisdom/contracts/sourceTier";
import {
  Feather,
  Flame,
  HandHelping,
  Heart,
  Quote,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

/** Small icon that names the card's role so cards read as objects, not paragraphs. */
const EYEBROW_ICONS: Record<string, LucideIcon> = {
  Interpretation: Sparkles,
  Discernment: ShieldCheck,
  Prayer: HandHelping,
  Practice: Feather,
  Scripture: Quote,
  Pattern: Flame,
};

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
  const Icon = eyebrow ? EYEBROW_ICONS[eyebrow] ?? Sparkles : null;
  return (
    <section
      className={[
        "relative overflow-hidden rounded-2xl border px-5 py-5 md:px-6 md:py-6 transition",
        tone === "primary"
          ? "border-primary/30 bg-surface glow-lime"
          : "border-panel-border bg-surface/60",
      ].join(" ")}
    >
      {/* Left color rail — makes each card scannable as an object */}
      <span
        aria-hidden
        className="absolute inset-y-4 left-0 w-[3px] rounded-full bg-gradient-to-b from-primary/70 via-primary/30 to-transparent"
      />
      {(eyebrow || title || aside) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex items-start gap-3">
            {Icon && (
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                <Icon className="size-3.5" strokeWidth={2} />
              </span>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
                  {eyebrow}
                </p>
              )}
              {title && (
                <h2 className="mt-1 font-serif text-xl font-medium leading-tight text-foreground md:text-[26px]">
                  {title}
                </h2>
              )}
            </div>
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

/**
 * A quoted passage block, styled like an illuminated verse.
 * Use for direct scripture quotations shown inline in a card.
 */
export function ScriptureBlock({
  reference,
  text,
  translation = "WEB",
}: {
  reference: string;
  text: string;
  translation?: string;
}) {
  return (
    <figure className="relative rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 via-surface/40 to-transparent p-4">
      <Quote
        aria-hidden
        className="absolute right-3 top-3 size-8 text-primary/20"
        strokeWidth={1.5}
      />
      <blockquote className="font-serif text-[17px] italic leading-relaxed text-foreground/95">
        “{text}”
      </blockquote>
      <figcaption className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="font-medium text-primary">{reference}</span>
        <span aria-hidden>·</span>
        <span>{translation}</span>
      </figcaption>
    </figure>
  );
}

/** Movement metadata for prayer lines — icon + colored accent per movement. */
export const MOVEMENT_META: Record<
  string,
  { label: string; Icon: LucideIcon; accent: string }
> = {
  invocation: { label: "Invocation", Icon: Sparkles, accent: "text-tier-canonical border-tier-canonical/40 bg-tier-canonical/10" },
  confession: { label: "Confession", Icon: Heart, accent: "text-tier-founder border-tier-founder/40 bg-tier-founder/10" },
  renunciation: { label: "Renunciation", Icon: Flame, accent: "text-destructive border-destructive/40 bg-destructive/10" },
  petition: { label: "Petition", Icon: HandHelping, accent: "text-tier-context border-tier-context/40 bg-tier-context/10" },
  intercession: { label: "Intercession", Icon: HandHelping, accent: "text-tier-tradition border-tier-tradition/40 bg-tier-tradition/10" },
  thanksgiving: { label: "Thanksgiving", Icon: Feather, accent: "text-tier-synthesis border-tier-synthesis/40 bg-tier-synthesis/10" },
  benediction: { label: "Benediction", Icon: ShieldCheck, accent: "text-primary border-primary/40 bg-primary/10" },
};

export function MovementBadge({ movement }: { movement: string }) {
  const m = MOVEMENT_META[movement] ?? {
    label: movement.replace(/_/g, " "),
    Icon: Sparkles,
    accent: "text-muted-foreground border-panel-border bg-surface/60",
  };
  const { Icon, label, accent } = m;
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        accent,
      ].join(" ")}
    >
      <Icon className="size-3" strokeWidth={2} />
      {label}
    </span>
  );
}

/**
 * Derivation legend — explains the three ways a prayer line or CB claim can
 * be tied to a passage. Every citation renders exactly one of these values.
 */
export const DERIVATION_EXPLANATIONS: Record<
  "direct" | "inferred" | "pattern_matched",
  { label: string; blurb: string }
> = {
  direct: {
    label: "Direct",
    blurb:
      "The passage says the thing being prayed. Language, verbs, or imagery in the prayer line come straight from this text.",
  },
  inferred: {
    label: "Inferred",
    blurb:
      "The prayer line is a reasonable pastoral inference from the passage: a next step, an implication, or an application the text supports without stating verbatim.",
  },
  pattern_matched: {
    label: "Pattern-matched",
    blurb:
      "The passage describes a structurally similar situation (a biblical archetype) and the prayer line borrows that pattern — same shape, different specifics.",
  },
};

export function DerivationLegend() {
  return (
    <div className="rounded-xl border border-panel-border bg-surface/40 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
        How citations are derived
      </p>
      <dl className="mt-2 grid gap-2 md:grid-cols-3">
        {(Object.entries(DERIVATION_EXPLANATIONS) as Array<[
          keyof typeof DERIVATION_EXPLANATIONS,
          (typeof DERIVATION_EXPLANATIONS)[keyof typeof DERIVATION_EXPLANATIONS],
        ]>).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-panel-border/60 bg-background/40 p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
              {v.label}
            </dt>
            <dd className="mt-1 text-xs leading-snug text-muted-foreground">{v.blurb}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
