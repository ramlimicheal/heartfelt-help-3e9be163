/**
 * Founder-only Unified Turn Canary — server-side feature gate.
 *
 * Three states (via WISDOM_UNIFIED_TURN):
 *   - "off"    → nobody may execute unified turns (default)
 *   - "canary" → only authenticated users whose verified email appears in
 *                WISDOM_UNIFIED_CANARY_EMAILS
 *   - "on"     → all authenticated users
 *
 * Pure functions. Callers pass identity from a server-verified source
 * (Supabase claims). Never accept email / role / canary indicator from
 * the request body.
 */

export type WisdomMode = "off" | "canary" | "on";

export type AccessInput = {
  authenticated: boolean;
  /** Normalized verified email from the Supabase JWT, or null. */
  verifiedEmail: string | null;
  /** True only when the JWT proves the email is verified. */
  emailVerified: boolean;
  /** Optional overrides for deterministic tests. */
  mode?: WisdomMode;
  allowlist?: ReadonlySet<string>;
};

export type AccessDecision =
  | { allowed: true; mode: "canary" | "on" }
  | {
      allowed: false;
      reason:
        | "unified_disabled"
        | "unauthenticated"
        | "email_unverified"
        | "canary_denied";
    };

export function currentWisdomMode(): WisdomMode {
  const raw = (process.env.WISDOM_UNIFIED_TURN ?? "").trim().toLowerCase();
  if (raw === "on" || raw === "1" || raw === "true") return "on";
  if (raw === "canary") return "canary";
  return "off";
}

export function currentCanaryEmails(): ReadonlySet<string> {
  const raw = process.env.WISDOM_UNIFIED_CANARY_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && s.includes("@")),
  );
}

export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (t.length === 0 || !t.includes("@")) return null;
  return t;
}

export function resolveWisdomAccess(input: AccessInput): AccessDecision {
  const mode = input.mode ?? currentWisdomMode();
  if (!input.authenticated) return { allowed: false, reason: "unauthenticated" };
  if (mode === "off") return { allowed: false, reason: "unified_disabled" };
  if (mode === "on") return { allowed: true, mode };
  // canary
  if (!input.emailVerified || !input.verifiedEmail) {
    return { allowed: false, reason: "email_unverified" };
  }
  const list = input.allowlist ?? currentCanaryEmails();
  if (list.size === 0) return { allowed: false, reason: "canary_denied" };
  if (!list.has(input.verifiedEmail)) return { allowed: false, reason: "canary_denied" };
  return { allowed: true, mode };
}

/**
 * Extract a verified email from a Supabase JWT claims object.
 * We only trust the top-level `email` when a boolean truth signal
 * (`email_verified`) is present in the top claim or in user_metadata.
 */
export function extractVerifiedEmailFromClaims(claims: unknown): {
  email: string | null;
  verified: boolean;
} {
  if (!claims || typeof claims !== "object") return { email: null, verified: false };
  const c = claims as Record<string, unknown>;
  const email = normalizeEmail(c.email);
  const topVerified = c.email_verified === true;
  const meta = (c.user_metadata as Record<string, unknown> | undefined) ?? undefined;
  const metaVerified = meta?.email_verified === true;
  return { email, verified: Boolean(email) && (topVerified || metaVerified) };
}
