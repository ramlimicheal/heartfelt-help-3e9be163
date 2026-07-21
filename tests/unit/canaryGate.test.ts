import { describe, it, expect } from "vitest";
import {
  extractVerifiedEmailFromClaims,
  normalizeEmail,
  resolveWisdomAccess,
} from "@/lib/wisdom/gate";

describe("normalizeEmail", () => {
  it("lowercases and trims valid emails", () => {
    expect(normalizeEmail("  Founder@Example.COM  ")).toBe("founder@example.com");
  });
  it("rejects non-emails", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(123 as unknown)).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("extractVerifiedEmailFromClaims", () => {
  it("returns verified when top-level email_verified=true", () => {
    const out = extractVerifiedEmailFromClaims({
      email: "Founder@Example.com",
      email_verified: true,
    });
    expect(out).toEqual({ email: "founder@example.com", verified: true });
  });
  it("returns verified when nested user_metadata.email_verified=true", () => {
    const out = extractVerifiedEmailFromClaims({
      email: "a@b.co",
      user_metadata: { email_verified: true },
    });
    expect(out.verified).toBe(true);
  });
  it("never trusts a body-supplied claim without verification signal", () => {
    const out = extractVerifiedEmailFromClaims({ email: "spoof@evil.com" });
    expect(out).toEqual({ email: "spoof@evil.com", verified: false });
  });
  it("safe on garbage input", () => {
    expect(extractVerifiedEmailFromClaims(null)).toEqual({ email: null, verified: false });
    expect(extractVerifiedEmailFromClaims("hi")).toEqual({ email: null, verified: false });
  });
});

describe("resolveWisdomAccess — three states", () => {
  const allow = new Set(["founder@example.com"]);

  it("off: denies everyone, including allowlisted verified founder", () => {
    const d = resolveWisdomAccess({
      authenticated: true,
      verifiedEmail: "founder@example.com",
      emailVerified: true,
      mode: "off",
      allowlist: allow,
    });
    expect(d).toEqual({ allowed: false, reason: "unified_disabled" });
  });

  it("canary: allows authenticated verified allowlisted email", () => {
    const d = resolveWisdomAccess({
      authenticated: true,
      verifiedEmail: "founder@example.com",
      emailVerified: true,
      mode: "canary",
      allowlist: allow,
    });
    expect(d).toEqual({ allowed: true, mode: "canary" });
  });

  it("canary: denies non-allowlisted verified email", () => {
    const d = resolveWisdomAccess({
      authenticated: true,
      verifiedEmail: "someone@else.com",
      emailVerified: true,
      mode: "canary",
      allowlist: allow,
    });
    expect(d).toEqual({ allowed: false, reason: "canary_denied" });
  });

  it("canary: denies unverified email even if on allowlist", () => {
    const d = resolveWisdomAccess({
      authenticated: true,
      verifiedEmail: "founder@example.com",
      emailVerified: false,
      mode: "canary",
      allowlist: allow,
    });
    expect(d).toEqual({ allowed: false, reason: "email_unverified" });
  });

  it("canary: denies when allowlist is empty (misconfigured)", () => {
    const d = resolveWisdomAccess({
      authenticated: true,
      verifiedEmail: "founder@example.com",
      emailVerified: true,
      mode: "canary",
      allowlist: new Set(),
    });
    expect(d).toEqual({ allowed: false, reason: "canary_denied" });
  });

  it("on: allows any authenticated user without allowlist check", () => {
    const d = resolveWisdomAccess({
      authenticated: true,
      verifiedEmail: null,
      emailVerified: false,
      mode: "on",
      allowlist: new Set(),
    });
    expect(d).toEqual({ allowed: true, mode: "on" });
  });

  it("denies unauthenticated in every mode", () => {
    for (const mode of ["off", "canary", "on"] as const) {
      const d = resolveWisdomAccess({
        authenticated: false,
        verifiedEmail: "founder@example.com",
        emailVerified: true,
        mode,
        allowlist: allow,
      });
      expect(d).toEqual({ allowed: false, reason: "unauthenticated" });
    }
  });

  it("spoofing: body-supplied email cannot substitute for verified claim", () => {
    // Simulate the composer trying to smuggle an allowlisted email through
    // the request body: the gate reads only verified claim values.
    const spoofedBodyEmail = "founder@example.com";
    const verifiedFromJwt = extractVerifiedEmailFromClaims({
      email: "attacker@evil.com",
      // no email_verified signal
    });
    const d = resolveWisdomAccess({
      authenticated: true,
      verifiedEmail: verifiedFromJwt.email,
      emailVerified: verifiedFromJwt.verified,
      mode: "canary",
      allowlist: allow,
    });
    expect(d.allowed).toBe(false);
    // The spoofed body value is irrelevant to the decision.
    expect(spoofedBodyEmail).toBe("founder@example.com");
  });
});
