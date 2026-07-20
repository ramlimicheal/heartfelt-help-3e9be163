import { createFileRoute, Link } from "@tanstack/react-router";
import { PRAYERS } from "@/lib/wisdom/mock/seed";

export const Route = createFileRoute("/prayers/")({
  head: () => ({ meta: [{ title: "Prayers — Wisdom" }] }),
  component: PrayersList,
});

function PrayersList() {
  const list = Object.values(PRAYERS);
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
              {p.mode} · {p.lines.length} lines · every line has sources
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
