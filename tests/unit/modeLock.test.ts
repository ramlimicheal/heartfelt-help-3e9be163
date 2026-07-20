import { describe, it, expect } from "vitest";
import {
  evaluateModeLock,
  assertModeAllowed,
  MODE_LOCK_ERROR,
} from "@/lib/wisdom/modeLock";

describe("modeLock helpers", () => {
  it("no session → accept", () => {
    expect(evaluateModeLock({ session: null, requestedMode: "pattern" })).toEqual({
      ok: true,
      effectiveMode: "pattern",
    });
  });

  it("unlocked session → accept", () => {
    expect(
      evaluateModeLock({
        session: { id: "s", user_id: "u", mode: "companion", mode_locked_at: null },
        requestedMode: "pattern",
      }),
    ).toEqual({ ok: true, effectiveMode: "companion" });
  });

  it("locked, same mode → accept", () => {
    expect(
      evaluateModeLock({
        session: { id: "s", user_id: "u", mode: "pattern", mode_locked_at: "2026-01-01T00:00:00Z" },
        requestedMode: "pattern",
      }),
    ).toEqual({ ok: true, effectiveMode: "pattern" });
  });

  it("locked, different mode → reject with typed error", () => {
    const d = evaluateModeLock({
      session: { id: "s", user_id: "u", mode: "pattern", mode_locked_at: "2026-01-01T00:00:00Z" },
      requestedMode: "curse_breaker",
    });
    expect(d).toEqual({
      ok: false,
      code: "mode_locked_mismatch",
      lockedMode: "pattern",
      requestedMode: "curse_breaker",
      recoverable: true,
    });
  });

  it("assertModeAllowed throws SESSION_MODE_LOCKED on mismatch", () => {
    expect(() =>
      assertModeAllowed({
        session: { id: "s", user_id: "u", mode: "pattern", mode_locked_at: "2026-01-01T00:00:00Z" },
        requestedMode: "deep_wisdom",
      }),
    ).toThrow(new RegExp(MODE_LOCK_ERROR));
  });

  it("assertModeAllowed returns the effective mode on success", () => {
    expect(
      assertModeAllowed({
        session: { id: "s", user_id: "u", mode: "pattern", mode_locked_at: "2026-01-01T00:00:00Z" },
        requestedMode: "pattern",
      }),
    ).toBe("pattern");
  });
});
