import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getPatternDetail,
  setPracticeAssignment,
  transitionPatternLifecycle,
  type PatternPracticeItem,
  type PracticeAssignmentStatus,
} from "@/lib/wisdom/patterns.functions";
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
  const transitionFn = useServerFn(transitionPatternLifecycle);
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["pattern", patternId],
    queryFn: () => fn({ data: { patternId } }),
  });

  const transition = useMutation({
    mutationFn: (lifecycle: "accepted" | "rejected" | "reconsidered") =>
      transitionFn({ data: { patternId, lifecycle, feedback: feedback.trim() || undefined } }),
    onSuccess: () => {
      setFeedback("");
      qc.invalidateQueries({ queryKey: ["pattern", patternId] });
      qc.invalidateQueries({ queryKey: ["patterns"] });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading pattern…</p>;
  if (error) return <p className="text-sm text-destructive">This pattern could not be loaded.</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Pattern not found.</p>;

  const isTerminal = data.lifecycle === "accepted" || data.lifecycle === "rejected";


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

      <Card
        eyebrow="Your discernment"
        title={
          isTerminal
            ? data.lifecycle === "accepted"
              ? "You accepted this pattern."
              : "You rejected this pattern."
            : "Do you recognize this pattern in your life?"
        }
      >
        <p className="text-[13px] text-muted-foreground">
          {isTerminal
            ? "You can reconsider it if something shifts."
            : "No verdict. Accept if it lands, reject if it doesn't, or reconsider later."}
        </p>
        {!isTerminal && (
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder="Optional: a sentence about what makes this land — or not."
            className="mt-3 w-full resize-none rounded-lg border border-panel-border bg-background/60 px-3 py-2 text-[13px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {!isTerminal && (
            <>
              <button
                onClick={() => transition.mutate("accepted")}
                disabled={transition.isPending}
                className="rounded-full bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => transition.mutate("rejected")}
                disabled={transition.isPending}
                className="rounded-full border border-panel-border bg-background/60 px-3 py-1.5 text-[12px] text-foreground/80 transition hover:bg-surface disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          {isTerminal && (
            <button
              onClick={() => transition.mutate("reconsidered")}
              disabled={transition.isPending}
              className="rounded-full border border-panel-border bg-background/60 px-3 py-1.5 text-[12px] text-foreground/80 transition hover:bg-surface disabled:opacity-50"
            >
              Reconsider
            </button>
          )}
          {transition.error && (
            <span className="text-[11px] text-destructive">
              {(transition.error as Error).message}
            </span>
          )}
        </div>
      </Card>


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
        <Card eyebrow="Practices" title="Commit to one next act.">
          <div className="space-y-2">
            {data.practices.map((p) => (
              <PracticeRow key={p.id} patternId={patternId} practice={p} />
            ))}
          </div>
        </Card>
      )}

      <Card eyebrow="Take it deeper" title="Bring this pattern into Wisdom.">
        <p className="text-[13px] text-muted-foreground">
          Open a new turn pre-filled with this pattern so diagnosis flows straight into
          prayer and practice.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/wisdom"
            search={{
              mode: "deep",
              prompt: `Help me discern the pattern: "${data.title}". ${data.description ?? ""}`.trim(),
            }}
            className="rounded-full bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90"
          >
            Take to Wisdom · Deep
          </Link>
          <Link
            to="/wisdom"
            search={{
              mode: "companion",
              prompt: `Pray with me over this pattern in my life: "${data.title}".`,
            }}
            className="rounded-full border border-panel-border bg-background/60 px-3 py-1.5 text-[12px] text-foreground/80 transition hover:bg-surface"
          >
            Pray it through · Companion
          </Link>
        </div>
      </Card>


      {data.evidence.length === 0 && data.practices.length === 0 && !data.acceptanceFeedback && !data.rejectedReason && (
        <p className="rounded-xl border border-panel-border bg-panel px-5 py-4 text-sm text-muted-foreground">
          No evidence or practices recorded yet for this pattern.
        </p>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<PracticeAssignmentStatus, string> = {
  pending: "pending",
  committed: "committed",
  completed: "completed",
  skipped: "skipped",
  abandoned: "abandoned",
};

function PracticeRow({
  patternId,
  practice,
}: {
  patternId: string;
  practice: PatternPracticeItem;
}) {
  const setFn = useServerFn(setPracticeAssignment);
  const qc = useQueryClient();
  const mutate = useMutation({
    mutationFn: (status: "committed" | "completed" | "skipped") =>
      setFn({ data: { practiceId: practice.id, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pattern", patternId] });
      qc.invalidateQueries({ queryKey: ["journey"] });
    },
  });
  const status = practice.assignmentStatus;
  const isCompleted = status === "completed";
  return (
    <div className="rounded-lg border border-surface-border bg-surface/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{practice.title}</p>
        {practice.isPrimary && (
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
            primary
          </span>
        )}
        {status && (
          <span className="ml-auto rounded-full border border-panel-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{practice.rationale}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!isCompleted && status !== "committed" && (
          <button
            onClick={() => mutate.mutate("committed")}
            disabled={mutate.isPending}
            className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            Commit
          </button>
        )}
        {!isCompleted && (
          <button
            onClick={() => mutate.mutate("completed")}
            disabled={mutate.isPending}
            className="rounded-full border border-panel-border bg-background/60 px-3 py-1.5 text-[11px] text-foreground/80 transition hover:bg-surface disabled:opacity-50"
          >
            Mark done
          </button>
        )}
        {!isCompleted && (
          <button
            onClick={() => mutate.mutate("skipped")}
            disabled={mutate.isPending}
            className="rounded-full border border-panel-border bg-background/60 px-3 py-1.5 text-[11px] text-muted-foreground transition hover:bg-surface disabled:opacity-50"
          >
            Skip
          </button>
        )}
        {mutate.error && (
          <span className="text-[11px] text-destructive">
            {(mutate.error as Error).message}
          </span>
        )}
      </div>
    </div>
  );
}

