/**
 * Checkpoint 3A — Unified Wisdom Turn orchestrator invariants.
 *
 * Uses in-memory fakes for DB and the model call so we can prove the
 * required behavioural contracts without hitting the Lovable AI Gateway
 * or Supabase — the orchestrator's I/O is fully injected.
 *
 * The 53 existing tests (DNR, mode-lock, signal contract, pattern
 * lifecycle, dnr-fanout) are NOT modified.
 */
import { describe, it, expect } from "vitest";
import {
  runUnifiedTurn,
  computeIdempotencyKey,
  type OrchestratorDeps,
  type RetrievalPassage,
  type UnifiedTurnInput,
} from "@/lib/wisdom/unified.orchestrator";
import type { UnifiedResult, UnifiedMode } from "@/lib/wisdom/unified.schemas";

// ── In-memory dep factory ────────────────────────────────────────────
type Store = {
  turns: Array<Record<string, unknown>>;
  artifactCalls: Array<{ turnId: string; result: UnifiedResult }>;
  runs: Array<Record<string, unknown>>;
};

function makeRetrieval(): RetrievalPassage[] {
  return [
    { id: "11111111-1111-1111-1111-111111111111", reference: "Ps 34:18", translation: "WEB", canon_profile: "protestant_66", source_tier: "S1", text: "Yahweh is near to the broken-hearted, and saves those with a crushed spirit." },
    { id: "22222222-2222-2222-2222-222222222222", reference: "Rom 8:26", translation: "WEB", canon_profile: "protestant_66", source_tier: "S1", text: "The Spirit helps our weakness, for we don't know how to pray as we ought." },
    { id: "33333333-3333-3333-3333-333333333333", reference: "Jas 5:16", translation: "WEB", canon_profile: "protestant_66", source_tier: "S1", text: "Confess your offenses to one another, and pray for one another, that you may be healed." },
  ];
}

function baseInput(overrides: Partial<UnifiedTurnInput> = {}): UnifiedTurnInput {
  return {
    userId: "u-1",
    sessionId: "s-1",
    triggeringUserMessageId: "m-1",
    storedSessionMode: "pattern",
    memoryDirective: "normal",
    userText: "I keep withdrawing when my wife brings up finances.",
    ...overrides,
  };
}

function makeDeps(opts: {
  buildResult: (mode: UnifiedMode, retrieval: RetrievalPassage[]) => unknown;
  store?: Store;
  throwInModel?: string;
  retrieval?: RetrievalPassage[];
  seedExisting?: { status: "ok"|"validation_error"|"pending"|"model_error"; result?: UnifiedResult };
}): { deps: OrchestratorDeps; store: Store } {
  const store: Store = opts.store ?? { turns: [], artifactCalls: [], runs: [] };
  const retrieval = opts.retrieval ?? makeRetrieval();
  if (opts.seedExisting) {
    store.turns.push({
      id: "existing-turn",
      triggering_user_message_id: "m-1",
      status: opts.seedExisting.status,
      result: opts.seedExisting.result ?? null,
    });
  }
  const deps: OrchestratorDeps = {
    loadPrompt: async (key) => ({ key, version: 1, body: `SYSTEM:${key}` }),
    loadModel:  async (stage) => ({ stage, version: 1, model: "google/gemini-3-flash-preview" }),
    retrieve: async () => retrieval,
    callModel: async ({ mode }) => {
      if (opts.throwInModel) throw new Error(opts.throwInModel);
      return { raw: opts.buildResult(mode, retrieval), tokensIn: 100, tokensOut: 200 };
    },
    findExistingTurn: async (msgId) => {
      const found = store.turns.find((t) => t.triggering_user_message_id === msgId);
      if (!found) return null;
      return {
        id: found.id as string,
        status: found.status as "pending"|"ok"|"validation_error"|"model_error",
        result: (found.result as UnifiedResult | null) ?? null,
      };
    },
    createTurn: async (row) => {
      if (store.turns.some((t) => t.triggering_user_message_id === row.triggeringUserMessageId))
        throw new Error("duplicate triggering message");
      const id = `turn-${store.turns.length + 1}`;
      store.turns.push({
        id, triggering_user_message_id: row.triggeringUserMessageId,
        status: "pending", result: null, idempotency_key: row.idempotencyKey,
        mode: row.mode, prompt_key: row.promptKey, model: row.model,
      });
      return { id };
    },
    finalizeTurn: async (id, patch) => {
      const t = store.turns.find((x) => x.id === id);
      if (!t) throw new Error("no such turn");
      Object.assign(t, {
        status: patch.status,
        result: patch.result ?? t.result,
        error: patch.error ?? null,
      });
    },
    persistArtifacts: async (turnId, _u, _s, result) => {
      store.artifactCalls.push({ turnId, result });
    },
    logRun: async (row) => { store.runs.push(row); },
  };
  return { deps, store };
}

