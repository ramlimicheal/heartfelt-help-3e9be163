import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getJourneyTimeline } from "@/lib/wisdom/journey.functions";

export const Route = createFileRoute("/journey")({
  head: () => ({ meta: [{ title: "Journey — Wisdom" }] }),
  component: Journey,
});

const TYPE_LABEL: Record<string, string> = {
  signal: "Signal recorded",
  pattern_update: "Pattern updated",
  interpretation: "Interpretation composed",
  prayer: "Prayer composed",
  practice_assigned: "Practice assigned",
  check_in: "Check-in recorded",
  memory_change: "Memory updated",
};

function Journey() {
  const fn = useServerFn(getJourneyTimeline);
  const { data, isLoading, error } = useQuery({
    queryKey: ["journey"],
    queryFn: () => fn(),
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Journey</p>
        <h1 className="text-3xl leading-tight">Your formation, over time.</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          No streaks, no rankings, no faith score. Setbacks are recorded as data, never as
          identity. You can review, edit, or remove any event.
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading your journey…</p>}
      {error && (
        <p className="text-sm text-destructive">Your journey could not be loaded.</p>
      )}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <p className="rounded-xl border border-panel-border bg-panel px-5 py-4 text-sm text-muted-foreground">
          Nothing to show yet. As you use Wisdom, formation events appear here.
        </p>
      )}

      {data && data.length > 0 && (
        <ol className="relative space-y-4 border-l border-panel-border pl-6">
          {data.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[29px] top-2 grid size-3 place-items-center rounded-full bg-primary ring-4 ring-background" />
              <div className="rounded-xl border border-panel-border bg-panel px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-primary">
                  {TYPE_LABEL[e.eventType] ?? e.eventType}
                </p>
                {e.note && <p className="mt-1 text-sm">{e.note}</p>}
                {e.fruit.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fruit: {e.fruit.join(", ")}
                  </p>
                )}
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
