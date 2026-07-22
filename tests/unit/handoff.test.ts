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

describe("wisdom handoff — expiry & malformed payloads", () => {
  beforeEach(() => __resetHandoffForTests());

  it("returns null and clears storage for an expired handoff (> 5 min old)", () => {
    const nonce = writeHandoff({ prompt: SENSITIVE, mode: "pattern" });
    const storage = (globalThis as unknown as { sessionStorage: MemStorage }).sessionStorage;
    // Rewrite the payload with an aged createdAt so we deterministically
    // exercise the expiry branch without touching Date.
    const raw = storage.getItem("wisdom.handoff.v1")!;
    const parsed = JSON.parse(raw);
    parsed.createdAt = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    storage.setItem("wisdom.handoff.v1", JSON.stringify(parsed));

    expect(consumeHandoff(nonce)).toBeNull();
    expect(storage.getItem("wisdom.handoff.v1")).toBeNull();
  });

  it("expired handoff cannot be replayed even if storage is repopulated with the same nonce", () => {
    const nonce = writeHandoff({ prompt: SENSITIVE, mode: "pattern" });
    const storage = (globalThis as unknown as { sessionStorage: MemStorage }).sessionStorage;
    const raw = storage.getItem("wisdom.handoff.v1")!;
    const parsed = JSON.parse(raw);
    parsed.createdAt = Date.now() - 10 * 60 * 1000;
    storage.setItem("wisdom.handoff.v1", JSON.stringify(parsed));
    expect(consumeHandoff(nonce)).toBeNull();

    // Attacker resurrection: write a fresh payload with the SAME nonce.
    parsed.createdAt = Date.now();
    storage.setItem("wisdom.handoff.v1", JSON.stringify(parsed));
    expect(consumeHandoff(nonce)).toBeNull();
  });

  it("returns null and clears storage for a malformed (unparseable) payload", () => {
    const storage = (globalThis as unknown as { sessionStorage: MemStorage }).sessionStorage;
    storage.setItem("wisdom.handoff.v1", "{ not json");
    expect(consumeHandoff("any-nonce")).toBeNull();
    expect(storage.getItem("wisdom.handoff.v1")).toBeNull();
  });

  it("returns null for a structurally invalid payload (missing required fields)", () => {
    const storage = (globalThis as unknown as { sessionStorage: MemStorage }).sessionStorage;
    storage.setItem(
      "wisdom.handoff.v1",
      JSON.stringify({ nonce: "x", prompt: 42, mode: "pattern", createdAt: Date.now() }),
    );
    expect(consumeHandoff("x")).toBeNull();
    expect(storage.getItem("wisdom.handoff.v1")).toBeNull();
  });

  it("swallows sessionStorage errors (quota / disabled) without throwing", () => {
    // Replace the storage with one that throws on every op.
    const original = (globalThis as unknown as { sessionStorage: unknown }).sessionStorage;
    const brokenStorage = {
      get length() { return 0; },
      clear() { throw new Error("quota"); },
      getItem() { throw new Error("quota"); },
      setItem() { throw new Error("quota"); },
      removeItem() { throw new Error("quota"); },
      key() { return null; },
    };
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = brokenStorage;
    try {
      // writeHandoff must not throw and must still return a nonce.
      const nonce = writeHandoff({ prompt: SENSITIVE, mode: "pattern" });
      expect(typeof nonce).toBe("string");
      // consumeHandoff must not throw and must return null.
      expect(consumeHandoff(nonce)).toBeNull();
    } finally {
      (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = original;
    }
  });
});

