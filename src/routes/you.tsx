import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Shield, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { listPersonaFacts, updatePersonaFactStatus } from "@/lib/wisdom/library.functions";
import { confirmSensitivePersonaFact } from "@/lib/wisdom/persona.functions";

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
  const confirmFn = useServerFn(confirmSensitivePersonaFact);

  const [pendingConfirmId, setPendingConfirmId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["library", "persona-facts"] });

  const mut = useMutation({
    mutationFn: updateFn,
    onSuccess: () => invalidate(),
    onError: (e: unknown) => setErrorMsg(e instanceof Error ? e.message : "Update failed"),
  });

  const confirmMut = useMutation({
    mutationFn: confirmFn,
    onError: (e: unknown) =>
      setErrorMsg(e instanceof Error ? e.message : "Confirmation failed"),
  });

  const grouped: Record<string, Fact[]> = { proposed: [], accepted: [], rejected: [] };
  for (const f of facts) {
    const bucket = f.status === "accepted" || f.status === "rejected" ? f.status : "proposed";
    grouped[bucket].push(f);
  }

  const hasAny = facts.length > 0;

  const requestAccept = (f: Fact) => {
    setErrorMsg(null);
    // Session-only / DNR facts can never be accepted as durable persona memory.
    if (f.memoryDirective === "session_only" || f.memoryDirective === "do_not_remember") {
      setErrorMsg(
        "This fact was captured under a non-durable memory directive. Ask Wisdom about it in a new turn with 'Remember normally' to create a durable proposal.",
      );
      return;
    }
    if (f.sensitivity === "sensitive") {
      setPendingConfirmId(f.id);
      return;
    }
    mut.mutate({ data: { factId: f.id, status: "accepted" } });
  };

  const finalizeSensitive = async (factId: string) => {
    setErrorMsg(null);
    try {
      await confirmMut.mutateAsync({ data: { factId } });
      await mut.mutateAsync({ data: { factId, status: "accepted" } });
      setPendingConfirmId(null);
    } catch {
      /* handlers already surfaced */
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">You</p>
        <h1 className="text-3xl leading-tight">Your persona graph.</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Nothing becomes durable memory without your consent. Sensitive proposals require an explicit confirmation before they are accepted. Rejected memory never silently returns.
        </p>
      </header>

      {errorMsg && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

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
              pending={mut.isPending || confirmMut.isPending}
              pendingConfirmId={pendingConfirmId}
              onAccept={requestAccept}
              onCancelConfirm={() => setPendingConfirmId(null)}
              onFinalizeSensitive={finalizeSensitive}
              onReject={(id) => mut.mutate({ data: { factId: id, status: "rejected" } })}
              onReconsider={(id) => mut.mutate({ data: { factId: id, status: "proposed" } })}
            />
          ),
        )
      )}
    </div>
  );
}

function FactGroup({
  label,
  items,
  pending,
  pendingConfirmId,
  onAccept,
  onCancelConfirm,
  onFinalizeSensitive,
  onReject,
  onReconsider,
}: {
  label: "proposed" | "accepted" | "rejected";
  items: Fact[];
  pending: boolean;
  pendingConfirmId: string | null;
  onAccept: (f: Fact) => void;
  onCancelConfirm: () => void;
  onFinalizeSensitive: (id: string) => void;
  onReject: (id: string) => void;
  onReconsider: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label} ({items.length})
      </h2>
      {items.map((f) => {
        const confirming = pendingConfirmId === f.id;
        const nonDurable =
          f.memoryDirective === "session_only" || f.memoryDirective === "do_not_remember";
        return (
          <div key={f.id} className="rounded-xl border border-panel-border bg-panel px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {f.key && (
                <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {f.key}
                </span>
              )}
              {f.sensitivity === "sensitive" && (
                <span
                  data-testid="fact-sensitive-badge"
                  className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-destructive"
                >
                  <Shield className="size-3" /> sensitive
                </span>
              )}
              {nonDurable && (
                <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {f.memoryDirective === "do_not_remember" ? "not remembered" : "session only"}
                </span>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {Math.round(f.confidence * 100)}%
              </span>
            </div>
            <p className="mt-2 text-[15px]">{f.text}</p>

            {confirming && f.sensitivity === "sensitive" && (
              <div
                data-testid="fact-confirm-panel"
                className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive"
              >
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 size-3.5" />
                  <div className="flex-1">
                    <div className="font-medium">This proposal is sensitive.</div>
                    <p className="mt-1 text-destructive/85">
                      Accepting it stores it as durable persona memory that Wisdom can recall in future sessions. Only continue if you want it remembered.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        disabled={pending}
                        onClick={() => onFinalizeSensitive(f.id)}
                        data-testid="fact-confirm-accept"
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/60 bg-destructive px-2.5 py-1 text-xs text-destructive-foreground disabled:opacity-50"
                      >
                        <Check className="size-3" /> Confirm & accept
                      </button>
                      <button
                        disabled={pending}
                        onClick={onCancelConfirm}
                        className="inline-flex items-center gap-1 rounded-md border border-panel-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {label !== "accepted" && !confirming && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {label === "proposed" && !nonDurable && (
                  <button
                    disabled={pending}
                    onClick={() => onAccept(f)}
                    data-testid="fact-accept-btn"
                    className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary disabled:opacity-50"
                  >
                    <Check className="size-3" /> Accept
                  </button>
                )}
                <button
                  disabled={pending}
                  onClick={() => onReject(f.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-panel-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <X className="size-3" /> Reject
                </button>
                {label === "rejected" && (
                  <button
                    disabled={pending}
                    onClick={() => onReconsider(f.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-panel-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Reconsider
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
