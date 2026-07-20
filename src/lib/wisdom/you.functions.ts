import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PersonaFactStatus =
  | "proposed"
  | "accepted"
  | "corrected"
  | "rejected"
  | "session_only"
  | "deleted";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [k: string]: JsonValue }
  | JsonValue[];

export type PersonaFactRow = {
  id: string;
  key: string;
  value: JsonValue;
  status: string;
  sensitivity: string;
  origin: string;
  confidence: number | null;
  sourceMessageId: string | null;
  createdAt: string;
  updatedAt: string;
};

export const listPersonaFacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PersonaFactRow[]> => {
    const { data, error } = await context.supabase
      .from("persona_facts")
      .select(
        "id, key, value, status, sensitivity, origin, confidence, source_message_id, created_at, updated_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      key: r.key,
      value: (r.value ?? null) as JsonValue,
      status: r.status,
      sensitivity: r.sensitivity,
      origin: r.origin,
      confidence: r.confidence,
      sourceMessageId: r.source_message_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  });

// Accept / reject / correct a persona fact proposal.
// - `accepted` on a sensitive fact first inserts a confirmation row (required by trigger).
// - `corrected` writes a new value AND flips status to accepted (correction is durable).
export const setPersonaFactStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      factId: string;
      status: "accepted" | "rejected" | "corrected" | "deleted";
      correctedValue?: JsonValue;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership + fetch sensitivity via RLS
    const { data: fact, error: readErr } = await supabase
      .from("persona_facts")
      .select("id, user_id, sensitivity, status")
      .eq("id", data.factId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!fact || fact.user_id !== userId) throw new Error("Fact not found");

    // For sensitive facts moving to accepted/corrected, insert confirmation first.
    if (
      (data.status === "accepted" || data.status === "corrected") &&
      fact.sensitivity === "sensitive"
    ) {
      const { error: confErr } = await supabase
        .from("persona_fact_confirmations")
        .insert({
          persona_fact_id: data.factId,
          confirmed_by: userId,
          method: "explicit",
        });
      // Ignore duplicate confirmation errors (unique constraint / already confirmed)
      if (confErr && !/duplicate|unique/i.test(confErr.message)) {
        throw new Error(confErr.message);
      }
    }

    const patch: {
      status: "accepted" | "rejected" | "deleted";
      value?: JsonValue;
      origin?: "explicit" | "inferred";
    } = {
      status: data.status === "corrected" ? "accepted" : data.status,
    };
    if (data.status === "corrected" && data.correctedValue !== undefined) {
      patch.value = data.correctedValue;
      patch.origin = "explicit";
    }

    const { error: updErr } = await supabase
      .from("persona_facts")
      .update(patch)
      .eq("id", data.factId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true as const };
  });
