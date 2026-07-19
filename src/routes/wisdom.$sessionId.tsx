import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Edit3,
  HelpCircle,
  X,
} from "lucide-react";
import {
  ARCHETYPE_INDEX,
  PASSAGE_INDEX,
  RESPONSES,
  SESSIONS,
} from "@/lib/wisdom/mock/seed";
import { Card, ConfidenceBar, TierChip } from "@/components/wisdom/primitives";
import type {
  PatternHypothesis,
  PrayerLine,
  UserVerdict,
} from "@/lib/wisdom/schemas";

export const Route = createFileRoute("/wisdom/$sessionId")({
  head: ({ params }) => {
    const s = SESSIONS.find((x) => x.id === params.sessionId);
    return {
      meta: [{ title: `${s?.title ?? "Session"} — Wisdom` }, { name: "robots", content: "noindex" }],
    };
  },
  loader: ({ params }) => {
    const session = SESSIONS.find((s) => s.id === params.sessionId);
    const response = RESPONSES[params.sessionId];
    if (!session || !response) throw notFound();
    return { session, response };
  },
  notFoundComponent: () => (
    <p className="text-sm text-muted-foreground">Session not found.</p>
  ),
  errorComponent: () => (
    <p className="text-sm text-destructive">This session could not be loaded.</p>
  ),
  component: SessionView,
});

