import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, MovementBadge, DerivationLegend, DERIVATION_EXPLANATIONS } from "@/components/wisdom/primitives";
import { getPrayer } from "@/lib/wisdom/library.functions";

const prayerQuery = (prayerId: string) =>
  queryOptions({
    queryKey: ["library", "prayer", prayerId],
    queryFn: () => getPrayer({ data: { prayerId } }),
  });

export const Route = createFileRoute("/prayers/$prayerId")({
  head: () => ({
    meta: [
      { title: "Prayer — Wisdom" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(prayerQuery(params.prayerId));
    if (!data) throw notFound();
  },
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Prayer not found.</p>,
  errorComponent: () => (
    <p className="text-sm text-destructive">This prayer could not be loaded.</p>
  ),
  component: PrayerDetail,
});

type Src = {
  id: string; passageId: string; derivation: string; explanation: string;
  tier: string; reference: string; passageText: string;
};
type Line = { id: string; ordering: number; movement: string; text: string; sources: Src[] };

function PrayerDetail() {
  const { prayerId } = Route.useParams();
  const { data: prayer } = useSuspenseQuery(prayerQuery(prayerId));
  if (!prayer) return null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link to="/prayers" className="text-xs text-muted-foreground hover:text-foreground">
          ← All prayers
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          Prayer · {prayer.mode}
        </p>
        <h1 className="text-3xl leading-tight">{prayer.title}</h1>
      </header>

      <Card eyebrow="Prayer" title="Tap any line for its Prayer Roots.">
        <DerivationLegend />
        <div className="mt-4 space-y-3">
          {prayer.lines.map((line) => <LineBlock key={line.id} line={line} />)}
        </div>
      </Card>
    </div>
  );
}

function LineBlock({ line }: { line: Line }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-panel-border bg-surface/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface"
      >
        <MovementBadge movement={line.movement} />
        <p className="flex-1 font-serif text-[17px] leading-snug">{line.text}</p>
        {open ? <ChevronDown className="mt-1 size-4 text-muted-foreground" /> : <ChevronRight className="mt-1 size-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="space-y-2 border-t border-panel-border px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Prayer roots
          </p>
          {line.sources.length === 0 ? (
            <p className="text-xs text-muted-foreground">No source citations recorded for this line.</p>
          ) : (
            line.sources.map((s) => {
              const label = DERIVATION_EXPLANATIONS[s.derivation as keyof typeof DERIVATION_EXPLANATIONS]?.label ?? s.derivation;
              return (
                <div key={s.id} className="rounded border border-panel-border/60 bg-background px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      {s.tier}
                    </span>
                    <span className="text-sm font-medium">{s.reference}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">· {label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.explanation}</p>
                  {s.passageText && (
                    <p className="mt-1 text-[11px] italic text-muted-foreground line-clamp-3">
                      "{s.passageText}"
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
