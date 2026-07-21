/**
 * Checkpoint 3B — Unified Wisdom turn: server-side pipeline wired to the
 * atomic `persist_unified_turn` / `fail_unified_turn` RPCs.
 *
 * The orchestrator (unified.orchestrator.ts) stays pure. Its dependency
 * shape (createTurn/persistArtifacts/finalizeTurn) is retained for the
 * existing 15 unit tests; in production we route ALL durable writes through
 * the RPC by making `persistArtifacts` a no-op and doing the atomic write
 * inside `finalizeTurn(ok)`. Failure paths go through `fail_unified_turn`.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
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

// Beta: unified turn is always on for any authenticated user.
export function isUnifiedTurnEnabled(): boolean {
  return true;
}

export function isLegacyChatEnabled(): boolean {
  return false;
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

// ── Core runner (used by both the server fn and the SSE route) ────────
export type UnifiedRunContext = {
  userId: string;
  sessionId: string;
  triggeringUserMessageId: string;
  storedSessionMode: UnifiedMode | "curse_breaker";
  memoryDirective: "normal" | "session_only" | "do_not_remember";
  userText: string;
  clientRequestedMode?: string;
  inputPayload: unknown;
  payloadHash: string;
  resultSchemaVersion?: number;
};

export async function runUnifiedTurnCore(ctx: UnifiedRunContext) {
  if (!isUnifiedTurnEnabled()) {
    throw new Error("unified turn disabled");
  }
  const db = await admin();
  const deps = buildProductionDeps(db, {
    inputPayload: ctx.inputPayload,
    payloadHash: ctx.payloadHash,
    resultSchemaVersion: ctx.resultSchemaVersion ?? 1,
    expectedUserId: ctx.userId,
  });
  return runUnifiedTurn(
    {
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      triggeringUserMessageId: ctx.triggeringUserMessageId,
      storedSessionMode: ctx.storedSessionMode,
      memoryDirective: ctx.memoryDirective,
      userText: ctx.userText,
      clientRequestedMode: ctx.clientRequestedMode,
    },
    deps,
  );
}

const input = z.object({
  sessionId: z.string().uuid(),
  triggeringUserMessageId: z.string().uuid(),
  clientRequestedMode: z.string().optional(),
});

// Kept for internal callers / tests. Route callers should hit the SSE endpoint.
export const runUnifiedWisdomTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof input>) => input.parse(d))
  .handler(async ({ data, context }) => {
    if (!isUnifiedTurnEnabled()) {
      return { ok: false as const, disabled: true as const, error: "unified turn disabled" };
    }
    const db = await admin();
    const { data: sess } = await db.from("sessions")
      .select("id,user_id,mode").eq("id", data.sessionId).maybeSingle();
    if (!sess || sess.user_id !== context.userId) throw new Error("session not found");
    const { data: msg } = await db.from("messages")
      .select("id,user_id,session_id,memory_directive,content")
      .eq("id", data.triggeringUserMessageId).maybeSingle();
    if (!msg || msg.user_id !== context.userId || msg.session_id !== data.sessionId)
      throw new Error("triggering message not found");

    const inputPayload = {
      sessionId: data.sessionId,
      triggeringUserMessageId: data.triggeringUserMessageId,
      clientRequestedMode: data.clientRequestedMode,
    };
    const payloadHash = await sha256Hex(JSON.stringify(inputPayload));
    const outcome = await runUnifiedTurnCore({
      userId: context.userId,
      sessionId: data.sessionId,
      triggeringUserMessageId: data.triggeringUserMessageId,
      storedSessionMode: sess.mode as UnifiedMode | "curse_breaker",
      memoryDirective: msg.memory_directive as UnifiedRunContext["memoryDirective"],
      userText: msg.content as string,
      clientRequestedMode: data.clientRequestedMode,
      inputPayload,
      payloadHash,
    });
    return { ok: true as const, outcome };
  });

// ── Utility ─────────────────────────────────────────────────────────
export async function sha256Hex(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeModelJson(value: unknown, mode: UnifiedMode): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = { ...(value as Record<string, unknown>) };

  if (mode === "pattern") {
    record.competing_hypotheses = record.competing_hypotheses ?? record.hypotheses ?? [];
    record.prayer_draft = record.prayer_draft ?? record.prayer ?? record.evolving_prayer;
  }

  if (mode === "deep_wisdom") {
    record.hypothesis_under_test = record.hypothesis_under_test ?? record.primary_hypothesis ?? record.hypothesis ?? {
      name: "Working hypothesis",
      description: "",
      confidence: 0.5,
    };
    record.competing_explanations = record.competing_explanations ?? record.alternative_explanations ?? [];
    record.prayer_lineage_draft = record.prayer_lineage_draft ?? record.prayer_draft ?? record.prayer ?? record.evolving_prayer;
  }

  if (mode === "companion") {
    const mirrors = record.biblical_mirrors;
    record.biblical_mirror = record.biblical_mirror ?? (Array.isArray(mirrors) ? mirrors[0] : undefined);
  }

  return record;
}

// ── Production dependency wiring ─────────────────────────────────────
type Db = Awaited<ReturnType<typeof admin>>;

type ProductionExtras = {
  inputPayload: unknown;
  payloadHash: string;
  resultSchemaVersion: number;
  expectedUserId: string;
};

export function buildProductionDeps(db: Db, extras: ProductionExtras): OrchestratorDeps {
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
      const { isFakeModelEnabled, assertFakeModelSafe, fakeCallModel } = await import(
        "./testing/fakeGateway.server"
      );
      assertFakeModelSafe();
      if (isFakeModelEnabled()) {
        return fakeCallModel({ system, userPrompt, mode, model });
      }
      const schema =
        mode === "companion" ? zCompanionResult :
        mode === "pattern"   ? zPatternResult   : zDeepWisdomResult;
      const gateway = await getGateway();

      const tryOnce = async (sys: string, prompt: string) => {
        try {
          const r = await generateText({
            model: gateway(model),
            output: Output.object({ schema: schema as unknown as typeof zCompanionResult }),
            system: sys,
            prompt,
          });
          return { ok: true as const, raw: r.output, tokensIn: r.usage?.inputTokens, tokensOut: r.usage?.outputTokens };
        } catch (err) {
          if (NoObjectGeneratedError.isInstance(err)) {
            const preview = (err.text ?? "").slice(0, 4000);
            // Fallback #1: manual parse of the raw text.
            try {
              const parsed = extractJsonObject(err.text ?? "");
              const normalized = normalizeModelJson(parsed, mode);
              const validated = schema.parse({ ...(normalized as object), mode });
              return { ok: true as const, raw: validated, tokensIn: err.usage?.inputTokens, tokensOut: err.usage?.outputTokens };
            } catch { /* fall through */ }
            return { ok: false as const, textPreview: preview, cause: (err.cause as Error | undefined)?.message ?? err.message };
          }
          throw err;
        }
      };

      const first = await tryOnce(system, userPrompt);
      if (first.ok) return { raw: first.raw, tokensIn: first.tokensIn, tokensOut: first.tokensOut };

      // Repair pass: hand the model back its own broken output plus the schema
      // and ask for a corrected JSON. One retry only.
      console.warn("[wisdom.callModel] first pass failed; repair", { mode, cause: first.cause?.slice(0, 300) });
      const repairSystem = system + "\n\nYour previous output failed JSON schema validation. Fix it. Return ONLY the corrected JSON. No prose, no code fences.";
      const repairPrompt = `PREVIOUS INVALID OUTPUT:\n${first.textPreview}\n\nSCHEMA ERROR:\n${first.cause?.slice(0, 800) ?? "schema mismatch"}\n\nORIGINAL REQUEST:\n${userPrompt}`;
      const second = await tryOnce(repairSystem, repairPrompt);
      if (second.ok) return { raw: second.raw, tokensIn: second.tokensIn, tokensOut: second.tokensOut };

      console.error("[wisdom.callModel] repair pass also failed", { mode, cause: second.cause?.slice(0, 300) });
      throw new Error(`model output failed schema after repair: ${second.cause?.slice(0, 200) ?? "unknown"}`);
    },
    findExistingTurn: async (msgId) => {
      const { data } = await db.from("wisdom_turns")
        .select("id,status,result").eq("triggering_user_message_id", msgId).maybeSingle();
      if (!data) return null;
      // Map DB canonical states (3B) back to the orchestrator's status enum.
      const s = data.status as string;
      const mapped: "pending"|"ok"|"validation_error"|"model_error" =
        s === "completed" ? "ok" :
        s === "failed" ? "model_error" :
        s === "processing" ? "pending" :
        (s as "pending"|"ok"|"validation_error"|"model_error");
      return {
        id: data.id as string,
        status: mapped,
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
        status: "processing",
        payload_hash: extras.payloadHash,
        input_payload: extras.inputPayload as never,
        result_schema_version: extras.resultSchemaVersion,
      }).select("id").single();
      if (error || !data) throw new Error(`wisdom_turns insert: ${error?.message}`);
      return { id: data.id as string };
    },
    // Production: no-op. Atomic write happens in finalizeTurn via RPC.
    persistArtifacts: async () => { /* handled by persist_unified_turn */ },
    finalizeTurn: async (id, patch) => {
      if (patch.status === "ok" && patch.result) {
        const { error } = await db.rpc("persist_unified_turn", {
          p_turn_id: id,
          p_expected_user: extras.expectedUserId,
          p_result: patch.result as unknown as never,
          p_input_payload: extras.inputPayload as never,
          p_payload_hash: extras.payloadHash,
          p_result_schema_version: extras.resultSchemaVersion,
          p_latency_ms: patch.latencyMs ?? 0,
          p_tokens_in: patch.tokensIn ?? 0,
          p_tokens_out: patch.tokensOut ?? 0,
        });
        if (error) throw new Error(`persist_unified_turn: ${error.message}`);
      } else {
        await db.rpc("fail_unified_turn", {
          p_turn_id: id,
          p_expected_user: extras.expectedUserId,
          p_error_code: (patch.error ?? patch.status ?? "unknown").slice(0, 80),
          p_stage: "orchestrator",
          p_retryable: true,
        });
      }
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
