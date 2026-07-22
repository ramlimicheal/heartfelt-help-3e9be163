/**
 * Library server functions — real data for /patterns, /prayers, /journey, /you,
 * /wisdom/curse-breaker. All authenticated + RLS-scoped.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ── Patterns ────────────────────────────────────────────────────────
export const listPatterns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patterns")
      .select("id,title,description,status,lifecycle,accepted_at,rejected_reason,updated_at,created_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id as string,
      title: (p.title as string) ?? "Untitled pattern",
      description: (p.description as string) ?? "",
      status: (p.status as string) ?? "proposed",
      lifecycle: (p.lifecycle as string | null) ?? null,
      acceptedAt: (p.accepted_at as string | null) ?? null,
      rejectedReason: (p.rejected_reason as string | null) ?? null,
      updatedAt: p.updated_at as string,
      createdAt: p.created_at as string,
    }));
  });

const patternInput = z.object({ patternId: z.string().uuid() });
export const getPattern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof patternInput>) => patternInput.parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: pattern }, { data: evidence }] = await Promise.all([
      context.supabase
        .from("patterns")
        .select("id,title,description,status,lifecycle,accepted_at,rejected_reason,created_at,updated_at")
        .eq("id", data.patternId)
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("pattern_evidence")
        .select("id,kind,excerpt,confidence,created_at")
        .eq("pattern_id", data.patternId)
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (!pattern) return null;
    return {
      pattern: {
        id: pattern.id as string,
        title: (pattern.title as string) ?? "Untitled pattern",
        description: (pattern.description as string) ?? "",
        status: (pattern.status as string) ?? "proposed",
        lifecycle: (pattern.lifecycle as string | null) ?? null,
        acceptedAt: (pattern.accepted_at as string | null) ?? null,
        rejectedReason: (pattern.rejected_reason as string | null) ?? null,
        createdAt: pattern.created_at as string,
        updatedAt: pattern.updated_at as string,
      },
      evidence: (evidence ?? []).map((e) => ({
        id: e.id as string,
        kind: e.kind as string,
        excerpt: (e.excerpt as string) ?? "",
        confidence: Number(e.confidence ?? 0.5),
        createdAt: e.created_at as string,
      })),
    };
  });

// ── Prayers ─────────────────────────────────────────────────────────
export const listPrayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("prayers")
      .select("id,title,mode,finalized_at,updated_at,prayer_lines(id)")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((p) => ({
      id: p.id as string,
      title: (p.title as string) ?? "Draft prayer",
      mode: p.mode as string,
      finalizedAt: (p.finalized_at as string | null) ?? null,
      updatedAt: p.updated_at as string,
      lineCount: Array.isArray(p.prayer_lines) ? p.prayer_lines.length : 0,
    }));
  });

const prayerInput = z.object({ prayerId: z.string().uuid() });
export const getPrayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof prayerInput>) => prayerInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: prayer } = await context.supabase
      .from("prayers")
      .select(`
        id,title,mode,finalized_at,created_at,
        prayer_lines(
          id, ordering, movement, text,
          prayer_line_sources(id, passage_id, derivation, explanation, tier)
        )
      `)
      .eq("id", data.prayerId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!prayer) return null;

    const passageIds = new Set<string>();
    const lines = (prayer.prayer_lines ?? []) as Array<{
      id: string; ordering: number; movement: string; text: string;
      prayer_line_sources: Array<{ id: string; passage_id: string; derivation: string; explanation: string; tier: string }>;
    }>;
    for (const l of lines) for (const s of l.prayer_line_sources ?? []) passageIds.add(s.passage_id);
    const passageMap = new Map<string, { reference: string; text: string }>();
    if (passageIds.size > 0) {
      const { data: passages } = await context.supabase
        .from("source_passages")
        .select("id,reference,text")
        .in("id", Array.from(passageIds));
      for (const p of passages ?? []) {
        passageMap.set(p.id as string, {
          reference: (p.reference as string) ?? "",
          text: (p.text as string) ?? "",
        });
      }
    }

    lines.sort((a, b) => a.ordering - b.ordering);
    return {
      id: prayer.id as string,
      title: (prayer.title as string) ?? "Draft prayer",
      mode: prayer.mode as string,
      finalizedAt: (prayer.finalized_at as string | null) ?? null,
      createdAt: prayer.created_at as string,
      lines: lines.map((l) => ({
        id: l.id,
        ordering: l.ordering,
        movement: l.movement,
        text: l.text,
        sources: (l.prayer_line_sources ?? []).map((s) => ({
          id: s.id,
          passageId: s.passage_id,
          derivation: s.derivation,
          explanation: s.explanation,
          tier: s.tier,
          reference: passageMap.get(s.passage_id)?.reference ?? "",
          passageText: passageMap.get(s.passage_id)?.text ?? "",
        })),
      })),
    };
  });

// ── Journey ─────────────────────────────────────────────────────────
export const listJourney = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: events }, { data: checkins }] = await Promise.all([
      context.supabase
        .from("formation_events")
        .select("id,event_type,note,at,pattern_id,prayer_id")
        .eq("user_id", context.userId)
        .order("at", { ascending: false })
        .limit(80),
      context.supabase
        .from("check_ins")
        .select("id,observed,setback,note,at")
        .eq("user_id", context.userId)
        .order("at", { ascending: false })
        .limit(40),
    ]);
    const merged: Array<{
      id: string; kind: "event" | "check_in"; at: string;
      type: string; note: string;
      patternId: string | null; prayerId: string | null;
    }> = [];
    for (const e of events ?? []) {
      merged.push({
        id: e.id as string, kind: "event",
        at: e.at as string,
        type: (e.event_type as string) ?? "event",
        note: (e.note as string) ?? "",
        patternId: (e.pattern_id as string | null) ?? null,
        prayerId: (e.prayer_id as string | null) ?? null,
      });
    }
    for (const c of checkins ?? []) {
      const parts: string[] = [];
      if (c.observed) parts.push(`Observed: ${c.observed as string}`);
      if (c.setback) parts.push(`Setback: ${c.setback as string}`);
      if (c.note) parts.push(c.note as string);
      merged.push({
        id: c.id as string, kind: "check_in",
        at: c.at as string,
        type: "check_in",
        note: parts.join(" · "),
        patternId: null, prayerId: null,
      });
    }
    merged.sort((a, b) => (a.at < b.at ? 1 : -1));
    return merged;
  });

// ── Persona / You ───────────────────────────────────────────────────
export const listPersonaFacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("persona_facts")
      .select("id,key,value,status,sensitivity,confidence,memory_directive,updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((f) => {
      const raw = f.value as unknown;
      let text = "";
      if (typeof raw === "string") text = raw;
      else if (raw && typeof raw === "object") {
        const asRec = raw as Record<string, unknown>;
        text = String(asRec.text ?? asRec.value ?? JSON.stringify(raw));
      }
      return {
        id: f.id as string,
        key: (f.key as string) ?? "",
        text,
        status: (f.status as string) ?? "proposed",
        sensitivity: (f.sensitivity as string) ?? "normal",
        confidence: Number(f.confidence ?? 0.5),
        memoryDirective: (f.memory_directive as string) ?? "normal",
        updatedAt: f.updated_at as string,
      };
    });
  });

const factUpdate = z.object({
  factId: z.string().uuid(),
  status: z.enum(["accepted", "rejected", "proposed"]),
});
export const updatePersonaFactStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof factUpdate>) => factUpdate.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("persona_facts")
      .update({ status: data.status })
      .eq("id", data.factId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Latest curse-breaker turn (for /wisdom/curse-breaker landing) ───
export const getLatestCurseBreakerTurn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("wisdom_turns")
      .select("id,session_id,status,result,created_at,mode")
      .eq("user_id", context.userId)
      .eq("mode", "curse_breaker")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id as string,
      sessionId: data.session_id as string,
      resultJson: JSON.stringify(data.result ?? null),
      createdAt: data.created_at as string,
    };
  });
