/**
 * Phase 2A — memory directive is user-visible and reaches the SSE request.
 *
 * These are static/source-level assertions (no browser). They guarantee:
 *   1. The composer renders a per-message memory control with all three
 *      choices (normal / session_only / do_not_remember).
 *   2. `submit()` forwards the composer's state to streamUnifiedTurn,
 *      not the hardcoded "normal" it used prior to Phase 2A.
 *   3. The SSE request Zod schema at /api/wisdom/turn accepts exactly the
 *      three documented directives.
 *   4. The backend RPC (`persist_unified_turn`) still respects DNR by
 *      not creating durable rows — enforced by the source of truth on the
 *      DB side and asserted here via integration tests elsewhere.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const composer = readFileSync("src/routes/wisdom.index.tsx", "utf8");
const turnApi = readFileSync("src/routes/api/wisdom/turn.ts", "utf8");
const stream = readFileSync("src/lib/wisdom/unified.stream.ts", "utf8");

describe("Phase 2A — memory directive UI is wired end-to-end", () => {
  it("composer offers all three memory choices with explicit labels", () => {
    for (const id of ["normal", "session_only", "do_not_remember"]) {
      expect(composer).toContain(id);
    }
    expect(composer).toMatch(/Remember normally/);
    expect(composer).toMatch(/Session only/);
    expect(composer).toMatch(/Do not remember/);
  });

  it("composer state (memoryDirective), not a hardcoded 'normal', is sent", () => {
    // The `submit` path must forward the memoryDirective state variable.
    expect(composer).toMatch(/memoryDirective,\s*\n\s*clientRequestedMode/);
    // The old hardcoded literal path must be gone.
    expect(composer).not.toMatch(/memoryDirective:\s*"normal"/);
  });

  it("stream helper's TurnRequest still declares the three-value union", () => {
    expect(stream).toMatch(
      /memoryDirective\??:\s*"normal"\s*\|\s*"session_only"\s*\|\s*"do_not_remember"/,
    );
  });

  it("/api/wisdom/turn Zod input accepts exactly the three directives", () => {
    // Extract the memoryDirective enum from the request Zod schema.
    const m = turnApi.match(
      /memoryDirective:\s*z\.enum\(\[[^\]]*\]\)/,
    );
    expect(m, "memoryDirective enum block not found").toBeTruthy();
    const block = m![0];
    for (const v of ["normal", "session_only", "do_not_remember"]) {
      expect(block).toContain(v);
    }
    // No silent aliases.
    expect(block).not.toMatch(/"remember"|"forget"|"private"/);
  });

  it("composer never silently rewrites session_only or do_not_remember to normal", () => {
    // Guard against the anti-pattern of overriding the state right before submit.
    expect(composer).not.toMatch(/memoryDirective\s*=\s*["']normal["']/);
    expect(composer).not.toMatch(
      /setMemoryDirective\(["']normal["']\)\s*;?\s*(\/\/.*)?\n\s*(await\s+)?submit/,
    );
  });
});
