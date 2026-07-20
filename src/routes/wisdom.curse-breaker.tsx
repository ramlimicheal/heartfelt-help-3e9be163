import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, ChevronDown, ChevronRight } from "lucide-react";
import { COPY } from "@/lib/wisdom/copy/v1";
import {
  getLatestCurseBreakerReading,
  type CbCategoryRow,
} from "@/lib/wisdom/curseBreaker.functions";

export const Route = createFileRoute("/wisdom/curse-breaker")({
  head: () => ({
    meta: [
      { title: "Curse Breaker — Wisdom" },
      {
        name: "description",
        content:
          "Curse Breaker examines biblical curse and stronghold categories alongside ordinary explanations — with cited evidence, competing hypotheses, and no automatic verdicts.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CurseBreakerRoute,
});

function CurseBreakerRoute() {
  const [consented, setConsented] = useState(false);

  if (!consented) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <Link to="/wisdom" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to Wisdom
          </Link>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
            <ShieldAlert className="size-3.5" strokeWidth={2} />
            {COPY.curseBreaker.heroEyebrow}
          </p>
          <h1 className="text-3xl leading-tight md:text-[38px] md:leading-[1.1]">
            {COPY.curseBreaker.preambleTitle}
          </h1>
        </header>
        <div className="space-y-3 rounded-2xl border border-panel-border bg-surface/40 px-5 py-5 md:px-6 md:py-6">
          {COPY.curseBreaker.preambleBody.map((p, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-foreground/90">
              {p}
            </p>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {COPY.curseBreaker.disclaimers.dignity}
        </p>
        <button
          onClick={() => setConsented(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          {COPY.curseBreaker.preambleConsent}
        </button>
      </div>
    );
  }

  return <CurseBreakerReading />;
}

function CurseBreakerReading() {
  const fn = useServerFn(getLatestCurseBreakerReading);
  const { data, isLoading, error } = useQuery({
    queryKey: ["curse-breaker", "latest"],
    queryFn: () => fn(),
    refetchInterval: 5000,
  });

  const deep = (data?.categories ?? []).filter((c) => c.deep_analyzed);
  const triaged = (data?.categories ?? []).filter((c) => !c.deep_analyzed);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <Link to="/wisdom" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to Wisdom
        </Link>
        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          <ShieldAlert className="size-3.5" strokeWidth={2} />
          {COPY.modes.curse_breaker.label}
        </p>
        <h1 className="text-3xl leading-tight">Latest reading.</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Wisdom scored fourteen stronghold categories against your story, then went deep on
          the ones that met the threshold. Every claim is cited. Nothing is a verdict.
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading your reading…</p>}
      {error && <p className="text-sm text-destructive">Your reading could not be loaded.</p>}

      {!isLoading && !error && !data?.session && (
        <div className="space-y-3 rounded-2xl border border-panel-border bg-surface/40 px-5 py-5 md:px-6 md:py-6">
          <p className="text-[15px] leading-relaxed text-foreground/90">
            No Curse Breaker session yet. Start in Wisdom with <span className="italic">Curse Breaker</span>{" "}
            selected and describe the pattern — the analysis will appear here.
          </p>
          <Link
            to="/wisdom"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Begin in Wisdom →
          </Link>
        </div>
      )}

      {data?.session && (data.categories.length === 0) && (
        <p className="rounded-xl border border-panel-border bg-panel px-5 py-4 text-sm text-muted-foreground">
          Discernment pipeline running… scoring the fourteen categories against your story.
        </p>
      )}

      {deep.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Deep analysis ({deep.length})
          </h2>
          {deep.map((c) => <CategoryCard key={c.id} row={c} defaultOpen />)}
        </section>
      )}

      {triaged.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Triaged, below threshold ({triaged.length})
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {triaged.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-panel-border bg-panel/60 px-3 py-2"
              >
                <span className="text-[13px] capitalize">{c.category.replace(/_/g, " ")}</span>
                <span className="text-[11px] text-muted-foreground">
                  {(c.cheap_score * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CategoryCard({ row, defaultOpen = false }: { row: CbCategoryRow; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const supporting = asStringArray(row.supporting_evidence);
  const counter = asStringArray(row.counter_evidence);
  const alternatives = asStringArray(row.alternative_explanations);
  const citations = asCitationArray(row.citations);

  return (
    <div className="rounded-xl border border-panel-border bg-panel">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
        <span className="text-[15px] capitalize">{row.category.replace(/_/g, " ")}</span>
        <span className="ml-auto flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>triage {(row.cheap_score * 100).toFixed(0)}%</span>
          {row.confidence != null && (
            <span className="text-primary">confidence {(row.confidence * 100).toFixed(0)}%</span>
          )}
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-panel-border px-4 py-4">
          {row.pastoral_note && (
            <p className="text-[14px] leading-relaxed text-foreground/90">{row.pastoral_note}</p>
          )}
          {supporting.length > 0 && (
            <Block label="Supporting evidence" items={supporting} />
          )}
          {counter.length > 0 && <Block label="Counter-evidence" items={counter} />}
          {alternatives.length > 0 && (
            <Block label="Alternative explanations" items={alternatives} />
          )}
          {citations.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Citations ({citations.length})
              </p>
              <ul className="space-y-2">
                {citations.map((c, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-panel-border bg-surface/60 px-3 py-2 text-[13px] leading-relaxed"
                  >
                    <p className="text-muted-foreground">passage {c.passage_id.slice(0, 8)}…</p>
                    {c.note && <p className="mt-1 text-foreground/90">{c.note}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-foreground/90">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function asCitationArray(v: unknown): { passage_id: string; note?: string }[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    if (x && typeof x === "object" && "passage_id" in x && typeof (x as { passage_id: unknown }).passage_id === "string") {
      const o = x as { passage_id: string; note?: unknown };
      return [{ passage_id: o.passage_id, note: typeof o.note === "string" ? o.note : undefined }];
    }
    return [];
  });
}
