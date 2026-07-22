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
//
// Library rule: /prayers shows only prayers the user has explicitly finalized.
// Draft prayers stay visible inside their originating session (via
// loadSessionHistory), never as durable library entries.
export const listPrayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("prayers")
      .select("id,title,mode,finalized_at,updated_at,prayer_lines(id)")
      .eq("user_id", context.userId)
      .not("finalized_at", "is", null)
      .order("finalized_at", { ascending: false })
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
        id,title,mode,finalized_at,created_at,wisdom_turn_id,
        prayer_lines(
          id, ordering, movement, text,
          prayer_line_sources(id, passage_id, derivation, explanation, tier)
        )
      `)
      .eq("id", data.prayerId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!prayer) return null;

    // Derive the originating memory directive from the wisdom_turn that
    // produced this prayer. Session-only / do_not_remember prayers can
    // never be finalized — surface this to the UI as `memoryDirective`
    // so it can explain why the action is unavailable.
    let memoryDirective: "normal" | "session_only" | "do_not_remember" = "normal";
    if (prayer.wisdom_turn_id) {
      const { data: turn } = await context.supabase
        .from("wisdom_turns")
        .select("memory_directive")
        .eq("id", prayer.wisdom_turn_id as string)
        .eq("user_id", context.userId)
        .maybeSingle();
      const md = (turn?.memory_directive as string | null) ?? "normal";
      if (md === "session_only" || md === "do_not_remember") memoryDirective = md;
    }

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

    const missingCitationLineOrders = lines
      .filter((l) => !Array.isArray(l.prayer_line_sources) || l.prayer_line_sources.length === 0)
      .map((l) => l.ordering);

    const finalizedAt = (prayer.finalized_at as string | null) ?? null;
    const canFinalize =
      !finalizedAt &&
      memoryDirective === "normal" &&
      lines.length > 0 &&
      missingCitationLineOrders.length === 0;

    return {
      id: prayer.id as string,
      title: (prayer.title as string) ?? "Draft prayer",
      mode: prayer.mode as string,
      finalizedAt,
      createdAt: prayer.created_at as string,
      memoryDirective,
      canFinalize,
      missingCitationLineOrders,
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

// ── Explicit prayer finalization ─────────────────────────────────────
//
// A prayer draft enters the durable prayer library only through this
// server function, called by the user's explicit action. Every check is
// performed server-side. The database `prayers_finalize_guard` remains
// the last line of defense.
const finalizeInput = z.object({ prayerId: z.string().uuid() });
export const finalizePrayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof finalizeInput>) => finalizeInput.parse(d))
  .handler(async ({ data, context }) => {
    // 1. Load the prayer and verify ownership. Never trust client-supplied
    //    metadata about who owns it or its state.
    const { data: prayer, error: loadErr } = await context.supabase
      .from("prayers")
      .select("id, user_id, finalized_at, wisdom_turn_id")
      .eq("id", data.prayerId)
      .maybeSingle();
    if (loadErr) throw new Error("Prayer could not be loaded.");
    if (!prayer || prayer.user_id !== context.userId) {
      // Do not leak existence to other users.
      throw new Error("Prayer not found.");
    }

    // 2. Idempotent short-circuit for an already-finalized prayer.
    if (prayer.finalized_at) {
      return {
        ok: true,
        finalizedAt: prayer.finalized_at as string,
        alreadyFinalized: true,
      };
    }

    // 3. Reject prayers drafted under a non-durable memory directive.
    if (prayer.wisdom_turn_id) {
      const { data: turn } = await context.supabase
        .from("wisdom_turns")
        .select("memory_directive, user_id")
        .eq("id", prayer.wisdom_turn_id as string)
        .maybeSingle();
      if (turn && turn.user_id !== context.userId) {
        throw new Error("Prayer not found.");
      }
      const md = (turn?.memory_directive as string | null) ?? "normal";
      if (md === "session_only" || md === "do_not_remember") {
        throw new Error(
          "This prayer was drafted under a non-durable memory directive and cannot be added to your prayer library. Ask Wisdom for a new prayer with 'Remember normally' to keep it.",
        );
      }
    }

    // 4. Load lines + their citations under the user's RLS. Reject empty
    //    prayers and any line without at least one citation.
    const { data: lines } = await context.supabase
      .from("prayer_lines")
      .select("id, ordering, prayer_line_sources(id)")
      .eq("prayer_id", data.prayerId)
      .eq("user_id", context.userId)
      .order("ordering", { ascending: true });
    const lineRows = (lines ?? []) as Array<{
      id: string;
      ordering: number;
      prayer_line_sources: Array<{ id: string }>;
    }>;
    if (lineRows.length === 0) {
      throw new Error("This prayer has no lines yet, so it cannot be finalized.");
    }
    const missing = lineRows.filter(
      (l) => !Array.isArray(l.prayer_line_sources) || l.prayer_line_sources.length === 0,
    );
    if (missing.length > 0) {
      const count = missing.length;
      throw new Error(
        `${count} prayer ${count === 1 ? "line has" : "lines have"} no scripture citation yet. Every line needs at least one source before this prayer can be finalized.`,
      );
    }

    // 5. Set finalized_at only after all validation passes. The
    //    `is finalized_at null` clause + DB `prayers_finalize_guard`
    //    together keep the write idempotent under concurrent submits.
    const nowIso = new Date().toISOString();
    const { data: updated, error: uErr } = await context.supabase
      .from("prayers")
      .update({ finalized_at: nowIso })
      .eq("id", data.prayerId)
      .eq("user_id", context.userId)
      .is("finalized_at", null)
      .select("finalized_at")
      .maybeSingle();
    if (uErr) {
      // Surface a user-safe error. DB guard messages are theological/technical.
      throw new Error("This prayer could not be finalized right now.");
    }
    return {
      ok: true,
      finalizedAt: (updated?.finalized_at as string | null) ?? nowIso,
      alreadyFinalized: false,
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
    // Load ownership + guard state first — never trust the client to have
    // told us the fact's sensitivity or memory directive.
    const { data: fact, error: loadErr } = await context.supabase
      .from("persona_facts")
      .select("id, user_id, sensitivity, memory_directive")
      .eq("id", data.factId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!fact || fact.user_id !== context.userId) {
      // Do not leak existence to other users.
      throw new Error("Fact not found");
    }

    if (data.status === "accepted") {
      // Session-only / DNR facts can never become accepted cross-session
      // persona memory. This closes the "generic status-update" bypass.
      if (
        fact.memory_directive === "session_only" ||
        fact.memory_directive === "do_not_remember"
      ) {
        throw new Error(
          "This fact was captured under a non-durable memory directive and cannot be accepted as long-term persona memory.",
        );
      }
      // Sensitive facts require an explicit confirmation row before accept.
      // The DB trigger `persona_facts_guard` enforces this too; we surface a
      // clean error here so the UI can prompt for confirmation.
      if (fact.sensitivity === "sensitive") {
        const { data: conf } = await context.supabase
          .from("persona_fact_confirmations")
          .select("id")
          .eq("persona_fact_id", data.factId)
          .eq("confirmed_by", context.userId)
          .limit(1)
          .maybeSingle();
        if (!conf) {
          throw new Error(
            "Sensitive persona facts require an explicit confirmation before acceptance.",
          );
        }
      }
    }

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
