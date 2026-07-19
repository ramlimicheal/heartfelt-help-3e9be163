import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { SESSIONS } from "@/lib/wisdom/mock/seed";

export const Route = createFileRoute("/wisdom/")({
  head: () => ({ meta: [{ title: "Wisdom — Sessions" }] }),
  component: WisdomList,
});

function WisdomList() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gold">
          Wisdom
        </p>
        <h1 className="font-serif text-3xl leading-tight md:text-4xl">
          Tell Wisdom what is happening.
        </h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Write in your own words. You will see structured cards, not a message stream — what
          Wisdom hears, the pattern beneath it, the biblical mirror, a prayer with lineage,
          and one next act.
        </p>
      </header>

      <section className="rounded-2xl border border-panel-border bg-panel p-5">
        <label htmlFor="story" className="block text-xs font-medium text-muted-foreground">
          Start a new session
        </label>
        <textarea
          id="story"
          placeholder="What is on your mind? What has been repeating?"
          className="mt-3 h-32 w-full resize-none rounded-lg border border-surface-border bg-background px-4 py-3 text-[15px] leading-relaxed placeholder:text-muted-foreground/70 focus:border-gold focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-2 text-xs">
            {["Companion", "Pattern", "Deep"].map((mode, i) => (
              <button
                key={mode}
                className={[
                  "rounded-full border px-3 py-1 transition",
                  i === 1
                    ? "border-gold bg-gold-soft text-gold"
                    : "border-surface-border text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {mode}
              </button>
            ))}
          </div>
          <Link
            to="/wisdom/$sessionId"
            params={{ sessionId: SESSIONS[0].id }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <Sparkles className="size-3.5" strokeWidth={2} />
            Open seeded example
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Recent sessions
        </h2>
        {SESSIONS.map((s) => (
          <Link
            key={s.id}
            to="/wisdom/$sessionId"
            params={{ sessionId: s.id }}
            className="group flex items-start gap-4 rounded-xl border border-panel-border bg-panel px-4 py-4 transition hover:bg-surface"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-lg leading-snug">{s.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {s.messages[0].text}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                {s.depth} mode · {new Date(s.createdAt).toLocaleDateString()}
              </p>
            </div>
            <ArrowRight
              className="mt-1 size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground"
              strokeWidth={1.75}
            />
          </Link>
        ))}
      </section>
    </div>
  );
}
