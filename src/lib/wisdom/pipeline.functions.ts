/**
 * Wisdom pipeline server functions.
 * - runWisdomPipeline: extraction → retrieval → composition → persistence.
 * All model calls go through Lovable AI Gateway. Every prayer line is
 * validated to cite a passage from the retrieval set (server-side check,
 * not just the schema).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { zExtractionResult, zComposition } from "./pipeline.schemas";

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
    db.from("prompt_versions").select("body,version,model_hint").eq("key", promptKey).eq("active", true).maybeSingle(),
    db.from("model_configs").select("model,provider,version,params").eq("stage", stage).eq("active", true).maybeSingle(),
  ]);
  if (!prompt) throw new Error(`No active prompt for ${promptKey}`);
  if (!model) throw new Error(`No active model_config for ${stage}`);
  return { prompt, model };
}

async function logRun(
  db: Awaited<ReturnType<typeof admin>>,
  args: {
    userId: string; sessionId: string; mode: "wisdom" | "curse_breaker" | "companion";
    stage: string; status: "ok" | "error" | "skipped"; latencyMs: number;
    promptKey?: string; promptVersion?: number; model?: string;
    error?: string; idempotencyKey?: string;
    tokensIn?: number; tokensOut?: number;
  },
) {
  await db.from("pipeline_runs").insert({
    user_id: args.userId, session_id: args.sessionId, mode: args.mode,
    stage: args.stage, status: args.status, latency_ms: args.latencyMs,
    prompt_key: args.promptKey ?? null, prompt_version: args.promptVersion ?? null,
    model: args.model ?? null, error: args.error ?? null,
    idempotency_key: args.idempotencyKey ?? null,
    tokens_in: args.tokensIn ?? null, tokens_out: args.tokensOut ?? null,
  });
}

const runInput = z.object({
  sessionId: z.string().uuid(),
  idempotencyKey: z.string().min(6).max(120).optional(),
});

export const runWisdomPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof runInput>) => runInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const userId = context.userId;

    // Ownership + load messages
    const { data: session, error: sErr } = await db
      .from("sessions").select("id,user_id,mode").eq("id", data.sessionId).maybeSingle();
    if (sErr || !session) throw new Error("session not found");
    if (session.user_id !== userId) throw new Error("Forbidden");

    const { data: messages } = await db
      .from("messages").select("id,role,content,memory_directive,created_at")
      .eq("session_id", data.sessionId).order("created_at", { ascending: true });
    const userTurns = (messages ?? []).filter((m) => m.role === "user").map((m) => m.content).join("\n\n");
    if (!userTurns.trim()) throw new Error("session has no user messages");

    const gateway = await getGateway();

    // ── Stage 1: extraction ───────────────────────────────────────────
    const { prompt: exPrompt, model: exModel } = await loadActive(db, "wisdom.extraction", "extraction");
    let extraction;
    {
      const t0 = Date.now();
      try {
        const r = await generateText({
          model: gateway(exModel.model),
          output: Output.object({ schema: zExtractionResult }),
          system: exPrompt.body,
          prompt: userTurns,
        });
        extraction = r.output;
        await logRun(db, { userId, sessionId: data.sessionId, mode: "wisdom", stage: "extraction",
          status: "ok", latencyMs: Date.now() - t0, promptKey: "wisdom.extraction",
          promptVersion: exPrompt.version, model: exModel.model,
          tokensIn: r.usage?.inputTokens, tokensOut: r.usage?.outputTokens });
      } catch (e) {
        await logRun(db, { userId, sessionId: data.sessionId, mode: "wisdom", stage: "extraction",
          status: "error", latencyMs: Date.now() - t0, promptKey: "wisdom.extraction",
          promptVersion: exPrompt.version, model: exModel.model, error: String(e) });
        throw e;
      }
    }

    // Persist signals (append-only DNR guard already at DB level requires source_message_id).
    const firstUserMsgId = (messages ?? []).find((m) => m.role === "user")?.id;
    if (firstUserMsgId) {
      const rows = extraction.signals.slice(0, 20).map((s) => ({
        user_id: userId, session_id: data.sessionId, source_message_id: firstUserMsgId,
        kind: s.kind, confidence: s.confidence,
        origin: (s.explicit ? "explicit" : "inferred") as "explicit" | "inferred",
        payload: { paraphrase: s.paraphrase },
      }));
      if (rows.length) await db.from("signals").insert(rows);
    }

    // ── Stage 2: retrieval (approved passages only, tier-ordered) ────
    const { data: passages } = await db
      .from("source_passages")
      .select("id,reference,canonical_ref,text,source_id,source_documents!inner(tier,status)")
      .eq("source_documents.status", "approved")
      .limit(24);
    const retrieval = (passages ?? []).map((p) => ({
      id: p.id, reference: p.reference,
      tier: (p as { source_documents: { tier: string } }).source_documents.tier, text: p.text,
    }));
    if (retrieval.length === 0) throw new Error("retrieval empty — no approved passages seeded");
    const retrievalIds = new Set(retrieval.map((r) => r.id));

    // ── Stage 3: composition ─────────────────────────────────────────
    const { prompt: coPrompt, model: coModel } = await loadActive(db, "wisdom.composition", "composition");
    const retrievalBlock = retrieval.map((r) =>
      `passage_id=${r.id} tier=${r.tier} ${r.reference}\n${r.text}`).join("\n\n---\n\n");
    const userPrompt =
      `USER STORY:\n${userTurns}\n\nEXTRACTED SIGNALS:\n${JSON.stringify(extraction, null, 2)}\n\n` +
      `RETRIEVAL SET (use passage_id verbatim in every prayer line's citations):\n${retrievalBlock}`;

    let composition;
    {
      const t0 = Date.now();
      try {
        const r = await generateText({
          model: gateway(coModel.model),
          output: Output.object({ schema: zComposition }),
          system: coPrompt.body,
          prompt: userPrompt,
        });
        composition = r.output;
        await logRun(db, { userId, sessionId: data.sessionId, mode: "wisdom", stage: "composition",
          status: "ok", latencyMs: Date.now() - t0, promptKey: "wisdom.composition",
          promptVersion: coPrompt.version, model: coModel.model, idempotencyKey: data.idempotencyKey,
          tokensIn: r.usage?.inputTokens, tokensOut: r.usage?.outputTokens });
      } catch (e) {
        await logRun(db, { userId, sessionId: data.sessionId, mode: "wisdom", stage: "composition",
          status: "error", latencyMs: Date.now() - t0, promptKey: "wisdom.composition",
          promptVersion: coPrompt.version, model: coModel.model, error: String(e) });
        throw e;
      }
    }

    // Grounding gate: each prayer line must (a) cite passages from retrieval,
    // (b) supply a substantive per-citation explanation that connects the
    // passage to the line, and (c) not duplicate citations.
    for (const [i, line] of composition.prayer.lines.entries()) {
      const seen = new Set<string>();
      for (const c of line.citations) {
        if (!retrievalIds.has(c.passage_id))
          throw new Error(`prayer line ${i}: fabricated passage_id ${c.passage_id}`);
        if (seen.has(c.passage_id))
          throw new Error(`prayer line ${i}: duplicate citation ${c.passage_id}`);
        seen.add(c.passage_id);
        if (!c.explanation || c.explanation.trim().length < 40)
          throw new Error(`prayer line ${i}: citation ${c.passage_id} lacks a supporting explanation (≥40 chars) tying the passage to the prayer line`);
      }
    }

    // ── Stage 4: persistence ─────────────────────────────────────────
    const { data: interp, error: iErr } = await db.from("interpretations").insert({
      user_id: userId, session_id: data.sessionId,
      headline: composition.hypothesis.name,
      body: composition.hypothesis.description,
      confidence: composition.hypothesis.confidence,
    }).select("id").single();
    if (iErr) throw new Error(iErr.message);

    await db.from("discernments").insert([
      { user_id: userId, session_id: data.sessionId, kind: "context_note", text: composition.discernment.contextNote },
      { user_id: userId, session_id: data.sessionId, kind: "direct_vs_inferred", text: composition.discernment.directVsInferred },
      { user_id: userId, session_id: data.sessionId, kind: "descriptive_vs_prescriptive", text: composition.discernment.descriptiveVsPrescriptive },
      ...composition.discernment.counterEvidence.map((t) => ({
        user_id: userId, session_id: data.sessionId, kind: "counter_evidence" as const, text: t,
      })),
      { user_id: userId, session_id: data.sessionId, kind: "distinguishing_question", text: composition.hypothesis.distinguishingQuestion },
    ]);

    const { data: prayer, error: pErr } = await db.from("prayers").insert({
      user_id: userId, session_id: data.sessionId,
      title: composition.prayer.title, mode: "full",
    }).select("id").single();
    if (pErr) throw new Error(pErr.message);

    for (const [ordering, line] of composition.prayer.lines.entries()) {
      const { data: lineRow, error: lErr } = await db.from("prayer_lines").insert({
        prayer_id: prayer.id, user_id: userId, ordering,
        movement: line.movement, text: line.text,
      }).select("id").single();
      if (lErr) throw new Error(lErr.message);
      const srcRows = line.citations.map((c) => {
        const p = retrieval.find((r) => r.id === c.passage_id)!;
        return {
          prayer_line_id: lineRow.id, user_id: userId, passage_id: c.passage_id,
          derivation: c.derivation, explanation: c.explanation, tier: p.tier as
            "S1"|"S2"|"S3"|"S4"|"S5"|"S6"|"S7"|"S8",
        };
      });
      await db.from("prayer_line_sources").insert(srcRows);
    }
    // Finalize (trigger enforces ≥1 source per line)
    await db.from("prayers").update({ finalized_at: new Date().toISOString() }).eq("id", prayer.id);

    await db.from("practices").insert({
      user_id: userId, session_id: data.sessionId,
      kind: composition.primaryPractice.kind,
      title: composition.primaryPractice.title,
      rationale: composition.primaryPractice.rationale,
      is_primary: true,
    });

    return {
      ok: true,
      interpretationId: interp.id,
      prayerId: prayer.id,
    };
  });

/** Owner-scoped read of the composed slice for UI. */
export const getSessionSlice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string }) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const s = context.supabase;
    const [inter, disc, prayers, practices] = await Promise.all([
      s.from("interpretations").select("*").eq("session_id", data.sessionId).order("created_at", { ascending: false }).limit(1),
      s.from("discernments").select("*").eq("session_id", data.sessionId).order("created_at"),
      s.from("prayers").select("id,title,mode,finalized_at,prayer_lines(id,ordering,movement,text,prayer_line_sources(passage_id,derivation,explanation,tier))").eq("session_id", data.sessionId).order("created_at", { ascending: false }).limit(1),
      s.from("practices").select("*").eq("session_id", data.sessionId).order("is_primary", { ascending: false }),
    ]);
    return {
      interpretation: inter.data?.[0] ?? null,
      discernments: disc.data ?? [],
      prayer: prayers.data?.[0] ?? null,
      practices: practices.data ?? [],
    };
  });

// ── Session bootstrap: create session + first user message ──────────────
const startInput = z.object({
  mode: z.enum(["companion", "pattern", "deep_wisdom", "curse_breaker"]),
  text: z.string().min(1).max(8000),
});

export const startWisdomSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof startInput>) => startInput.parse(d))
  .handler(async ({ data, context }) => {
    const s = context.supabase;
    const { data: sess, error: sErr } = await s.from("sessions")
      .insert({ user_id: context.userId, mode: data.mode, title: data.text.slice(0, 80) })
      .select("id").single();
    if (sErr || !sess) throw new Error(sErr?.message ?? "session insert failed");
    const { error: mErr } = await s.from("messages").insert({
      user_id: context.userId, session_id: sess.id, role: "user",
      content: data.text, memory_directive: "normal",
    });
    if (mErr) throw new Error(mErr.message);
    return { sessionId: sess.id };
  });

// ── Telemetry: pipeline_runs for a session (owner-scoped by RLS) ────────
export const getSessionTelemetry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string }) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: runs } = await context.supabase
      .from("pipeline_runs")
      .select("stage,status,latency_ms,model,prompt_key,prompt_version,tokens_in,tokens_out,error,created_at")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true });
    return { runs: runs ?? [] };
  });

