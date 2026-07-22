/**
 * Phase 2B — finalizePrayer server function source-level guarantees.
 *
 * These are static assertions that the server function contains the
 * validation logic the spec requires. Behavioral proof lives in
 * tests/integration/prayerFinalization.test.ts against the real database.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const library = readFileSync("src/lib/wisdom/library.functions.ts", "utf8");
const detail = readFileSync("src/routes/prayers.$prayerId.tsx", "utf8");
const index = readFileSync("src/routes/prayers.index.tsx", "utf8");

function finalizeHandler(): string {
  const idx = library.indexOf("export const finalizePrayer");
  expect(idx).toBeGreaterThan(-1);
  return library.slice(idx, idx + 5000);
}

describe("Phase 2B — finalizePrayer server function", () => {
  it("uses requireSupabaseAuth middleware and Zod input validation", () => {
    const h = finalizeHandler();
    expect(h).toMatch(/\.middleware\(\[requireSupabaseAuth\]\)/);
    expect(h).toMatch(/inputValidator/);
    // finalizeInput schema defined immediately above with prayerId: uuid.
    expect(library).toMatch(/finalizeInput\s*=\s*z\.object\(\{\s*prayerId:\s*z\.string\(\)\.uuid\(\)/);
  });

  it("loads the prayer server-side and rejects cross-user access", () => {
    const h = finalizeHandler();
    expect(h).toMatch(/from\(["']prayers["']\)/);
    expect(h).toMatch(/user_id\s*!==\s*context\.userId/);
    expect(h).toMatch(/Prayer not found/);
  });

  it("is idempotent for an already-finalized prayer", () => {
    const h = finalizeHandler();
    // Short-circuit branch when finalized_at is already set.
    expect(h).toMatch(/if\s*\(\s*prayer\.finalized_at\s*\)/);
    expect(h).toMatch(/alreadyFinalized:\s*true/);
  });

  it("rejects session_only and do_not_remember originating turns", () => {
    const h = finalizeHandler();
    expect(h).toMatch(/wisdom_turns/);
    expect(h).toMatch(/memory_directive/);
    expect(h).toMatch(/session_only/);
    expect(h).toMatch(/do_not_remember/);
    expect(h).toMatch(/non-durable memory directive/i);
  });

  it("rejects prayers with no lines", () => {
    const h = finalizeHandler();
    expect(h).toMatch(/lineRows\.length\s*===\s*0/);
    expect(h).toMatch(/no lines yet/i);
  });

  it("rejects prayers whose lines are missing citations", () => {
    const h = finalizeHandler();
    expect(h).toMatch(/prayer_line_sources/);
    expect(h).toMatch(/no scripture citation/i);
  });

  it("only writes finalized_at after all validation passes and is idempotent under race", () => {
    const h = finalizeHandler();
    // The update sets finalized_at exactly once, guarded by is-null.
    expect(h).toMatch(/finalized_at:\s*nowIso/);
    expect(h).toMatch(/\.is\(["']finalized_at["'],\s*null\)/);
  });

  it("returns user-safe errors (never raw SQL / model output)", () => {
    const h = finalizeHandler();
    expect(h).toMatch(/Prayer could not be loaded/);
    expect(h).toMatch(/could not be finalized right now/);
    // No leaking of raw error.message from Supabase / DB into the response.
    expect(h).not.toMatch(/throw new Error\(error\.message\)/);
  });
});

describe("Phase 2B — prayer library filtering", () => {
  it("listPrayers only returns finalized prayers", () => {
    const idx = library.indexOf("export const listPrayers");
    const body = library.slice(idx, idx + 1500);
    expect(body).toMatch(/\.not\(["']finalized_at["'],\s*["']is["'],\s*null\)/);
  });

  it("getPrayer surfaces memoryDirective, canFinalize, and missingCitationLineOrders", () => {
    const idx = library.indexOf("export const getPrayer");
    const body = library.slice(idx, idx + 4000);
    expect(body).toMatch(/memoryDirective/);
    expect(body).toMatch(/canFinalize/);
    expect(body).toMatch(/missingCitationLineOrders/);
  });

  it("/prayers copy reflects finalized-only library", () => {
    expect(index).toMatch(/finalized/i);
    expect(index).not.toMatch(/finalizedAt \?/); // no draft/finalized ternary anymore
  });
});

describe("Phase 2B — prayer detail UI wiring", () => {
  it("imports and calls finalizePrayer through useServerFn", () => {
    expect(detail).toMatch(/finalizePrayer/);
    expect(detail).toMatch(/useServerFn\(finalizePrayer\)/);
  });

  it("renders distinct states: already-finalized, non-durable, missing-citations, finalize action", () => {
    expect(detail).toMatch(/data-testid="prayer-already-finalized"/);
    expect(detail).toMatch(/data-testid="prayer-nondurable-block"/);
    expect(detail).toMatch(/data-testid="prayer-missing-citations"/);
    expect(detail).toMatch(/data-testid="prayer-finalize-btn"/);
  });

  it("does not auto-finalize (finalize only fires from the button onClick)", () => {
    // No `useEffect(...finalize` autotrigger.
    expect(detail).not.toMatch(/useEffect\([^)]*finalize/);
    expect(detail).toMatch(/onClick=\{onFinalize\}/);
  });
});
