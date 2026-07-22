import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Card, ConfidenceBar } from "@/components/wisdom/primitives";
import { getPattern } from "@/lib/wisdom/library.functions";

const patternQuery = (patternId: string) =>
  queryOptions({
    queryKey: ["library", "pattern", patternId],
    queryFn: () => getPattern({ data: { patternId } }),
  });

export const Route = createFileRoute("/patterns/$patternId")({
  head: () => ({
    meta: [
      { title: "Pattern — Wisdom" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(patternQuery(params.patternId));
    if (!data) throw notFound();
  },
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Pattern not found.</p>,
  errorComponent: () => (
    <p className="text-sm text-destructive">This pattern could not be loaded.</p>
  ),
  component: PatternDetail,
});

function PatternDetail() {
  const { patternId } = Route.useParams();
  const { data } = useSuspenseQuery(patternQuery(patternId));
  if (!data) return null;
  const { pattern, evidence } = data;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link to="/patterns" className="text-xs text-muted-foreground hover:text-foreground">
          ← All patterns
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          Pattern · {pattern.status}
        </p>
        <h1 className="text-3xl leading-tight">{pattern.title}</h1>
        {pattern.description && (
          <p className="text-[15px] leading-relaxed text-muted-foreground">{pattern.description}</p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Updated {new Date(pattern.updatedAt).toLocaleString()}
        </p>
      </header>

      {pattern.rejectedReason && (
        <Card eyebrow="Rejected" title="Reason recorded">
          <p>{pattern.rejectedReason}</p>
        </Card>
      )}

      <Card eyebrow="Evidence" title="Where this pattern showed up">
        {evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No evidence recorded yet. This remains a candidate until more sessions confirm or refine it.
          </p>
        ) : (
          <ul className="space-y-2">
            {evidence.map((e) => (
              <li key={e.id} className="rounded-lg border border-panel-border/60 bg-surface/40 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
                    {e.kind}
                  </span>
                  <ConfidenceBar value={e.confidence} />
                </div>
                {e.excerpt && <p className="mt-1 text-sm text-foreground/90">{e.excerpt}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
