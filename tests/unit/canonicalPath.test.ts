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

  it("dashboard never puts user-entered text in the URL", () => {
    const src = readFileSync("src/routes/dashboard.tsx", "utf8");
    // The navigate() call must not carry `prompt` or `autostart` in search.
    // Extract every navigate({...}) block that targets /wisdom.
    const blocks = src.match(/navigate\(\{[\s\S]*?to:\s*["']\/wisdom["'][\s\S]*?\}\)/g) ?? [];
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) {
      expect(b).not.toMatch(/\bprompt\b/);
      expect(b).not.toMatch(/\bautostart\b/);
      // The variable `text` holds the user story; it must not be serialized.
      expect(b).not.toMatch(/\btext\b/);
    }
    // And handoff must be used.
    expect(src).toMatch(/writeHandoff\(/);
  });

  it("/wisdom search schema does not accept a `prompt` param", () => {
    const src = readFileSync("src/routes/wisdom.index.tsx", "utf8");
    // WisdomSearch type block must not declare prompt/autostart.
    const typeBlock = src.match(/type WisdomSearch = \{[\s\S]*?\};/)?.[0] ?? "";
    expect(typeBlock).not.toMatch(/\bprompt\??:/);
    expect(typeBlock).not.toMatch(/\bautostart\??:/);
    // validateSearch must not extract raw.prompt.
    const vs = src.match(/validateSearch:[\s\S]*?\},\s*\}\);/)?.[0] ?? "";
    expect(vs).not.toMatch(/raw\.prompt/);
    expect(vs).not.toMatch(/raw\.autostart/);
  });

  it("wisdom.index consumes the handoff exactly once and clears the URL", () => {
    const src = readFileSync("src/routes/wisdom.index.tsx", "utf8");
    expect(src).toMatch(/consumeHandoff\(/);
    // Nonce is stripped from URL after consumption.
    expect(src).toMatch(/navigate\(\{\s*to:\s*["']\/wisdom["'],\s*search:\s*\{\},\s*replace:\s*true\s*\}\)/);
    // A boot-once ref must gate the effect.
    expect(src).toMatch(/bootRef\.current/);
  });

  it("existing session mode is authoritative over any client override", () => {
    const src = readFileSync("src/routes/wisdom.index.tsx", "utf8");
    // When sessionId is set, the submit path ignores modeOverride.
    expect(src).toMatch(/sessionId\s*\?\s*mode\s*:\s*\(modeOverride\s*\?\?\s*mode\)/);
  });
});
