import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireCuratorOrAdmin(userId: string) {
  const db = await admin();
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  const roles = new Set((data ?? []).map((r) => r.role));
  if (!roles.has("curator") && !roles.has("admin")) throw new Error("Forbidden");
  return roles.has("admin") ? "admin" : "curator";
}

const approveInput = z.object({
  targetType: z.enum(["source", "archetype"]),
  targetId: z.string().uuid(),
  targetVersion: z.number().int().positive(),
  note: z.string().max(2000).optional(),
});

export const approveTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof approveInput>) => approveInput.parse(d))
  .handler(async ({ data, context }) => {
    const role = await requireCuratorOrAdmin(context.userId);
    const db = await admin();
    const { error } = await db.from("source_approvals").insert({
      target_type: data.targetType,
      target_id: data.targetId,
      target_version: data.targetVersion,
      approver_id: context.userId,
      approver_role: role,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    await db.from("source_audit").insert({
      target_type: data.targetType,
      target_id: data.targetId,
      actor_id: context.userId,
      action: "approve",
      payload: { version: data.targetVersion, note: data.note ?? null },
    });
    return { ok: true };
  });

const publishInput = z.object({
  targetType: z.enum(["source", "archetype"]),
  targetId: z.string().uuid(),
});

export const publishTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof publishInput>) => publishInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireCuratorOrAdmin(context.userId);
    const db = await admin();
    const table = data.targetType === "source" ? "source_documents" : "biblical_archetypes";
    // The DB trigger enforces the two-approver invariant.
    const { error } = await db.from(table).update({ status: "approved" }).eq("id", data.targetId);
    if (error) throw new Error(error.message);
    await db.from("source_audit").insert({
      target_type: data.targetType,
      target_id: data.targetId,
      actor_id: context.userId,
      action: "publish",
      payload: {},
    });
    return { ok: true };
  });

/** Public read: approved archetypes with their mirrors and primary passages. */
export const listApprovedArchetypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("biblical_archetypes")
      .select(
        "id, slug, title, summary, archetype_mirrors(mirror_type, description), archetype_passages(role, ordering, source_passages(reference, canonical_ref, text, source_documents(slug, title, tier, translation, licence)))",
      )
      .eq("status", "approved")
      .order("title");
    if (error) throw new Error(error.message);
    return data;
  });
