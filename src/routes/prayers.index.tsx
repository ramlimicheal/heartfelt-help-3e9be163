import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPrayers } from "@/lib/wisdom/prayers.functions";

export const Route = createFileRoute("/prayers/")({
  head: () => ({ meta: [{ title: "Prayers — Wisdom" }] }),
  component: PrayersList,
});

function PrayersList() {
  const fn = useServerFn(listPrayers);
  const { data, isLoading, error } = useQuery({
    queryKey: ["prayers"],
    queryFn: () => fn(),
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Prayer</p>
        <h1 className="text-3xl leading-tight">Prayer with lineage.</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Every line is traceable to a passage or approved archetype. Wisdom does not present
          generated text as God's direct reply.
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading prayers…</p>}
      {error && (
        <p className="text-sm text-destructive">Your prayers could not be loaded.</p>
      )}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <p className="rounded-xl border border-panel-border bg-panel px-5 py-4 text-sm text-muted-foreground">
          No prayers yet. A prayer is created when you finish a Wisdom session.
        </p>
      )}

      {data && data.length > 0 && (
        <section className="space-y-3">
          {data.map((p) => (
            <Link
              key={p.id}
              to="/prayers/$prayerId"
              params={{ prayerId: p.id }}
              className="block rounded-xl border border-panel-border bg-panel px-5 py-4 transition hover:bg-surface"
            >
              <p className="text-lg leading-snug">{p.title}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {p.mode} · {p.lineCount} lines · every line has sources
              </p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
