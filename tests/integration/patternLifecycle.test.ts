import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestContext, type TestContext } from "../harness";

let ctx: TestContext;
beforeAll(async () => { ctx = await createTestContext(); });
afterAll(async () => { await ctx?.cleanup(); });

async function proposePattern(user: TestContext["userA"], key: string, title = "recurring anger") {
  return user.client
    .from("patterns")
    .upsert(
      {
        user_id: user.id,
        idempotency_key: key,
        title,
        lifecycle: "proposed",
        last_edited_by: user.id,
      },
      { onConflict: "user_id,idempotency_key" },
    )
    .select("id,lifecycle")
    .single();
}

describe("pattern lifecycle integration", () => {
  it("propose writes lifecycle='proposed' (never 'pending')", async () => {
    const key = `pt-${Date.now()}-a`;
    const { data, error } = await proposePattern(ctx.userA, key);
    expect(error).toBeNull();
    expect(data?.lifecycle).toBe("proposed");
  });

  it("idempotent propose does not create duplicates", async () => {
    const key = `pt-${Date.now()}-b`;
    const r1 = await proposePattern(ctx.userA, key);
    const r2 = await proposePattern(ctx.userA, key);
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();
    expect(r1.data?.id).toBe(r2.data?.id);
    const { data: all } = await ctx.userA.client
      .from("patterns")
      .select("id")
      .eq("user_id", ctx.userA.id)
      .eq("idempotency_key", key);
    expect(all?.length).toBe(1);
  });

  it("end users cannot bypass server functions for accept/reject/reconsider (patterns_owner_lifecycle_guard)", async () => {
    const key = `pt-${Date.now()}-x`;
    const { data: p } = await proposePattern(ctx.userA, key);
    for (const target of ["accepted", "rejected", "reconsidered"] as const) {
      const { error } = await ctx.userA.client
        .from("patterns")
        .update({ lifecycle: target })
        .eq("id", p!.id);
      expect(error, `direct lifecycle→${target} must be blocked`).not.toBeNull();
      expect((error as Error).message.toLowerCase()).toMatch(/server function/);
    }
  });

  it("accept REQUIRES acceptance_feedback (DB CHECK enforced under service role)", async () => {
    const key = `pt-${Date.now()}-c`;
    const { data: p } = await proposePattern(ctx.userA, key);
    // No feedback → CHECK rejects even under service role.
    const { error: bad } = await ctx.admin
      .from("patterns")
      .update({ lifecycle: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", p!.id);
    expect(bad).not.toBeNull();
    // With feedback → CHECK passes; service role bypasses the owner-lifecycle trigger.
    const { error: ok } = await ctx.admin
      .from("patterns")
      .update({
        lifecycle: "accepted",
        acceptance_feedback: "yes this names something real",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", p!.id);
    expect(ok).toBeNull();
  });

  it("reject REQUIRES reason + scope + evidence snapshot (DB CHECK enforced under service role)", async () => {
    const key = `pt-${Date.now()}-d`;
    const { data: p } = await proposePattern(ctx.userA, key);
    const { error: bad } = await ctx.admin
      .from("patterns")
      .update({ lifecycle: "rejected", rejected_reason: "not me" })
      .eq("id", p!.id);
    expect(bad).not.toBeNull();
    const { error: ok } = await ctx.admin
      .from("patterns")
      .update({
        lifecycle: "rejected",
        rejected_reason: "not me",
        rejected_scope: "durable",
        rejected_evidence_snapshot: { pattern: { title: "recurring anger" }, evidence: [] },
        rejected_at: new Date().toISOString(),
      })
      .eq("id", p!.id);
    expect(ok).toBeNull();
  });

  it("reconsider REQUIRES original + new evidence (DB CHECK enforced under service role)", async () => {
    const key = `pt-${Date.now()}-e`;
    const { data: original } = await proposePattern(ctx.userA, key);
    await ctx.admin
      .from("patterns")
      .update({
        lifecycle: "rejected",
        rejected_reason: "not me",
        rejected_scope: "durable",
        rejected_evidence_snapshot: { pattern: {}, evidence: [] },
        rejected_at: new Date().toISOString(),
      })
      .eq("id", original!.id);

    const { error: bad } = await ctx.admin.from("patterns").insert({
      user_id: ctx.userA.id,
      idempotency_key: `${key}-r1`,
      title: "recurring anger",
      lifecycle: "reconsidered",
    });
    expect(bad).not.toBeNull();

    const { error: ok } = await ctx.admin.from("patterns").insert({
      user_id: ctx.userA.id,
      idempotency_key: `${key}-r2`,
      title: "recurring anger",
      lifecycle: "reconsidered",
      reconsidered_from: original!.id,
      reconsideration_evidence: "New situation last week clearly shows this pattern re-emerging under stress",
    });
    expect(ok).toBeNull();
  });

  it("owner isolation — User B cannot even attempt lifecycle transitions on User A's pattern", async () => {
    const key = `pt-${Date.now()}-f`;
    const { data: p } = await proposePattern(ctx.userA, key);
    const { data: rows } = await ctx.userB.client
      .from("patterns")
      .update({ lifecycle: "accepted", acceptance_feedback: "hostile" })
      .eq("id", p!.id)
      .select("id");
    expect((rows ?? []).length).toBe(0);
    const { data: check } = await ctx.userA.client
      .from("patterns")
      .select("lifecycle,acceptance_feedback")
      .eq("id", p!.id)
      .single();
    expect(check?.lifecycle).toBe("proposed");
    expect(check?.acceptance_feedback).toBeNull();
  });
});
