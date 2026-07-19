import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import {
  CompetingExplanationsCard,
  DignityAndSafetyCard,
  FormationCheckInCard,
  FourteenCategoriesCard,
  GenerationalTimelineCard,
  PatternBreakingActCard,
  PrayerLineageCard,
  TensionAnalysisCard,
} from "@/components/wisdom/curseBreakerCards";
import { COPY } from "@/lib/wisdom/copy/v1";
import { cbResponse, cbSession } from "@/lib/wisdom/mock/curseBreakerSeed";

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

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link to="/wisdom" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to Wisdom
        </Link>
        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          <ShieldAlert className="size-3.5" strokeWidth={2} />
          {COPY.modes.curse_breaker.label} · seeded example
        </p>
        <h1 className="text-3xl leading-tight">{cbSession.title}</h1>
      </header>

      <section className="space-y-3">
        {cbSession.messages.map((m) => (
          <blockquote
            key={m.id}
            className="rounded-xl border-l-2 border-primary/40 bg-surface/50 px-4 py-3 text-[15px] leading-relaxed text-foreground/85"
          >
            {m.text}
          </blockquote>
        ))}
      </section>

      {/* Card 0 — What I hear (shared with other modes) */}
      <div className="rounded-2xl border border-panel-border bg-surface/60 px-5 py-5 md:px-6 md:py-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
          What I hear
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-foreground/90">
          {cbResponse.whatIHear}
        </p>
      </div>

      <GenerationalTimelineCard points={cbResponse.timeline} />
      <FourteenCategoriesCard interpretations={cbResponse.interpretations} />
      <CompetingExplanationsCard interpretations={cbResponse.interpretations} />
      <TensionAnalysisCard tensions={cbResponse.tensions} />
      <PrayerLineageCard
        lineage={cbResponse.prayerLineage}
        passages={cbResponse.passageIndex}
      />
      <PatternBreakingActCard act={cbResponse.primaryAct} />
      <FormationCheckInCard checkIn={cbResponse.checkIn} />
      <DignityAndSafetyCard dignity={cbResponse.dignity} />
    </div>
  );
}
