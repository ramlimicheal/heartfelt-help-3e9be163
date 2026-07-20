import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPatterns } from "@/lib/wisdom/patterns.functions";

export const Route = createFileRoute("/patterns/")({
  head: () => ({ meta: [{ title: "Patterns — Wisdom" }] }),
  component: PatternsList,
});

const LIFECYCLE_ORDER = ["proposed", "accepted", "refined", "reconsidered", "rejected"] as const;
const LIFECYCLE_LABEL: Record<string, string> = {
  proposed: "proposed",
  accepted: "accepted",
  refined: "improving",
  reconsidered: "reconsidered",
  rejected: "rejected",
};

function PatternsList() {
  const fn = useServerFn(listPatterns);
  const { data, isLoading, error } = useQuery({
    queryKey: ["patterns"],
    queryFn: () => fn(),
  });

  const groups = LIFECYCLE_ORDER.map((lc) => ({
    lifecycle: lc,
    items: (data ?? []).filter((p) => p.lifecycle === lc && p.status !== "archived"),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Patterns</p>
        <h1 className="text-3xl leading-tight">The loops beneath your story.</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Every pattern is a hypothesis you can accept, edit, rename, reject, or leave
          unsure. Rejected patterns never silently return.
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading patterns…</p>}
      {error && (
        <p className="text-sm text-destructive">Your patterns could not be loaded.</p>
      )}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <p className="rounded-xl border border-panel-border bg-panel px-5 py-4 text-sm text-muted-foreground">
          No patterns yet. Patterns appear here after Wisdom proposes them.
        </p>
      )}

      {groups.map((g) => (
        <section key={g.lifecycle} className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {LIFECYCLE_LABEL[g.lifecycle] ?? g.lifecycle}
          </h2>
          {g.items.map((h) => (
            <Link
              key={h.id}
              to="/patterns/$patternId"
              params={{ patternId: h.id }}
              className="block rounded-xl border border-panel-border bg-panel px-5 py-4 transition hover:bg-surface"
            >
              <p className="text-lg leading-snug">{h.title}</p>
              {h.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{h.description}</p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Updated {new Date(h.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
