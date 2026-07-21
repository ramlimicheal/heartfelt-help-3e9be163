/**
 * Read-only beta-status probe for the Wisdom composer.
 *
 * Returns whether the authenticated caller may currently execute a unified
 * turn. Uses server-verified claims. Never trusts request-body email/role.
 * Never mutates anything.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  currentWisdomMode,
  extractVerifiedEmailFromClaims,
  resolveWisdomAccess,
} from "@/lib/wisdom/gate";

export const Route = createFileRoute("/api/wisdom/access")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const mode = currentWisdomMode();

  const authHeader = request.headers.get("authorization") ?? "";
  const hasBearer = authHeader.startsWith("Bearer ");
  const token = hasBearer ? authHeader.slice("Bearer ".length).trim() : "";

  if (!token || token.split(".").length !== 3) {
    const decision = resolveWisdomAccess({
      authenticated: false,
      verifiedEmail: null,
      emailVerified: false,
      mode,
    });
    return json({ allowed: false, mode, reason: (decision as { reason: string }).reason });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return json({ allowed: false, mode, reason: "misconfigured" }, 500);
  }

  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: makeSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
  });
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return json({ allowed: false, mode, reason: "unauthenticated" });
  }

  const { email, verified } = extractVerifiedEmailFromClaims(data.claims);
  const decision = resolveWisdomAccess({
    authenticated: true,
    verifiedEmail: email,
    emailVerified: verified,
    mode,
  });
  if (decision.allowed) return json({ allowed: true, mode });
  return json({ allowed: false, mode, reason: decision.reason });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function makeSupabaseFetch(key: string): typeof fetch {
  const isNew = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNew && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}
