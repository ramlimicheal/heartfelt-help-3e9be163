/**
 * Checkpoint 3A — Pure unified orchestrator.
 *
 * Runs one turn end-to-end: identity → retrieval → single model call →
 * schema validation → grounding validation → persistence.
 *
 * All I/O is injected (db + model + clock) so the invariants can be tested
 * without hitting the Lovable AI Gateway. Called by the flag-gated server
 * function in `unified.functions.ts`.
 */
import { z } from "zod";
import {
  zCompanionResult,
  zPatternResult,
  zDeepWisdomResult,
  type UnifiedMode,
  type UnifiedResult,
} from "./unified.schemas";

export type UnifiedTurnInput = {
  userId: string;
  sessionId: string;
  triggeringUserMessageId: string;
  storedSessionMode: UnifiedMode | "curse_breaker";
  memoryDirective: "normal" | "session_only" | "do_not_remember";
  userText: string;
  clientRequestedMode?: string;
};

export type RetrievalPassage = {
  id: string;
  reference: string;
  translation: string;
  canon_profile: string;
  source_tier: "S1"|"S2"|"S3"|"S4"|"S5"|"S6"|"S7"|"S8";
  text: string;
};

export type PromptRow = { key: string; version: number; body: string };
export type ModelRow  = { stage: string; version: number; model: string };

export type ModelCall = (args: {
  system: string;
  userPrompt: string;
  mode: UnifiedMode;
  model: string;
}) => Promise<{ raw: unknown; tokensIn?: number; tokensOut?: number }>;

export type OrchestratorDeps = {
  loadPrompt: (key: string) => Promise<PromptRow>;
  loadModel: (stage: string) => Promise<ModelRow>;
  retrieve: () => Promise<RetrievalPassage[]>;
  callModel: ModelCall;
  // Reserve a turn row keyed by triggering_user_message_id + idempotency_key.
  // Returns existing turn if this triggering message already produced one
  // (idempotent retry), else null.
  findExistingTurn: (triggeringUserMessageId: string) => Promise<{
    id: string;
    status: "pending"|"ok"|"validation_error"|"model_error";
    result: UnifiedResult | null;
  } | null>;
  createTurn: (row: {
    userId: string;
    sessionId: string;
    triggeringUserMessageId: string;
    mode: UnifiedMode;
    memoryDirective: "normal"|"session_only"|"do_not_remember";
    idempotencyKey: string;
    promptKey: string;
    promptVersion: number;
    model: string;
    modelVersion: number;
  }) => Promise<{ id: string }>;
  finalizeTurn: (id: string, patch: {
    status: "ok"|"validation_error"|"model_error";
    result?: UnifiedResult;
    error?: string;
    latencyMs?: number;
    tokensIn?: number;
    tokensOut?: number;
  }) => Promise<void>;
  persistArtifacts: (
    turnId: string,
    userId: string,
    sessionId: string,
    result: UnifiedResult,
  ) => Promise<void>;
  logRun: (row: {
    userId: string; sessionId: string;
    mode: UnifiedMode; stage: string;
    status: "ok"|"error";
    promptKey: string; promptVersion: number;
    model: string;
    latencyMs: number;
    tokensIn?: number; tokensOut?: number;
    idempotencyKey: string;
    error?: string;
  }) => Promise<void>;
  now?: () => number;
};

export const CURSE_BREAKER_PENDING_ERROR =
  "unified_orchestrator: curse_breaker is not unified in Checkpoint 3A";

// Idempotency key is deterministic in the triggering message +
// active prompt/model versions. Retries of the same triggering message under
// the same governed config resolve to the same key.
export function computeIdempotencyKey(args: {
  triggeringUserMessageId: string;
  promptKey: string;
  promptVersion: number;
  modelStage: string;
  modelVersion: number;
}): string {
  return `t:${args.triggeringUserMessageId}|p:${args.promptKey}@${args.promptVersion}|m:${args.modelStage}@${args.modelVersion}`;
}

function schemaFor(mode: UnifiedMode) {
  if (mode === "companion") return zCompanionResult;
  if (mode === "pattern") return zPatternResult;
  return zDeepWisdomResult;
}

function promptKeyFor(mode: UnifiedMode) {
  return `unified.${mode}` as const;
}

