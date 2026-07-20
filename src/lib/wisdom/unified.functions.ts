/**
 * Checkpoint 3A — Flag-gated Unified Wisdom Turn server function.
 *
 * Split-brain preservation: `runWisdomPipeline` and `/api/chat` remain the
 * production paths until Checkpoint 3B. This function is only reachable
 * when the server-side flag WISDOM_UNIFIED_TURN=on is set. It never writes
 * durable artifacts unless enabled.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  runUnifiedTurn,
  type OrchestratorDeps,
  type UnifiedTurnInput,
} from "./unified.orchestrator";
import {
  zCompanionResult,
  zPatternResult,
  zDeepWisdomResult,
  type UnifiedMode,
  type UnifiedResult,
} from "./unified.schemas";

export function isUnifiedTurnEnabled(): boolean {
  const v = process.env.WISDOM_UNIFIED_TURN;
  return v === "on" || v === "1" || v === "true";
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getGateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  return createLovableAiGatewayProvider(key);
}

const input = z.object({
  sessionId: z.string().uuid(),
  triggeringUserMessageId: z.string().uuid(),
  clientRequestedMode: z.string().optional(),
});

export const runUnifiedWisdomTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof input>) => input.parse(d))
  .handler(async ({ data, context }) => {
    if (!isUnifiedTurnEnabled()) {
      return { ok: false as const, disabled: true as const, error: "unified turn disabled" };
    }
    const db = await admin();

    // Load session (stored mode is authoritative) and message ownership.
    const { data: sess } = await db.from("sessions")
      .select("id,user_id,mode").eq("id", data.sessionId).maybeSingle();
    if (!sess || sess.user_id !== context.userId) throw new Error("session not found");
    const { data: msg } = await db.from("messages")
      .select("id,user_id,session_id,memory_directive,content")
      .eq("id", data.triggeringUserMessageId).maybeSingle();
    if (!msg || msg.user_id !== context.userId || msg.session_id !== data.sessionId)
      throw new Error("triggering message not found");

    const deps = buildProductionDeps(db);
    const turnInput: UnifiedTurnInput = {
      userId: context.userId,
      sessionId: data.sessionId,
      triggeringUserMessageId: data.triggeringUserMessageId,
      storedSessionMode: sess.mode as UnifiedMode | "curse_breaker",
      memoryDirective: msg.memory_directive as UnifiedTurnInput["memoryDirective"],
      userText: msg.content as string,
      clientRequestedMode: data.clientRequestedMode,
    };
    const outcome = await runUnifiedTurn(turnInput, deps);
    return { ok: true as const, outcome };
  });

// ── Production dependency wiring ─────────────────────────────────────
type Db = Awaited<ReturnType<typeof admin>>;

export function buildProductionDeps(db: Db): OrchestratorDeps {
  return {
    loadPrompt: async (key) => {
      const { data } = await db.from("prompt_versions")
        .select("key,version,body").eq("key", key).eq("active", true).maybeSingle();
      if (!data) throw new Error(`no active prompt for ${key}`);
      return data;
    },
    loadModel: async (stage) => {
      const { data } = await db.from("model_configs")
        .select("stage,version,model").eq("stage", stage).eq("active", true).maybeSingle();
      if (!data) throw new Error(`no active model_config for ${stage}`);
      return data;
    },
    retrieve: async () => {
      const { data } = await db.from("source_passages")
        .select("id,reference,text,source_documents!inner(tier,status,translation)")
        .eq("source_documents.status", "approved").limit(24);
      return ((data ?? []) as Array<{ id: string; reference: string; text: string; source_documents: { tier: string; translation: string | null } }>).map((p) => ({
        id: p.id,
        reference: p.reference,
        translation: p.source_documents.translation ?? "WEB",
        canon_profile: "protestant_66",
        source_tier: p.source_documents.tier as "S1"|"S2"|"S3"|"S4"|"S5"|"S6"|"S7"|"S8",
        text: p.text,
      }));
    },
    callModel: async ({ system, userPrompt, mode, model }) => {
      const schema =
        mode === "companion" ? zCompanionResult :
        mode === "pattern"   ? zPatternResult   : zDeepWisdomResult;
      const gateway = await getGateway();
      const r = await generateText({
        model: gateway(model),
        // Cast: Output.object infers a single schema type; our per-mode union
        // is narrowed above and validated again by the orchestrator.
        output: Output.object({ schema: schema as unknown as typeof zCompanionResult }),
        system,
        prompt: userPrompt,
      });
      return { raw: r.output, tokensIn: r.usage?.inputTokens, tokensOut: r.usage?.outputTokens };
    },
    findExistingTurn: async (msgId) => {
      const { data } = await db.from("wisdom_turns")
        .select("id,status,result").eq("triggering_user_message_id", msgId).maybeSingle();
      if (!data) return null;
      return {
        id: data.id as string,
        status: data.status as "pending"|"ok"|"validation_error"|"model_error",
        result: (data.result as UnifiedResult | null) ?? null,
      };
    },
    createTurn: async (row) => {
      const { data, error } = await db.from("wisdom_turns").insert({
        user_id: row.userId,
        session_id: row.sessionId,
        triggering_user_message_id: row.triggeringUserMessageId,
        mode: row.mode,
        memory_directive: row.memoryDirective,
        idempotency_key: row.idempotencyKey,
        prompt_key: row.promptKey,
        prompt_version: row.promptVersion,
        model: row.model,
        model_version: row.modelVersion,
        status: "pending",
      }).select("id").single();
      if (error || !data) throw new Error(`wisdom_turns insert: ${error?.message}`);
      return { id: data.id as string };
    },
    finalizeTurn: async (id, patch) => {
      await db.from("wisdom_turns").update({
        status: patch.status,
        result: patch.result ?? null,
        error: patch.error ?? null,
        latency_ms: patch.latencyMs ?? null,
        tokens_in: patch.tokensIn ?? null,
        tokens_out: patch.tokensOut ?? null,
      }).eq("id", id);
    },
    persistArtifacts: async (turnId, userId, sessionId, result) => {
      if (result.mode === "companion") return; // no durable inference
      const draft = result.mode === "pattern" ? result.prayer_draft : result.prayer_lineage_draft;
      const practice = result.primary_practice;
      const hypothesis =
        result.mode === "pattern"
          ? result.competing_hypotheses[0]
          : result.hypothesis_under_test;

      // Interpretation (one per turn — enforced by unique index).
      const { data: interp, error: iErr } = await db.from("interpretations").insert({
        user_id: userId, session_id: sessionId, wisdom_turn_id: turnId,
        headline: hypothesis.name,
        body: hypothesis.description,
        confidence: hypothesis.confidence,
      }).select("id").single();
      if (iErr) throw new Error(`interp: ${iErr.message}`);

      // Prayer + lines + sources — passage_ids are the SAME ones shown to the user.
      const { data: prayer, error: pErr } = await db.from("prayers").insert({
        user_id: userId, session_id: sessionId, wisdom_turn_id: turnId,
        title: draft.title, mode: "full",
      }).select("id").single();
      if (pErr) throw new Error(`prayer: ${pErr.message}`);
      const passageTiers = new Map(result.source_passages.map((p) => [p.passage_id, p.source_tier]));
      for (const [ordering, line] of draft.lines.entries()) {
        const { data: lineRow, error: lErr } = await db.from("prayer_lines").insert({
          prayer_id: prayer.id, user_id: userId, ordering,
          movement: line.movement, text: line.text,
        }).select("id").single();
        if (lErr) throw new Error(`prayer_line: ${lErr.message}`);
        const srcRows = line.citations.map((c) => ({
          prayer_line_id: lineRow.id, user_id: userId, passage_id: c.passage_id,
          derivation: c.derivation, explanation: c.explanation,
          tier: passageTiers.get(c.passage_id) ?? "S3",
        }));
        await db.from("prayer_line_sources").insert(srcRows);
      }
      await db.from("prayers").update({ finalized_at: new Date().toISOString() }).eq("id", prayer.id);

      await db.from("practices").insert({
        user_id: userId, session_id: sessionId, wisdom_turn_id: turnId,
        kind: practice.kind, title: practice.title, rationale: practice.rationale,
        is_primary: true,
      });

      // Discernments — deep_wisdom includes counter_evidence + contextual_limits;
      // pattern uses the distinguishing_question.
      if (result.mode === "pattern") {
        await db.from("discernments").insert({
          user_id: userId, session_id: sessionId, wisdom_turn_id: turnId,
          kind: "distinguishing_question", text: result.distinguishing_question,
        });
      } else {
        const rows = [
          ...result.counter_evidence.map((t) => ({
            user_id: userId, session_id: sessionId, wisdom_turn_id: turnId,
            kind: "counter_evidence" as const, text: t,
          })),
          ...result.contextual_limits.map((t) => ({
            user_id: userId, session_id: sessionId, wisdom_turn_id: turnId,
            kind: "context_note" as const, text: t,
          })),
        ];
        if (rows.length) await db.from("discernments").insert(rows);
      }
      // Interpretation id returned but no downstream use here.
      return void interp;
    },
    logRun: async (row) => {
      await db.from("pipeline_runs").insert({
        user_id: row.userId, session_id: row.sessionId,
        mode: row.mode === "deep_wisdom" ? "wisdom" : row.mode === "pattern" ? "wisdom" : "companion",
        stage: row.stage, status: row.status, latency_ms: row.latencyMs,
        prompt_key: row.promptKey, prompt_version: row.promptVersion,
        model: row.model, tokens_in: row.tokensIn, tokens_out: row.tokensOut,
        idempotency_key: row.idempotencyKey, error: row.error ?? null,
      });
    },
  };
}
