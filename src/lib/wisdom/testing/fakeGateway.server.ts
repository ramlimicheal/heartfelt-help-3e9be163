/**
 * Checkpoint 3B / Turn 2a — Fake AI gateway for isolated route tests.
 *
 * SERVER-ONLY. The `.server.ts` suffix keeps this module out of the client
 * bundle (enforced by the project's Vite plugin/import protection).
 *
 * ACTIVATION IS FAIL-CLOSED. `isFakeModelEnabled()` returns true ONLY when
 * ALL of the following are simultaneously true, evaluated from process env:
 *
 *   1. NODE_ENV === 'test'
 *   2. WISDOM_TEST_FAKE_MODEL === '1'
 *   3. WISDOM_TEST_RUN_ID is a non-empty string
 *
 * If flag #2 is set without #1 or #3, `assertFakeModelSafe()` THROWS — the
 * process fails closed instead of silently enabling the fake in an
 * environment that could reach real users.
 *
 * The fake model is never selectable by an HTTP caller:
 *   - No request header, query param, cookie, or body field is inspected.
 *   - All decisions come from process env, set only by the test runner.
 *   - Nothing exported here writes to the network or opens a port.
 */

import type { ModelCall } from "../unified.orchestrator";

/** Guard result. Never trust this without `assertFakeModelSafe`. */
export function isFakeModelEnabled(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  const flag = process.env.WISDOM_TEST_FAKE_MODEL;
  const runId = process.env.WISDOM_TEST_RUN_ID;
  return nodeEnv === "test" && flag === "1" && !!runId && runId.length > 0;
}

/**
 * Fail-closed check. Call at module resolution time in any code path that
 * would substitute the fake. If WISDOM_TEST_FAKE_MODEL is set but the
 * surrounding environment is not a test environment, throw synchronously so
 * the misuse is impossible to silently ignore.
 */
export function assertFakeModelSafe(): void {
  const flag = process.env.WISDOM_TEST_FAKE_MODEL;
  if (flag !== "1") return; // flag off → no assertion needed
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "WISDOM_TEST_FAKE_MODEL is set but NODE_ENV is not 'test' — refusing to enable fake gateway.",
    );
  }
  if (!process.env.WISDOM_TEST_RUN_ID) {
    throw new Error(
      "WISDOM_TEST_FAKE_MODEL is set but WISDOM_TEST_RUN_ID is missing — refusing to enable fake gateway.",
    );
  }
}

// ── Deterministic capabilities used by later sub-turns ─────────────────
type Scenario =
  | { kind: "success"; raw: unknown; tokensIn?: number; tokensOut?: number }
  | { kind: "validation_error"; raw: unknown }
  | { kind: "model_error"; error: string }
  | { kind: "delay"; ms: number; then: Scenario }
  | { kind: "barrier"; token: string; then: Scenario };

type RunState = {
  runId: string;
  defaultScenario: Scenario;
  scenariosByKey: Map<string, Scenario>;
  callCount: number;
  callLog: Array<{ mode: string; model: string; at: number; key: string | null }>;
  barriers: Map<string, { resolve: () => void; promise: Promise<void> }>;
};

const runs = new Map<string, RunState>();

function getState(): RunState {
  assertFakeModelSafe();
  const runId = process.env.WISDOM_TEST_RUN_ID!;
  let s = runs.get(runId);
  if (!s) {
    s = {
      runId,
      defaultScenario: { kind: "model_error", error: "no_scenario_configured" },
      scenariosByKey: new Map(),
      callCount: 0,
      callLog: [],
      barriers: new Map(),
    };
    runs.set(runId, s);
  }
  return s;
}

/** Reset per-test state (call in `beforeEach`). Never touches other runs. */
export function resetFakeGateway(): void {
  const runId = process.env.WISDOM_TEST_RUN_ID;
  if (!runId) return;
  runs.delete(runId);
}

/** Configure the default response returned when no key match is found. */
export function setDefaultScenario(s: Scenario): void {
  getState().defaultScenario = s;
}

/** Configure a scenario keyed by triggering-message id (or any test key). */
export function setScenarioFor(key: string, s: Scenario): void {
  getState().scenariosByKey.set(key, s);
}

/** Return the number of times the fake model was invoked in this run. */
export function fakeCallCount(): number {
  return getState().callCount;
}

/** Return the (small) call log for assertions. Contains no user content. */
export function fakeCallLog(): ReadonlyArray<{ mode: string; model: string; at: number; key: string | null }> {
  return getState().callLog.slice();
}

/** Release a barrier so a suspended call can proceed. */
export function releaseBarrier(token: string): void {
  const b = getState().barriers.get(token);
  if (b) {
    b.resolve();
    getState().barriers.delete(token);
  }
}

/** ModelCall wired for the orchestrator. Server-only. Not exported to client. */
export const fakeCallModel: ModelCall = async ({ mode, model, userPrompt }) => {
  const state = getState();
  state.callCount += 1;
  // The prompt embeds the triggering message id in the identity block;
  // extract the last uuid we see as a routing key. Never log the prompt.
  const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const matches = userPrompt.match(uuidRe) ?? [];
  const key = matches.length ? matches[matches.length - 1]!.toLowerCase() : null;
  state.callLog.push({ mode, model, at: Date.now(), key });

  const scenario = (key ? state.scenariosByKey.get(key) : undefined) ?? state.defaultScenario;
  return runScenario(scenario);
};

async function runScenario(
  s: Scenario,
): Promise<{ raw: unknown; tokensIn?: number; tokensOut?: number }> {
  switch (s.kind) {
    case "success":
      return { raw: s.raw, tokensIn: s.tokensIn ?? 0, tokensOut: s.tokensOut ?? 0 };
    case "validation_error":
      // Return a shape the orchestrator's Zod parse will reject.
      return { raw: s.raw, tokensIn: 0, tokensOut: 0 };
    case "model_error":
      throw new Error(s.error);
    case "delay":
      await new Promise((r) => setTimeout(r, s.ms));
      return runScenario(s.then);
    case "barrier": {
      const state = getState();
      let existing = state.barriers.get(s.token);
      if (!existing) {
        let resolve!: () => void;
        const promise = new Promise<void>((r) => (resolve = r));
        existing = { promise, resolve };
        state.barriers.set(s.token, existing);
      }
      await existing.promise;
      return runScenario(s.then);
    }
  }
}
