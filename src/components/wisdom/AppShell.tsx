import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Compass,
  Hand,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { SESSIONS } from "@/lib/wisdom/mock/seed";

type NavItem = { to: string; label: string; Icon: typeof Compass };

const NAV: NavItem[] = [
  { to: "/wisdom", label: "Wisdom", Icon: Sparkles },
  { to: "/patterns", label: "Patterns", Icon: Compass },
  { to: "/prayers", label: "Prayer", Icon: Hand },
  { to: "/journey", label: "Journey", Icon: BookOpen },
  { to: "/you", label: "You", Icon: User },
];

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? (window.localStorage.getItem("wisdom-theme") as "light" | "dark" | null)
        : null;
    const initial: "light" | "dark" =
      saved ??
      (typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark");
    setTheme(initial);
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("light", theme === "light");
    if (typeof window !== "undefined") window.localStorage.setItem("wisdom-theme", theme);
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

function isActive(pathname: string, to: string) {
  if (to === "/wisdom") return pathname === "/" || pathname.startsWith("/wisdom");
  return pathname.startsWith(to);
}

export function AppShell({ children }: { children?: ReactNode }) {
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFullBleed =
    pathname === "/welcome" || pathname === "/onboarding" || pathname === "/auth";

  if (isFullBleed) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {children ?? <Outlet />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px]">
        {/* Desktop left rail */}
        <aside className="hidden shrink-0 border-r border-panel-border/60 md:flex md:w-64 md:flex-col">
          <div className="flex items-center gap-2.5 px-5 pt-6 pb-4">
            <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_24px_0] shadow-primary-glow">
              <Sparkles className="size-4" strokeWidth={2} />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Wisdom</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Scripture-first
              </p>
            </div>
          </div>

          <div className="px-3">
            <Link
              to="/wisdom"
              className="flex w-full items-center justify-between rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="size-4" strokeWidth={2} />
                New session
              </span>
              <span className="rounded-md bg-primary-foreground/10 px-1.5 py-0.5 text-[10px]">
                ⌘K
              </span>
            </Link>
          </div>

          <nav className="mt-6 flex flex-col gap-0.5 px-3">
            <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Space
            </p>
            {NAV.map(({ to, label, Icon }) => {
              const active = isActive(pathname, to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={[
                    "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition",
                    active
                      ? "bg-surface text-foreground"
                      : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon
                    className={["size-4", active ? "text-primary" : ""].join(" ")}
                    strokeWidth={1.75}
                  />
                  <span>{label}</span>
                  {active && (
                    <span className="ml-auto size-1.5 rounded-full bg-primary" aria-hidden />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 px-3">
            <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Recent
            </p>
            <ul className="space-y-0.5">
              {SESSIONS.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <Link
                    to="/wisdom/$sessionId"
                    params={{ sessionId: s.id }}
                    className={[
                      "block truncate rounded-md px-2.5 py-1.5 text-xs transition",
                      pathname.includes(s.id)
                        ? "bg-surface text-foreground"
                        : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                    ].join(" ")}
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-auto space-y-0.5 px-3 pb-5">
            <Link
              to="/settings/privacy"
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground hover:bg-surface/60 hover:text-foreground"
            >
              <Settings className="size-3.5" strokeWidth={1.75} />
              Privacy &amp; memory
            </Link>
            <button
              onClick={toggle}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-muted-foreground hover:bg-surface/60 hover:text-foreground"
            >
              {theme === "dark" ? (
                <Sun className="size-3.5" strokeWidth={1.75} />
              ) : (
                <Moon className="size-3.5" strokeWidth={1.75} />
              )}
              {theme === "dark" ? "Light" : "Dark"} theme
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 pb-24 md:pb-8">
          {/* Mobile header */}
          <header className="flex items-center justify-between border-b border-panel-border/60 px-4 py-3 md:hidden">
            <Link to="/wisdom" className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="size-3.5" strokeWidth={2} />
              </span>
              <span className="text-sm font-semibold">Wisdom</span>
            </Link>
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-surface/60 hover:text-foreground"
            >
              {theme === "dark" ? (
                <Sun className="size-4" strokeWidth={1.75} />
              ) : (
                <Moon className="size-4" strokeWidth={1.75} />
              )}
            </button>
          </header>

          <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-10 md:py-10">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-panel-border bg-background/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map(({ to, label, Icon }) => {
            const active = isActive(pathname, to);
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={[
                    "flex flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium transition",
                    active ? "text-foreground" : "text-muted-foreground",
                  ].join(" ")}
                >
                  <Icon
                    className={["size-5", active ? "text-primary" : ""].join(" ")}
                    strokeWidth={1.75}
                  />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
