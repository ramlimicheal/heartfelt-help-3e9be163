import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Pencil, Shield, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  listPersonaFacts,
  setPersonaFactStatus,
  type JsonValue,
  type PersonaFactRow,
} from "@/lib/wisdom/you.functions";

export const Route = createFileRoute("/you")({
  head: () => ({ meta: [{ title: "You — memory & persona" }] }),
  component: You,
});

const STATUS_ORDER = ["proposed", "accepted", "corrected", "rejected", "session_only", "deleted"] as const;

const STATUS_LABEL: Record<string, string> = {
  proposed: "awaiting your review",
  accepted: "accepted",
  corrected: "corrected",
  rejected: "rejected",
  session_only: "session only",
  deleted: "deleted",
};

function renderValue(v: JsonValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object" && !Array.isArray(v) && "value" in v) {
    const inner = (v as { value: JsonValue }).value;
    if (typeof inner === "string" || typeof inner === "number") return String(inner);
  }
  return JSON.stringify(v);
}

function You() {
  const fn = useServerFn(listPersonaFacts);
  const { data, isLoading, error } = useQuery({
    queryKey: ["persona-facts"],
    queryFn: () => fn(),
  });

  const grouped: Record<string, PersonaFactRow[]> = {};
  for (const f of data ?? []) (grouped[f.status] ??= []).push(f);

  const proposedCount = grouped.proposed?.length ?? 0;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">You</p>
        <h1 className="text-3xl leading-tight">Your persona graph.</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Nothing becomes durable memory without your consent. Accept what fits, correct what's close,
          reject what misreads you. Sensitive proposals require explicit confirmation. Rejected memory never silently returns.
        </p>
        {proposedCount > 0 && (
          <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
            {proposedCount} proposal{proposedCount === 1 ? "" : "s"} awaiting your review
          </p>
        )}
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading your memory…</p>}
      {error && (
        <p className="text-sm text-destructive">Your persona could not be loaded.</p>
      )}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <p className="rounded-xl border border-panel-border bg-panel px-5 py-4 text-sm text-muted-foreground">
          No persona facts yet. Proposals appear here after your first conversations.
        </p>
      )}

      {STATUS_ORDER.map((s) => {
        const items = grouped[s] ?? [];
        if (items.length === 0) return null;
        return <FactGroup key={s} label={STATUS_LABEL[s] ?? s} items={items} />;
      })}
    </div>
  );
}

function FactGroup({ label, items }: { label: string; items: PersonaFactRow[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label} ({items.length})
      </h2>
      {items.map((f) => (
        <FactRow key={f.id} fact={f} />
      ))}
    </section>
  );
}

function FactRow({ fact }: { fact: PersonaFactRow }) {
  const qc = useQueryClient();
  const setStatus = useServerFn(setPersonaFactStatus);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(renderValue(fact.value));

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof setPersonaFactStatus>[0]["data"]) =>
      setStatus({ data: input }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["persona-facts"] });
      qc.invalidateQueries({ queryKey: ["journey-timeline"] });
      const msg =
        vars.status === "accepted"
          ? "Accepted into your persona."
          : vars.status === "corrected"
          ? "Correction saved."
          : vars.status === "rejected"
          ? "Rejected. It won't come back on its own."
          : "Removed.";
      toast.success(msg);
      setEditing(false);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Could not update this fact.");
    },
  });

  const pending = mutation.isPending;
  const isProposed = fact.status === "proposed";
  const isAccepted = fact.status === "accepted";

  return (
    <div className="rounded-xl border border-panel-border bg-panel px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {fact.key}
        </span>
        {fact.sensitivity === "sensitive" && (
          <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-destructive">
            <Shield className="size-3" /> sensitive
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {fact.confidence != null && `${Math.round(fact.confidence * 100)}% · `}
          {fact.origin}
        </span>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full resize-none rounded-md border border-panel-border bg-surface px-3 py-2 text-[15px] outline-none focus:border-primary"
            rows={2}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              disabled={pending || draft.trim().length === 0}
              onClick={() =>
                mutation.mutate({
                  factId: fact.id,
                  status: "corrected",
                  correctedValue: draft.trim(),
                })
              }
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
            >
              <Check className="size-3" /> Save correction
            </button>
            <button
              disabled={pending}
              onClick={() => {
                setDraft(renderValue(fact.value));
                setEditing(false);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-panel-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[15px]">{renderValue(fact.value)}</p>
      )}

      {!editing && isProposed && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            disabled={pending}
            onClick={() => mutation.mutate({ factId: fact.id, status: "accepted" })}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
          >
            <Check className="size-3" />
            {fact.sensitivity === "sensitive" ? "Confirm & accept" : "Accept"}
          </button>
          <button
            disabled={pending}
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-md border border-panel-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-3" /> Correct
          </button>
          <button
            disabled={pending}
            onClick={() => mutation.mutate({ factId: fact.id, status: "rejected" })}
            className="inline-flex items-center gap-1 rounded-md border border-panel-border px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="size-3" /> Reject
          </button>
        </div>
      )}

      {!editing && isAccepted && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            disabled={pending}
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-md border border-panel-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-3" /> Correct
          </button>
          <button
            disabled={pending}
            onClick={() => mutation.mutate({ factId: fact.id, status: "deleted" })}
            className="inline-flex items-center gap-1 rounded-md border border-panel-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3" /> Forget
          </button>
        </div>
      )}
    </div>
  );
}
