import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getPatternDetail, transitionPatternLifecycle } from "@/lib/wisdom/patterns.functions";
import { Card } from "@/components/wisdom/primitives";


export const Route = createFileRoute("/patterns/$patternId")({
  head: () => ({
    meta: [{ title: "Pattern — Wisdom" }, { name: "robots", content: "noindex" }],
  }),
  component: PatternDetail,
});

function PatternDetail() {
  const { patternId } = Route.useParams();
  const fn = useServerFn(getPatternDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["pattern", patternId],
    queryFn: () => fn({ data: { patternId } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading pattern…</p>;
  if (error) return <p className="text-sm text-destructive">This pattern could not be loaded.</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Pattern not found.</p>;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link to="/patterns" className="text-xs text-muted-foreground hover:text-foreground">
          ← All patterns
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          Pattern · {data.lifecycle}
        </p>
        <h1 className="text-3xl leading-tight">{data.title}</h1>
        {data.description && (
          <p className="text-[15px] leading-relaxed text-muted-foreground">{data.description}</p>
        )}
      </header>

      {data.acceptanceFeedback && (
        <Card eyebrow="Your acceptance feedback" title="Why this landed.">
          <p className="text-foreground/85">{data.acceptanceFeedback}</p>
        </Card>
      )}

      {data.rejectedReason && (
        <Card eyebrow="Rejected" title="Reason recorded.">
          <p className="text-foreground/85">{data.rejectedReason}</p>
        </Card>
      )}

      {data.evidence.length > 0 && (
        <Card eyebrow="Evidence" title="What Wisdom is drawing from.">
          <ul className="space-y-2">
            {data.evidence.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-surface-border bg-surface/40 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
                    {e.kind.replace("_", " ")}
                  </span>
                  {e.confidence != null && (
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(e.confidence * 100)}% confidence
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {new Date(e.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {e.excerpt && <p className="mt-1 text-sm">{e.excerpt}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.practices.length > 0 && (
        <Card eyebrow="Practices" title="One next act, plus optional.">
          <div className="space-y-2">
            {data.practices.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-surface-border bg-surface/40 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{p.title}</p>
                  {p.isPrimary && (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                      primary
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.rationale}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.evidence.length === 0 && data.practices.length === 0 && !data.acceptanceFeedback && !data.rejectedReason && (
        <p className="rounded-xl border border-panel-border bg-panel px-5 py-4 text-sm text-muted-foreground">
          No evidence or practices recorded yet for this pattern.
        </p>
      )}
    </div>
  );
}
