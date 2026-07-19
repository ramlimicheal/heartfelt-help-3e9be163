import { createFileRoute, Link } from "@tanstack/react-router";
import { HYPOTHESES } from "@/lib/wisdom/mock/seed";
import { ConfidenceBar } from "@/components/wisdom/primitives";
import type { PatternStatus } from "@/lib/wisdom/schemas";

export const Route = createFileRoute("/patterns/")({
  head: () => ({ meta: [{ title: "Patterns — Wisdom" }] }),
  component: PatternsList,
});

const STATUS_ORDER: PatternStatus[] = [
  "proposed",
  "exploring",
  "accepted",
  "improving",
  "recurring",
  "resolved",
  "rejected",
  "archived",
];

function PatternsList() {
  const list = Object.values(HYPOTHESES);
  const groups = STATUS_ORDER.map((status) => ({
    status,
    items: list.filter((h) => h.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gold">Patterns</p>
        <h1 className="font-serif text-3xl leading-tight">The loops beneath your story.</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Every pattern is a hypothesis you can accept, edit, rename, reject, or leave
          unsure. Rejected patterns never silently return.
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.status} className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {g.status}
          </h2>
          {g.items.map((h) => (
            <Link
              key={h.id}
              to="/patterns/$patternId"
              params={{ patternId: h.id }}
              className="block rounded-xl border border-panel-border bg-panel px-5 py-4 transition hover:bg-surface"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-serif text-lg leading-snug">{h.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{h.description}</p>
                </div>
                <ConfidenceBar value={h.confidence} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {h.domains.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-surface-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
