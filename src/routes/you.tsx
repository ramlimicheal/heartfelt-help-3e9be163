import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Shield, Trash2, X } from "lucide-react";
import { PERSONA_FACTS } from "@/lib/wisdom/mock/seed";
import type { MemoryStatus, PersonaFact } from "@/lib/wisdom/schemas";

export const Route = createFileRoute("/you")({
  head: () => ({ meta: [{ title: "You — memory & persona" }] }),
  component: You,
});

function You() {
  const [facts, setFacts] = useState<PersonaFact[]>(PERSONA_FACTS);
  const update = (id: string, status: MemoryStatus) =>
    setFacts((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));

  const grouped: Record<MemoryStatus, PersonaFact[]> = {
    session_only: [],
    proposed: [],
    accepted: [],
    rejected: [],
    sensitive: [],
    deleted: [],
  };
  facts.forEach((f) => grouped[f.status].push(f));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">You</p>
        <h1 className="text-3xl leading-tight">Your persona graph.</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Nothing becomes durable memory without your consent. Sensitive or identity-level
          proposals require explicit confirmation. Rejected memory never silently returns.
        </p>
      </header>

      {(["proposed", "sensitive", "accepted", "rejected"] as MemoryStatus[]).map((s) => (
        <FactGroup key={s} label={s} items={grouped[s] ?? []} onChange={update} />
      ))}
    </div>
  );
}

function FactGroup({
  label,
  items,
  onChange,
}: {
  label: MemoryStatus;
  items: PersonaFact[];
  onChange: (id: string, s: MemoryStatus) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label} ({items.length})
      </h2>
      {items.map((f) => (
        <div
          key={f.id}
          className="rounded-xl border border-panel-border bg-panel px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {f.domain}
            </span>
            {f.sensitivity === "sensitive" && (
              <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-destructive">
                <Shield className="size-3" /> sensitive
              </span>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {Math.round(f.confidence * 100)}% · from {f.evidenceMessageIds.length} messages
            </span>
          </div>
          <p className="mt-2 text-[15px]">{f.value}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => onChange(f.id, "accepted")}
              className="inline-flex items-center gap-1 rounded-md border border-olive/40 bg-olive/10 px-2.5 py-1 text-xs text-olive"
            >
              <Check className="size-3" /> Accept
            </button>
            <button
              onClick={() => onChange(f.id, "rejected")}
              className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" /> Reject
            </button>
            <button
              onClick={() => onChange(f.id, "deleted")}
              className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3" /> Delete
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
