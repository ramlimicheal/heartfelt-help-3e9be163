import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/wisdom/primitives";

export const Route = createFileRoute("/settings/privacy")({
  head: () => ({ meta: [{ title: "Privacy & memory — Wisdom" }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Privacy</p>
        <h1 className="text-3xl leading-tight">Your data, your controls.</h1>
      </header>

      <Card eyebrow="Do not remember" title="Per-message control.">
        <p>
          Any message can be marked <b>Do not remember</b>. Such messages are excluded from
          durable persona extraction and never produce proposals.
        </p>
      </Card>

      <Card eyebrow="Rejected memory" title="Never silently returns.">
        <p>
          When you reject a proposed fact or a pattern, it stays rejected. The context assembler
          excludes rejected items from all future reasoning.
        </p>
      </Card>

      <Card eyebrow="Sensitive facts" title="Explicit confirmation required.">
        <p>
          Sensitive or identity-level facts (for example, statements about who you are, not
          only what you did) require explicit confirmation before becoming accepted memory.
        </p>
      </Card>

      <Card eyebrow="Export & delete" title="Your data leaves cleanly.">
        <p>
          You can export your sessions, patterns, prayers, and formation events at any time.
          Deletion removes the row and excludes it from retrieval.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-lg border border-panel-border bg-panel px-3 py-1.5 text-sm hover:bg-surface">
            Export my data
          </button>
          <button className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/20">
            Delete my data
          </button>
          <button className="rounded-lg border border-panel-border bg-panel px-3 py-1.5 text-sm hover:bg-surface">
            Disable memory
          </button>
        </div>
      </Card>

      <Card eyebrow="What Wisdom refuses" title="Guardrails, in plain language.">
        <ul className="space-y-2 text-sm text-foreground/85">
          <li>— No claim that generated text is God's direct reply to you.</li>
          <li>— No verdict of possession, family curse, or supernatural cause from thin evidence.</li>
          <li>— No inference of addiction, health, sin, or moral state from a photo.</li>
          <li>— No guaranteed material outcomes from prayer or visualization.</li>
          <li>— No prescription of fasting duration from a repeated biblical number alone.</li>
          <li>— No streaks, faith scores, shame notifications, or public rankings.</li>
        </ul>
      </Card>
    </div>
  );
}
