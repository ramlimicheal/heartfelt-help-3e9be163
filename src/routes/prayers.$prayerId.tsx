import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronDown, ChevronRight, GitBranch, MessageSquare } from "lucide-react";
import { getPrayerDetail, type PrayerLineDetail } from "@/lib/wisdom/prayers.functions";
import { Card, TierChip } from "@/components/wisdom/primitives";

export const Route = createFileRoute("/prayers/$prayerId")({
  head: () => ({
    meta: [{ title: "Prayer — Wisdom" }, { name: "robots", content: "noindex" }],
  }),
  component: PrayerDetail,
});

function PrayerDetail() {
  const { prayerId } = Route.useParams();
  const fn = useServerFn(getPrayerDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["prayer", prayerId],
    queryFn: () => fn({ data: { prayerId } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading prayer…</p>;
  if (error) return <p className="text-sm text-destructive">This prayer could not be loaded.</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Prayer not found.</p>;

  const hasRoots = data.linkedPatterns.length > 0 || Boolean(data.sessionId);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link to="/prayers" className="text-xs text-muted-foreground hover:text-foreground">
          ← All prayers
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          Prayer · {data.mode}
        </p>
        <h1 className="text-3xl leading-tight">{data.title}</h1>
      </header>

      {hasRoots && (
        <Card eyebrow="Roots" title="Where this prayer came from.">
          <div className="space-y-2">
            {data.linkedPatterns.map((p) => (
              <Link
                key={p.id}
                to="/patterns/$patternId"
                params={{ patternId: p.id }}
                className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface/40 px-3 py-2 text-sm transition hover:bg-surface"
              >
                <GitBranch className="size-3.5 text-primary" />
                <span className="flex-1">{p.title}</span>
                <span className="rounded bg-background/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {p.lifecycle}
                </span>
              </Link>
            ))}
            {data.sessionId && (
              <Link
                to="/wisdom/$sessionId"
                params={{ sessionId: data.sessionId }}
                className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface/40 px-3 py-2 text-sm transition hover:bg-surface"
              >
                <MessageSquare className="size-3.5 text-primary" />
                <span className="flex-1">Originating Wisdom session</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Open</span>
              </Link>
            )}
          </div>
        </Card>
      )}

      <Card eyebrow="The prayer" title="Tap any line for its Prayer Roots.">
        <div className="space-y-3">
          {data.lines.map((line) => (
            <LineBlock key={line.id} line={line} />
          ))}
          {data.lines.length === 0 && (
            <p className="text-sm text-muted-foreground">No lines recorded for this prayer.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function LineBlock({ line }: { line: PrayerLineDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-surface-border bg-surface/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface"
      >
        <span className="mt-0.5 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
          {line.movement}
        </span>
        <p className="flex-1 text-[17px] leading-snug">{line.text}</p>
        {open ? (
          <ChevronDown className="mt-1 size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-1 size-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="space-y-2 border-t border-surface-border px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Prayer roots
          </p>
          {line.sources.length === 0 && (
            <p className="text-xs text-muted-foreground">No sources recorded for this line.</p>
          )}
          {line.sources.map((src) => (
            <div key={src.id} className="rounded border border-surface-border bg-background px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <TierChip tier={src.tier as never} />
                <span className="text-sm font-medium">{src.reference}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  · {src.derivation.replace("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{src.explanation}</p>
              {src.passageText && (
                <p className="mt-1 text-[11px] italic text-muted-foreground">
                  {src.passageText}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