/** Grounding: every scripture-bearing field must cite passages from the retrieval set. */
export function validateGrounding(
  result: UnifiedResult,
  retrievalIds: Set<string>,
) {
  // Every source_passages entry must be from the retrieval set.
  for (const p of result.source_passages) {
    if (!retrievalIds.has(p.passage_id))
      throw new Error(`fabricated source_passages.passage_id ${p.passage_id}`);
  }

  const checkCitationList = (
    where: string,
    citations: Array<{ passage_id: string; derivation: string; contextual_limit?: string }>,
  ) => {
    const seen = new Set<string>();
    for (const c of citations) {
      if (!retrievalIds.has(c.passage_id))
        throw new Error(`${where}: fabricated passage_id ${c.passage_id}`);
      if (seen.has(c.passage_id))
        throw new Error(`${where}: duplicate citation ${c.passage_id}`);
      seen.add(c.passage_id);
      if (c.derivation === "pattern_matched" && !(c.contextual_limit && c.contextual_limit.trim().length >= 8))
        throw new Error(`${where}: pattern_matched citation ${c.passage_id} must include a contextual_limit`);
    }
  };

  if (result.mode === "companion") {
    if (!retrievalIds.has(result.biblical_mirror.passage_id))
      throw new Error(`companion.biblical_mirror: fabricated passage_id ${result.biblical_mirror.passage_id}`);
    if (result.biblical_mirror.derivation === "pattern_matched"
        && !(result.biblical_mirror.contextual_limit && result.biblical_mirror.contextual_limit.trim().length >= 8))
      throw new Error(`companion.biblical_mirror: pattern_matched requires contextual_limit`);
  } else if (result.mode === "pattern") {
    result.prayer_draft.lines.forEach((l, i) =>
      checkCitationList(`pattern.prayer_draft.lines[${i}]`, l.citations));
  } else {
    for (const [i, m] of result.biblical_mirrors.entries()) {
      if (!retrievalIds.has(m.passage_id))
        throw new Error(`deep_wisdom.biblical_mirrors[${i}]: fabricated passage_id ${m.passage_id}`);
      if (m.derivation === "pattern_matched"
          && !(m.contextual_limit && m.contextual_limit.trim().length >= 8))
        throw new Error(`deep_wisdom.biblical_mirrors[${i}]: pattern_matched requires contextual_limit`);
    }
    result.prayer_lineage_draft.lines.forEach((l, i) =>
      checkCitationList(`deep_wisdom.prayer_lineage_draft.lines[${i}]`, l.citations));
  }
}

export type UnifiedTurnOutcome =
  | { kind: "reused"; turnId: string; result: UnifiedResult }
  | { kind: "created"; turnId: string; result: UnifiedResult }
  | { kind: "unsupported"; error: string };

