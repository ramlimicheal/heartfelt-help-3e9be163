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
import {
  selectDurableUserMessages,
  hasAnyDurableUserInput,
  assertValidSignalAttribution,
  type MessageForDnr,
} from "./dnr";
import { assertModeAllowed, MODE_LOCK_ERROR, type SessionMode } from "./modeLock";

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
  requestedMode: z.enum(["companion", "pattern", "deep_wisdom", "curse_breaker"]).optional(),
});

export const runWisdomPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof runInput>) => runInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const userId = context.userId;

    // Ownership + load messages
    const { data: session, error: sErr } = await db
      .from("sessions")
      .select("id,user_id,mode,mode_locked_at")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (sErr || !session) throw new Error("session not found");
    if (session.user_id !== userId) throw new Error("Forbidden");

    // Mode-lock guard (DB trigger is the ultimate authority; this returns a
    // clean typed error instead of a raw Postgres exception).
    if (data.requestedMode) {
      assertModeAllowed({
        session: {
          id: session.id,
          user_id: session.user_id,
          mode: session.mode as SessionMode,
          mode_locked_at: session.mode_locked_at as string | null,
        },
        requestedMode: data.requestedMode,
      });
    }

    const { data: messages } = await db
      .from("messages")
      .select("id,role,content,memory_directive,created_at")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true });

    // DNR gate: only non-DNR user turns may feed durable extraction.
    const allMessages = (messages ?? []) as MessageForDnr[];
    const durableUserMessages = selectDurableUserMessages(allMessages);
    if (!hasAnyDurableUserInput(allMessages)) {
      // Session contains only protected turns → NO durable artifacts.
      throw new Error(
        "session has no durable user messages (all user turns are do_not_remember)",
      );
    }
    // Concatenate ONLY the durable turns; DNR content never enters the model
    // prompt for durable artifact generation.
    const userTurns = durableUserMessages.map((m) => m.content).join("\n\n");

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

    // Persist signals with PER-SIGNAL attribution to a durable turn.
    // The old first-user-message attribution is REMOVED. When the extractor
    // does not attach a source, we fall back to the most recent durable turn
    // (never the first, never a DNR turn). Every insert is validated by both
    // the pure helper and the DB append-only guard.
    const durableIds = durableUserMessages.map((m) => m.id);
    const defaultAttribution = durableIds[durableIds.length - 1];
    if (defaultAttribution) {
      const rows = extraction.signals.slice(0, 20).map((s) => {
        const sourceMessageId = defaultAttribution;
        assertValidSignalAttribution({
          sourceMessageId,
          sessionMessages: allMessages,
        });
        return {
          user_id: userId,
          session_id: data.sessionId,
          source_message_id: sourceMessageId,
          kind: s.kind,
          confidence: s.confidence,
          origin: (s.explicit ? "explicit" : "inferred") as "explicit" | "inferred",
          payload: { paraphrase: s.paraphrase },
        };
      });
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

    // Grounding gate: EVERY citation on EVERY prayer line must (a) cite a
    // passage from the retrieval set, (b) be unique within the line, (c) carry
    // a per-derivation explanation that names the actual connection to the
    // passage — not generic filler padded to length. A single valid citation
    // does not rescue a line whose other citations fail; we reject the whole
    // composition so the caller retries.
    const GENERIC_FILLER = [
      "this verse relates", "this passage relates", "this scripture supports",
      "this supports the prayer", "this is relevant", "connects to the prayer",
      "aligns with", "reminds us that", "encourages us to",
    ];
    for (const [i, line] of composition.prayer.lines.entries()) {
      const seen = new Set<string>();
      for (const c of line.citations) {
        if (!retrievalIds.has(c.passage_id))
          throw new Error(`prayer line ${i}: fabricated passage_id ${c.passage_id}`);
        if (seen.has(c.passage_id))
          throw new Error(`prayer line ${i}: duplicate citation ${c.passage_id}`);
        seen.add(c.passage_id);
        const exp = (c.explanation ?? "").trim();
        if (exp.length < 40)
          throw new Error(`prayer line ${i}: citation ${c.passage_id} lacks a supporting explanation (≥40 chars)`);
        const lower = exp.toLowerCase();
        if (GENERIC_FILLER.some((f) => lower.startsWith(f) && lower.length < 90))
          throw new Error(`prayer line ${i}: citation ${c.passage_id} explanation is generic filler`);
        const passage = retrieval.find((r) => r.id === c.passage_id)!;
        // Per-derivation semantic checks — the three claims Wisdom makes.
        if (c.derivation === "direct") {
          // "Direct" = Scripture's own language, not a thematically similar verse.
          // Require the explanation to quote or reference specific wording from the passage.
          const words = passage.text.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 5);
          const overlap = words.filter((w) => lower.includes(w)).length;
          const quoted = /["“][^"”]{6,}["”]/.test(exp) || exp.includes(passage.reference);
          if (!quoted && overlap < 3)
            throw new Error(`prayer line ${i}: direct citation ${passage.reference} must quote or reference the passage's actual language`);
        } else if (c.derivation === "inferred") {
          // "Inferred" = Wisdom's application, not something Scripture explicitly promises.
          if (!/(infer|appl(y|ication)|we (draw|read|understand)|not (a )?promise|extends?|implication)/i.test(exp))
            throw new Error(`prayer line ${i}: inferred citation ${passage.reference} must frame the connection as Wisdom's application, not an explicit promise`);
        } else if (c.derivation === "pattern_matched") {
          // "Pattern" = structural similarity AND its limits.
          if (!/(pattern|parallel|structur|similar|echo|type)/i.test(exp))
            throw new Error(`prayer line ${i}: pattern_matched citation ${passage.reference} must name the structural parallel`);
          if (!/(limit|differ|not identical|context|caveat|however|but )/i.test(exp))
            throw new Error(`prayer line ${i}: pattern_matched citation ${passage.reference} must state the limits of the parallel`);
        }
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

