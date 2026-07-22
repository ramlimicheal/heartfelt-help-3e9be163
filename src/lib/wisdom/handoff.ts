/**
 * One-time client-side handoff for private user text between routes.
 *
 * Why this exists
 * ---------------
 * Wisdom must never place user-written content (story, prayer request,
 * personal context, memory directive, or generated result) in a URL.
 * URLs are logged by history, analytics, and error tools, and can be
 * shared or copy-pasted. Anything sensitive is transferred in-tab via
 * `sessionStorage` and referenced from the URL only by an opaque random
 * nonce that identifies the payload.
 *
 * Guarantees
 * ----------
 * 1. Only a non-sensitive mode identifier and an opaque nonce may appear
 *    in the URL. The prompt, memory directive, and any generated content
 *    never enter `search` / `params`.
 * 2. `consumeHandoff(nonce)` returns the payload at most once. It:
 *      - removes the stored payload immediately, and
 *      - records the nonce in a consumed set so the same nonce can
 *        never resurrect the payload from history, remount, back/forward,
 *        or React Strict Mode's double-invocation of effects.
 * 3. `sessionStorage` is scoped to the browsing context, so a different
 *    user or tab cannot read another user's transient payload.
 *
 * Non-goals
 * ---------
 * This is not a persistent memory channel and not durable across
 * refresh once consumed. It is a one-way, single-use route handoff.
 */

export type HandoffMode = "companion" | "pattern" | "deep_wisdom" | "curse_breaker";

export type HandoffPayload = {
  prompt: string;
  mode: HandoffMode;
  createdAt: number;
};

type StoredHandoff = HandoffPayload & { nonce: string };

