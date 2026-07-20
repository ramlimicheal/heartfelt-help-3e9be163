import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Compass,
  Hand,
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  Orbit,
  Plus,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  User,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { SESSIONS } from "@/lib/wisdom/mock/seed";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";


type NavItem = { to: string; label: string; Icon: typeof Compass };
type NavGroup = { label: string; caption: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: "Begin",
    caption: "Talk to Wisdom. It listens for the pattern beneath.",
    items: [
      { to: "/wisdom", label: "Wisdom", Icon: Sparkles },
      { to: "/wisdom/curse-breaker", label: "Curse Breaker", Icon: ShieldAlert },
    ],
  },
  {
    label: "Discern",
    caption: "What Wisdom has surfaced about you.",
    items: [
      { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
      { to: "/patterns", label: "Patterns", Icon: Compass },
      { to: "/wisdom/map", label: "Constellation", Icon: Orbit },
      { to: "/journey", label: "Mirrors", Icon: Users },
    ],
  },
  {
    label: "Hold",
    caption: "What you carry forward.",
    items: [
      { to: "/prayers", label: "Prayer", Icon: Hand },
      { to: "/journey", label: "Journey", Icon: BookOpen },
      { to: "/you", label: "You", Icon: User },
    ],
  },
];

const MOBILE_NAV: NavItem[] = [
  { to: "/wisdom", label: "Wisdom", Icon: Sparkles },
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/wisdom/map", label: "Map", Icon: Orbit },
  { to: "/prayers", label: "Prayer", Icon: Hand },
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
  if (to === "/wisdom") {
    return pathname === "/wisdom" || pathname === "/";
  }
  if (to === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(to);
}



export function AppShell({ children }: { children?: ReactNode }) {
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, ready } = useSession();
  const isFullBleed =
    pathname === "/welcome" || pathname === "/onboarding" || pathname === "/auth";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

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

          <nav className="mt-6 flex flex-col gap-4 px-3">
            {GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {group.label}
                </p>
                <p className="mb-1.5 px-2 text-[10.5px] leading-snug text-muted-foreground/70">
                  {group.caption}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map(({ to, label, Icon }) => {
                    const active = isActive(pathname, to);
                    return (
                      <Link
                        key={to + label}
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
                </div>
              </div>
            ))}
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
            {ready && (
              user ? (
                <div className="mb-2 rounded-lg border border-panel-border/60 bg-surface/40 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-primary/20 text-[10px] font-semibold text-primary">
                      {(user.email ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[11px] text-foreground/90">
                      {user.email}
                    </p>
                    <button
                      onClick={signOut}
                      title="Sign out"
                      className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground"
                    >
                      <LogOut className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              ) : (
                <Link
                  to="/auth"
                  search={{ redirect: pathname }}
                  className="mb-2 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-2 text-xs font-medium text-primary hover:bg-primary/15"
                >
                  <LogIn className="size-3.5" strokeWidth={2} />
                  Sign in to save sessions
                </Link>
              )
            )}
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
            <div className="flex items-center gap-1">
              {ready && !user && (
                <Link
                  to="/auth"
                  search={{ redirect: pathname }}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                >
                  <LogIn className="size-3" strokeWidth={2} />
                  Sign in
                </Link>
              )}
              {ready && user && (
                <button
                  onClick={signOut}
                  aria-label="Sign out"
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-surface/60 hover:text-foreground"
                >
                  <LogOut className="size-4" strokeWidth={1.75} />
                </button>
              )}
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
            </div>
          </header>


          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-panel-border bg-background/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {MOBILE_NAV.map(({ to, label, Icon }) => {
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