// ── Fixture builders (structurally-valid results) ────────────────────
function companionResult(retrieval: RetrievalPassage[]): unknown {
  const p = retrieval[0];
  return {
    mode: "companion",
    what_wisdom_heard: "You feel unheard when finances come up.",
    explicit_signals: [{ kind: "emotion", paraphrase: "shutdown", confidence: 0.7 }],
    inferred_signals: [],
    source_passages: [{ passage_id: p.id, reference: p.reference, translation: p.translation, canon_profile: p.canon_profile, source_tier: p.source_tier, text: p.text }],
    uncertainty: "Limited context.",
    user_facing_response: "It sounds like the moment overwhelms you.",
    next_question: "What happens in the first seconds you notice yourself pulling back?",
    reflection: "You've named a recurring shape.",
    biblical_mirror: {
      passage_id: p.id, derivation: "direct",
      direct_vs_inferred: "direct", descriptive_vs_prescriptive: "descriptive",
      explanation: "Nearness to the broken-hearted meets you in the withdrawal.",
    },
  };
}

function patternResult(retrieval: RetrievalPassage[]): unknown {
  const [p1, p2, p3] = retrieval;
  return {
    mode: "pattern",
    what_wisdom_heard: "Withdrawal returns whenever finances surface.",
    explicit_signals: [{ kind: "trigger", paraphrase: "finance topic", confidence: 0.8 }],
    inferred_signals: [{ kind: "belief", paraphrase: "I will fail her", confidence: 0.6 }],
    source_passages: [p1,p2,p3].map((x)=>({ passage_id: x.id, reference: x.reference, translation: x.translation, canon_profile: x.canon_profile, source_tier: x.source_tier, text: x.text })),
    uncertainty: "Two turns of evidence only.",
    user_facing_response: "The trigger seems to be exposure to a numeric ask.",
    next_question: "Which specific ask escalates fastest?",
    event_chain: [
      { kind: "trigger", text: "wife opens budget app", fromUser: true },
      { kind: "interpretation", text: "she will see the gap", fromUser: false },
      { kind: "choice", text: "I go silent", fromUser: true },
    ],
    competing_hypotheses: [
      { name: "Shame-avoidance", description: "Silence protects self-image.", confidence: 0.6,
        supporting_evidence: ["repeated withdrawal"], counter_evidence: [], missing_evidence: ["your account of the internal moment"] },
      { name: "Overload", description: "Cognitive fatigue at end of day.", confidence: 0.4,
        supporting_evidence: ["evening timing"], counter_evidence: [], missing_evidence: ["morning comparison"] },
    ],
    distinguishing_question: "Does the same silence happen mid-morning?",
    proposed_pattern_eligible: true,
    proposed_pattern: { title: "Financial-exposure withdrawal", description: "Withdrawal triggered by financial exposure.", confidence: 0.55 },
    prayer_draft: {
      title: "For honesty in exposure",
      lines: [
        { movement: "confession", text: "I confess I hide.",
          citations: [{ passage_id: p3.id, derivation: "direct", explanation: "James 5:16 speaks the practice we resist." }] },
        { movement: "adoration", text: "You are near even now.",
          citations: [{ passage_id: p1.id, derivation: "direct", explanation: "Psalm 34:18 names God's location." }] },
        { movement: "deliverance", text: "Meet me in the shutdown.",
          citations: [{ passage_id: p2.id, derivation: "pattern_matched", explanation: "The Spirit intercedes where words fail.", contextual_limit: "The parallel is prayerlessness; not identical to marital silence." }] },
      ],
    },
    primary_practice: { kind: "confession", title: "Name it aloud within 30 seconds", rationale: "Speed disrupts the hide-loop." },
  };
}

