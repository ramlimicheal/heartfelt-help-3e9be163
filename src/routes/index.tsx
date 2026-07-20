import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Play, Eye, MessageSquare, Paperclip } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wisdom — Scripture-first pattern and prayer intelligence" },
      {
        name: "description",
        content:
          "Name the pattern beneath your story. See the biblical mirror. Pray with grounded language and take one next faithful step.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Top nav */}
      <header className="mx-auto flex max-w-[1280px] items-center justify-between px-8 py-6">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-md bg-white/10">
              <div className="size-3 rounded-sm bg-white" />
            </div>
            <span className="text-lg font-medium tracking-tight">Wisdom</span>
          </div>
          <nav className="hidden items-center gap-8 text-[13px] font-medium tracking-wider text-white/70 md:flex">
            <a href="#product" className="hover:text-white">PRODUCT</a>
            <a href="#solutions" className="hover:text-white">SOLUTIONS</a>
            <a href="#pricing" className="hover:text-white">PRICING</a>
            <a href="#enterprise" className="hover:text-white">ENTERPRISE</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium hover:bg-white/5"
          >
            Login
          </Link>
          <Link
            to="/auth"
            className="rounded-full bg-white/15 px-5 py-2 text-sm font-medium backdrop-blur hover:bg-white/25"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero panel */}
      <section className="mx-auto max-w-[1280px] px-6">
        <div className="relative overflow-hidden rounded-[28px] p-10 md:p-14"
          style={{
            background:
              "radial-gradient(120% 90% at 15% 40%, #0f5a4d 0%, #0b4a3f 35%, #072e28 70%, #041a17 100%)",
          }}
        >
          {/* Grid overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage:
                "radial-gradient(80% 70% at 40% 50%, black 40%, transparent 100%)",
            }}
          />
          {/* Soft red dot accent */}
          <div className="absolute right-[38%] top-16 size-1.5 rounded-full bg-rose-400 shadow-[0_0_12px_2px_rgba(244,63,94,0.7)]" />

          <div className="relative grid gap-10 md:grid-cols-[1.2fr_1fr]">
            {/* Left: headline */}
            <div className="flex min-h-[520px] flex-col justify-end">
              <div className="mb-6 inline-flex w-fit items-center rounded-md border border-white/20 bg-black/25 px-3 py-1.5 text-[11px] font-medium tracking-[0.18em] text-white/80">
                SCRIPTURE-FIRST. HUMAN STORY. AI DISCERNMENT.
              </div>
              <h1 className="text-5xl font-normal leading-[1.05] tracking-tight text-white md:text-[64px]">
                Name the pattern
                <br />
                beneath your story.
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/70">
                Wisdom mirrors your real life through Scripture, prays with grounded language,
                and suggests one next faithful step—never a verdict.
              </p>
              <div className="mt-8 flex items-center gap-3">
                <Link
                  to="/auth"
                  className="rounded-full bg-white/15 px-6 py-3 text-sm font-medium backdrop-blur hover:bg-white/25"
                >
                  Get Started
                </Link>
                <button className="flex items-center gap-2 rounded-full px-2 py-2 text-sm text-white/90 hover:text-white">
                  <span className="grid size-8 place-items-center rounded-full bg-white/15">
                    <Play className="size-3.5 fill-white" strokeWidth={0} />
                  </span>
                  Watch Demo
                </button>
              </div>
            </div>

            {/* Right: floating cards */}
            <div className="flex flex-col gap-4">
              {/* Progress card */}
              <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-5 backdrop-blur-md">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-3xl font-medium">73%</div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-white/70">
                      Pattern Clarity <span className="text-white/40">ⓘ</span>
                    </div>
                  </div>
                  <div className="text-xs text-white/60">35 / 42</div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[73%] rounded-full bg-gradient-to-r from-emerald-300 to-emerald-500" />
                </div>
              </div>

              {/* Journey mapping card */}
              <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-5 backdrop-blur-md">
                <div className="text-sm font-medium">Pattern & Persona Mapping</div>
                <p className="mt-2 text-xs leading-relaxed text-white/60">
                  Identify the recurring loops and hidden strongholds beneath your story,
                  and trace them to Scripture that mirrors what is happening.
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-white/70">
                    <span className="rounded bg-white/10 px-1.5 py-0.5">↑</span>
                    4/10
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/60">
                    <span className="flex items-center gap-1"><Eye className="size-3.5" /> 40</span>
                    <span className="flex items-center gap-1"><MessageSquare className="size-3.5" /> 12</span>
                    <span className="flex items-center gap-1"><Paperclip className="size-3.5" /> 2</span>
                  </div>
                </div>
              </div>

              {/* Meeting card */}
              <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-5 backdrop-blur-md">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium">Prayer & Formation Circle</div>
                    <div className="mt-1 text-xs text-white/60">◷ STARTS IN 10 MINUTES</div>
                  </div>
                  <button className="flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-[11px] font-medium">
                    JOIN NOW <ArrowUpRight className="size-3" />
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <span className="grid size-5 place-items-center rounded-sm bg-white/15 text-[9px]">W</span>
                    Wisdom Live
                  </div>
                  <div className="flex -space-x-2">
                    {["#f5a", "#fa5", "#5af"].map((c) => (
                      <div key={c} className="size-6 rounded-full border-2 border-[#0b4a3f]" style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom trust strip */}
          <div className="relative mt-14 border-t border-white/10 pt-6">
            <div className="mb-4 text-[11px] font-medium tracking-[0.18em] text-white/60">
              TRUSTED BY PASTORS, COUNSELORS & SEEKERS WORLDWIDE
            </div>
            <div className="flex flex-wrap items-center gap-x-12 gap-y-3 text-white/60">
              {["Refuge", "Sanctuary", "Cornerstone", "Vineyard", "Ekklesia"].map((n) => (
                <span key={n} className="text-lg font-medium tracking-wide">{n}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="h-24" />
    </div>
  );
}
