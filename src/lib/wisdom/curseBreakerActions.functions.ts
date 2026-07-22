/**
 * Phase 3B — Curse Breaker interpretation actions.
 *
 * Server functions that record the user's decision on a pastoral/biblical
 * interpretation produced by a v2 Curse Breaker turn. All actions are:
 *
 *  - authenticated (requireSupabaseAuth);
 *  - server-side owner-checked (never trust client-supplied ownership);
 *  - filtered by taxonomy_version = 2 on the source turn;
 *  - rejected for non-durable memory directives (session_only, DNR);
 *  - user-safe on failure (no raw DB errors leak);
 *  - idempotent (unique on (wisdom_turn_id, interpretation_client_id)).
 *
 * The interpretation content itself lives in wisdom_turns.result. This
 * table only records the user's action.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const setStatusInput = z.object({
  wisdomTurnId: z.string().uuid(),
  interpretationClientId: z.string().min(1).max(64),
  status: z.enum(["unresolved", "accepted", "revised", "rejected"]),
  revision: z.string().max(2000).optional(),
});

export const setCurseBreakerInterpretationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof setStatusInput>) => setStatusInput.parse(d))
  .handler(async ({ data, context }) => {
    // 1. Verify the source turn: owner, mode, memory directive, version.
    const { data: turn } = await context.supabase
      .from("wisdom_turns")
      .select("id, user_id, session_id, mode, memory_directive, taxonomy_version")
      .eq("id", data.wisdomTurnId)
      .maybeSingle();
    if (!turn || (turn.user_id as string) !== context.userId) {
      // Do not leak existence of another user's turn.
      throw new Error("Interpretation not available.");
    }
    if ((turn.mode as string) !== "curse_breaker") {
      throw new Error("Interpretation not available.");
    }
    const md = (turn.memory_directive as string) ?? "normal";
    if (md === "session_only" || md === "do_not_remember") {
      throw new Error(
        "This turn was captured under a non-durable memory directive, so decisions cannot be saved to your library.",
      );
    }
    if (((turn.taxonomy_version as number | null) ?? 1) < 2) {
      throw new Error("This is a legacy Curse Breaker turn and does not support interpretation actions.");
    }

    // 2. Revision is required when status is 'revised', bounded when present.
    if (data.status === "revised") {
      if (!data.revision || data.revision.trim().length < 3) {
        throw new Error("A revision needs a short explanation before it can be saved.");
      }
    }
    const revision =
      data.status === "revised" ? (data.revision ?? "").trim() : null;

    // 3. Upsert on (wisdom_turn_id, interpretation_client_id).
    //    Repeated identical submissions are safe.
    const { data: row, error } = await context.supabase
      .from("curse_breaker_interpretations")
      .upsert(
        {
          user_id: context.userId,
          session_id: turn.session_id as string,
          wisdom_turn_id: data.wisdomTurnId,
          interpretation_client_id: data.interpretationClientId,
          status: data.status,
          revision,
        } as never,
        { onConflict: "wisdom_turn_id,interpretation_client_id", ignoreDuplicates: false },
      )
      .select("id, status, revision, updated_at")
      .single();
    if (error || !row) {
      // Never surface raw DB errors.
      throw new Error("That decision could not be saved right now.");
    }
    return {
      ok: true as const,
      id: row.id as string,
      status: row.status as "unresolved" | "accepted" | "revised" | "rejected",
      revision: (row.revision as string | null) ?? null,
      updatedAt: row.updated_at as string,
    };
  });

const listInput = z.object({ wisdomTurnId: z.string().uuid() });

export const listCurseBreakerInterpretationStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof listInput>) => listInput.parse(d))
  .handler(async ({ data, context }) => {
    // Owner-only read (RLS also blocks); do NOT leak "unknown turn" as a
    // distinct signal — an empty array is safe.
    const { data: rows } = await context.supabase
      .from("curse_breaker_interpretations")
      .select("interpretation_client_id, status, revision, updated_at")
      .eq("wisdom_turn_id", data.wisdomTurnId)
      .eq("user_id", context.userId);
    return (rows ?? []).map((r) => ({
      interpretationClientId: r.interpretation_client_id as string,
      status: r.status as "unresolved" | "accepted" | "revised" | "rejected",
      revision: (r.revision as string | null) ?? null,
      updatedAt: r.updated_at as string,
    }));
  });
