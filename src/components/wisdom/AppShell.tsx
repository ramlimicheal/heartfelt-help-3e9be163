import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BookOpen, Compass, Hand, Sparkles, User } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type NavItem = { to: string; label: string; Icon: typeof Compass };

const NAV: NavItem[] = [
  { to: "/wisdom", label: "Wisdom", Icon: Sparkles },
  { to: "/patterns", label: "Patterns", Icon: Compass },
  { to: "/prayers", label: "Prayer", Icon: Hand },
  { to: "/journey", label: "Journey", Icon: BookOpen },
  { to: "/you", label: "You", Icon: User },
];

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = (typeof window !== "undefined" && window.localStorage.getItem("wisdom-theme")) as
      | "light"
      | "dark"
      | null;
    const initial: "light" | "dark" =
      saved ??
      (typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    setTheme(initial);
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
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
    return <div className="min-h-screen bg-background text-foreground">{children ?? <Outlet />}</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px]">
        {/* Desktop left rail */}
        <aside className="hidden shrink-0 border-r border-panel-border md:flex md:w-60 md:flex-col">
          <div className="px-6 pt-8 pb-6">
            <Link to="/wisdom" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-gold-soft text-gold">
                <Sparkles className="size-4" strokeWidth={1.75} />
              </span>
              <span className="font-serif text-xl leading-none">Wisdom</span>
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Scripture-first pattern and prayer intelligence.
            </p>
          </div>
          <nav className="flex flex-col gap-0.5 px-3">
            {NAV.map(({ to, label, Icon }) => {
              const active = isActive(pathname, to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={[
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                    active
                      ? "bg-surface text-foreground"
                      : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  <span>{label}</span>
                  {active && (
                    <span className="ml-auto size-1.5 rounded-full bg-gold" aria-hidden />
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-1 px-3 pb-6">
            <Link
              to="/settings/privacy"
              className="block rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-surface/60 hover:text-foreground"
            >
              Privacy &amp; memory
            </Link>
            <button
              onClick={toggle}
              className="w-full rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-surface/60 hover:text-foreground"
            >
              {theme === "dark" ? "Light" : "Dark"} theme
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 pb-24 md:pb-8">
          {/* Mobile header */}
          <header className="flex items-center justify-between border-b border-panel-border px-4 py-3 md:hidden">
            <Link to="/wisdom" className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-gold-soft text-gold">
                <Sparkles className="size-3.5" strokeWidth={1.75} />
              </span>
              <span className="font-serif text-lg leading-none">Wisdom</span>
            </Link>
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-surface/60"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </header>

          <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
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
                    className={["size-5", active ? "text-gold" : ""].join(" ")}
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
