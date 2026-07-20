import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SessionMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  memoryDirective: string;
  createdAt: string;
};

export type SessionInterpretation = {
  id: string;
  headline: string;
  body: string;
  confidence: number;
  minSourceTier: string | null;
  patternId: string | null;
  archetypeId: string | null;
  createdAt: string;
};

export type SessionDiscernment = {
  id: string;
  kind: string;
  text: string;
  createdAt: string;
};

export type SessionPrayerSummary = {
  id: string;
  title: string;
  mode: string;
  lineCount: number;
};

export type SessionPracticeSummary = {
  id: string;
  kind: string;
  title: string;
  rationale: string;
  isPrimary: boolean;
};

export type SessionDetail = {
  id: string;
  title: string | null;
  mode: string;
  createdAt: string;
  updatedAt: string;
  messages: SessionMessage[];
  interpretation: SessionInterpretation | null;
  discernments: SessionDiscernment[];
  prayers: SessionPrayerSummary[];
  practices: SessionPracticeSummary[];
};

const input = z.object({ sessionId: z.string().uuid() });

export const getSessionDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof input>) => input.parse(d))
  .handler(async ({ data, context }): Promise<SessionDetail | null> => {
    const { data: s, error } = await context.supabase
      .from("sessions")
      .select("id, title, mode, created_at, updated_at, user_id")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!s || s.user_id !== context.userId) return null;

    const [msgs, interps, disc, prayers, practices] = await Promise.all([
      context.supabase
        .from("messages")
        .select("id, role, content, memory_directive, created_at")
        .eq("session_id", s.id)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("interpretations")
        .select("id, headline, body, confidence, min_source_tier, pattern_id, archetype_id, created_at")
        .eq("session_id", s.id)
        .order("created_at", { ascending: false })
        .limit(1),
      context.supabase
        .from("discernments")
        .select("id, kind, text, created_at")
        .eq("session_id", s.id)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("prayers")
        .select("id, title, mode, prayer_lines(count)")
        .eq("session_id", s.id),
      context.supabase
        .from("practices")
        .select("id, kind, title, rationale, is_primary")
        .eq("session_id", s.id)
        .order("is_primary", { ascending: false }),
    ]);
    if (msgs.error) throw new Error(msgs.error.message);
    if (interps.error) throw new Error(interps.error.message);
    if (disc.error) throw new Error(disc.error.message);
    if (prayers.error) throw new Error(prayers.error.message);
    if (practices.error) throw new Error(practices.error.message);

    const interp = interps.data?.[0] ?? null;

    return {
      id: s.id,
      title: s.title,
      mode: s.mode,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      messages: (msgs.data ?? []).map((m) => ({
        id: m.id,
        role: m.role as SessionMessage["role"],
        content: m.content,
        memoryDirective: m.memory_directive,
        createdAt: m.created_at,
      })),
      interpretation: interp
        ? {
            id: interp.id,
            headline: interp.headline,
            body: interp.body,
            confidence: Number(interp.confidence),
            minSourceTier: interp.min_source_tier,
            patternId: interp.pattern_id,
            archetypeId: interp.archetype_id,
            createdAt: interp.created_at,
          }
        : null,
      discernments: (disc.data ?? []).map((d) => ({
        id: d.id,
        kind: d.kind,
        text: d.text,
        createdAt: d.created_at,
      })),
      prayers: (prayers.data ?? []).map((p) => {
        const linesAgg = p.prayer_lines as unknown as { count: number }[] | null;
        return {
          id: p.id,
          title: p.title,
          mode: p.mode,
          lineCount: linesAgg?.[0]?.count ?? 0,
        };
      }),
      practices: (practices.data ?? []).map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        rationale: r.rationale,
        isPrimary: r.is_primary,
      })),
    };
  });

export type RecentSession = {
  id: string;
  title: string | null;
  mode: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  hasPrayer: boolean;
};

export const listRecentSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecentSession[]> => {
    const { data, error } = await context.supabase
      .from("sessions")
      .select("id, title, mode, created_at, updated_at, messages(count), prayers(id)")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []).map((s) => {
      const msgAgg = s.messages as unknown as { count: number }[] | null;
      const prayers = s.prayers as unknown as { id: string }[] | null;
      return {
        id: s.id,
        title: s.title,
        mode: s.mode,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        messageCount: msgAgg?.[0]?.count ?? 0,
        hasPrayer: (prayers?.length ?? 0) > 0,
      };
    });
  });
