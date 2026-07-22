import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listJourney } from "@/lib/wisdom/library.functions";

const journeyQuery = queryOptions({
  queryKey: ["library", "journey"],
  queryFn: () => listJourney(),
});

export const Route = createFileRoute("/journey")({
  head: () => ({ meta: [{ title: "Journey — Wisdom" }] }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(journeyQuery);
  },
  errorComponent: () => (
    <p className="text-sm text-destructive">Journey couldn't load. Try again in a moment.</p>
  ),
  component: Journey,
});

const TYPE_LABEL: Record<string, string> = {
  story_shared: "Story shared",
  pattern_proposed: "Pattern proposed",
  pattern_accepted: "Pattern accepted",
  pattern_edited: "Pattern edited",
  pattern_rejected: "Pattern rejected",
  prayer_composed: "Prayer composed",
  prayer_edited: "Prayer edited",
  practice_selected: "Practice selected",
  check_in: "Check-in",
  setback_recorded: "Setback recorded",
  fruit_observed: "Fruit observed",
};

function Journey() {
  const { data: items } = useSuspenseQuery(journeyQuery);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Journey</p>
        <h1 className="text-3xl leading-tight">Your formation, over time.</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          No streaks, no rankings, no faith score. Setbacks are recorded as data, never as identity.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-panel-border bg-panel/60 px-6 py-10 text-center">
          <p className="text-lg">Your journey hasn't started yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Events appear here as Wisdom surfaces patterns, prayers, and practices with you.
          </p>
          <Link to="/wisdom" className="mt-4 inline-block rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground">
            Open Wisdom
          </Link>
        </div>
      ) : (
        <ol className="relative space-y-4 border-l border-panel-border pl-6">
          {items.map((e) => (
            <li key={`${e.kind}:${e.id}`} className="relative">
              <span className="absolute -left-[29px] top-2 grid size-3 place-items-center rounded-full bg-primary ring-4 ring-background" />
              <div className="rounded-xl border border-panel-border bg-panel px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-primary">
                  {TYPE_LABEL[e.type] ?? e.type.replace(/_/g, " ")}
                </p>
                {e.note && <p className="mt-1 text-sm">{e.note}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(e.at).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
