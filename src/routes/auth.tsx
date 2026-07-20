import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

import { z } from "zod";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in · Wisdom" },
      { name: "description", content: "Sign in or create a Wisdom account." },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect ?? "/wisdom" });
    });
  }, [navigate, redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fn = mode === "signin" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
      const { error: authErr } = await fn.call(supabase.auth, {
        email,
        password,
        ...(mode === "signup"
          ? { options: { emailRedirectTo: window.location.origin } }
          : {}),
      });
      if (authErr) throw authErr;
      navigate({ to: redirect ?? "/wisdom" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 space-y-4 shadow-lg"
      >
        <div>
          <h1 className="text-2xl font-semibold">Wisdom</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" ? "Welcome back." : "Create your account."}
          </p>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-accent text-accent-foreground font-medium py-2 disabled:opacity-50"
        >
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <div className="flex items-center gap-2 pt-1">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setError(null);
            setBusy(true);
            try {
              const result = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (result.error) throw result.error;
              if (result.redirected) return;
              navigate({ to: redirect ?? "/wisdom" });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Google sign-in failed");
              setBusy(false);
            }
          }}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-background hover:bg-muted transition py-2 text-sm font-medium disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          Continue with Google
        </button>


        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Create an account" : "Have an account? Sign in"}
        </button>

        <p className="text-xs text-muted-foreground text-center pt-2">
          <Link to="/" className="hover:text-foreground">
            ← Back home
          </Link>
        </p>
      </form>
    </main>
  );
}

