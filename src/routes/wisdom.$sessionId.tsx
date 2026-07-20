import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSessionDetail } from "@/lib/wisdom/session.functions";
import { Card, ConfidenceBar } from "@/components/wisdom/primitives";

export const Route = createFileRoute("/wisdom/$sessionId")({
  head: () => ({
    meta: [{ title: "Session — Wisdom" }, { name: "robots", content: "noindex" }],
  }),
  component: SessionView,
});

function SessionView() {
  const { sessionId } = Route.useParams();
  const fn = useServerFn(getSessionDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => fn({ data: { sessionId } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading session…</p>;
  if (error) return <p className="text-sm text-destructive">This session could not be loaded.</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Session not found.</p>;

  const userMessages = data.messages.filter((m) => m.role === "user");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link to="/wisdom" className="text-xs text-muted-foreground hover:text-foreground">
          ← All sessions
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          Session · {data.mode}
        </p>
        <h1 className="text-3xl leading-tight">{data.title ?? "Untitled session"}</h1>
      </header>

      {userMessages.length > 0 && (
        <section className="space-y-3">
          {userMessages.map((m) => (
            <blockquote
              key={m.id}
              className="rounded-xl border-l-2 border-primary/40 bg-surface/50 px-4 py-3 text-[15px] leading-relaxed text-foreground/85"
            >
              {m.content}
            </blockquote>
          ))}
        </section>
      )}

      {data.interpretation ? (
        <Card
          eyebrow="What Wisdom hears"
          title={data.interpretation.headline}
          aside={<ConfidenceBar value={data.interpretation.confidence} />}
        >
          <p className="text-foreground/85 whitespace-pre-line">{data.interpretation.body}</p>
        </Card>
      ) : (
        <p className="rounded-xl border border-panel-border bg-panel px-5 py-4 text-sm text-muted-foreground">
          No interpretation has been recorded for this session yet.
        </p>
      )}

      {data.discernments.length > 0 && (
        <Card eyebrow="Discernment & uncertainty" title="What could Wisdom have wrong?">
          <ul className="space-y-2">
            {data.discernments.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border border-surface-border bg-surface/40 px-3 py-2"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-primary">
                  {d.kind.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-sm">{d.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.prayers.length > 0 && (
        <Card eyebrow="Prayer" title="Every line is traceable.">
          <div className="space-y-2">
            {data.prayers.map((p) => (
              <Link
                key={p.id}
                to="/prayers/$prayerId"
                params={{ prayerId: p.id }}
                className="block rounded-lg border border-surface-border bg-surface/40 px-4 py-3 transition hover:bg-surface"
              >
                <p className="text-sm font-medium">{p.title}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {p.mode} · {p.lineCount} lines · with sources
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-surface-border bg-surface/40 px-3 py-2 text-xs text-muted-foreground">
            Wisdom does not present generated text as God's direct reply. Lament, waiting, and
            uncertainty are permitted.
          </div>
        </Card>
      )}

      {data.practices.length > 0 && (
        <Card eyebrow="One next act" title="Small, embodied, testable.">
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
    </div>
  );
}