const KEY_PAYLOAD = "wisdom.handoff.v1";
const KEY_CONSUMED = "wisdom.handoff.v1.consumed";
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes — cover slow logins, cap window
const CONSUMED_LIMIT = 32; // small ring buffer of recently used nonces

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function randomNonce(): string {
  const g = globalThis.crypto;
  if (g?.randomUUID) return g.randomUUID();
  const bytes = new Uint8Array(16);
  (g?.getRandomValues?.(bytes) ??
    (() => {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    })());
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readConsumed(storage: Storage): string[] {
  try {
    const raw = storage.getItem(KEY_CONSUMED);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function markConsumed(storage: Storage, nonce: string): void {
  const list = readConsumed(storage);
  if (list.includes(nonce)) return;
  const next = [nonce, ...list].slice(0, CONSUMED_LIMIT);
  try {
    storage.setItem(KEY_CONSUMED, JSON.stringify(next));
  } catch {
    /* quota exhausted — worst case nonce may be reusable within this tab; the
     * bootRef guard on the consumer still prevents duplicate submit per mount */
  }
}

/**
 * Write a handoff payload for the next route to consume.
 * Returns the opaque nonce that must be placed in the URL.
 * Overwrites any prior un-consumed handoff (dashboard "begin" always wins).
 */
export function writeHandoff(payload: Omit<HandoffPayload, "createdAt">): string {
  const storage = safeStorage();
  const nonce = randomNonce();
  if (!storage) return nonce;
  const stored: StoredHandoff = {
    nonce,
    prompt: payload.prompt,
    mode: payload.mode,
    createdAt: Date.now(),
  };
  try {
    storage.setItem(KEY_PAYLOAD, JSON.stringify(stored));
  } catch {
    /* storage disabled — caller will simply see no autostart */
  }
  return nonce;
}

/**
 * Consume the handoff payload keyed by `nonce`.
 *
 * Behavior:
 *   - If no payload exists, or the stored nonce does not match, or the
 *     payload is expired, or the nonce is already in the consumed set,
 *     returns `null` (and still clears any expired/mismatched payload).
 *   - On a valid match, deletes the payload from storage AND records the
 *     nonce in the consumed set before returning. This is what makes
 *     autostart execute at most once across remount, refresh, Strict
 *     Mode double-invoke, and back/forward navigation.
 */
export function consumeHandoff(nonce: string | undefined | null): HandoffPayload | null {
  if (!nonce) return null;
  const storage = safeStorage();
  if (!storage) return null;

  // Replay protection: once a nonce is used, it can never re-open the payload.
  if (readConsumed(storage).includes(nonce)) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(KEY_PAYLOAD);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: StoredHandoff | null = null;
  try {
    const obj = JSON.parse(raw) as unknown;
    if (
      obj &&
      typeof obj === "object" &&
      typeof (obj as StoredHandoff).nonce === "string" &&
      typeof (obj as StoredHandoff).prompt === "string" &&
      typeof (obj as StoredHandoff).mode === "string" &&
      typeof (obj as StoredHandoff).createdAt === "number"
    ) {
      parsed = obj as StoredHandoff;
    }
  } catch {
    parsed = null;
  }

  if (!parsed) {
    // Corrupt payload — drop it so it can't linger.
    try { storage.removeItem(KEY_PAYLOAD); } catch { /* ignore */ }
    return null;
  }

  if (parsed.nonce !== nonce) return null;
  if (Date.now() - parsed.createdAt > MAX_AGE_MS) {
    try { storage.removeItem(KEY_PAYLOAD); } catch { /* ignore */ }
    markConsumed(storage, nonce);
    return null;
  }

  // Delete BEFORE returning so any concurrent effect invocation
  // (Strict Mode, remount) cannot read the same payload again.
  try { storage.removeItem(KEY_PAYLOAD); } catch { /* ignore */ }
  markConsumed(storage, nonce);

  return {
    prompt: parsed.prompt,
    mode: parsed.mode,
    createdAt: parsed.createdAt,
  };
}

/**
 * Non-autosubmit continuation channel.
 *
 * The response-experience "continue" chips must fill the composer
 * without submitting. From the session viewer this means navigating
 * back to /wisdom and pre-populating the textarea. We keep this
 * strictly separate from the autostart handoff:
 *   - No nonce, no URL parameter — the payload never appears in the URL.
 *   - The composer explicitly READS it (setInput + focus). Nothing runs
 *     automatically.
 *   - Single-consume, capped age, best-effort against storage failure.
 */
const KEY_PENDING = "wisdom.pending-input.v1";
const PENDING_MAX_AGE_MS = 5 * 60 * 1000;
export type PendingInput = { sessionId?: string; prompt: string; createdAt: number };

export function writePendingInput(payload: { sessionId?: string; prompt: string }): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(
      KEY_PENDING,
      JSON.stringify({
        sessionId: payload.sessionId,
        prompt: payload.prompt,
        createdAt: Date.now(),
      } satisfies PendingInput),
    );
  } catch {
    /* best-effort */
  }
}

export function consumePendingInput(): PendingInput | null {
  const storage = safeStorage();
  if (!storage) return null;
  let raw: string | null = null;
  try { raw = storage.getItem(KEY_PENDING); } catch { return null; }
  if (!raw) return null;
  try { storage.removeItem(KEY_PENDING); } catch { /* ignore */ }
  try {
    const obj = JSON.parse(raw) as unknown;
    if (
      obj &&
      typeof obj === "object" &&
      typeof (obj as PendingInput).prompt === "string" &&
      typeof (obj as PendingInput).createdAt === "number"
    ) {
      const p = obj as PendingInput;
      if (Date.now() - p.createdAt > PENDING_MAX_AGE_MS) return null;
      return p;
    }
  } catch { /* fall through */ }
  return null;
}

/** Test-only: reset both keys. Not exported by name-mangling; safe to call in JSDOM. */
export function __resetHandoffForTests(): void {
  const storage = safeStorage();
  if (!storage) return;
  try { storage.removeItem(KEY_PAYLOAD); } catch { /* ignore */ }
  try { storage.removeItem(KEY_CONSUMED); } catch { /* ignore */ }
  try { storage.removeItem(KEY_PENDING); } catch { /* ignore */ }
}
