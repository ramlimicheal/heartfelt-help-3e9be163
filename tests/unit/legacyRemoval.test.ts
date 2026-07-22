/**
 * Phase 2C guardrails.
 *
 * After the legacy Wisdom intelligence path was retired, these tests keep
 * it retired: no file may reintroduce the removed modules, and every
 * canonical contract must have a single source of truth.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

const REMOVED = [
  "src/lib/wisdom/pipeline.functions.ts",
  "src/lib/wisdom/pipeline.schemas.ts",
  "src/lib/wisdom/curseBreaker.functions.ts",
  "src/lib/wisdom/curseBreaker.ts",
  "src/lib/wisdom/schemas.ts",
];

const REMOVED_IMPORT_PATTERNS = [
  /@\/lib\/wisdom\/pipeline\.functions/,
  /@\/lib\/wisdom\/pipeline\.schemas/,
  /@\/lib\/wisdom\/curseBreaker\.functions/,
  /@\/lib\/wisdom\/curseBreaker["']/,
  /@\/lib\/wisdom\/schemas["']/,
  /["']\.\/pipeline\.functions["']/,
  /["']\.\/pipeline\.schemas["']/,
  /["']\.\/curseBreaker\.functions["']/,
  /["']\.\/curseBreaker["']/,
  /["']\.\/schemas["']/,
];

const REMOVED_SYMBOLS = [
  "runWisdomPipeline",
  "runCurseBreakerPipeline",
  "startWisdomSession",
  "sendUserMessage",
  "startLinkedSession",
  "getSessionSlice",
  "getSessionTelemetry",
  "getCurseBreakerSlice",
];

describe("Phase 2C — legacy Wisdom code removal", () => {
  it("removed files are gone from disk", () => {
    for (const p of REMOVED) expect(existsSync(p), `${p} should not exist`).toBe(false);
  });

  const allFiles = [...walk("src"), ...walk("tests")];

  it("no file imports a removed module path", () => {
    const offenders: string[] = [];
    for (const f of allFiles) {
      // The guard test itself references the paths as string patterns.
      if (f.endsWith("legacyRemoval.test.ts")) continue;
      const src = readFileSync(f, "utf8");
      for (const rx of REMOVED_IMPORT_PATTERNS) {
        if (rx.test(src)) {
          offenders.push(`${f} matches ${rx}`);
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("removed legacy server-fn symbols have zero references", () => {
    const offenders: string[] = [];
    for (const f of allFiles) {
      if (f.endsWith("legacyRemoval.test.ts")) continue;
      if (f.endsWith("canonicalPath.test.ts")) continue; // asserts these as forbidden regexes
      const src = readFileSync(f, "utf8");
      for (const sym of REMOVED_SYMBOLS) {
        if (new RegExp(`\\b${sym}\\b`).test(src)) {
          offenders.push(`${f} references ${sym}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("exactly one active Wisdom turn implementation exists", () => {
    // The unified orchestrator is the sole runner.
    expect(existsSync("src/lib/wisdom/unified.orchestrator.ts")).toBe(true);
    expect(existsSync("src/routes/api/wisdom/turn.ts")).toBe(true);
  });

  it("exactly one active mode union exists (modeLock.SessionMode)", () => {
    const modeLock = readFileSync("src/lib/wisdom/modeLock.ts", "utf8");
    // Any other module that declares a SessionMode-like union should import it.
    const declarations = [...walk("src")].filter((f) => {
      const src = readFileSync(f, "utf8");
      return /export\s+type\s+SessionMode\s*=/.test(src);
    });
    expect(declarations, "SessionMode must be declared only in modeLock.ts").toEqual([
      "src/lib/wisdom/modeLock.ts",
    ]);
    // The canonical union covers the four supported modes.
    for (const m of ["companion", "pattern", "deep_wisdom", "curse_breaker"]) {
      expect(modeLock).toMatch(new RegExp(`["']${m}["']`));
    }
  });

  it("exactly one active prayer-movement contract exists", () => {
    const canonicalPath = "src/lib/wisdom/contracts/prayerMovement.ts";
    expect(existsSync(canonicalPath)).toBe(true);
    const canonical = readFileSync(canonicalPath, "utf8");
    expect(canonical).toMatch(/export\s+const\s+zPrayerMovement\s*=\s*z\.enum/);
    // No other module may declare `zPrayerMovement`.
    const declarers = [...walk("src")].filter((f) => {
      if (f === canonicalPath) return false;
      const src = readFileSync(f, "utf8");
      return /export\s+const\s+zPrayerMovement\s*=/.test(src);
    });
    expect(declarers).toEqual([]);
  });

  it("exactly one active source-tier contract exists", () => {
    const canonicalPath = "src/lib/wisdom/contracts/sourceTier.ts";
    expect(existsSync(canonicalPath)).toBe(true);
    const declarers = [...walk("src")].filter((f) => {
      if (f === canonicalPath) return false;
      const src = readFileSync(f, "utf8");
      return /export\s+type\s+SourceTier\s*=/.test(src);
    });
    expect(declarers).toEqual([]);
  });

  it("no user-facing route imports a legacy intelligence path", () => {
    const routeFiles = walk("src/routes");
    for (const f of routeFiles) {
      const src = readFileSync(f, "utf8");
      for (const rx of REMOVED_IMPORT_PATTERNS) {
        expect(rx.test(src), `${f} matches ${rx}`).toBe(false);
      }
    }
  });

  it("/api/chat remains a 410-Gone compatibility sentinel", () => {
    // Documented in the file: retained so any stale client/monitor request
    // gets an explicit Gone response instead of a mysterious 404, and so
    // the composerWiring guard test can keep pinning the sentinel.
    const src = readFileSync("src/routes/api/chat.ts", "utf8");
    expect(src).toMatch(/410/);
  });
});
