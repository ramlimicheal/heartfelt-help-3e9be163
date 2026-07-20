/**
 * Checkpoint 2.1 — signals & pattern_evidence are server-write-only,
 * immutable historical evidence. User corrections must flow through the
 * append-only signal_corrections table.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestContext, type TestContext } from "../harness";

let ctx: TestContext;
beforeAll(async () => { ctx = await createTestContext(); });
afterAll(async () => { await ctx?.cleanup(); });

async function newSessionWithNormalTurn(user: TestContext["userA"]) {
  const { data: sess } = await user.client
    .from("sessions").insert({ user_id: user.id, mode: "pattern", title: "t" })
    .select("id").single();
  const { data: msg } = await user.client
    .from("messages").insert({
      user_id: user.id, session_id: sess!.id, role: "user",
      content: "durable turn", memory_directive: "normal",
    }).select("id").single();
  return { sessionId: sess!.id, messageId: msg!.id };
}

async function pipelineSignal(userId: string, sessionId: string, sourceMessageId: string) {
  return ctx.admin.from("signals").insert({
    user_id: userId, session_id: sessionId, source_message_id: sourceMessageId,
    kind: "belief", origin: "explicit", confidence: 0.7,
    payload: { paraphrase: "pipeline-inserted" },
  }).select("id").single();
}

describe("signals write contract — server-write-only + immutable", () => {
  it("authenticated User A cannot directly INSERT a signal (grant + policy revoked)", async () => {
    const { sessionId, messageId } = await newSessionWithNormalTurn(ctx.userA);
    const { error } = await ctx.userA.client.from("signals").insert({
      user_id: ctx.userA.id, session_id: sessionId, source_message_id: messageId,
      kind: "belief", origin: "explicit", confidence: 0.5, payload: { paraphrase: "attempt" },
    });
    expect(error).not.toBeNull();
    expect((error as Error).message.toLowerCase()).toMatch(/permission denied|row-level security/);
  });

  it("authenticated User A cannot UPDATE a signal (immutability trigger + no grant)", async () => {
    const { sessionId, messageId } = await newSessionWithNormalTurn(ctx.userA);
    const { data: s } = await pipelineSignal(ctx.userA.id, sessionId, messageId);
    const { data: rows, error } = await ctx.userA.client
      .from("signals").update({ confidence: 0.99 }).eq("id", s!.id).select("id");
    // Either PostgREST returns no rows (missing grant) or the trigger fires.
    expect(((rows ?? []).length === 0) || error !== null).toBe(true);
    // Confirm nothing actually changed.
    const { data: fresh } = await ctx.admin.from("signals").select("confidence").eq("id", s!.id).single();
    expect(Number(fresh?.confidence)).toBe(0.7);
  });

  it("authenticated User A cannot DELETE a signal", async () => {
    const { sessionId, messageId } = await newSessionWithNormalTurn(ctx.userA);
    const { data: s } = await pipelineSignal(ctx.userA.id, sessionId, messageId);
    const { data: rows, error } = await ctx.userA.client
      .from("signals").delete().eq("id", s!.id).select("id");
    expect(((rows ?? []).length === 0) || error !== null).toBe(true);
    const { data: still } = await ctx.admin.from("signals").select("id").eq("id", s!.id).single();
    expect(still?.id).toBe(s!.id);
  });

  it("User A cannot manipulate User B's signals", async () => {
    const { sessionId, messageId } = await newSessionWithNormalTurn(ctx.userB);
    const { data: s } = await pipelineSignal(ctx.userB.id, sessionId, messageId);
    // Read attempt.
    const { data: readA } = await ctx.userA.client.from("signals").select("id").eq("id", s!.id);
    expect(readA ?? []).toEqual([]);
    // Insert-into-B attempt (should be denied — no grant + policy would require auth.uid()=user_id anyway).
    const { error: insErr } = await ctx.userA.client.from("signals").insert({
      user_id: ctx.userB.id, session_id: sessionId, source_message_id: messageId,
      kind: "belief", origin: "explicit", confidence: 0.9, payload: { paraphrase: "hostile" },
    });
    expect(insErr).not.toBeNull();
  });

  it("even under service_role, UPDATE / DELETE on signals is blocked by the immutability trigger", async () => {
    const { sessionId, messageId } = await newSessionWithNormalTurn(ctx.userA);
    const { data: s } = await pipelineSignal(ctx.userA.id, sessionId, messageId);
    const { error: uErr } = await ctx.admin.from("signals").update({ confidence: 0.11 }).eq("id", s!.id);
    expect(uErr).not.toBeNull();
    expect((uErr as Error).message.toLowerCase()).toMatch(/immutable|signal_corrections/);
    const { error: dErr } = await ctx.admin.from("signals").delete().eq("id", s!.id);
    expect(dErr).not.toBeNull();
  });

  it("authorized pipeline can insert a signal that references the exact allowed source message", async () => {
    const { sessionId, messageId } = await newSessionWithNormalTurn(ctx.userA);
    const { data: s, error } = await pipelineSignal(ctx.userA.id, sessionId, messageId);
    expect(error).toBeNull();
    expect(s?.id).toBeTruthy();
    const { data: fresh } = await ctx.admin.from("signals").select("source_message_id,user_id").eq("id", s!.id).single();
    expect(fresh?.source_message_id).toBe(messageId);
    expect(fresh?.user_id).toBe(ctx.userA.id);
  });

  it("user correction path: signal_corrections is append-only and owner-scoped", async () => {
    const { sessionId, messageId } = await newSessionWithNormalTurn(ctx.userA);
    const { data: s } = await pipelineSignal(ctx.userA.id, sessionId, messageId);
    // A can append.
    const { data: c1, error: c1Err } = await ctx.userA.client.from("signal_corrections").insert({
      signal_id: s!.id, user_id: ctx.userA.id, correction_kind: "disagree", note: "That's not what I meant.",
    }).select("id").single();
    expect(c1Err).toBeNull();
    expect(c1?.id).toBeTruthy();
    // A cannot mutate that correction — no UPDATE/DELETE policy exists, so
    // PostgREST returns 0 rows silently. Confirm the row is unchanged either
    // way (belt & braces).
    const { data: uRows } = await ctx.userA.client.from("signal_corrections")
      .update({ note: "revised" }).eq("id", c1!.id).select("id");
    expect((uRows ?? []).length).toBe(0);
    const { data: dRows } = await ctx.userA.client.from("signal_corrections")
      .delete().eq("id", c1!.id).select("id");
    expect((dRows ?? []).length).toBe(0);
    const { data: still } = await ctx.admin.from("signal_corrections")
      .select("note").eq("id", c1!.id).single();
    expect(still?.note).toBe("That's not what I meant.");
    // B cannot append a correction to A's signal.
    const { error: bErr } = await ctx.userB.client.from("signal_corrections").insert({
      signal_id: s!.id, user_id: ctx.userB.id, correction_kind: "disagree", note: "hostile",
    });
    expect(bErr).not.toBeNull();
  });
});

describe("pattern_evidence write contract — server-write-only", () => {
  it("authenticated User A cannot directly INSERT pattern_evidence", async () => {
    const { data: pat } = await ctx.admin.from("patterns").insert({
      user_id: ctx.userA.id, idempotency_key: `pe-${Date.now()}`, title: "t", lifecycle: "proposed",
    }).select("id").single();
    const { sessionId, messageId } = await newSessionWithNormalTurn(ctx.userA);
    void sessionId;
    const { error } = await ctx.userA.client.from("pattern_evidence").insert({
      pattern_id: pat!.id, user_id: ctx.userA.id, kind: "supporting", source_message_id: messageId,
    });
    expect(error).not.toBeNull();
    expect((error as Error).message.toLowerCase()).toMatch(/permission denied|row-level security/);
  });

  it("authenticated User A cannot UPDATE or DELETE pattern_evidence", async () => {
    const { data: pat } = await ctx.admin.from("patterns").insert({
      user_id: ctx.userA.id, idempotency_key: `pe-${Date.now()}-u`, title: "t", lifecycle: "proposed",
    }).select("id").single();
    const { sessionId, messageId } = await newSessionWithNormalTurn(ctx.userA);
    void sessionId;
    const { data: ev } = await ctx.admin.from("pattern_evidence").insert({
      pattern_id: pat!.id, user_id: ctx.userA.id, kind: "supporting", source_message_id: messageId,
    }).select("id").single();
    const { data: uRows } = await ctx.userA.client.from("pattern_evidence")
      .update({ kind: "counter" }).eq("id", ev!.id).select("id");
    expect((uRows ?? []).length).toBe(0);
    const { data: dRows } = await ctx.userA.client.from("pattern_evidence")
      .delete().eq("id", ev!.id).select("id");
    expect((dRows ?? []).length).toBe(0);
    // Row still present.
    const { data: still } = await ctx.admin.from("pattern_evidence").select("id,kind").eq("id", ev!.id).single();
    expect(still?.id).toBe(ev!.id);
    expect(still?.kind).toBe("supporting");
  });

  it("owner may still SELECT their own pattern_evidence", async () => {
    const { data: pat } = await ctx.admin.from("patterns").insert({
      user_id: ctx.userA.id, idempotency_key: `pe-${Date.now()}-s`, title: "t", lifecycle: "proposed",
    }).select("id").single();
    const { sessionId, messageId } = await newSessionWithNormalTurn(ctx.userA);
    void sessionId;
    await ctx.admin.from("pattern_evidence").insert({
      pattern_id: pat!.id, user_id: ctx.userA.id, kind: "supporting", source_message_id: messageId,
    });
    const { data: rows } = await ctx.userA.client.from("pattern_evidence")
      .select("id").eq("pattern_id", pat!.id);
    expect((rows ?? []).length).toBeGreaterThanOrEqual(1);
    // B cannot read them.
    const { data: rowsB } = await ctx.userB.client.from("pattern_evidence")
      .select("id").eq("pattern_id", pat!.id);
    expect((rowsB ?? []).length).toBe(0);
  });
});
