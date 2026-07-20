/**
 * Curse Breaker pipeline: two-pass across all 14 categories.
 * Pass 1 (cheap) scores every category in a single model call.
 * Pass 2 (deep) analyzes categories whose cheap_score ≥ threshold IN PARALLEL.
 * Every deep result MUST cite a passage_id from the retrieval set — DB trigger
 * also enforces that deep_analyzed=true requires ≥1 citation.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  INTERPRETATION_CATEGORIES, zCbCheap, zCbDeep,
} from "./pipeline.schemas";

const DEEP_THRESHOLD = 0.35;

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
async function loadActive(db: Awaited<ReturnType<typeof admin>>, promptKey: string, stage: string) {
  const [{ data: prompt }, { data: model }] = await Promise.all([
    db.from("prompt_versions").select("body,version").eq("key", promptKey).eq("active", true).maybeSingle(),
    db.from("model_configs").select("model,version").eq("stage", stage).eq("active", true).maybeSingle(),
  ]);
  if (!prompt) throw new Error(`No active prompt for ${promptKey}`);
  if (!model) throw new Error(`No active model_config for ${stage}`);
  return { prompt, model };
}

const runInput = z.object({ sessionId: z.string().uuid() });

export const runCurseBreakerPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof runInput>) => runInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const userId = context.userId;

    const { data: session } = await db.from("sessions")
      .select("id,user_id").eq("id", data.sessionId).maybeSingle();
    if (!session || session.user_id !== userId) throw new Error("Forbidden");

    const { data: messages } = await db.from("messages")
      .select("id,role,content").eq("session_id", data.sessionId).order("created_at");
    const userStory = (messages ?? []).filter((m) => m.role === "user").map((m) => m.content).join("\n\n");
    if (!userStory.trim()) throw new Error("session has no user messages");

    const gateway = await getGateway();

    // Retrieval — approved passages
    const { data: passages } = await db.from("source_passages")
      .select("id,reference,text,source_documents!inner(tier,status)")
      .eq("source_documents.status", "approved").limit(30);
    const retrieval = (passages ?? []).map((p) => ({
      id: p.id, reference: p.reference, text: p.text,
      tier: (p as { source_documents: { tier: string } }).source_documents.tier,
    }));
    if (!retrieval.length) throw new Error("retrieval empty");
    const retrievalIds = new Set(retrieval.map((r) => r.id));

    // ── Pass 1: cheap scores for all 14 ─────────────────────────────
    const { prompt: cheapPrompt, model: cheapModel } = await loadActive(db, "cb.cheap_score", "cb_cheap");
    const t0 = Date.now();
    const { output: cheap } = await generateText({
      model: gateway(cheapModel.model),
      output: Output.object({ schema: zCbCheap }),
      system: cheapPrompt.body,
      prompt: `USER STORY:\n${userStory}\n\nCATEGORIES:\n${INTERPRETATION_CATEGORIES.join(", ")}`,
    });
    await db.from("pipeline_runs").insert({
      user_id: userId, session_id: data.sessionId, mode: "curse_breaker",
      stage: "cb_cheap", status: "ok", latency_ms: Date.now() - t0,
      prompt_key: "cb.cheap_score", prompt_version: cheapPrompt.version, model: cheapModel.model,
    });

    // Upsert cheap rows (unique on session_id+category from Batch 4a)
    const cheapRows = cheap.scores.map((s) => ({
      user_id: userId, session_id: data.sessionId,
      category: s.category, cheap_score: s.score,
      deep_analyzed: false, confidence: 0,
    }));
    await db.from("stronghold_categories")
      .upsert(cheapRows, { onConflict: "session_id,category" });

    // ── Pass 2: deep analysis for scores ≥ threshold, capped concurrency ──
    const { prompt: deepPrompt, model: deepModel } = await loadActive(db, "cb.deep_analysis", "cb_deep");
    const retrievalBlock = retrieval.map((r) =>
      `passage_id=${r.id} tier=${r.tier} ${r.reference}\n${r.text}`).join("\n\n---\n\n");
    const toDeep = cheap.scores.filter((s) => s.score >= DEEP_THRESHOLD);

    const CB_DEEP_CONCURRENCY = 3; // cap parallel model calls (rate/cost/backpressure)
    const deepResults: Array<{ category: string; output: z.infer<typeof zCbDeep> } | null> = [];
    for (let i = 0; i < toDeep.length; i += CB_DEEP_CONCURRENCY) {
      const batch = toDeep.slice(i, i + CB_DEEP_CONCURRENCY);
      const chunk = await Promise.all(batch.map(async (s) => {
        const dt0 = Date.now();
        try {
          const { output } = await generateText({
            model: gateway(deepModel.model),
            output: Output.object({ schema: zCbDeep }),
            system: deepPrompt.body,
            prompt:
              `CATEGORY: ${s.category}\n\nUSER STORY:\n${userStory}\n\n` +
              `RETRIEVAL SET (cite passage_id verbatim, ≥1 required; each citation MUST include a "note" of ≥40 characters that quotes or paraphrases the passage and connects it to the category):\n${retrievalBlock}`,
          });
          // Grounding gate: id exists, no duplicates, note substantively supports the claim.
          const seen = new Set<string>();
          for (const c of output.citations) {
            if (!retrievalIds.has(c.passage_id)) throw new Error(`fabricated passage_id ${c.passage_id}`);
            if (seen.has(c.passage_id)) throw new Error(`duplicate citation ${c.passage_id}`);
            seen.add(c.passage_id);
            if (!c.note || c.note.trim().length < 40)
              throw new Error(`citation ${c.passage_id} note lacks substantive support (≥40 chars)`);
          }
          await db.from("pipeline_runs").insert({
            user_id: userId, session_id: data.sessionId, mode: "curse_breaker",
            stage: `cb_deep:${s.category}`, status: "ok", latency_ms: Date.now() - dt0,
            prompt_key: "cb.deep_analysis", prompt_version: deepPrompt.version, model: deepModel.model,
          });
          return { category: s.category, output };
        } catch (e) {
          await db.from("pipeline_runs").insert({
            user_id: userId, session_id: data.sessionId, mode: "curse_breaker",
            stage: `cb_deep:${s.category}`, status: "error", latency_ms: Date.now() - dt0,
            prompt_key: "cb.deep_analysis", prompt_version: deepPrompt.version, model: deepModel.model,
            error: String(e),
          });
          return null;
        }
      }));
      deepResults.push(...chunk);
    }

    for (const r of deepResults) {
      if (!r) continue;
      await db.from("stronghold_categories")
        .update({
          deep_analyzed: true,
          confidence: r.output.confidence,
          pastoral_note: r.output.pastoral_note,
          supporting_evidence: r.output.supporting_evidence,
          counter_evidence: r.output.counter_evidence,
          alternative_explanations: r.output.alternative_explanations,
          citations: r.output.citations,
        })
        .eq("session_id", data.sessionId)
        .eq("category", r.category);
    }

    return { ok: true, deepAnalyzedCount: deepResults.filter(Boolean).length };
  });

export const getCurseBreakerSlice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string }) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cats } = await context.supabase
      .from("stronghold_categories").select("*")
      .eq("session_id", data.sessionId).order("cheap_score", { ascending: false });
    return { categories: cats ?? [] };
  });
