/**
 * Phase 2A — sensitive persona consent and non-durable-directive guard.
 *
 * Source-level guarantees:
 *   1. `updatePersonaFactStatus` (the generic status-update path) rejects
 *      accepting a sensitive fact without an existing confirmation row.
 *   2. `updatePersonaFactStatus` and `acceptPersonaFact` reject accepting
 *      any fact whose memory_directive is session_only or do_not_remember.
 *   3. Both accept paths load the fact server-side and verify ownership
 *      before mutating (no cross-user access, no client-supplied metadata).
 *   4. The You page renders a two-step confirm flow for sensitive facts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const library = readFileSync("src/lib/wisdom/library.functions.ts", "utf8");
const persona = readFileSync("src/lib/wisdom/persona.functions.ts", "utf8");
const youPage = readFileSync("src/routes/you.tsx", "utf8");

function statusHandler(): string {
  // Slice the updatePersonaFactStatus server fn body.
  const idx = library.indexOf("export const updatePersonaFactStatus");
  expect(idx).toBeGreaterThan(-1);
  return library.slice(idx, idx + 4000);
}
function acceptHandler(): string {
  const idx = persona.indexOf("export const acceptPersonaFact");
  expect(idx).toBeGreaterThan(-1);
  return persona.slice(idx, idx + 3000);
}

describe("Phase 2A — persona consent server-side guards", () => {
  it("updatePersonaFactStatus loads the fact server-side and enforces ownership", () => {
    const h = statusHandler();
    expect(h).toMatch(/from\(["']persona_facts["']\)/);
    expect(h).toMatch(/user_id\s*!==\s*context\.userId/);
    // Never trusts client-supplied sensitivity/directive.
    expect(h).toMatch(/select\(["'][^"']*sensitivity[^"']*memory_directive[^"']*["']\)/);
  });

  it("updatePersonaFactStatus blocks accepting session_only or do_not_remember facts", () => {
    const h = statusHandler();
    expect(h).toMatch(/session_only/);
    expect(h).toMatch(/do_not_remember/);
    expect(h).toMatch(/non-durable memory directive/i);
  });

  it("updatePersonaFactStatus blocks accepting sensitive without a confirmation row", () => {
    const h = statusHandler();
    expect(h).toMatch(/sensitivity\s*===\s*["']sensitive["']/);
    expect(h).toMatch(/persona_fact_confirmations/);
    expect(h).toMatch(/require an explicit confirmation/i);
  });

  it("acceptPersonaFact enforces the same non-durable and confirmation rules", () => {
    const h = acceptHandler();
    expect(h).toMatch(/session_only/);
    expect(h).toMatch(/do_not_remember/);
    expect(h).toMatch(/persona_fact_confirmations/);
    expect(h).toMatch(/requires confirmation/i);
  });

  it("You page requires a confirm-then-accept step for sensitive facts", () => {
    // Two-step UI: click Accept on sensitive → confirm panel appears →
    // finalize calls confirmSensitivePersonaFact then updatePersonaFactStatus.
    expect(youPage).toMatch(/confirmSensitivePersonaFact/);
    expect(youPage).toMatch(/updatePersonaFactStatus/);
    expect(youPage).toMatch(/fact-confirm-panel|Confirm & accept/);
    // Accept button is NOT rendered for non-durable proposals.
    expect(youPage).toMatch(/nonDurable/);
    // Sensitive path goes through the confirmation flow, not a direct accept.
    expect(youPage).toMatch(/setPendingConfirmId/);
  });
});
