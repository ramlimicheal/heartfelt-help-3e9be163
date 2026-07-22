import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listPatterns } from "@/lib/wisdom/library.functions";

const patternsQuery = queryOptions({
  queryKey: ["library", "patterns"],
  queryFn: () => listPatterns(),
});

export const Route = createFileRoute("/patterns/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Patterns — Wisdom" }] }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(patternsQuery);
  },
  errorComponent: () => (
    <p className="text-sm text-destructive">Patterns couldn't load. Try again in a moment.</p>
  ),
  component: PatternsList,
});

const STATUS_ORDER = ["proposed", "exploring", "accepted", "improving", "recurring", "resolved", "rejected", "archived"];

function PatternsList() {
  const { data: list } = useSuspenseQuery(patternsQuery);

  if (list.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="rounded-2xl border border-panel-border bg-panel/60 px-6 py-10 text-center">
          <p className="text-lg">No patterns yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Bring a real situation to Wisdom. When a pattern emerges it will appear here as a candidate — never as a verdict.
          </p>
          <Link to="/wisdom" className="mt-4 inline-block rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground">
            Open Wisdom
          </Link>
        </div>
      </div>
    );
  }

  const groups = STATUS_ORDER
    .map((status) => ({ status, items: list.filter((p) => p.status === status) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <Header />
      {groups.map((g) => (
        <section key={g.status} className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {g.status} ({g.items.length})
          </h2>
          {g.items.map((p) => (
            <Link
              key={p.id}
              to="/patterns/$patternId"
              params={{ patternId: p.id }}
              className="block rounded-xl border border-panel-border bg-panel px-5 py-4 transition hover:bg-surface"
            >
              <p className="text-lg leading-snug">{p.title}</p>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Updated {new Date(p.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}

function Header() {
  return (
    <header className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Patterns</p>
      <h1 className="text-3xl leading-tight">The loops beneath your story.</h1>
      <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
        Every pattern is a candidate you can accept, refine, or reject. Rejected patterns never silently return.
      </p>
    </header>
  );
}
