import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadOwned(userId: string, patternId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("patterns")
    .select("id, user_id, lifecycle, title, description, status, version:updated_at, rejected_evidence_snapshot")
    .eq("id", patternId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.user_id !== userId) throw new Error("Pattern not found");
  return data;
}

const proposeInput = z.object({
  idempotencyKey: z.string().min(8).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
});

export const proposePattern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof proposeInput>) => proposeInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("patterns")
      .upsert(
        {
          user_id: context.userId,
          idempotency_key: data.idempotencyKey,
          title: data.title,
          description: data.description ?? null,
          lifecycle: "proposed",
          last_edited_by: context.userId,
        },
        { onConflict: "user_id,idempotency_key", ignoreDuplicates: false },
      )
      .select("id, lifecycle, title, description, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const acceptInput = z.object({
  patternId: z.string().uuid(),
  feedback: z.string().min(1).max(2000),
});

export const acceptPattern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof acceptInput>) => acceptInput.parse(d))
  .handler(async ({ data, context }) => {
    await loadOwned(context.userId, data.patternId);
    const db = await admin();
    const { error } = await db
      .from("patterns")
      .update({
        lifecycle: "accepted",
        status: "active",
        acceptance_feedback: data.feedback,
        accepted_at: new Date().toISOString(),
        last_edited_by: context.userId,
      })
      .eq("id", data.patternId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await db.from("pattern_feedback").insert({
      pattern_id: data.patternId,
      user_id: context.userId,
      kind: "accept",
      note: data.feedback,
    });
    return { ok: true };
  });

const rejectInput = z.object({
  patternId: z.string().uuid(),
  reason: z.string().min(1).max(2000),
  scope: z.enum(["session", "durable", "global"]).default("durable"),
});

export const rejectPattern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof rejectInput>) => rejectInput.parse(d))
  .handler(async ({ data, context }) => {
    const pattern = await loadOwned(context.userId, data.patternId);
    const db = await admin();
    // Snapshot current evidence at rejection time.
    const { data: evidence } = await db
      .from("pattern_evidence")
      .select("id, kind, excerpt, confidence, source_message_id, created_at")
      .eq("pattern_id", data.patternId);
    const { error } = await db
      .from("patterns")
      .update({
        lifecycle: "rejected",
        status: "rejected",
        rejected_reason: data.reason,
        rejected_scope: data.scope,
        rejected_evidence_snapshot: {
          pattern: { title: pattern.title, description: pattern.description },
          evidence: evidence ?? [],
        },
        rejected_at: new Date().toISOString(),
        last_edited_by: context.userId,
      })
      .eq("id", data.patternId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await db.from("pattern_feedback").insert({
      pattern_id: data.patternId,
      user_id: context.userId,
      kind: "reject",
      note: data.reason,
    });
    return { ok: true };
  });

const archiveInput = z.object({ patternId: z.string().uuid() });
export const archivePattern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof archiveInput>) => archiveInput.parse(d))
  .handler(async ({ data, context }) => {
    await loadOwned(context.userId, data.patternId);
    const db = await admin();
    const { error } = await db
      .from("patterns")
      .update({ status: "archived", archived_at: new Date().toISOString(), last_edited_by: context.userId })
      .eq("id", data.patternId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const reconsiderInput = z.object({
  patternId: z.string().uuid(),
  newEvidence: z.string().min(20).max(4000),
  newIdempotencyKey: z.string().min(8).max(120),
});

/** Reconsider a rejected pattern: creates a NEW pattern linked back to the original.
 *  Requires meaningful new evidence (min 20 chars) with visible explanation. */
export const reconsiderPattern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof reconsiderInput>) => reconsiderInput.parse(d))
  .handler(async ({ data, context }) => {
    const prior = await loadOwned(context.userId, data.patternId);
    if (prior.lifecycle !== "rejected") throw new Error("Only rejected patterns can be reconsidered");
    const db = await admin();
    const { data: created, error } = await db
      .from("patterns")
      .insert({
        user_id: context.userId,
        idempotency_key: data.newIdempotencyKey,
        title: prior.title,
        description: prior.description,
        lifecycle: "reconsidered",
        reconsidered_from: data.patternId,
        reconsideration_evidence: data.newEvidence,
        last_edited_by: context.userId,
      })
      .select("id, lifecycle")
      .single();
    if (error) throw new Error(error.message);
    await db.from("pattern_feedback").insert({
      pattern_id: created.id,
      user_id: context.userId,
      kind: "reconsider",
      note: data.newEvidence,
    });
    return { ok: true, newPatternId: created.id };
  });

const relInput = z.object({
  fromPatternId: z.string().uuid(),
  toPatternId: z.string().uuid(),
  relation: z.enum(["causes", "reinforces", "masks", "contradicts", "precedes"]),
  idempotencyKey: z.string().min(8).max(120),
});
export const createPatternRelationship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof relInput>) => relInput.parse(d))
  .handler(async ({ data, context }) => {
    await loadOwned(context.userId, data.fromPatternId);
    await loadOwned(context.userId, data.toPatternId);
    const db = await admin();
    const { data: row, error } = await db
      .from("pattern_relationships")
      .upsert(
        {
          user_id: context.userId,
          from_pattern_id: data.fromPatternId,
          to_pattern_id: data.toPatternId,
          relation: data.relation,
          idempotency_key: data.idempotencyKey,
        },
        { onConflict: "user_id,idempotency_key" },
      )
      .select("id, relation")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const evidenceInput = z.object({
  patternId: z.string().uuid(),
  kind: z.enum(["supporting", "counter", "missing", "hidden_agreement"]),
  sourceMessageId: z.string().uuid(),
  excerpt: z.string().max(2000).optional(),
  confidence: z.number().min(0).max(1).optional(),
});
/** Server-only evidence recording (called by the pipeline, not the client). */
export const recordPatternEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof evidenceInput>) => evidenceInput.parse(d))
  .handler(async ({ data, context }) => {
    await loadOwned(context.userId, data.patternId);
    const db = await admin();
    // Verify source message ownership + not DNR.
    const { data: msg } = await db
      .from("messages")
      .select("id, user_id, memory_directive")
      .eq("id", data.sourceMessageId)
      .maybeSingle();
    if (!msg || msg.user_id !== context.userId) throw new Error("Source message not owned by caller");
    if (msg.memory_directive === "do_not_remember")
      throw new Error("do_not_remember messages cannot become pattern evidence");
    const { error } = await db.from("pattern_evidence").insert({
      pattern_id: data.patternId,
      user_id: context.userId,
      kind: data.kind,
      source_message_id: data.sourceMessageId,
      excerpt: data.excerpt ?? null,
      confidence: data.confidence ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Read accepted patterns only (rejected excluded from durable context). */
export const listAcceptedPatterns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patterns")
      .select("id, title, description, lifecycle, status, accepted_at")
      .eq("user_id", context.userId)
      .eq("lifecycle", "accepted")
      .neq("status", "archived")
      .order("accepted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });
