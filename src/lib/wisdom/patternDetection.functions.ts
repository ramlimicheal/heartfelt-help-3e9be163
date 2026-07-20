/**
 * Stage 2 — Pattern candidate streaming.
 *
 * After each successful pipeline run, scan the user's recent signals across
 * ALL their sessions and propose candidate patterns (pending / status=active,
 * lifecycle="pending"). Proposals require ≥3 distinct signals across ≥2
 * sessions or ≥7 days. Accepted/rejected patterns are excluded to prevent
 * re-proposal.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";

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

const zProposal = z.object({
  patterns: z.array(z.object({
    title: z.string(),
    description: z.string(),
    distinguishingQuestion: z.string(),
    confidence: z.number(),
    evidenceSignalIds: z.array(z.string()),
  })),
});

/**
 * Internal helper. Runs pattern detection for a user.
 * Safe to call after a pipeline run; failures are swallowed by the caller.
 */
export async function runPatternDetectionForUser(userId: string, triggerSessionId: string) {
  const db = await admin();

  // Load recent signals (last 30 days, up to 60), joined with session context.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: signals } = await db
    .from("signals")
    .select("id,session_id,source_message_id,kind,origin,confidence,payload,created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(60);

  if (!signals || signals.length < 3) return { ok: true, proposed: 0, reason: "insufficient signals" };

  // Recurrence gate — must cross ≥2 sessions.
  const sessionSet = new Set(signals.map((s) => s.session_id));
  if (sessionSet.size < 2) return { ok: true, proposed: 0, reason: "only one session" };

  // Exclude patterns already in a terminal / accepted state to prevent duplicates.
  const { data: existing } = await db
    .from("patterns")
    .select("title,description,lifecycle,status")
    .eq("user_id", userId);
  const accepted = (existing ?? []).filter((p) => p.lifecycle === "accepted");
  const rejected = (existing ?? []).filter((p) => p.lifecycle === "rejected");

  // Load active model + prompt.
  const [{ data: prompt }, { data: model }] = await Promise.all([
    db.from("prompt_versions").select("body,version").eq("key", "wisdom.pattern_detection").eq("active", true).maybeSingle(),
    db.from("model_configs").select("model").eq("stage", "pattern.detection").eq("active", true).maybeSingle(),
  ]);
  if (!prompt || !model) return { ok: false, proposed: 0, reason: "no active prompt/model for pattern.detection" };

  const gateway = await getGateway();

  const signalPayload = signals.map((s) => ({
    id: s.id,
    session_id: s.session_id,
    kind: s.kind,
    origin: s.origin,
    paraphrase: (s.payload as { paraphrase?: string } | null)?.paraphrase ?? "",
    confidence: s.confidence,
    created_at: s.created_at,
  }));

  const userPrompt =
    `SIGNALS:\n${JSON.stringify(signalPayload, null, 2)}\n\n` +
    `ACCEPTED_PATTERNS:\n${JSON.stringify(accepted.map((p) => ({ title: p.title, description: p.description })), null, 2)}\n\n` +
    `REJECTED_PATTERNS:\n${JSON.stringify(rejected.map((p) => ({ title: p.title, description: p.description })), null, 2)}`;

  const t0 = Date.now();
  let proposal: z.infer<typeof zProposal>;
  try {
    const r = await generateText({
      model: gateway(model.model),
      output: Output.object({ schema: zProposal }),
      system: prompt.body,
      prompt: userPrompt,
    });
    proposal = r.output;
    await db.from("pipeline_runs").insert({
      user_id: userId, session_id: triggerSessionId, mode: "wisdom",
      stage: "pattern.detection", status: "ok", latency_ms: Date.now() - t0,
      prompt_key: "wisdom.pattern_detection", prompt_version: prompt.version,
      model: model.model, tokens_in: r.usage?.inputTokens ?? null,
      tokens_out: r.usage?.outputTokens ?? null,
    });
  } catch (e) {
    await db.from("pipeline_runs").insert({
      user_id: userId, session_id: triggerSessionId, mode: "wisdom",
      stage: "pattern.detection", status: "error", latency_ms: Date.now() - t0,
      prompt_key: "wisdom.pattern_detection", prompt_version: prompt.version,
      model: model.model, error: String(e),
    });
    return { ok: false, proposed: 0, reason: String(e) };
  }

  // Validate + insert candidates.
  const signalById = new Map(signals.map((s) => [s.id, s]));
  const existingTitles = new Set((existing ?? []).map((p) => p.title.toLowerCase().trim()));
  let inserted = 0;

  for (const cand of proposal.patterns.slice(0, 5)) {
    const title = cand.title.trim().slice(0, 200);
    if (!title || existingTitles.has(title.toLowerCase())) continue;

    // Evidence gate: ≥3 distinct valid signals across ≥2 sessions.
    const evidence = cand.evidenceSignalIds
      .map((id) => signalById.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    const distinctSessions = new Set(evidence.map((e) => e.session_id));
    if (evidence.length < 3 || distinctSessions.size < 2) continue;

    // Clamp confidence within proposal band.
    const conf = Math.max(0.3, Math.min(0.85, Number(cand.confidence) || 0.5));
    const idempotencyKey = `pd:${userId}:${title.toLowerCase()}`;

    const { data: patternRow, error: pErr } = await db.from("patterns").insert({
      user_id: userId,
      idempotency_key: idempotencyKey,
      title,
      description: `${cand.description.trim()}\n\nDistinguishing question: ${cand.distinguishingQuestion.trim()}`,
      status: "active" as const,
      lifecycle: "pending",
    }).select("id").single();
    if (pErr || !patternRow) continue;

    // Evidence rows — each references its source_message_id (append-only).
    const evRows = evidence.slice(0, 10).map((e) => ({
      pattern_id: patternRow.id,
      user_id: userId,
      kind: "supporting" as const,
      source_message_id: e.source_message_id,
      excerpt: (e.payload as { paraphrase?: string } | null)?.paraphrase ?? null,
      confidence: conf,
    }));
    if (evRows.length) await db.from("pattern_evidence").insert(evRows);

    // Journey trail — a pending proposal event.
    await db.from("formation_events").insert({
      user_id: userId,
      event_type: "pattern_update",
      pattern_id: patternRow.id,
      note: `Pattern proposed: ${title}`,
      fruit: [],
    });

    inserted += 1;
    existingTitles.add(title.toLowerCase());
  }

  return { ok: true, proposed: inserted };
}

/** Explicit trigger (dashboard "scan for patterns" button, admin, etc.). */
export const detectPatterns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string }) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => runPatternDetectionForUser(context.userId, data.sessionId));
