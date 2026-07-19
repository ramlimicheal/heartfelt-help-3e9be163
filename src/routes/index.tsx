import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  Sun,
  Moon,
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

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

function NovaHome() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar */}
        <aside className="w-[280px] shrink-0 border-r border-panel-border px-5 py-6">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-medium tracking-tight text-foreground">Nova</span>
          </div>

          <button className="mb-6 flex w-full items-center justify-between rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm text-foreground transition hover:bg-surface-hover">
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New conversation
            </span>
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <Command className="h-3 w-3" />K
            </span>
          </button>

          <nav className="space-y-1">
            <SidebarItem icon={<Sparkles className="h-4 w-4" />} label="Today" active />
            <SidebarItem icon={<CalendarIcon className="h-4 w-4" />} label="Calendar" />
            <SidebarItem icon={<CircleCheck className="h-4 w-4" />} label="Tasks" />
          </nav>

          <div className="mt-8">
            <div className="mb-3 px-3 text-[11px] font-medium tracking-widest text-muted-foreground">
              RECENT
            </div>
            <div className="space-y-1">
              <RecentItem label="Plan my week" />
              <RecentItem label="Research brief" />
              <RecentItem label="Trip to New York" />
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-surface-border bg-surface p-4">
            <div className="mb-1.5 flex items-center gap-2 text-sm text-foreground">
              <Command className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Nova shortcuts</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Press{" "}
              <kbd className="rounded border border-surface-border bg-surface px-1 py-0.5 text-[10px] text-foreground">
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
              <div className="text-[11px] font-medium tracking-widest text-muted-foreground">
                TUESDAY, SEPTEMBER 23
              </div>
              <h2 className="mt-1.5 text-lg font-normal text-foreground">Your day, in flow</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggle}
                aria-label="Toggle theme"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-muted-foreground transition hover:bg-surface-hover">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-muted-foreground transition hover:bg-surface-hover">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                AT
              </button>
            </div>
          </div>

          {/* Hero */}
          <div className="flex-1">
            <div
              className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary"
              style={{ boxShadow: "0 0 60px var(--primary-glow)" }}
            >
              <Sparkles className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
            </div>

            <div className="mb-3 text-sm font-medium text-primary">Good morning, Alex</div>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.1] tracking-tight text-foreground">
              Your day is ready when you are.
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              You have 3 open tasks, 2 meetings, and a generous focus window before lunch. What
              would you like to move forward?
            </p>

            <div className="mt-10 grid max-w-3xl grid-cols-3 gap-3">
              <SuggestionCard
                icon={<Sunrise className="h-4 w-4 text-primary" />}
                title="Plan my morning"
                subtitle="Build a calm, focused run"
              />
              <SuggestionCard
                icon={<Target className="h-4 w-4 text-foreground/80" />}
                title="Protect focus time"
                subtitle="Find a 90 minute block"
              />
              <SuggestionCard
                icon={<Sparkles className="h-4 w-4 text-primary" />}
                title="What needs me?"
                subtitle="Prioritize the important"
              />
            </div>
          </div>

          {/* Composer */}
          <div className="mt-12">
            <div
              className="rounded-2xl border border-surface-border bg-surface p-4"
              style={{ boxShadow: "0 0 80px -20px var(--primary-glow)" }}
            >
              <input
                placeholder="Ask Nova anything…"
                className="w-full bg-transparent px-2 py-2 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border text-muted-foreground transition hover:bg-surface-hover">
                    <Plus className="h-4 w-4" />
                  </button>
                  <button className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-foreground">
                    <Navigation className="h-3 w-3" />
                    Normal
                  </button>
                  <button className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-foreground">
                    <Lightbulb className="h-3 w-3" />
                    DeepThink
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-foreground">
                    <AudioLines className="h-3 w-3" />
                    Voice
                  </button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Your daily copilot can make suggestions, not changes, without your approval.
            </p>
          </div>
        </main>

        {/* Right panel */}
        <aside className="w-[340px] shrink-0 border-l border-panel-border px-6 py-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="text-[11px] font-medium tracking-widest text-muted-foreground">
              DAILY RHYTHM
            </div>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="rounded-xl border border-surface-border bg-surface p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[15px] font-medium text-foreground">Energy score</div>
                <div className="mt-1 text-xs text-muted-foreground">Up 8% from yesterday</div>
              </div>
              <EnergyRing value={68} />
            </div>
            <div className="mt-5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: "68%" }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>Low</span>
                <span>Typical</span>
                <span>Peak</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[11px] font-medium tracking-widest text-muted-foreground">
                TODAY'S SCHEDULE
              </div>
              <button className="text-xs text-muted-foreground hover:text-foreground">
                View all
              </button>
            </div>
            <div className="space-y-3">
              <ScheduleItem time="9:30" title="Product standup" subtitle="Meeting" tone="primary" />
              <ScheduleItem
                time="11:00"
                title="Focus: onboarding review"
                subtitle="Deep work"
                tone="purple"
              />
              <ScheduleItem time="2:30" title="Design critique" subtitle="Meeting" tone="primary" />
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-4 flex items-center gap-1.5 text-[11px] font-medium tracking-widest text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              SUGGESTED NEXT
            </div>
            <div className="space-y-2">
              <SuggestedTask
                tone="primary"
                title="Finalize onboarding review"
                subtitle="Due today · 20 min"
              />
              <SuggestedTask
                tone="blue"
                title="Book flight to New York"
                subtitle="Suggested from your notes"
              />
              <SuggestedTask
                tone="amber"
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
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function RecentItem({ label }: { label: string }) {
  return (
    <button className="block w-full truncate rounded-lg px-3 py-1.5 text-left text-sm text-muted-foreground transition hover:bg-surface-hover hover:text-foreground">
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
    <button className="rounded-xl border border-surface-border bg-surface p-4 text-left transition hover:bg-surface-hover">
      <div className="mb-4">{icon}</div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
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
          className="stroke-surface-border"
          strokeWidth="3"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          className="stroke-primary"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

const toneMap = {
  primary: "bg-primary",
  purple: "bg-schedule-purple",
  blue: "bg-schedule-blue",
  amber: "bg-schedule-amber",
} as const;

const toneSoftMap = {
  primary: "bg-primary/15 text-primary",
  purple: "bg-schedule-purple/15 text-schedule-purple",
  blue: "bg-schedule-blue/15 text-schedule-blue",
  amber: "bg-schedule-amber/15 text-schedule-amber",
} as const;

function ScheduleItem({
  time,
  title,
  subtitle,
  tone,
}: {
  time: string;
  title: string;
  subtitle: string;
  tone: keyof typeof toneMap;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 pt-0.5 text-xs text-muted-foreground">{time}</div>
      <div className={`mt-1 h-8 w-0.5 rounded-full ${toneMap[tone]}`} />
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

function SuggestedTask({
  tone,
  title,
  subtitle,
}: {
  tone: keyof typeof toneSoftMap;
  title: string;
  subtitle: string;
}) {
  return (
    <button className="flex w-full items-center gap-3 rounded-xl border border-surface-border bg-surface p-3 text-left transition hover:bg-surface-hover">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneSoftMap[tone]}`}>
        <CircleCheck className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </button>
  );
}
