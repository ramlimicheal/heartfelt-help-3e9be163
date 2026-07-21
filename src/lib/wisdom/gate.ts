/**
 * Wisdom access gate.
 *
 * As of the public beta the founder-only canary is REMOVED. The only gate is
 * authentication. These helpers are kept so existing callers/tests continue
 * to type-check; they now resolve to "on" for any authenticated user.
 */

export type WisdomMode = "on";

export type AccessInput = {
  authenticated: boolean;
  verifiedEmail?: string | null;
  emailVerified?: boolean;
  mode?: WisdomMode;
  allowlist?: ReadonlySet<string>;
};

export type AccessDecision =
  | { allowed: true; mode: "on" }
  | { allowed: false; reason: "unauthenticated" };

export function currentWisdomMode(): WisdomMode {
  return "on";
}

export function currentCanaryEmails(): ReadonlySet<string> {
  return new Set<string>();
}

export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (t.length === 0 || !t.includes("@")) return null;
  return t;
}

export function resolveWisdomAccess(input: AccessInput): AccessDecision {
  if (!input.authenticated) return { allowed: false, reason: "unauthenticated" };
  return { allowed: true, mode: "on" };
}

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
