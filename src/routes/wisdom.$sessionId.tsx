/**
 * Live pipeline results — reads real DB slice + telemetry.
 * Rendered only after startWisdomSession + runWisdomPipeline succeed.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Card,
  DerivationLegend,
  DERIVATION_EXPLANATIONS,
  MovementBadge,
} from "@/components/wisdom/primitives";
import { getSessionSlice, getSessionTelemetry } from "@/lib/wisdom/pipeline.functions";


export const Route = createFileRoute("/wisdom/$sessionId")({
  head: () => ({
    meta: [
      { title: "Live session — Wisdom" },
      { name: "robots", content: "noindex" },
    ],
  }),
  pendingComponent: () => (
    <div className="space-y-4">
      <div className="h-8 w-2/3 animate-pulse rounded bg-surface/60" />
      <div className="h-24 animate-pulse rounded-xl bg-surface/40" />
      <div className="h-40 animate-pulse rounded-xl bg-surface/40" />
      <p className="text-xs text-muted-foreground">Composing your session…</p>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
      <p className="text-sm font-medium text-destructive">Something interrupted this session.</p>
      <p className="text-xs text-muted-foreground break-words">{String(error?.message ?? error)}</p>
      <button
        onClick={() => reset()}
        className="rounded-full border border-panel-border bg-surface px-4 py-1.5 text-xs hover:bg-background"
      >
        Try again
      </button>
      <Link to="/wisdom" className="ml-2 text-xs text-muted-foreground hover:text-foreground">
        Back to sessions
      </Link>
    </div>
  ),
  component: LiveSessionView,
});

const sliceQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ["wisdom-slice", sessionId],
    queryFn: () => getSessionSlice({ data: { sessionId } }),
  });
const telemetryQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ["wisdom-telemetry", sessionId],
    queryFn: () => getSessionTelemetry({ data: { sessionId } }),
  });

function LiveSessionView() {
  const { sessionId } = Route.useParams();
  const { data: slice } = useSuspenseQuery(sliceQuery(sessionId));
  const { data: telemetry } = useSuspenseQuery(telemetryQuery(sessionId));
  const [showTelemetry, setShowTelemetry] = useState(false);

  const prayer = slice.prayer;
  const lines =
    (prayer?.prayer_lines ?? []).sort(
      (a: { ordering: number }, b: { ordering: number }) => a.ordering - b.ordering,
    );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link to="/wisdom" className="text-xs text-muted-foreground hover:text-foreground">
          ← All sessions
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          Live session · real pipeline output
        </p>
        <h1 className="text-3xl leading-tight">
          {slice.interpretation?.headline ?? "Composing…"}
        </h1>
      </header>

      {slice.interpretation && (
        <Card eyebrow="Interpretation" title={slice.interpretation.headline}>
          <p>{slice.interpretation.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Confidence {Math.round((slice.interpretation.confidence ?? 0) * 100)}%
          </p>
        </Card>
      )}

      {slice.discernments.length > 0 && (
        <Card eyebrow="Discernment" title="What could I have wrong?">
          <ul className="space-y-2 text-sm">
            {slice.discernments.map((d: { id: string; kind: string; text: string }) => (
              <li key={d.id} className="rounded-lg border border-panel-border/60 bg-surface/40 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-primary">
                  {d.kind.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-foreground/90">{d.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {prayer && (
        <Card eyebrow="Prayer" title={prayer.title}>
          <DerivationLegend />
          <div className="mt-4 space-y-3">
            {lines.map(
              (line: {
                id: string;
                movement: string;
                text: string;
                prayer_line_sources: Array<{
                  passage_id: string;
                  derivation: keyof typeof DERIVATION_EXPLANATIONS;
                  explanation: string;
                  tier: string;
                }>;
              }) => (
                <div key={line.id} className="relative overflow-hidden rounded-xl border border-panel-border/60 bg-gradient-to-br from-surface/60 via-surface/30 to-transparent p-4">
                  <span aria-hidden className="absolute inset-y-3 left-0 w-[2px] rounded-full bg-primary/40" />
                  <div className="flex flex-wrap items-center gap-2">
                    <MovementBadge movement={line.movement} />
                  </div>
                  <p className="mt-2 font-serif text-[17px] leading-relaxed text-foreground/95">
                    {line.text}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {line.prayer_line_sources.map((s, i) => (
                      <div key={i} className="rounded-lg border border-panel-border/50 bg-background/50 px-3 py-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            {s.tier}
                          </span>
                          <span className="rounded-full border border-panel-border/60 bg-surface/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {DERIVATION_EXPLANATIONS[s.derivation]?.label ?? s.derivation}
                          </span>
                        </div>
                        <p className="mt-1.5 leading-snug text-muted-foreground">{s.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>

              ),
            )}
          </div>
        </Card>
      )}

      {slice.practices.length > 0 && (
        <Card eyebrow="Practice" title={slice.practices[0].title}>
          <p>{slice.practices[0].rationale}</p>
        </Card>
      )}

      <button
        onClick={() => setShowTelemetry((s) => !s)}
        className="flex w-full items-center justify-between rounded-xl border border-panel-border bg-panel px-5 py-3 text-sm hover:bg-surface"
      >
        <span className="font-medium">
          Pipeline telemetry — {telemetry.runs.length} model call{telemetry.runs.length === 1 ? "" : "s"}
        </span>
        {showTelemetry ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>
      {showTelemetry && <TelemetryTable runs={telemetry.runs} />}
    </div>
  );
}

function TelemetryTable({
  runs,
}: {
  runs: Array<{
    stage: string;
    status: string;
    latency_ms: number | null;
    model: string | null;
    prompt_key: string | null;
    prompt_version: number | null;
    tokens_in: number | null;
    tokens_out: number | null;
    error: string | null;
  }>;
}) {
  const totalLatency = runs.reduce((n, r) => n + (r.latency_ms ?? 0), 0);
  const totalTokens = runs.reduce(
    (n, r) => n + (r.tokens_in ?? 0) + (r.tokens_out ?? 0),
    0,
  );
  return (
    <div className="overflow-x-auto rounded-xl border border-panel-border bg-surface/40">
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Stage</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Model</th>
            <th className="px-3 py-2">Prompt</th>
            <th className="px-3 py-2 text-right">Latency</th>
            <th className="px-3 py-2 text-right">Tokens in/out</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r, i) => (
            <tr key={i} className="border-t border-panel-border/50">
              <td className="px-3 py-2 font-medium">{r.stage}</td>
              <td className={`px-3 py-2 ${r.status === "ok" ? "text-primary" : "text-destructive"}`}>
                {r.status}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.model ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.prompt_key ? `${r.prompt_key} v${r.prompt_version}` : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.latency_ms != null ? `${r.latency_ms} ms` : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {(r.tokens_in ?? 0)} / {(r.tokens_out ?? 0)}
              </td>
            </tr>
          ))}
          <tr className="border-t border-panel-border bg-background/40 font-medium">
            <td className="px-3 py-2" colSpan={4}>
              Totals ({runs.length} calls)
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{totalLatency} ms</td>
            <td className="px-3 py-2 text-right tabular-nums">{totalTokens} tok</td>
          </tr>
        </tbody>
      </table>
      <p className="border-t border-panel-border/60 px-3 py-2 text-[11px] text-muted-foreground">
        Cost is metered by Lovable AI Gateway per request; per-call credit cost is not
        returned inline but is available in the workspace usage dashboard, correlated by
        model and prompt key/version shown here.
      </p>
    </div>
  );
}
