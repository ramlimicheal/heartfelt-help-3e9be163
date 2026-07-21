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
  it("no non-server source file imports src/lib/wisdom/testing/fakeGateway", () => {
    const all = walk("src");
    const leaks: string[] = [];
    for (const f of all) {
      // Skip server-only modules and the fake gateway itself.
      if (f.endsWith(".server.ts") || f.endsWith(".server.tsx")) continue;
      if (f.includes("/wisdom/testing/")) continue;
      const src = readFileSync(f, "utf8");
      if (/fakeGateway/.test(src) || /wisdom\/testing\/fakeGateway/.test(src)) {
        leaks.push(f);
      }
    }
    expect(leaks, `client-reachable files reference fakeGateway: ${leaks.join(", ")}`).toEqual([]);
  });

  it("fakeGateway module filename ends in .server.ts (import-protection tripwire)", () => {
    const all = walk("src/lib/wisdom/testing");
    const fake = all.find((f) => /fakeGateway/.test(f));
    expect(fake).toBeTruthy();
    expect(fake!.endsWith(".server.ts")).toBe(true);
  });
});
