/**
 * Phase 3B — Curse Breaker v2 layered result renderer.
 *
 * Presentation only. All persistence goes through
 * setCurseBreakerInterpretationStatus. Never leads with a verdict.
 *
 * Visible order (matches the approved design):
 *   1. What Wisdom noticed
 *   2. Evidence from your story
 *   3. What may be contributing
 *   4. A spiritual concern you named (only if user-reported)
 *   5. Biblical and pastoral lenses (each with actions)
 *   6. What remains uncertain
 *   7. Accept / Revise / Reject / Mark unresolved controls (per lens)
 *   8. One small faithful action
 *   9. Qualified-help guidance (when applicable)
 *  10. Cited prayer draft (rendered by parent)
 */
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CB_CONTRIBUTING_LABEL,
  type CurseBreakerResult,
  type PastoralInterpretation,
} from "@/lib/wisdom/unified.schemas";
import {
  setCurseBreakerInterpretationStatus,
  listCurseBreakerInterpretationStatuses,
} from "@/lib/wisdom/curseBreakerActions.functions";

type Status = "unresolved" | "accepted" | "revised" | "rejected";

export function CurseBreakerV2View({
  result,
  wisdomTurnId,
  interactive = true,
}: {
  result: CurseBreakerResult;
  wisdomTurnId?: string;
  interactive?: boolean;
}) {
  const canAct = interactive && Boolean(wisdomTurnId);
  const listFn = useServerFn(listCurseBreakerInterpretationStatuses);
  const qc = useQueryClient();
  const { data: statuses } = useQuery({
    queryKey: ["curseBreaker.interpretations", wisdomTurnId ?? "none"],
    queryFn: () => listFn({ data: { wisdomTurnId: wisdomTurnId! } }),
    enabled: canAct,
  });
  const statusById = useMemo(() => {
    const m = new Map<string, { status: Status; revision: string | null }>();
    for (const s of statuses ?? []) m.set(s.interpretationClientId, { status: s.status, revision: s.revision });
    return m;
  }, [statuses]);

  return (
    <div className="space-y-4">
      {/* 1. WHAT WISDOM NOTICED */}
      <Section eyebrow="What Wisdom noticed">
        <p className="text-[13px] text-foreground/90">
          {result.observed_pattern.summary || result.what_wisdom_heard || "Wisdom is still listening."}
        </p>
      </Section>

      {/* 2. EVIDENCE FROM YOUR STORY */}
      {result.observed_pattern.evidence_quotes.length > 0 && (
        <Section eyebrow="Evidence from your story">
          <ul className="space-y-1.5">
            {result.observed_pattern.evidence_quotes.map((q, i) => (
              <li
                key={i}
                className="rounded-lg border border-panel-border/50 bg-background/40 px-3 py-2 text-[12px] text-foreground/85 italic"
              >
                “{q}”
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 3. CONTRIBUTING INFLUENCES */}
      {result.contributing_influences.length > 0 && (
        <Section eyebrow="What may be contributing" note="Hypotheses, not verdicts.">
          <ul className="space-y-2">
            {result.contributing_influences.map((inf) => (
              <li key={inf.id} className="rounded-lg border border-panel-border/50 bg-background/40 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[12px] font-medium text-foreground/90">
                    {CB_CONTRIBUTING_LABEL[inf.kind] ?? inf.label}
                  </div>
                  {inf.needs_qualified_help && (
                    <span className="text-[10px] uppercase tracking-wider text-amber-400/90">
                      Consider qualified help
                    </span>
                  )}
                </div>
                {inf.explanation && (
                  <p className="mt-1 text-[12px] text-muted-foreground">{inf.explanation}</p>
                )}
                <EvidencePair support={inf.supporting_evidence} counter={inf.counter_evidence} />
                {inf.uncertainty && (
                  <p className="mt-1 text-[11px] text-muted-foreground italic">Uncertainty: {inf.uncertainty}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 4. USER-REPORTED SPIRITUAL CONCERN */}
      {result.user_reported_spiritual_concern.length > 0 && (
        <Section eyebrow="A spiritual concern you named" note="Wisdom holds this because you raised it.">
          <ul className="space-y-1.5">
            {result.user_reported_spiritual_concern.map((c, i) => (
              <li key={i} className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
                <div className="text-[12px] font-medium">{c.concern}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  You told Wisdom: “{c.evidence_from_user}”
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 5–7. PASTORAL / BIBLICAL LENSES WITH ACTIONS */}
      {result.insufficient_evidence ? (
        <Section eyebrow="Biblical and pastoral lenses">
          <p className="text-[12px] text-muted-foreground italic">
            There isn't enough evidence yet to offer a pastoral reading. Insufficient evidence is a
            valid outcome — Wisdom will hold this until more comes to light.
          </p>
        </Section>
      ) : (
        result.pastoral_interpretations.length > 0 && (
          <Section eyebrow="Biblical and pastoral lenses" note="Each is a revisable hypothesis, not a verdict.">
            <ul className="space-y-3">
              {result.pastoral_interpretations.map((interp) => (
                <InterpretationRow
                  key={interp.id}
                  interp={interp}
                  wisdomTurnId={wisdomTurnId}
                  canAct={canAct}
                  saved={statusById.get(interp.id)}
                  onSaved={() =>
                    qc.invalidateQueries({ queryKey: ["curseBreaker.interpretations", wisdomTurnId] })
                  }
                />
              ))}
            </ul>
          </Section>
        )
      )}

      {/* 8. WHAT REMAINS UNCERTAIN */}
      {result.uncertainty_notes.length > 0 && (
        <Section eyebrow="What remains uncertain">
          <ul className="ml-4 list-disc space-y-1 text-[12px] text-muted-foreground">
            {result.uncertainty_notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* 9. ONE SMALL FAITHFUL ACTION */}
      {result.next_faithful_action.text && (
        <Section eyebrow="One small faithful action">
          <p className="text-[13px] text-foreground/90">{result.next_faithful_action.text}</p>
          {result.next_faithful_action.escalation_hint && (
            <p className="mt-2 text-[11px] uppercase tracking-wider text-amber-400/90">
              Consider {result.next_faithful_action.escalation_hint.replace("_", " ")} support
            </p>
          )}
        </Section>
      )}

      {/* 10. QUALIFIED-HELP GUIDANCE */}
      {result.qualified_help_notes.length > 0 && (
        <Section eyebrow="When to reach for qualified help">
          <ul className="space-y-1.5">
            {result.qualified_help_notes.map((n, i) => (
              <li
                key={i}
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px] text-foreground/85"
              >
                {n}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Wisdom is not a replacement for pastoral, medical, mental-health, legal, or emergency care.
          </p>
        </Section>
      )}
    </div>
  );
}

function Section({
  eyebrow,
  note,
  children,
}: {
  eyebrow: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-panel-border/60 bg-surface/40 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</div>
        {note && <div className="text-[10px] italic text-muted-foreground">{note}</div>}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EvidencePair({ support, counter }: { support: string[]; counter: string[] }) {
  if (support.length === 0 && counter.length === 0) return null;
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {support.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Supports</div>
          <ul className="mt-1 space-y-1 text-[11.5px] text-foreground/85">
            {support.map((s, i) => (
              <li key={i} className="border-l-2 border-primary/40 pl-2">{s}</li>
            ))}
          </ul>
        </div>
      )}
      {counter.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pushes back</div>
          <ul className="mt-1 space-y-1 text-[11.5px] text-foreground/85">
            {counter.map((s, i) => (
              <li key={i} className="border-l-2 border-amber-500/40 pl-2">{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InterpretationRow({
  interp,
  wisdomTurnId,
  canAct,
  saved,
  onSaved,
}: {
  interp: PastoralInterpretation;
  wisdomTurnId?: string;
  canAct: boolean;
  saved?: { status: Status; revision: string | null };
  onSaved: () => void;
}) {
  const status: Status = saved?.status ?? "unresolved";
  const [revising, setRevising] = useState(false);
  const [revision, setRevision] = useState(saved?.revision ?? "");
  const [flash, setFlash] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const setStatusFn = useServerFn(setCurseBreakerInterpretationStatus);
  const mutation = useMutation({
    mutationFn: async (input: { status: Status; revision?: string }) =>
      setStatusFn({
        data: {
          wisdomTurnId: wisdomTurnId!,
          interpretationClientId: interp.id,
          status: input.status,
          revision: input.revision,
        },
      }),
    onSuccess: () => {
      setFlash({ kind: "success", text: "Saved." });
      setRevising(false);
      onSaved();
      setTimeout(() => setFlash(null), 1800);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Could not save.";
      setFlash({ kind: "error", text: msg });
      setTimeout(() => setFlash(null), 3500);
    },
  });

  return (
    <li className="rounded-lg border border-panel-border/50 bg-background/40 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[12.5px] font-medium text-foreground/90">{interp.summary}</div>
        <StatusPill status={status} />
      </div>
      {interp.uncertainty && (
        <p className="mt-1 text-[11px] text-muted-foreground italic">Uncertainty: {interp.uncertainty}</p>
      )}
      <EvidencePair support={interp.supporting_evidence} counter={interp.counter_evidence} />
      {interp.biblical_lens.explanation && (
        <p className="mt-2 rounded-md bg-primary/5 px-2 py-1.5 text-[11.5px] text-foreground/85">
          <span className="font-medium">Biblical lens:</span> {interp.biblical_lens.explanation}
          {interp.biblical_lens.contextual_limit && (
            <span className="ml-1 text-muted-foreground italic">
              ({interp.biblical_lens.contextual_limit})
            </span>
          )}
        </p>
      )}
      {saved?.status === "revised" && saved.revision && (
        <p className="mt-2 rounded-md border-l-2 border-primary/60 bg-primary/5 px-2 py-1.5 text-[11.5px]">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Your revision</span>
          <br />
          {saved.revision}
        </p>
      )}

      {canAct && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {revising ? (
            <div className="flex w-full flex-col gap-2">
              <textarea
                value={revision}
                onChange={(e) => setRevision(e.target.value.slice(0, 2000))}
                maxLength={2000}
                placeholder="How would you revise this reading?"
                className="min-h-[70px] w-full rounded-md border border-panel-border bg-background/60 p-2 text-[12px]"
              />
              <div className="flex items-center gap-1.5">
                <ActionButton
                  label="Save revision"
                  primary
                  disabled={revision.trim().length < 3 || mutation.isPending}
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate({ status: "revised", revision: revision.trim() })}
                />
                <ActionButton label="Cancel" onClick={() => setRevising(false)} />
                <span className="ml-auto text-[10px] text-muted-foreground">{revision.length}/2000</span>
              </div>
            </div>
          ) : (
            <>
              <ActionButton
                label="Accept"
                loading={mutation.isPending && mutation.variables?.status === "accepted"}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ status: "accepted" })}
              />
              <ActionButton
                label="Revise"
                disabled={mutation.isPending}
                onClick={() => setRevising(true)}
              />
              <ActionButton
                label="Reject"
                loading={mutation.isPending && mutation.variables?.status === "rejected"}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ status: "rejected" })}
              />
              <ActionButton
                label="Mark unresolved"
                loading={mutation.isPending && mutation.variables?.status === "unresolved"}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ status: "unresolved" })}
              />
            </>
          )}
        </div>
      )}
      {flash && (
        <p
          className={`mt-2 text-[11px] ${flash.kind === "success" ? "text-emerald-400" : "text-destructive"}`}
          role={flash.kind === "error" ? "alert" : undefined}
        >
          {flash.text}
        </p>
      )}
    </li>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { text: string; cls: string }> = {
    unresolved: { text: "Unresolved", cls: "border-muted-foreground/30 text-muted-foreground" },
    accepted: { text: "Accepted", cls: "border-emerald-500/40 text-emerald-400" },
    revised: { text: "Revised", cls: "border-primary/40 text-primary" },
    rejected: { text: "Rejected", cls: "border-destructive/40 text-destructive" },
  };
  const cfg = map[status];
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${cfg.cls}`}>
      {cfg.text}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  loading,
  primary,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
        primary
          ? "border-primary bg-primary text-primary-foreground hover:opacity-90"
          : "border-panel-border/60 bg-background/40 text-foreground/85 hover:bg-background/60"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {loading ? "Saving…" : label}
    </button>
  );
}