function deepWisdomResult(retrieval: RetrievalPassage[]): unknown {
  const [p1, p2] = retrieval;
  return {
    mode: "deep_wisdom",
    what_wisdom_heard: "You are testing whether this is spiritual or ordinary.",
    explicit_signals: [], inferred_signals: [],
    source_passages: [p1,p2].map((x)=>({ passage_id: x.id, reference: x.reference, translation: x.translation, canon_profile: x.canon_profile, source_tier: x.source_tier, text: x.text })),
    uncertainty: "One session only.",
    user_facing_response: "There are several ordinary explanations to weigh first.",
    next_question: null,
    event_chain: [{ kind: "trigger", text: "budget conversation", fromUser: true }],
    hypothesis_under_test: {
      name: "Generational fear of provision",
      description: "Ancestral scarcity script may be at work.",
      confidence: 0.4,
      supporting_evidence: ["family narrative of scarcity"],
      counter_evidence: ["current provision is stable"],
      missing_evidence: ["direct memory of childhood scarcity"],
    },
    competing_explanations: [
      { frame: "ordinary", text: "End-of-day cognitive load." },
      { frame: "relational", text: "Unmet expectation of admiration." },
      { frame: "embodied", text: "Stress response in body." },
    ],
    biblical_mirrors: [
      { passage_id: p1.id, derivation: "direct", direct_vs_inferred: "direct", descriptive_vs_prescriptive: "descriptive", explanation: "God near the crushed spirit." },
    ],
    counter_evidence: ["No sudden spiritual disturbance reported."],
    contextual_limits: ["Deep Wisdom cannot diagnose family systems."],
    prayer_lineage_draft: {
      title: "For discernment across ordinary and spiritual",
      lines: [
        { movement: "adoration", text: "You see the whole chain.", citations: [{ passage_id: p1.id, derivation: "direct", explanation: "You are near." }] },
        { movement: "confession", text: "I confess I rushed to name it spiritual.", citations: [{ passage_id: p2.id, derivation: "inferred", explanation: "We infer the Spirit's help when we do not know how to pray." }] },
        { movement: "healing",    text: "Heal the moment beneath the moment.", citations: [{ passage_id: p1.id, derivation: "direct", explanation: "Nearness to the crushed spirit." }] },
      ],
    },
    primary_practice: { kind: "silence", title: "Two minutes of silence before the next conversation", rationale: "Interrupts scripted reactivity." },
    proposed_persona_facts: [
      { category: "belief", text: "Money means exposure.", status: "proposed", sensitivity: "sensitive" },
    ],
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("Checkpoint 3A — Unified Wisdom Turn orchestrator", () => {
  it("visible result and persisted result are the same structured object (pattern)", async () => {
    const { deps, store } = makeDeps({ buildResult: (_, r) => patternResult(r) });
    const out = await runUnifiedTurn(baseInput({ storedSessionMode: "pattern" }), deps);
    expect(out.kind).toBe("created");
    if (out.kind !== "created") throw new Error("unreachable");
    const persisted = store.artifactCalls[0].result;
    // Same object reference all the way through (visible == persisted).
    expect(persisted).toBe(out.result);
    // Turn row's `result` matches too.
    expect(store.turns[0].result).toBe(out.result);
  });

  it("every visible citation belongs to the retrieval set; persisted uses the same passage_ids", async () => {
    const { deps, store } = makeDeps({ buildResult: (_, r) => patternResult(r) });
    const out = await runUnifiedTurn(baseInput({ storedSessionMode: "pattern" }), deps);
    if (out.kind !== "created" || out.result.mode !== "pattern") throw new Error("unreachable");
    const retrievalIds = new Set(makeRetrieval().map((r) => r.id));
    const visibleIds = out.result.prayer_draft.lines.flatMap((l) => l.citations.map((c) => c.passage_id));
    for (const id of visibleIds) expect(retrievalIds.has(id)).toBe(true);
    const persistedIds = store.artifactCalls[0].result.mode === "pattern"
      ? store.artifactCalls[0].result.prayer_draft.lines.flatMap((l) => l.citations.map((c) => c.passage_id))
      : [];
    expect(persistedIds).toEqual(visibleIds);
  });

  it("fabricated references fail the turn (validation_error, no artifacts)", async () => {
    const { deps, store } = makeDeps({
      buildResult: (_, r) => {
        const bad = JSON.parse(JSON.stringify(patternResult(r))) as { prayer_draft: { lines: Array<{ citations: Array<{ passage_id: string }> }> } };
        bad.prayer_draft.lines[0].citations[0].passage_id = "99999999-9999-9999-9999-999999999999";
        return bad;
      },
    });
    await expect(runUnifiedTurn(baseInput({ storedSessionMode: "pattern" }), deps)).rejects.toThrow(/fabricated/);
    expect(store.artifactCalls.length).toBe(0);
    expect(store.turns[0].status).toBe("validation_error");
  });

  it("Pattern and Deep Wisdom use distinct contracts (deep_wisdom result rejected as pattern)", async () => {
    const { deps } = makeDeps({ buildResult: (_, r) => deepWisdomResult(r) });
    // Session is stored as pattern but model returns deep_wisdom-shaped body.
    // Because the orchestrator forces the mode discriminator to the stored
    // mode, the pattern schema rejects deep_wisdom-only fields' absence.
    await expect(runUnifiedTurn(baseInput({ storedSessionMode: "pattern" }), deps))
      .rejects.toThrow(/schema:/);
  });

  it("Companion performs no durable inference writes even on success", async () => {
    const { deps, store } = makeDeps({ buildResult: (_, r) => companionResult(r) });
    const out = await runUnifiedTurn(baseInput({ storedSessionMode: "companion" }), deps);
    expect(out.kind).toBe("created");
    expect(store.artifactCalls.length).toBe(0);
    expect(store.turns[0].status).toBe("ok");
  });

  it("DNR (do_not_remember) turn produces no durable artifacts even in pattern mode", async () => {
    const { deps, store } = makeDeps({ buildResult: (_, r) => patternResult(r) });
    const out = await runUnifiedTurn(
      baseInput({ storedSessionMode: "pattern", memoryDirective: "do_not_remember" }),
      deps,
    );
    expect(out.kind).toBe("created");
    expect(store.artifactCalls.length).toBe(0);
  });

  it("retrying the same triggering message returns the same turn and creates no duplicates", async () => {
    const { deps, store } = makeDeps({ buildResult: (_, r) => patternResult(r) });
    const first = await runUnifiedTurn(baseInput({ storedSessionMode: "pattern" }), deps);
    const second = await runUnifiedTurn(baseInput({ storedSessionMode: "pattern" }), deps);
    if (first.kind !== "created" || second.kind !== "reused") throw new Error("unexpected outcome");
    expect(second.turnId).toBe(first.turnId);
    expect(store.turns.length).toBe(1);
    expect(store.artifactCalls.length).toBe(1); // still only from the first call
  });

  it("model failure creates no partial artifact family", async () => {
    const { deps, store } = makeDeps({
      buildResult: (_, r) => patternResult(r),
      throwInModel: "gateway 503",
    });
    await expect(runUnifiedTurn(baseInput({ storedSessionMode: "pattern" }), deps)).rejects.toThrow(/gateway 503/);
    expect(store.artifactCalls.length).toBe(0);
    expect(store.turns[0].status).toBe("model_error");
  });

  it("validation failure creates no partial artifact family", async () => {
    const { deps, store } = makeDeps({
      buildResult: (_, r) => {
        // Structurally invalid: strip a required field.
        const bad = JSON.parse(JSON.stringify(patternResult(r))) as Record<string, unknown>;
        delete bad.competing_hypotheses;
        return bad;
      },
    });
    await expect(runUnifiedTurn(baseInput({ storedSessionMode: "pattern" }), deps)).rejects.toThrow(/schema:/);
    expect(store.artifactCalls.length).toBe(0);
    expect(store.turns[0].status).toBe("validation_error");
  });

  it("client mode cannot override stored session mode", async () => {
    const { deps, store } = makeDeps({ buildResult: (_, r) => companionResult(r) });
    // Stored is companion; client requests pattern. Orchestrator uses companion.
    await runUnifiedTurn(
      baseInput({ storedSessionMode: "companion", clientRequestedMode: "pattern" }),
      deps,
    );
    expect(store.turns[0].mode).toBe("companion");
    expect(store.artifactCalls.length).toBe(0); // companion never writes
  });

  it("active prompt/model versions appear in telemetry with the idempotency key", async () => {
    const { deps, store } = makeDeps({ buildResult: (_, r) => patternResult(r) });
    await runUnifiedTurn(baseInput({ storedSessionMode: "pattern" }), deps);
    const okRun = store.runs.find((r) => (r as { stage: string }).stage === "unified.turn") as Record<string, unknown>;
    expect(okRun.promptKey).toBe("unified.pattern");
    expect(okRun.promptVersion).toBe(1);
    expect(okRun.model).toBe("google/gemini-3-flash-preview");
    expect(okRun.idempotencyKey).toBeTruthy();
  });

  it("computed idempotency key is deterministic in triggering message + prompt/model versions", () => {
    const k = computeIdempotencyKey({
      triggeringUserMessageId: "m-1",
      promptKey: "unified.pattern", promptVersion: 1,
      modelStage: "unified.pattern", modelVersion: 1,
    });
    expect(k).toBe("t:m-1|p:unified.pattern@1|m:unified.pattern@1");
  });

  it("no scrubbable reasoning fields ever appear in the visible result", async () => {
    const { deps } = makeDeps({ buildResult: (_, r) => patternResult(r) });
    const out = await runUnifiedTurn(baseInput({ storedSessionMode: "pattern" }), deps);
    if (out.kind !== "created") throw new Error("unreachable");
    for (const k of Object.keys(out.result)) {
      expect(k).not.toMatch(/reason|scratch|chain_of_thought|cot/i);
    }
  });

  it("curse_breaker sessions are unsupported in Checkpoint 3A (unified interface pending)", async () => {
    const { deps, store } = makeDeps({ buildResult: (_, r) => patternResult(r) });
    const out = await runUnifiedTurn(
      baseInput({ storedSessionMode: "curse_breaker" as UnifiedMode }),
      deps,
    );
    expect(out.kind).toBe("unsupported");
    expect(store.turns.length).toBe(0);
    expect(store.artifactCalls.length).toBe(0);
  });

  it("pattern-matched citations without a contextual_limit are backfilled (graceful grounding)", async () => {
    const { deps, store } = makeDeps({
      buildResult: (_, r) => {
        const bad = JSON.parse(JSON.stringify(patternResult(r))) as { prayer_draft: { lines: Array<{ citations: Array<{ derivation: string; contextual_limit?: string }> }> } };
        delete bad.prayer_draft.lines[2].citations[0].contextual_limit;
        return bad;
      },
    });
    const out = await runUnifiedTurn(baseInput({ storedSessionMode: "pattern" }), deps);
    expect(out.kind).toBe("created");
    expect(store.artifactCalls.length).toBe(1);
  });
});
