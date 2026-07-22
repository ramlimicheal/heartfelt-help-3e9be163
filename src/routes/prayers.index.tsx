import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listPrayers } from "@/lib/wisdom/library.functions";

const prayersQuery = queryOptions({
  queryKey: ["library", "prayers"],
  queryFn: () => listPrayers(),
});

export const Route = createFileRoute("/prayers/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Prayers — Wisdom" }] }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(prayersQuery);
  },
  errorComponent: () => (
    <p className="text-sm text-destructive">Prayers couldn't load. Try again in a moment.</p>
  ),
  component: PrayersList,
});

function PrayersList() {
  const { data: list } = useSuspenseQuery(prayersQuery);
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Prayer</p>
        <h1 className="text-3xl leading-tight">Prayer with lineage.</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Every line is traceable to a passage. Wisdom does not present generated text as God's direct reply.
        </p>
      </header>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-panel-border bg-panel/60 px-6 py-10 text-center">
          <p className="text-lg">No prayer has been formed yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            A prayer will appear here after Wisdom understands the situation and verifies its biblical roots.
          </p>
          <Link to="/wisdom" className="mt-4 inline-block rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground">
            Open Wisdom
          </Link>
        </div>
      ) : (
        <section className="space-y-3">
          {list.map((p) => (
            <Link
              key={p.id}
              to="/prayers/$prayerId"
              params={{ prayerId: p.id }}
              className="block rounded-xl border border-panel-border bg-panel px-5 py-4 transition hover:bg-surface"
            >
              <p className="text-lg leading-snug">{p.title}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {p.mode} · {p.lineCount} line{p.lineCount === 1 ? "" : "s"}
                {p.finalizedAt ? " · finalized" : " · draft"}
              </p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
