import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shield } from "lucide-react";
import { listPersonaFacts, type PersonaFactRow, type JsonValue } from "@/lib/wisdom/you.functions";

export const Route = createFileRoute("/you")({
  head: () => ({ meta: [{ title: "You — memory & persona" }] }),
  component: You,
});

const STATUS_ORDER = ["proposed", "accepted", "corrected", "rejected", "session_only", "deleted"] as const;

const STATUS_LABEL: Record<string, string> = {
  proposed: "proposed",
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
        <div
          key={f.id}
          className="rounded-xl border border-panel-border bg-panel px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {f.key}
            </span>
            {f.sensitivity === "sensitive" && (
              <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-destructive">
                <Shield className="size-3" /> sensitive
              </span>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {f.confidence != null && `${Math.round(f.confidence * 100)}% · `}
              {f.origin}
            </span>
          </div>
          <p className="mt-2 text-[15px]">{renderValue(f.value)}</p>
        </div>
      ))}
    </section>
  );
}
