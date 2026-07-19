import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const idInput = z.object({ factId: z.string().uuid() });
const correctInput = z.object({
  factId: z.string().uuid(),
  value: z.record(z.unknown()),
});
const proposeInput = z.object({
  key: z.string().min(1).max(120),
  value: z.record(z.unknown()),
  sensitivity: z.enum(["normal", "sensitive"]).default("normal"),
  sourceMessageId: z.string().uuid().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadOwnedFact(userId: string, factId: string) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("persona_facts")
    .select("id, user_id, sensitivity, status")
    .eq("id", factId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.user_id !== userId) throw new Error("Fact not found");
  return data;
}

/** Server-only: propose a new persona fact on behalf of the authenticated user. */
export const proposePersonaFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof proposeInput>) => proposeInput.parse(d))
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    // Ensure persona exists.
    const { data: persona, error: pErr } = await admin
      .from("personas")
      .upsert({ user_id: context.userId }, { onConflict: "user_id" })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);

    const { data: fact, error } = await admin
      .from("persona_facts")
      .insert({
        persona_id: persona.id,
        user_id: context.userId,
        key: data.key,
        value: data.value,
        status: "proposed",
        sensitivity: data.sensitivity,
        origin: "inferred",
        source_message_id: data.sourceMessageId ?? null,
        confidence: data.confidence ?? null,
      })
      .select("id, status, sensitivity")
      .single();
    if (error) throw new Error(error.message);
    return fact;
  });

export const acceptPersonaFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof idInput>) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const fact = await loadOwnedFact(context.userId, data.factId);
    const admin = await getAdmin();

    if (fact.sensitivity === "sensitive") {
      // Require confirmation first; caller should invoke confirmSensitivePersonaFact.
      const { data: conf } = await admin
        .from("persona_fact_confirmations")
        .select("id")
        .eq("persona_fact_id", data.factId)
        .eq("confirmed_by", context.userId)
        .limit(1)
        .maybeSingle();
      if (!conf) throw new Error("Sensitive fact requires confirmation first");
    }

    const { error } = await admin
      .from("persona_facts")
      .update({ status: "accepted" })
      .eq("id", data.factId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectPersonaFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof idInput>) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await loadOwnedFact(context.userId, data.factId);
    const admin = await getAdmin();
    const { error } = await admin
      .from("persona_facts")
      .update({ status: "rejected" })
      .eq("id", data.factId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const correctPersonaFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof correctInput>) => correctInput.parse(d))
  .handler(async ({ data, context }) => {
    await loadOwnedFact(context.userId, data.factId);
    const admin = await getAdmin();
    const { error } = await admin
      .from("persona_facts")
      .update({ value: data.value, status: "corrected" })
      .eq("id", data.factId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePersonaFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof idInput>) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    await loadOwnedFact(context.userId, data.factId);
    const admin = await getAdmin();
    const { error } = await admin.from("persona_facts").delete().eq("id", data.factId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const confirmSensitivePersonaFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof idInput>) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const fact = await loadOwnedFact(context.userId, data.factId);
    if (fact.sensitivity !== "sensitive")
      throw new Error("Only sensitive facts require confirmation");
    const admin = await getAdmin();
    const { error } = await admin.from("persona_fact_confirmations").insert({
      persona_fact_id: data.factId,
      confirmed_by: context.userId,
      method: "explicit_ui",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Server-only signal insertion — rejects do_not_remember sources at the DB layer. */
const signalInput = z.object({
  sessionId: z.string().uuid(),
  sourceMessageId: z.string().uuid(),
  origin: z.enum(["explicit", "inferred"]),
  kind: z.string().min(1).max(120),
  confidence: z.number().min(0).max(1),
  spanStart: z.number().int().nonnegative().optional(),
  spanEnd: z.number().int().nonnegative().optional(),
  spanText: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
});

export const recordSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof signalInput>) => signalInput.parse(d))
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { data: row, error } = await admin
      .from("signals")
      .insert({
        user_id: context.userId,
        session_id: data.sessionId,
        source_message_id: data.sourceMessageId,
        origin: data.origin,
        kind: data.kind,
        confidence: data.confidence,
        source_span_start: data.spanStart ?? null,
        source_span_end: data.spanEnd ?? null,
        span_text: data.spanText ?? null,
        payload: data.payload,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