export async function runUnifiedTurn(
  input: UnifiedTurnInput,
  deps: OrchestratorDeps,
): Promise<UnifiedTurnOutcome> {
  // Client-mode override policy: the STORED session mode is authoritative.
  // We ignore input.clientRequestedMode entirely for durable behaviour;
  // it is retained only for telemetry/observability by the caller.
  if (input.storedSessionMode === "curse_breaker") {
    return { kind: "unsupported", error: CURSE_BREAKER_PENDING_ERROR };
  }
  const mode: UnifiedMode = input.storedSessionMode;

  const promptKey = promptKeyFor(mode);
  const modelStage = promptKey;
  const [prompt, modelRow] = await Promise.all([
    deps.loadPrompt(promptKey),
    deps.loadModel(modelStage),
  ]);
  const idempotencyKey = computeIdempotencyKey({
    triggeringUserMessageId: input.triggeringUserMessageId,
    promptKey: prompt.key,
    promptVersion: prompt.version,
    modelStage,
    modelVersion: modelRow.version,
  });

  // Idempotent retry: if a completed turn already exists for this triggering
  // message, return it without any duplicate work or duplicate artifacts.
  const existing = await deps.findExistingTurn(input.triggeringUserMessageId);
  if (existing && existing.status === "ok" && existing.result) {
    return { kind: "reused", turnId: existing.id, result: existing.result };
  }
  if (existing) {
    // A prior attempt failed. Do NOT create a new row (unique constraint
    // enforces one turn per triggering message). Refuse and let the caller
    // start a new triggering message.
    throw new Error(`unified_orchestrator: prior turn ${existing.id} for message ${input.triggeringUserMessageId} ended in ${existing.status}; start a new turn`);
  }

  // Reserve turn row (pending). Unique(triggering_user_message_id) means a
  // racing duplicate insert fails at the DB — that's the retry-safety net.
  const { id: turnId } = await deps.createTurn({
    userId: input.userId,
    sessionId: input.sessionId,
    triggeringUserMessageId: input.triggeringUserMessageId,
    mode,
    memoryDirective: input.memoryDirective,
    idempotencyKey,
    promptKey: prompt.key,
    promptVersion: prompt.version,
    model: modelRow.model,
    modelVersion: modelRow.version,
  });

  const clock = deps.now ?? (() => Date.now());

  // ── Retrieval ──────────────────────────────────────────────────
  const retrieval = await deps.retrieve();
  if (retrieval.length === 0) {
    const err = "retrieval empty — no approved passages";
    await deps.finalizeTurn(turnId, { status: "model_error", error: err });
    await deps.logRun({
      userId: input.userId, sessionId: input.sessionId, mode, stage: "unified.retrieval",
      status: "error", promptKey: prompt.key, promptVersion: prompt.version,
      model: modelRow.model, latencyMs: 0, idempotencyKey, error: err,
    });
    throw new Error(err);
  }
  const retrievalIds = new Set(retrieval.map((r) => r.id));

  // ── Single model call ─────────────────────────────────────────
  const retrievalBlock = retrieval.map((r) =>
    `passage_id=${r.id} tier=${r.source_tier} ${r.reference} (${r.translation})\n${r.text}`).join("\n\n---\n\n");
  const userPrompt =
    `USER STORY:\n${input.userText}\n\n` +
    `RETRIEVAL SET (use passage_id verbatim; never fabricate):\n${retrievalBlock}`;

  const t0 = clock();
  let raw: unknown;
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;
  try {
    const r = await deps.callModel({
      system: prompt.body,
      userPrompt,
      mode,
      model: modelRow.model,
    });
    raw = r.raw;
    tokensIn = r.tokensIn;
    tokensOut = r.tokensOut;
  } catch (e) {
    const err = String((e as Error).message ?? e);
    await deps.finalizeTurn(turnId, { status: "model_error", error: err, latencyMs: clock() - t0 });
    await deps.logRun({
      userId: input.userId, sessionId: input.sessionId, mode, stage: "unified.model",
      status: "error", promptKey: prompt.key, promptVersion: prompt.version,
      model: modelRow.model, latencyMs: clock() - t0, idempotencyKey, error: err,
    });
    throw e;
  }

  // ── Structural validation ─────────────────────────────────────
  const parsed = schemaFor(mode).safeParse(
    // model returned raw JSON; force mode discriminator to the stored session mode
    typeof raw === "object" && raw !== null ? { ...(raw as object), mode } : raw,
  );
  if (!parsed.success) {
    const err = `schema: ${parsed.error.message.slice(0, 800)}`;
    await deps.finalizeTurn(turnId, { status: "validation_error", error: err, latencyMs: clock() - t0, tokensIn, tokensOut });
    await deps.logRun({
      userId: input.userId, sessionId: input.sessionId, mode, stage: "unified.schema",
      status: "error", promptKey: prompt.key, promptVersion: prompt.version,
      model: modelRow.model, latencyMs: clock() - t0, tokensIn, tokensOut, idempotencyKey, error: err,
    });
    throw new Error(err);
  }
  const result = parsed.data as UnifiedResult;

  // ── Grounding validation ──────────────────────────────────────
  try {
    validateGrounding(result, retrievalIds);
  } catch (e) {
    const err = String((e as Error).message ?? e);
    await deps.finalizeTurn(turnId, { status: "validation_error", error: err, latencyMs: clock() - t0, tokensIn, tokensOut });
    await deps.logRun({
      userId: input.userId, sessionId: input.sessionId, mode, stage: "unified.grounding",
      status: "error", promptKey: prompt.key, promptVersion: prompt.version,
      model: modelRow.model, latencyMs: clock() - t0, tokensIn, tokensOut, idempotencyKey, error: err,
    });
    throw e;
  }

  // ── DNR gate: do_not_remember produces NO durable inference artifacts. ──
  const isDnr = input.memoryDirective === "do_not_remember";

  // ── Persistence contract ─────────────────────────────────────
  // Companion: no durable inference writes even for normal turns.
  // Pattern / Deep Wisdom: persist artifact family only after full validation.
  if (mode !== "companion" && !isDnr) {
    await deps.persistArtifacts(turnId, input.userId, input.sessionId, result);
  }

  await deps.finalizeTurn(turnId, {
    status: "ok",
    result,
    latencyMs: clock() - t0,
    tokensIn, tokensOut,
  });
  await deps.logRun({
    userId: input.userId, sessionId: input.sessionId, mode, stage: "unified.turn",
    status: "ok", promptKey: prompt.key, promptVersion: prompt.version,
    model: modelRow.model, latencyMs: clock() - t0, tokensIn, tokensOut, idempotencyKey,
  });
  return { kind: "created", turnId, result };
}

// Test-visible: strip scrubbable "reasoning" fields (defence in depth — the
// schemas already reject them, this exists so callers rendering user text
// have a guaranteed-clean object).
export function stripReasoning<T extends { user_facing_response: string }>(r: T): T {
  const clone: Record<string, unknown> = { ...(r as unknown as Record<string, unknown>) };
  for (const k of Object.keys(clone)) {
    if (/reason|scratch|chain_of_thought|cot/i.test(k)) delete clone[k];
  }
  return clone as T;
}

// Re-export types for test/consumer convenience.
export { z };
