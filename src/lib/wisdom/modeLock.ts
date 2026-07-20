/**
 * Pure mode-lock helpers.
 *
 * Contract:
 *   Once a session has received its first accepted user message, its mode is
 *   immutable. Any request to run the pipeline (or send a user message) under
 *   a different mode must be REJECTED with a clear, recoverable error, or
 *   escalated into a new session that is explicitly linked to the original
 *   via parent_session_id.
 *
 * The database enforces this via the `enforce_session_mode_immutable` trigger.
 * These helpers exist to (a) let the server functions return a friendly, typed
 * error before hitting the DB, and (b) be exhaustively unit tested.
 */

export type SessionMode = "companion" | "pattern" | "deep_wisdom" | "curse_breaker";

export interface SessionForLock {
  id: string;
  user_id: string;
  mode: SessionMode;
  mode_locked_at: string | null;
}

export type ModeLockDecision =
  | { ok: true; effectiveMode: SessionMode }
  | {
      ok: false;
      code: "mode_locked_mismatch";
      lockedMode: SessionMode;
      requestedMode: SessionMode;
      recoverable: true;
    };

/**
 * Given a session (or null for "no session yet") and a requested mode,
 * decide whether the request may proceed. This is the pure counterpart of
 * what the DB trigger enforces.
 */
export function evaluateModeLock(args: {
  session: SessionForLock | null;
  requestedMode: SessionMode;
}): ModeLockDecision {
  const { session, requestedMode } = args;
  if (!session) return { ok: true, effectiveMode: requestedMode };
  if (session.mode_locked_at === null) return { ok: true, effectiveMode: session.mode };
  if (session.mode === requestedMode) return { ok: true, effectiveMode: session.mode };
  return {
    ok: false,
    code: "mode_locked_mismatch",
    lockedMode: session.mode,
    requestedMode,
    recoverable: true,
  };
}

export const MODE_LOCK_ERROR = "SESSION_MODE_LOCKED";

/**
 * Throws a typed, machine-readable error the client can recover from by
 * either retrying with the locked mode or creating a new linked session.
 */
export function assertModeAllowed(args: {
  session: SessionForLock | null;
  requestedMode: SessionMode;
}): SessionMode {
  const decision = evaluateModeLock(args);
  if (decision.ok) return decision.effectiveMode;
  const err = new Error(
    `${MODE_LOCK_ERROR}: session locked to '${decision.lockedMode}', cannot run '${decision.requestedMode}'`,
  );
  (err as Error & { code?: string; lockedMode?: SessionMode }).code = MODE_LOCK_ERROR;
  (err as Error & { lockedMode?: SessionMode }).lockedMode = decision.lockedMode;
  throw err;
}
