import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { COPY } from "@/lib/wisdom/copy/v1";

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
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <Link to="/wisdom" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to Wisdom
        </Link>
        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          <ShieldAlert className="size-3.5" strokeWidth={2} />
          {COPY.modes.curse_breaker.label}
        </p>
        <h1 className="text-3xl leading-tight">Bring a situation into Wisdom first.</h1>
      </header>

      <div className="space-y-3 rounded-2xl border border-panel-border bg-surface/40 px-5 py-5 md:px-6 md:py-6">
        <p className="text-[15px] leading-relaxed text-foreground/90">
          Curse Breaker analyses run against a real conversation — one where you've
          described the pattern in your own words. Start in Wisdom with{" "}
          <span className="italic">Curse Breaker</span> mode selected. When the
          pipeline has weighed the fourteen categories against Scripture, the
          discernment will appear here, cited and revisable.
        </p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Nothing seeded, nothing pre-decided. The category set is held open until
          your own evidence gives Wisdom something to weigh.
        </p>
      </div>

      <Link
        to="/wisdom"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        Begin in Wisdom →
      </Link>
    </div>
  );
}
