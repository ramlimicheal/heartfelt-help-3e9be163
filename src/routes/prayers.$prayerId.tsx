import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PASSAGE_INDEX, PRAYERS } from "@/lib/wisdom/mock/seed";
import { Card, TierChip } from "@/components/wisdom/primitives";

export const Route = createFileRoute("/prayers/$prayerId")({
  head: ({ params }) => ({
    meta: [
      { title: `${PRAYERS[params.prayerId]?.title ?? "Prayer"} — Wisdom` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ params }) => {
    const prayer = PRAYERS[params.prayerId];
    if (!prayer) throw notFound();
    return { prayer };
  },
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Prayer not found.</p>,
  errorComponent: () => (
    <p className="text-sm text-destructive">This prayer could not be loaded.</p>
  ),
  component: PrayerDetail,
});

function PrayerDetail() {
  const { prayer } = Route.useLoaderData()!;
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

      <Card eyebrow="The prayer" title="Tap any line for its Prayer Roots.">
        <div className="space-y-3">
          {prayer.lines.map((line: import("@/lib/wisdom/schemas").PrayerLine) => (
            <LineBlock key={line.id} line={line} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function LineBlock({ line }: { line: (typeof PRAYERS)[string]["lines"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-surface-border bg-surface/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface"
      >
        <span className="mt-0.5 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
          {line.movement}
        </span>
        <p className="flex-1 text-[17px] leading-snug">{line.text}</p>
        {open ? (
          <ChevronDown className="mt-1 size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-1 size-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="space-y-2 border-t border-surface-border px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Prayer roots
          </p>
          {line.sources.map((src, i) => {
            const passage = PASSAGE_INDEX[src.passageId];
            return (
              <div key={i} className="rounded border border-surface-border bg-background px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <TierChip tier={src.tier} />
                  <span className="text-sm font-medium">{passage.reference}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    · {src.derivation.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{src.explanation}</p>
                <p className="mt-1 text-[11px] italic text-muted-foreground">
                  {passage.curatorSummary}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