function SessionView() {
  const { session, response } = Route.useLoaderData();
  const [verdict, setVerdict] = useState<UserVerdict | null>(null);
  const [showDeep, setShowDeep] = useState(session.depth === "deep");
  const primary = response.hypotheses.find((h) => h.id === response.primaryHypothesisId)!;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link to="/wisdom" className="text-xs text-muted-foreground hover:text-foreground">
          ← All sessions
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gold">
          Session · {session.depth} mode
        </p>
        <h1 className="font-serif text-3xl leading-tight">{session.title}</h1>
      </header>

      {/* Original story */}
      <section className="space-y-3">
        {session.messages.map((m) => (
          <blockquote
            key={m.id}
            className="rounded-xl border-l-2 border-gold/40 bg-surface/50 px-4 py-3 text-[15px] leading-relaxed text-foreground/85"
          >
            {m.text}
          </blockquote>
        ))}
      </section>

      {/* 1. What I hear */}
      <Card eyebrow="What I hear" title="Before naming any pattern.">
        <p>{response.whatIHear}</p>
      </Card>

      {/* 2. The pattern I see */}
      <Card
        eyebrow="The pattern I see"
        title={primary.userEditedName ?? primary.name}
        aside={<ConfidenceBar value={primary.confidence} />}
      >
        <p className="text-foreground/85">{primary.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {primary.domains.map((d) => (
            <span
              key={d}
              className="rounded-full border border-surface-border bg-surface px-2.5 py-0.5 text-muted-foreground"
            >
              {d}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-xs hover:bg-surface">
            <Edit3 className="size-3.5" strokeWidth={1.75} /> Rename
          </button>
        </div>
      </Card>

      {/* 3. Why I see it */}
      <Card eyebrow="Why I see it" title="Evidence, not verdict.">
        <p>{response.whyISeeIt}</p>
      </Card>

      {/* 4. Biblical mirror */}
      <Card eyebrow="Biblical mirror" title="A complete narrative, not a proof text.">
        <div className="space-y-4">
          {primary.archetypes.slice(0, 2).map((link) => {
            const arch = ARCHETYPE_INDEX[link.archetypeId];
            return (
              <BiblicalMirrorBlock key={link.archetypeId} link={link} arch={arch} />
            );
          })}
        </div>
      </Card>

      {/* 5. Discernment */}
      <Card eyebrow="Discernment & uncertainty" title="What could I have wrong?">
        <div className="space-y-4">
          <Alternatives hypotheses={response.hypotheses.filter((h) => h.id !== primary.id)} />
          <div className="grid gap-3 md:grid-cols-2">
            <MicroBlock label="Direct vs inferred">{response.discernment.directVsInferred}</MicroBlock>
            <MicroBlock label="Descriptive vs prescriptive">
              {response.discernment.descriptiveVsPrescriptive}
            </MicroBlock>
          </div>
          <MicroBlock label="Counter-evidence">
            <ul className="space-y-1.5">
              {response.discernment.counterEvidence.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <CircleDot className="mt-1 size-3 shrink-0 text-muted-foreground" strokeWidth={2} />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </MicroBlock>
          <div className="rounded-lg border border-gold/30 bg-gold-soft px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gold">
              One distinguishing question
            </p>
            <p className="mt-1 font-serif text-lg leading-snug">
              {response.discernment.distinguishingQuestion}
            </p>
          </div>
        </div>
      </Card>

      {/* 6. Prayer */}
      <Card eyebrow="Prayer" title={response.prayer.title}>
        <p className="mb-4 text-xs text-muted-foreground">
          Every line is traceable. Tap any line to see its Prayer Roots.
        </p>
        <div className="space-y-2">
          {response.prayer.lines.map((line) => (
            <PrayerLineRow key={line.id} line={line} />
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-surface-border bg-surface/40 px-3 py-2 text-xs text-muted-foreground">
          Wisdom does not present generated text as God's direct reply. Lament, waiting, and
          uncertainty are permitted.
        </div>
      </Card>

      {/* 7. One next act */}
      <Card eyebrow="One next act" title={response.primaryAct.title}>
        <p>{response.primaryAct.rationale}</p>
        {response.optionalPractices.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Optional practices
            </p>
            {response.optionalPractices.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-surface-border bg-surface/40 px-4 py-3"
              >
                <p className="text-sm font-medium">{p.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.rationale}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 8. Feedback */}
      <Card eyebrow="Your verdict" title="Is this the pattern?">
        <div className="grid gap-2 sm:grid-cols-4">
          {(["accurate", "partly", "not_accurate", "unsure"] as UserVerdict[]).map((v) => {
            const active = verdict === v;
            const label =
              v === "accurate" ? "Accurate" : v === "partly" ? "Partly" : v === "not_accurate" ? "Not accurate" : "Unsure";
            const Icon = v === "accurate" ? Check : v === "not_accurate" ? X : v === "unsure" ? HelpCircle : CircleDot;
            return (
              <button
                key={v}
                onClick={() => setVerdict(v)}
                className={[
                  "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition",
                  active
                    ? "border-gold bg-gold-soft text-gold"
                    : "border-surface-border text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {label}
              </button>
            );
          })}
        </div>
        {verdict && (
          <p className="mt-3 text-xs text-muted-foreground">
            Recorded to your Journey. Rejected patterns never silently return as accepted facts.
          </p>
        )}
      </Card>

      {/* Deep-mode reveal */}
      <button
        onClick={() => setShowDeep((s) => !s)}
        className="flex w-full items-center justify-between rounded-xl border border-panel-border bg-panel px-5 py-3 text-sm hover:bg-surface"
      >
        <span className="font-medium">Deep mode — signals, event chain, source tiers</span>
        {showDeep ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>

      {showDeep && (
        <div className="space-y-6">
          <Card eyebrow="Persona signals" title="What Wisdom picked up.">
            <ul className="space-y-2 text-sm">
              {response.signals.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {s.kind}
                  </span>
                  <span
                    className={[
                      "rounded px-1.5 py-0.5 text-[10px]",
                      s.explicit ? "bg-olive/15 text-olive" : "bg-blue/15 text-blue",
                    ].join(" ")}
                  >
                    {s.explicit ? "explicit" : "inferred"}
                  </span>
                  <span className="text-foreground/85">{s.paraphrase}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {Math.round(s.confidence * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card eyebrow="Event chain" title="Context → trigger → interpretation → need → choice → reward → cost → afterthought → re-entry.">
            <ol className="space-y-2">
              {response.eventChain.map((l) => (
                <li key={l.id} className="rounded-lg border border-surface-border bg-surface/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-gold">
                      {l.kind.replace("_", " ")}
                    </span>
                    <span
                      className={[
                        "rounded px-1.5 py-0.5 text-[10px]",
                        l.fromUser ? "bg-olive/15 text-olive" : "bg-blue/15 text-blue",
                      ].join(" ")}
                    >
                      {l.fromUser ? "you said" : "inferred"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{l.text}</p>
                </li>
              ))}
            </ol>
          </Card>

          <Card
            eyebrow="Hidden agreement (candidate)"
            title="Not a verdict — a testable candidate."
          >
            <blockquote className="border-l-2 border-gold pl-4 font-serif text-lg italic text-foreground/90">
              “{primary.hiddenAgreementCandidate}”
            </blockquote>
          </Card>

          <Card eyebrow="Fruit to observe" title="What you might notice, over time.">
            <div className="flex flex-wrap gap-2">
              {response.fruitToObserve.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-olive/30 bg-olive/10 px-3 py-1 text-xs text-olive"
                >
                  {f.replace("_", " ")}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              No streaks, scores, or rankings. Setbacks are treated as data, not identity.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

function MicroBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface/40 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm text-foreground/85">{children}</div>
    </div>
  );
}

function BiblicalMirrorBlock({
  link,
  arch,
}: {
  link: { archetypeId: string; whyThisConnection: string; fitScore: number };
  arch: ReturnType<typeof getArch>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-surface-border bg-surface/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-serif text-xl">{arch.person}</p>
          <p className="text-sm text-muted-foreground">{arch.headline}</p>
        </div>
        <ConfidenceBar value={link.fitScore} />
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-foreground/85">{arch.narrativeSummary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {arch.primaryPassages.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-background px-2.5 py-1 text-xs"
          >
            <TierChip tier={p.tier} />
            <span className="font-medium">{p.reference}</span>
          </span>
        ))}
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-3 inline-flex items-center gap-1 text-xs text-gold hover:underline"
      >
        {open ? "Hide" : "Why this connection?"}
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-gold/25 bg-gold-soft px-3 py-2 text-sm">
          {link.whyThisConnection}
        </div>
      )}
    </div>
  );
}
function getArch(): (typeof ARCHETYPE_INDEX)[string] {
  return Object.values(ARCHETYPE_INDEX)[0];
}

function Alternatives({ hypotheses }: { hypotheses: PatternHypothesis[] }) {
  if (hypotheses.length === 0) return null;
  return (
    <div className="rounded-lg border border-surface-border bg-surface/40 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Alternative hypotheses ({hypotheses.length})
      </p>
      <div className="mt-2 space-y-2">
        {hypotheses.map((h) => (
          <div key={h.id} className="rounded-md border border-surface-border bg-background px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{h.name}</p>
              <ConfidenceBar value={h.confidence} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{h.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrayerLineRow({ line }: { line: PrayerLine }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-surface-border bg-surface/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface"
      >
        <span className="mt-0.5 rounded bg-gold-soft px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gold">
          {line.movement}
        </span>
        <p className="flex-1 font-serif text-[17px] leading-snug text-foreground/95">{line.text}</p>
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
          {line.sources.map((src, i) => {
            const passage = PASSAGE_INDEX[src.passageId];
            return (
              <div key={i} className="rounded border border-surface-border bg-background px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <TierChip tier={src.tier} />
                  <span className="text-sm font-medium">{passage.reference}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    · {src.derivation.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{src.explanation}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
