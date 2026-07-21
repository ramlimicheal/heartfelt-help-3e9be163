import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROUTES = path.resolve(__dirname, "../../src/routes");

function readAllComposerRoutes(): Array<{ file: string; body: string }> {
  const files = readdirSync(ROUTES).filter(
    (f) => f.startsWith("wisdom") && f.endsWith(".tsx"),
  );
  return files.map((f) => ({
    file: f,
    body: readFileSync(path.join(ROUTES, f), "utf8"),
  }));
}

describe("composer wiring — single intelligence path", () => {
  it("no Wisdom route imports the legacy /api/chat endpoint", () => {
    for (const { file, body } of readAllComposerRoutes()) {
      expect(body, `${file} must not reference /api/chat`).not.toMatch(/["'`]\/api\/chat["'`]/);
    }
  });

  it("no Wisdom route imports @ai-sdk/react or useChat", () => {
    for (const { file, body } of readAllComposerRoutes()) {
      expect(body, `${file} must not use @ai-sdk/react`).not.toMatch(/@ai-sdk\/react/);
      expect(body, `${file} must not call useChat`).not.toMatch(/\buseChat\b/);
    }
  });

  it("the primary composer submits through streamUnifiedTurn", () => {
    const body = readFileSync(path.join(ROUTES, "wisdom.index.tsx"), "utf8");
    expect(body).toMatch(/from "@\/lib\/wisdom\/unified\.stream"/);
    expect(body).toMatch(/streamUnifiedTurn\(/);
    // has a real submit handler wired to the button
    expect(body).toMatch(/data-testid="wisdom-submit"/);
    expect(body).toMatch(/onClick=\{\(\) => submit\(\)\}/);
  });

  it("the composer gates on useWisdomAccess before submitting", () => {
    const body = readFileSync(path.join(ROUTES, "wisdom.index.tsx"), "utf8");
    expect(body).toMatch(/useWisdomAccess\(\)/);
    // Private-beta empty state exists
    expect(body).toMatch(/data-testid="wisdom-private-beta"/);
    // Access check is enforced in submit
    expect(body).toMatch(/access\.status !== "allowed"/);
  });

  it("has a hard double-submit guard (ref, not just state)", () => {
    const body = readFileSync(path.join(ROUTES, "wisdom.index.tsx"), "utf8");
    expect(body).toMatch(/inflightRef/);
    expect(body).toMatch(/inflightRef\.current = true/);
  });
});

describe("legacy chat remains closed", () => {
  it("/api/chat returns 410 Gone (no fallback)", () => {
    const body = readFileSync(
      path.resolve(__dirname, "../../src/routes/api/chat.ts"),
      "utf8",
    );
    expect(body).toMatch(/410/);
  });
});
