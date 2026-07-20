import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding — Wisdom" }] }),
  component: Onboarding,
});

const STEPS = [
  {
    eyebrow: "How memory works",
    title: "Wisdom remembers only what you accept.",
    body: "Anything Wisdom notices about you begins as a proposal. Sensitive or identity-level observations require your explicit confirmation. Rejected notes never silently return. Any message can be marked 'Do not remember'.",
  },
  {
    eyebrow: "Sources are tiered, never flattened",
    title: "You will always see where a claim comes from.",
    body: "Canonical Scripture, historical context, tradition, extra-canonical texts, founder framework, modern analogy, and model hypothesis are labeled separately. Founder interpretation is never presented as direct Scripture.",
  },
  {
    eyebrow: "One next act, not one more chat",
    title: "Wisdom prefers fewer meaningful sessions to endless conversation.",
    body: "No streaks, no scores, no shame notifications. Every deep session ends with one proportionate action. You can always come back and record what happened.",
  },
];

function Onboarding() {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-between px-6 py-10">
        <div className="flex items-center justify-between">
          <Link to="/welcome" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
          <div className="flex gap-1.5">
            {STEPS.map((_, idx) => (
              <span
                key={idx}
                className={[
                  "h-1 w-6 rounded-full transition",
                  idx <= i ? "bg-primary" : "bg-surface",
                ].join(" ")}
              />
            ))}
          </div>
        </div>

        <main className="space-y-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
            {step.eyebrow}
          </p>
          <h1 className="text-3xl leading-tight text-foreground">{step.title}</h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{step.body}</p>
        </main>

        <div>
          {last ? (
            <Link
              to="/wisdom"
              className="block w-full rounded-xl bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground"
            >
              Enter Wisdom
            </Link>
          ) : (
            <button
              onClick={() => setI(i + 1)}
              className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
