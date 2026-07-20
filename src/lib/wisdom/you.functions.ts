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
