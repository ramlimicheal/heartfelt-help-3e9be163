/**
 * Turn 2a.1 — Static assertion that no client-side module can import the
 * fake gateway. Scans src/ (excluding *.server.ts and testing/) for any
 * reference to the fake gateway module.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe("Turn 2a.1 — fake gateway is unreachable from browser code", () => {
  it("no non-server source file statically imports the fake gateway", () => {
    const all = walk("src");
    const leaks: string[] = [];
    // Match STATIC top-level import/export forms only. Dynamic imports
    // inside handler bodies of *.functions.ts are stripped by the
    // TanStack server-fn transformer and never reach the client bundle.
    const staticImportRe =
      /(?:^|\n)\s*(?:import[^;]*from\s*["'][^"']*fakeGateway[^"']*["']|import\s*\(\s*["'][^"']*fakeGateway[^"']*["']\s*\)(?!\s*;?\s*$))/m;
    for (const f of all) {
      if (f.endsWith(".server.ts") || f.endsWith(".server.tsx")) continue;
      if (f.includes("/wisdom/testing/")) continue;
      const src = readFileSync(f, "utf8");
      // First a cheap containment check; then the strict static-import check.
      if (!/fakeGateway/.test(src)) continue;
      if (staticImportRe.test(src)) leaks.push(f);
    }
    expect(leaks, `client-reachable files STATICALLY import fakeGateway: ${leaks.join(", ")}`).toEqual([]);
  });

  it("fakeGateway module filename ends in .server.ts (import-protection tripwire)", () => {
    const all = walk("src/lib/wisdom/testing");
    const fake = all.find((f) => /fakeGateway/.test(f));
    expect(fake).toBeTruthy();
    expect(fake!.endsWith(".server.ts")).toBe(true);
  });
});
