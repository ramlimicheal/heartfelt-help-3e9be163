/**
 * Canonical intelligence path guard.
 *
 * User-facing routes must submit through streamUnifiedTurn / /api/wisdom/turn only.
 * Any direct import of legacy pipeline runners from a route file is a regression.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROUTES = "src/routes";

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

describe("canonical wisdom path", () => {
  const files = walk(ROUTES);

  it("no route imports runWisdomPipeline or runCurseBreakerPipeline", () => {
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (/runWisdomPipeline|runCurseBreakerPipeline/.test(src)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });

  it("no route imports legacy pipeline modules directly", () => {
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (/from ["']@\/lib\/wisdom\/(pipeline\.functions|curseBreaker\.functions)["']/.test(src)) {
        bad.push(f);
      }
    }
    expect(bad).toEqual([]);
  });

  it("dashboard hands off to /wisdom for all four modes", () => {
    const src = readFileSync("src/routes/dashboard.tsx", "utf8");
    expect(src).toMatch(/to:\s*["']\/wisdom["']/);
    for (const mode of ["companion", "pattern", "deep_wisdom", "curse_breaker"]) {
      expect(src.includes(mode)).toBe(true);
    }
  });

  it("session viewer reads canonical history + UnifiedResultView", () => {
    const src = readFileSync("src/routes/wisdom.$sessionId.tsx", "utf8");
    expect(src).toMatch(/loadSessionHistory/);
    expect(src).toMatch(/UnifiedResultView/);
    expect(src).not.toMatch(/runWisdomPipeline|runCurseBreakerPipeline/);
  });
});
