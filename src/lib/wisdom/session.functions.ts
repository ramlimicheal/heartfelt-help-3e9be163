import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { UnifiedResult } from "./unified.schemas";

export type SessionListItem = {
  id: string;
  title: string | null;
  mode: string;
  createdAt: string;
  updatedAt: string;
};

export const listRecentSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionListItem[]> => {
    const { data } = await context.supabase
      .from("sessions")
      .select("id,title,mode,created_at,updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(30);
    return (data ?? []).map((s) => ({
      id: s.id as string,
      title: (s.title as string | null) ?? null,
      mode: s.mode as string,
      createdAt: s.created_at as string,
      updatedAt: s.updated_at as string,
    }));
  });

export type SessionMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  memoryDirective: string;
};

export type SessionTurn = {
  id: string;
  triggeringUserMessageId: string | null;
  status: string;
  result: UnifiedResult | null;
  createdAt: string;
  mode: string;
  memoryDirective: string;
  artifactIds: Record<string, unknown> | null;
};

export type SessionHistory = {
  session: { id: string; mode: string; title: string | null };
  messages: SessionMessage[];
  turns: SessionTurn[];
};

const historyInput = z.object({ sessionId: z.string().uuid() });

export const loadSessionHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof historyInput>) => historyInput.parse(d))
  .handler(async ({ data, context }): Promise<SessionHistory> => {
    const { supabase, userId } = context;
    const [sessRes, msgRes, turnRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("id,mode,user_id,title")
        .eq("id", data.sessionId)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id,role,content,created_at,memory_directive")
        .eq("session_id", data.sessionId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("wisdom_turns")
        .select("id,triggering_user_message_id,status,result,created_at,mode")
        .eq("session_id", data.sessionId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);
    if (!sessRes.data || sessRes.data.user_id !== userId) {
      throw new Error("session not found");
    }
    return {
      session: {
        id: sessRes.data.id as string,
        mode: sessRes.data.mode as string,
        title: (sessRes.data.title as string | null) ?? null,
      },
      messages: (msgRes.data ?? []).map((m) => ({
        id: m.id as string,
        role: m.role as string,
        content: m.content as string,
        createdAt: m.created_at as string,
        memoryDirective: m.memory_directive as string,
      })),
      turns: (turnRes.data ?? []).map((t) => ({
        id: t.id as string,
        triggeringUserMessageId: (t.triggering_user_message_id as string | null) ?? null,
        status: t.status as string,
        result: (t.result as UnifiedResult | null) ?? null,
        createdAt: t.created_at as string,
        mode: t.mode as string,
      })),
    };
  });

const deleteInput = z.object({ sessionId: z.string().uuid() });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof deleteInput>) => deleteInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sess = await supabaseAdmin
      .from("sessions")
      .select("id,user_id")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!sess.data || sess.data.user_id !== userId) {
      throw new Error("session not found");
    }
    await supabaseAdmin.from("wisdom_turns").delete().eq("session_id", data.sessionId).eq("user_id", userId);
    await supabaseAdmin.from("messages").delete().eq("session_id", data.sessionId).eq("user_id", userId);
    const del = await supabaseAdmin
      .from("sessions")
      .delete()
      .eq("id", data.sessionId)
      .eq("user_id", userId);
    if (del.error) throw new Error(del.error.message);
    return { ok: true };
  });
