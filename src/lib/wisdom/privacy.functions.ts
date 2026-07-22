/**
 * Privacy server functions — export and delete user data.
 * Delete uses admin auth API to remove the auth.users row (cascades to all
 * user_id-scoped rows via existing FKs).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const exportMyData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [
      profile, sessions, messages, patterns, patternEvidence,
      prayers, prayerLines, prayerLineSources,
      formationEvents, checkIns, personaFacts, wisdomTurns,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("sessions").select("*").eq("user_id", userId),
      supabase.from("messages").select("*").eq("user_id", userId),
      supabase.from("patterns").select("*").eq("user_id", userId),
      supabase.from("pattern_evidence").select("*").eq("user_id", userId),
      supabase.from("prayers").select("*").eq("user_id", userId),
      supabase.from("prayer_lines").select("*").eq("user_id", userId),
      supabase.from("prayer_line_sources").select("*").eq("user_id", userId),
      supabase.from("formation_events").select("*").eq("user_id", userId),
      supabase.from("check_ins").select("*").eq("user_id", userId),
      supabase.from("persona_facts").select("*").eq("user_id", userId),
      supabase.from("wisdom_turns").select("*").eq("user_id", userId),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      userId,
      profile: profile.data ?? null,
      sessions: sessions.data ?? [],
      messages: messages.data ?? [],
      patterns: patterns.data ?? [],
      pattern_evidence: patternEvidence.data ?? [],
      prayers: prayers.data ?? [],
      prayer_lines: prayerLines.data ?? [],
      prayer_line_sources: prayerLineSources.data ?? [],
      formation_events: formationEvents.data ?? [],
      check_ins: checkIns.data ?? [],
      persona_facts: personaFacts.data ?? [],
      wisdom_turns: wisdomTurns.data ?? [],
    };
  });

const deleteInput = z.object({ confirm: z.literal("DELETE MY ACCOUNT") });
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof deleteInput>) => deleteInput.parse(d))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Delete all user-owned rows explicitly (RLS cascade is via user_id FKs on some tables only)
    const uid = context.userId;
    const tables = [
      "prayer_line_sources", "prayer_lines", "prayers",
      "pattern_evidence", "patterns",
      "persona_fact_confirmations", "persona_facts",
      "formation_events", "check_ins",
      "wisdom_turns", "wisdom_turn_attempts",
      "messages", "sessions", "profiles",
    ] as const;
    for (const t of tables) {
      await supabaseAdmin.from(t).delete().eq(t === "profiles" ? "id" : "user_id", uid);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
