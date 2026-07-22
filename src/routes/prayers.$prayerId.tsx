import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BookOpenCheck, ChevronDown, ChevronRight, Lock, ShieldAlert } from "lucide-react";
import { Card, MovementBadge, DerivationLegend, DERIVATION_EXPLANATIONS } from "@/components/wisdom/primitives";
import { finalizePrayer, getPrayer } from "@/lib/wisdom/library.functions";

const prayerQuery = (prayerId: string) =>
  queryOptions({
    queryKey: ["library", "prayer", prayerId],
    queryFn: () => getPrayer({ data: { prayerId } }),
  });

export const Route = createFileRoute("/prayers/$prayerId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Prayer — Wisdom" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(prayerQuery(params.prayerId));
    if (!data) throw notFound();
  },
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Prayer not found.</p>,
  errorComponent: () => (
    <p className="text-sm text-destructive">This prayer could not be loaded.</p>
  ),
  component: PrayerDetail,
});

type Src = {
  id: string; passageId: string; derivation: string; explanation: string;
  tier: string; reference: string; passageText: string;
};
type Line = { id: string; ordering: number; movement: string; text: string; sources: Src[] };

function PrayerDetail() {
  const { prayerId } = Route.useParams();
  const { data: prayer } = useSuspenseQuery(prayerQuery(prayerId));
  const queryClient = useQueryClient();
  const finalizeFn = useServerFn(finalizePrayer);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: finalizeFn,
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ["library", "prayer", prayerId] });
      queryClient.invalidateQueries({ queryKey: ["library", "prayers"] });
    },
    onError: (e: unknown) =>
      setErrorMsg(e instanceof Error ? e.message : "This prayer could not be finalized right now."),
  });

  if (!prayer) return null;

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

      <FinalizeSection
        prayer={prayer}
        pending={mut.isPending}
        errorMsg={errorMsg}
        onFinalize={() => {
          setErrorMsg(null);
          mut.mutate({ data: { prayerId } });
        }}
      />

      <Card eyebrow="Prayer" title="Tap any line for its Prayer Roots.">
        <DerivationLegend />
        <div className="mt-4 space-y-3">
          {prayer.lines.map((line) => (
            <LineBlock
              key={line.id}
              line={line}
              missingCitation={prayer.missingCitationLineOrders.includes(line.ordering)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

type PrayerDto = NonNullable<Awaited<ReturnType<typeof getPrayer>>>;

function FinalizeSection({
  prayer,
  pending,
  errorMsg,
  onFinalize,
}: {
  prayer: PrayerDto;
  pending: boolean;
  errorMsg: string | null;
  onFinalize: () => void;
}) {
  // Already-finalized prayers show a durable-library badge, not the action.
  if (prayer.finalizedAt) {
    return (
      <div
        data-testid="prayer-already-finalized"
        className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
      >
        <BookOpenCheck className="mt-0.5 size-4 text-primary" />
        <div>
          <p className="font-medium text-primary">In your prayer library.</p>
          <p className="mt-1 text-muted-foreground">
            This prayer was finalized on {new Date(prayer.finalizedAt).toLocaleDateString()} and is now part of your durable library.
          </p>
        </div>
      </div>
    );
  }

  // Non-durable memory directive: finalization is permanently unavailable.
  if (prayer.memoryDirective !== "normal") {
    const label =
      prayer.memoryDirective === "do_not_remember" ? "Do not remember" : "Session only";
    return (
      <div
        data-testid="prayer-nondurable-block"
        className="flex items-start gap-3 rounded-xl border border-panel-border bg-panel px-4 py-3 text-sm"
      >
        <Lock className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <p className="font-medium">Finalization unavailable — {label}.</p>
          <p className="mt-1 text-muted-foreground">
            This prayer was drafted under a non-durable memory directive, so it cannot be added to your prayer library. Ask Wisdom for a new prayer with <em>Remember normally</em> if you want to keep it.
          </p>
        </div>
      </div>
    );
  }

  // Missing citations: finalization is blocked until every line has a source.
  if (prayer.missingCitationLineOrders.length > 0) {
    const orders = prayer.missingCitationLineOrders;
    const label = orders.length === 1 ? `Line ${orders[0]}` : `Lines ${orders.join(", ")}`;
    return (
      <div
        data-testid="prayer-missing-citations"
        className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        <ShieldAlert className="mt-0.5 size-4" />
        <div>
          <p className="font-medium">Not yet ready to finalize.</p>
          <p className="mt-1 text-destructive/85">
            {label} {orders.length === 1 ? "does" : "do"} not yet have a scripture citation. Every line must be traceable to a passage before this prayer enters your library.
          </p>
        </div>
      </div>
    );
  }

  // Empty prayer: shouldn't happen for a real prayer but handled defensively.
  if (prayer.lines.length === 0) {
    return (
      <div className="rounded-xl border border-panel-border bg-panel px-4 py-3 text-sm text-muted-foreground">
        This prayer has no lines yet.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
      <p className="text-sm font-medium text-primary">Ready to finalize.</p>
      <p className="text-sm text-muted-foreground">
        Finalizing adds this prayer to your durable prayer library, where you can return to it across sessions. Every line is already traceable to scripture.
      </p>
      {errorMsg && (
        <p className="text-sm text-destructive" data-testid="prayer-finalize-error">
          {errorMsg}
        </p>
      )}
      <button
        type="button"
        onClick={onFinalize}
        disabled={pending}
        data-testid="prayer-finalize-btn"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
      >
        <BookOpenCheck className="size-4" />
        {pending ? "Finalizing…" : "Finalize prayer"}
      </button>
    </div>
  );
}

function LineBlock({ line, missingCitation }: { line: Line; missingCitation: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={
        "rounded-lg border bg-surface/30 " +
        (missingCitation ? "border-destructive/40" : "border-panel-border")
      }
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface"
      >
        <MovementBadge movement={line.movement} />
        <p className="flex-1 text-[17px] leading-snug">{line.text}</p>
        {missingCitation && (
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-destructive">
            no citation
          </span>
        )}
        {open ? <ChevronDown className="mt-1 size-4 text-muted-foreground" /> : <ChevronRight className="mt-1 size-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="space-y-2 border-t border-panel-border px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Prayer roots
          </p>
          {line.sources.length === 0 ? (
            <p className="text-xs text-muted-foreground">No source citations recorded for this line.</p>
          ) : (
            line.sources.map((s) => {
              const label = DERIVATION_EXPLANATIONS[s.derivation as keyof typeof DERIVATION_EXPLANATIONS]?.label ?? s.derivation;
              return (
                <div key={s.id} className="rounded border border-panel-border/60 bg-background px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      {s.tier}
                    </span>
                    <span className="text-sm font-medium">{s.reference}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">· {label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.explanation}</p>
                  {s.passageText && (
                    <p className="mt-1 text-[11px] italic text-muted-foreground line-clamp-3">
                      "{s.passageText}"
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
