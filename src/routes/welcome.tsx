import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome to Wisdom" },
      {
        name: "description",
        content:
          "Wisdom helps you name the pattern beneath your story, find the biblical mirror, and pray with grounded language.",
      },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-between px-6 py-12">
        <header className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-gold-soft text-gold">
            <Sparkles className="size-4" strokeWidth={1.75} />
          </span>
          <span className="font-serif text-xl">Wisdom</span>
        </header>

        <main className="space-y-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gold">
            Scripture-first
          </p>
          <h1 className="font-serif text-4xl leading-[1.1] text-foreground md:text-5xl">
            Tell Wisdom what is happening. It will help you see the pattern.
          </h1>
          <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Not a chatbot. Not a verse-finder. Wisdom listens to your real story, names the
            pattern beneath it, retrieves a complete biblical mirror, prays with you in language
            traceable to Scripture, and suggests one next faithful step. You control what it
            remembers about you.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { k: "01", t: "Person", d: "Tell your story in your own words." },
              { k: "02", t: "Pattern", d: "See the loop underneath, as a hypothesis you can test." },
              { k: "03", t: "Practice", d: "Pray with lineage, and take one next act." },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded-xl border border-panel-border bg-panel px-4 py-4"
              >
                <p className="font-serif text-lg text-gold">{s.k}</p>
                <p className="mt-2 text-sm font-medium">{s.t}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </main>

        <footer className="flex flex-col gap-3 sm:flex-row">
          <Link
            to="/onboarding"
            className="flex-1 rounded-xl bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Begin
          </Link>
          <Link
            to="/wisdom"
            className="flex-1 rounded-xl border border-panel-border bg-panel px-5 py-3 text-center text-sm font-medium transition hover:bg-surface"
          >
            Enter as guest
          </Link>
        </footer>
      </div>
    </div>
  );
}
