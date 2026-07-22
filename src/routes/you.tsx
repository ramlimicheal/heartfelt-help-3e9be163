import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Shield, X } from "lucide-react";
import { listPersonaFacts, updatePersonaFactStatus } from "@/lib/wisdom/library.functions";

const factsQuery = queryOptions({
  queryKey: ["library", "persona-facts"],
  queryFn: () => listPersonaFacts(),
});

export const Route = createFileRoute("/you")({
  ssr: false,
  head: () => ({ meta: [{ title: "You — memory & persona" }] }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(factsQuery);
  },
  errorComponent: () => (
    <p className="text-sm text-destructive">Your persona graph couldn't load.</p>
  ),
  component: YouPage,
});

type Fact = Awaited<ReturnType<typeof listPersonaFacts>>[number];

function YouPage() {
  const { data: facts } = useSuspenseQuery(factsQuery);
  const queryClient = useQueryClient();
  const updateFn = useServerFn(updatePersonaFactStatus);
  const mut = useMutation({
    mutationFn: updateFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["library", "persona-facts"] }),
  });

  const grouped: Record<string, Fact[]> = { proposed: [], accepted: [], rejected: [] };
  for (const f of facts) {
    const bucket = f.status === "accepted" || f.status === "rejected" ? f.status : "proposed";
    grouped[bucket].push(f);
  }

  const hasAny = facts.length > 0;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">You</p>
        <h1 className="text-3xl leading-tight">Your persona graph.</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Nothing becomes durable memory without your consent. Rejected memory never silently returns.
        </p>
      </header>

      {!hasAny ? (
        <div className="rounded-2xl border border-panel-border bg-panel/60 px-6 py-10 text-center">
          <p className="text-lg">Nothing to confirm yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            As you bring situations to Wisdom, proposals about you will surface here for your review.
          </p>
          <Link to="/wisdom" className="mt-4 inline-block rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground">
            Open Wisdom
          </Link>
        </div>
      ) : (
        (["proposed", "accepted", "rejected"] as const).map((s) =>
          grouped[s].length === 0 ? null : (
            <FactGroup
              key={s}
              label={s}
              items={grouped[s]}
              onChange={(id, next) => mut.mutate({ data: { factId: id, status: next } })}
              pending={mut.isPending}
            />
          ),
        )
      )}
    </div>
  );
}

function FactGroup({
  label, items, onChange, pending,
}: {
  label: "proposed" | "accepted" | "rejected";
  items: Fact[];
  onChange: (id: string, s: "accepted" | "rejected" | "proposed") => void;
  pending: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label} ({items.length})
      </h2>
      {items.map((f) => (
        <div key={f.id} className="rounded-xl border border-panel-border bg-panel px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {f.key && (
              <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {f.key}
              </span>
            )}
            {f.sensitivity === "sensitive" && (
              <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-destructive">
                <Shield className="size-3" /> sensitive
              </span>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {Math.round(f.confidence * 100)}%
            </span>
          </div>
          <p className="mt-2 text-[15px]">{f.text}</p>
          {label !== "accepted" && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {label === "proposed" && (
                <button
                  disabled={pending}
                  onClick={() => onChange(f.id, "accepted")}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary disabled:opacity-50"
                >
                  <Check className="size-3" /> Accept
                </button>
              )}
              <button
                disabled={pending}
                onClick={() => onChange(f.id, "rejected")}
                className="inline-flex items-center gap-1 rounded-md border border-panel-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="size-3" /> Reject
              </button>
              {label === "rejected" && (
                <button
                  disabled={pending}
                  onClick={() => onChange(f.id, "proposed")}
                  className="inline-flex items-center gap-1 rounded-md border border-panel-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Reconsider
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
