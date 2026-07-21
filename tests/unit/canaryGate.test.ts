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
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("extractVerifiedEmailFromClaims", () => {
  it("returns verified when top-level email_verified=true", () => {
    const out = extractVerifiedEmailFromClaims({ email: "Founder@Example.com", email_verified: true });
    expect(out).toEqual({ email: "founder@example.com", verified: true });
  });
  it("returns unverified when no signal", () => {
    expect(extractVerifiedEmailFromClaims({ email: "spoof@evil.com" }))
      .toEqual({ email: "spoof@evil.com", verified: false });
  });
  it("safe on garbage input", () => {
    expect(extractVerifiedEmailFromClaims(null)).toEqual({ email: null, verified: false });
  });
});

describe("resolveWisdomAccess — open beta", () => {
  it("allows any authenticated user", () => {
    expect(resolveWisdomAccess({ authenticated: true })).toEqual({ allowed: true, mode: "on" });
  });
  it("denies unauthenticated users", () => {
    expect(resolveWisdomAccess({ authenticated: false }))
      .toEqual({ allowed: false, reason: "unauthenticated" });
  });
});
