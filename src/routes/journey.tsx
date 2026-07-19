import { createFileRoute } from "@tanstack/react-router";
import { seededTimeline } from "@/lib/wisdom/mock/seed";

export const Route = createFileRoute("/journey")({
  head: () => ({ meta: [{ title: "Journey — Wisdom" }] }),
  component: Journey,
});

const TYPE_LABEL: Record<string, string> = {
  story_shared: "Story shared",
  pattern_proposed: "Pattern proposed",
  pattern_accepted: "Pattern accepted",
  pattern_edited: "Pattern edited",
  pattern_rejected: "Pattern rejected",
  prayer_created: "Prayer created",
  prayer_edited: "Prayer edited",
  practice_selected: "Practice selected",
  checkin_completed: "Check-in completed",
  setback_recorded: "Setback recorded",
  fruit_observed: "Fruit observed",
  pattern_confidence_changed: "Confidence changed",
  pattern_archived: "Pattern archived",
};

function Journey() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gold">Journey</p>
        <h1 className="font-serif text-3xl leading-tight">Your formation, over time.</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          No streaks, no rankings, no faith score. Setbacks are recorded as data, never as
          identity. You can review, edit, or remove any event.
        </p>
      </header>

      <ol className="relative space-y-4 border-l border-panel-border pl-6">
        {seededTimeline.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[29px] top-2 grid size-3 place-items-center rounded-full bg-gold ring-4 ring-background" />
            <div className="rounded-xl border border-panel-border bg-panel px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-gold">
                {TYPE_LABEL[e.type] ?? e.type}
              </p>
              <p className="mt-1 text-sm">{e.note}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(e.at).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
