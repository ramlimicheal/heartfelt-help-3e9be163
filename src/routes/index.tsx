import { createFileRoute } from "@tanstack/react-router";
import {
  Sparkles,
  Plus,
  Calendar as CalendarIcon,
  CircleCheck,
  Command,
  ChevronLeft,
  ChevronRight,
  Sunrise,
  Target,
  Lightbulb,
  AudioLines,
  Send,
  MoreHorizontal,
  Navigation,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nova — Your day, in flow" },
      {
        name: "description",
        content:
          "Nova is a calm daily copilot that helps you plan focus time, protect your rhythm, and move forward with intention.",
      },
      { property: "og:title", content: "Nova — Your day, in flow" },
      {
        property: "og:description",
        content: "A calm daily copilot for focused, intentional days.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NovaHome,
});

const green = "#c9f56d";

function NovaHome() {
  return (
    <div className="dark min-h-screen bg-black text-neutral-100 font-sans">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar */}
        <aside className="w-[280px] shrink-0 border-r border-white/5 px-5 py-6">
          <div className="mb-8 flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: green }}
            >
              <Sparkles className="h-4 w-4 text-black" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-medium tracking-tight text-white">Nova</span>
          </div>

          <button className="mb-6 flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-neutral-200 transition hover:bg-white/[0.06]">
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New conversation
            </span>
            <span className="flex items-center gap-0.5 text-[11px] text-neutral-500">
              <Command className="h-3 w-3" />K
            </span>
          </button>

          <nav className="space-y-1">
            <SidebarItem icon={<Sparkles className="h-4 w-4" />} label="Today" active />
            <SidebarItem icon={<CalendarIcon className="h-4 w-4" />} label="Calendar" />
            <SidebarItem icon={<CircleCheck className="h-4 w-4" />} label="Tasks" />
          </nav>

          <div className="mt-8">
            <div className="mb-3 px-3 text-[11px] font-medium tracking-widest text-neutral-500">
              RECENT
            </div>
            <div className="space-y-1">
              <RecentItem label="Plan my week" />
              <RecentItem label="Research brief" />
              <RecentItem label="Trip to New York" />
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-1.5 flex items-center gap-2 text-sm text-neutral-200">
              <Command className="h-3.5 w-3.5 text-neutral-400" />
              <span className="font-medium">Nova shortcuts</span>
            </div>
            <p className="text-xs leading-relaxed text-neutral-500">
              Press{" "}
              <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px] text-neutral-300">
                ⌘ K
              </kbd>{" "}
              anywhere to ask for help.
            </p>
          </div>
        </aside>

        {/* Main */}
        <main className="relative flex flex-1 flex-col px-12 py-6">
          {/* Header */}
          <div className="mb-16 flex items-start justify-between">
            <div>
              <div className="text-[11px] font-medium tracking-widest text-neutral-500">
                TUESDAY, SEPTEMBER 23
              </div>
              <h2 className="mt-1.5 text-lg font-normal text-neutral-100">
                Your day, in flow
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition hover:bg-white/5">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition hover:bg-white/5">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold text-black"
                style={{ backgroundColor: green }}
              >
                AT
              </button>
            </div>
          </div>

          {/* Hero */}
          <div className="flex-1">
            <div
              className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{
                backgroundColor: green,
                boxShadow: `0 0 60px ${green}55`,
              }}
            >
              <Sparkles className="h-5 w-5 text-black" strokeWidth={2.5} />
            </div>

            <div
              className="mb-3 text-sm font-medium"
              style={{ color: green }}
            >
              Good morning, Alex
            </div>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.1] tracking-tight text-white">
              Your day is ready when you are.
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-neutral-400">
              You have 3 open tasks, 2 meetings, and a generous focus window
              before lunch. What would you like to move forward?
            </p>

            {/* Suggestion cards */}
            <div className="mt-10 grid max-w-3xl grid-cols-3 gap-3">
              <SuggestionCard
                icon={<Sunrise className="h-4 w-4" style={{ color: green }} />}
                title="Plan my morning"
                subtitle="Build a calm, focused run"
              />
              <SuggestionCard
                icon={<Target className="h-4 w-4 text-neutral-300" />}
                title="Protect focus time"
                subtitle="Find a 90 minute block"
              />
              <SuggestionCard
                icon={<Sparkles className="h-4 w-4" style={{ color: green }} />}
                title="What needs me?"
                subtitle="Prioritize the important"
              />
            </div>
          </div>

          {/* Composer */}
          <div className="mt-12">
            <div
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.02), 0 0 80px -20px rgba(201,245,109,0.15)",
              }}
            >
              <input
                placeholder="Ask Nova anything…"
                className="w-full bg-transparent px-2 py-2 text-[15px] text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition hover:bg-white/5">
                    <Plus className="h-4 w-4" />
                  </button>
                  <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-neutral-300">
                    <Navigation className="h-3 w-3" />
                    Normal
                  </button>
                  <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-neutral-300">
                    <Lightbulb className="h-3 w-3" />
                    DeepThink
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300">
                    <AudioLines className="h-3 w-3" />
                    Voice
                  </button>
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-black"
                    style={{ backgroundColor: green }}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-neutral-600">
              Your daily copilot can make suggestions, not changes, without your
              approval.
            </p>
          </div>
        </main>

        {/* Right panel */}
        <aside className="w-[340px] shrink-0 border-l border-white/5 px-6 py-6">
          {/* Energy score */}
          <div className="mb-6 flex items-center justify-between">
            <div className="text-[11px] font-medium tracking-widest text-neutral-500">
              DAILY RHYTHM
            </div>
            <MoreHorizontal className="h-4 w-4 text-neutral-500" />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[15px] font-medium text-white">
                  Energy score
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  Up 8% from yesterday
                </div>
              </div>
              <EnergyRing value={68} />
            </div>
            <div className="mt-5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: "68%",
                    background: `linear-gradient(90deg, ${green}88, ${green})`,
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-neutral-500">
                <span>Low</span>
                <span>Typical</span>
                <span>Peak</span>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[11px] font-medium tracking-widest text-neutral-500">
                TODAY'S SCHEDULE
              </div>
              <button className="text-xs text-neutral-400 hover:text-white">
                View all
              </button>
            </div>
            <div className="space-y-3">
              <ScheduleItem
                time="9:30"
                title="Product standup"
                subtitle="Meeting"
                color={green}
              />
              <ScheduleItem
                time="11:00"
                title="Focus: onboarding review"
                subtitle="Deep work"
                color="#a78bfa"
              />
              <ScheduleItem
                time="2:30"
                title="Design critique"
                subtitle="Meeting"
                color={green}
              />
            </div>
          </div>

          {/* Suggested next */}
          <div className="mt-8">
            <div className="mb-4 flex items-center gap-1.5 text-[11px] font-medium tracking-widest text-neutral-500">
              <Sparkles className="h-3 w-3" style={{ color: green }} />
              SUGGESTED NEXT
            </div>
            <div className="space-y-2">
              <SuggestedTask
                iconBg="rgba(201,245,109,0.12)"
                iconColor={green}
                title="Finalize onboarding review"
                subtitle="Due today · 20 min"
              />
              <SuggestedTask
                iconBg="rgba(96,165,250,0.12)"
                iconColor="#60a5fa"
                title="Book flight to New York"
                subtitle="Suggested from your notes"
              />
              <SuggestedTask
                iconBg="rgba(251,191,36,0.12)"
                iconColor="#fbbf24"
                title="Send project update"
                subtitle="Follows up on last Friday"
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "text-black"
          : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
      }`}
      style={active ? { backgroundColor: green } : undefined}
    >
      {icon}
      {label}
    </button>
  );
}

function RecentItem({ label }: { label: string }) {
  return (
    <button className="block w-full truncate rounded-lg px-3 py-1.5 text-left text-sm text-neutral-400 hover:bg-white/5 hover:text-neutral-200">
      {label}
    </button>
  );
}

function SuggestionCard({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.04]">
      <div className="mb-4">{icon}</div>
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-1 text-xs text-neutral-500">{subtitle}</div>
    </button>
  );
}

function EnergyRing({ value }: { value: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative h-12 w-12">
      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="3"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={green}
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
        {value}
      </div>
    </div>
  );
}

function ScheduleItem({
  time,
  title,
  subtitle,
  color,
}: {
  time: string;
  title: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 pt-0.5 text-xs text-neutral-500">{time}</div>
      <div
        className="mt-1 h-8 w-0.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="text-xs text-neutral-500">{subtitle}</div>
      </div>
    </div>
  );
}

function SuggestedTask({
  iconBg,
  iconColor,
  title,
  subtitle,
}: {
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
}) {
  return (
    <button className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition hover:bg-white/[0.04]">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg }}
      >
        <CircleCheck className="h-4 w-4" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-white">{title}</div>
        <div className="truncate text-xs text-neutral-500">{subtitle}</div>
      </div>
    </button>
  );
}
