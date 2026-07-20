/**
 * Persona fact extraction (Stage 3).
 * Reads user turns from a session, proposes durable persona facts as
 * `status="proposed"` for the user to accept / reject in /you.
 * Never auto-accepts. Skips duplicate keys already accepted/proposed.
 */
import { generateText, Output, NoObjectGeneratedError } from "ai";
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

const zFacts = z.object({
  facts: z.array(
    z.object({
      key: z.string(),
      value: z.object({ value: z.string() }).passthrough(),
      confidence: z.number(),
      sensitivity: z.enum(["normal", "sensitive"]),
      rationale: z.string(),
    }),
  ),
});

export async function runPersonaExtractionForSession(
  userId: string,
  sessionId: string,
) {
  const db = await admin();

  const { data: messages } = await db
    .from("messages")
    .select("id, role, content, memory_directive")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const userTurns = (messages ?? [])
    .filter((m) => m.role === "user" && m.memory_directive !== "do_not_remember")
    .map((m) => m.content)
    .join("\n\n");
  if (!userTurns.trim()) return { inserted: 0, skipped: 0 };

  const firstUserMsgId = (messages ?? []).find((m) => m.role === "user")?.id ?? null;

  const [{ data: prompt }, { data: model }] = await Promise.all([
    db.from("prompt_versions")
      .select("body,version").eq("key", "wisdom.persona_extraction").eq("active", true).maybeSingle(),
    db.from("model_configs")
      .select("model").eq("stage", "persona_extraction").eq("active", true).maybeSingle(),
  ]);
  if (!prompt || !model) return { inserted: 0, skipped: 0 };

  const gateway = await getGateway();

  let facts: z.infer<typeof zFacts>["facts"] = [];
  try {
    const r = await generateText({
      model: gateway(model.model),
      output: Output.object({ schema: zFacts }),
      system: prompt.body,
      prompt: userTurns,
    });
    facts = r.output.facts;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) return { inserted: 0, skipped: 0 };
    throw e;
  }
  if (facts.length === 0) return { inserted: 0, skipped: 0 };

  // Ensure persona exists.
  const { data: persona } = await db
    .from("personas")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select("id")
    .single();
  if (!persona) return { inserted: 0, skipped: 0 };

  // Skip keys already on record (proposed/accepted/corrected). Rejected keys
  // stay silent — the user opted out.
  const { data: existing } = await db
    .from("persona_facts")
    .select("key,status")
    .eq("user_id", userId);
  const blockedKeys = new Set(
    (existing ?? [])
      .filter((r) => ["proposed", "accepted", "corrected", "rejected"].includes(r.status))
      .map((r) => r.key),
  );

  const fresh = facts.filter((f) => !blockedKeys.has(f.key)).slice(0, 6);
  if (fresh.length === 0) return { inserted: 0, skipped: facts.length };

  const rows = fresh.map((f) => ({
    persona_id: persona.id,
    user_id: userId,
    key: f.key,
    value: f.value as never,
    status: "proposed" as const,
    sensitivity: f.sensitivity,
    origin: "inferred" as const,
    source_message_id: firstUserMsgId,
    confidence: Math.max(0.4, Math.min(0.9, f.confidence)),
  }));

  const { data: inserted, error } = await db
    .from("persona_facts")
    .insert(rows)
    .select("id,key");
  if (error) throw new Error(error.message);

  // Emit journey events so /journey lights up when facts are proposed.
  const nowIso = new Date().toISOString();
  await db.from("formation_events").insert(
    (inserted ?? []).map((row) => ({
      user_id: userId,
      event_type: "memory_change" as const,
      persona_fact_id: row.id,
      note: `persona fact proposed: ${row.key}`,
      fruit: [],
      at: nowIso,
    })),
  );

  return { inserted: inserted?.length ?? 0, skipped: facts.length - (inserted?.length ?? 0) };
}
