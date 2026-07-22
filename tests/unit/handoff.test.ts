/**
 * Handoff module: private user text must never touch the URL.
 * Autostart must execute exactly once across remount, Strict Mode
 * double-invoke, refresh, and back/forward navigation.
 */
import { describe, it, expect, beforeEach } from "vitest";

// Minimal in-memory sessionStorage shim (Node env).
class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
}

// Install window + sessionStorage before importing the module under test.
(globalThis as unknown as { window: unknown }).window = globalThis;
(globalThis as unknown as { sessionStorage: MemStorage }).sessionStorage = new MemStorage();

const {
  writeHandoff,
  consumeHandoff,
  __resetHandoffForTests,
} = await import("@/lib/wisdom/handoff");

const SENSITIVE = "My father hurt me and I keep repeating his pattern.";

describe("wisdom handoff — privacy", () => {
  beforeEach(() => __resetHandoffForTests());

  it("writeHandoff returns an opaque nonce that is not the user's text", () => {
    const nonce = writeHandoff({ prompt: SENSITIVE, mode: "pattern" });
    expect(nonce).toEqual(expect.any(String));
    expect(nonce.length).toBeGreaterThanOrEqual(16);
    expect(nonce).not.toContain(SENSITIVE);
    expect(nonce).not.toContain("father");
  });

  it("stores the payload only in sessionStorage, keyed by a random id", () => {
    const nonce = writeHandoff({ prompt: SENSITIVE, mode: "pattern" });
    const raw = (globalThis as unknown as { sessionStorage: MemStorage }).sessionStorage.getItem(
      "wisdom.handoff.v1",
    );
    expect(raw).toBeTruthy();
    expect(raw!).toContain(SENSITIVE); // in-tab storage — expected
    expect(nonce).not.toContain(SENSITIVE);
  });
});

describe("wisdom handoff — one-time consumption", () => {
  beforeEach(() => __resetHandoffForTests());

  it("consumeHandoff returns the payload once, then null on every replay", () => {
    const nonce = writeHandoff({ prompt: SENSITIVE, mode: "curse_breaker" });
    const first = consumeHandoff(nonce);
    expect(first?.prompt).toBe(SENSITIVE);
    expect(first?.mode).toBe("curse_breaker");

    // Strict Mode double-invoke / remount / refresh: same nonce → nothing.
    expect(consumeHandoff(nonce)).toBeNull();
    expect(consumeHandoff(nonce)).toBeNull();
  });

  it("clears the sessionStorage payload synchronously on first consume", () => {
    const nonce = writeHandoff({ prompt: SENSITIVE, mode: "pattern" });
    consumeHandoff(nonce);
    const raw = (globalThis as unknown as { sessionStorage: MemStorage }).sessionStorage.getItem(
      "wisdom.handoff.v1",
    );
    expect(raw).toBeNull();
  });

  it("rejects a mismatched nonce and does not leak the payload", () => {
    writeHandoff({ prompt: SENSITIVE, mode: "pattern" });
    expect(consumeHandoff("wrong-nonce")).toBeNull();
  });

  it("rejects an empty/undefined nonce", () => {
    writeHandoff({ prompt: SENSITIVE, mode: "pattern" });
    expect(consumeHandoff(undefined)).toBeNull();
    expect(consumeHandoff("")).toBeNull();
  });
});
