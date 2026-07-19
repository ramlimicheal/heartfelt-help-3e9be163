import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ARCHETYPE_INDEX, HYPOTHESES, PRACTICES, RESPONSES } from "@/lib/wisdom/mock/seed";
import { Card, ConfidenceBar, TierChip } from "@/components/wisdom/primitives";

export const Route = createFileRoute("/patterns/$patternId")({
  head: ({ params }) => ({
    meta: [
      { title: `${HYPOTHESES[params.patternId]?.name ?? "Pattern"} — Wisdom` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ params }) => {
    const pattern = HYPOTHESES[params.patternId];
    if (!pattern) throw notFound();
    return { pattern };
  },
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Pattern not found.</p>,
  errorComponent: () => (
    <p className="text-sm text-destructive">This pattern could not be loaded.</p>
  ),
  component: PatternDetail,
});

function PatternDetail() {
  const { pattern } = Route.useLoaderData();
  const eventChain = Object.values(RESPONSES)[0]?.eventChain ?? [];
  const practices = PRACTICES.filter((p) => p.patternId === pattern.id);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link to="/patterns" className="text-xs text-muted-foreground hover:text-foreground">
          ← All patterns
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gold">
          Pattern · {pattern.status}
        </p>
        <h1 className="font-serif text-3xl leading-tight">{pattern.name}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{pattern.description}</p>
        <div className="pt-2">
          <ConfidenceBar value={pattern.confidence} />
        </div>
      </header>

      <Card eyebrow="Event chain" title="The loop, ordered.">
        <ol className="space-y-2">
          {eventChain.map((l) => (
            <li key={l.id} className="flex gap-3 rounded-lg border border-surface-border bg-surface/40 px-3 py-2">
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-gold">
                {l.kind.replace("_", " ")}
              </span>
              <p className="text-sm">{l.text}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card
        eyebrow="Hidden agreement (candidate)"
        title="A candidate to test, not a verdict."
      >
        <blockquote className="border-l-2 border-gold pl-4 font-serif text-lg italic">
          “{pattern.hiddenAgreementCandidate}”
        </blockquote>
      </Card>

      <Card eyebrow="Counter-evidence & missing evidence" title="What could I be wrong about?">
        <ul className="space-y-1.5">
          {pattern.counterOrMissingEvidence.map((c: string, i: number) => (
            <li key={i} className="text-sm text-foreground/85">
              — {c}
            </li>
          ))}
        </ul>
      </Card>

      <Card eyebrow="Biblical mirrors" title="Complete narratives, tiered.">
        <div className="space-y-4">
          {pattern.archetypes.map((link: import("@/lib/wisdom/schemas").PatternArchetypeLink) => {
            const arch = ARCHETYPE_INDEX[link.archetypeId];
            return (
              <div key={link.archetypeId} className="rounded-lg border border-surface-border bg-surface/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-lg">{arch.person}</p>
                    <p className="text-sm text-muted-foreground">{arch.headline}</p>
                  </div>
                  <ConfidenceBar value={link.fitScore} />
                </div>
                <p className="mt-2 text-sm text-foreground/85">{arch.narrativeSummary}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {arch.primaryPassages.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-background px-2 py-0.5"
                    >
                      <TierChip tier={p.tier} />
                      <span className="font-medium">{p.reference}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card eyebrow="Practices" title="One primary act, up to two optional.">
        <div className="space-y-2">
          {practices.map((p) => (
            <div
              key={p.id}
              className={[
                "rounded-lg border px-4 py-3",
                p.isPrimary
                  ? "border-gold/40 bg-gold-soft"
                  : "border-surface-border bg-surface/40",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{p.title}</p>
                {p.isPrimary && (
                  <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    Primary
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.rationale}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
