import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestContext, type TestContext } from "../harness";

let ctx: TestContext;
beforeAll(async () => { ctx = await createTestContext(); });
afterAll(async () => { await ctx?.cleanup(); });

async function createSession(user: TestContext["userA"], mode: string) {
  const { data, error } = await user.client
    .from("sessions")
    .insert({ user_id: user.id, mode, title: `t-${mode}` })
    .select("id,mode,mode_locked_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function insertUserMessage(
  user: TestContext["userA"],
  sessionId: string,
  content: string,
  directive: "normal" | "session_only" | "do_not_remember" = "normal",
) {
  const { data, error } = await user.client
    .from("messages")
    .insert({
      user_id: user.id, session_id: sessionId, role: "user", content, memory_directive: directive,
    })
    .select("id,memory_directive")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * The pipeline runs under service_role. We simulate that path with ctx.admin.
 * All safety guards (DNR trigger, ownership check, immutability trigger)
 * still fire under service_role because they are structural, not RLS.
 */
async function pipelineInsertSignal(
  userId: string,
  sessionId: string,
  sourceMessageId: string,
  extras: Partial<Record<string, unknown>> = {},
) {
  return ctx.admin.from("signals").insert({
    user_id: userId,
    session_id: sessionId,
    source_message_id: sourceMessageId,
    kind: "belief",
    origin: "explicit",
    confidence: 0.7,
    payload: { paraphrase: "auto-derived" },
    ...extras,
  });
}

describe("DNR integration — RLS + DB triggers via authed clients", () => {
  it("authorized pipeline can insert a signal attributed to the exact source message", async () => {
    const sess = await createSession(ctx.userA, "pattern");
    const msg = await insertUserMessage(ctx.userA, sess.id, "I keep failing at X");
    const { error } = await pipelineInsertSignal(ctx.userA.id, sess.id, msg.id);
    expect(error).toBeNull();
    const { data: signals } = await ctx.userA.client
      .from("signals")
      .select("id,source_message_id")
      .eq("session_id", sess.id);
    expect(signals?.length).toBe(1);
    expect(signals?.[0].source_message_id).toBe(msg.id);
  });

  it("DNR message cannot back a durable signal even via the pipeline (DB trigger blocks it)", async () => {
    const sess = await createSession(ctx.userA, "companion");
    const dnr = await insertUserMessage(ctx.userA, sess.id, "burn after reading", "do_not_remember");
    const { error } = await pipelineInsertSignal(ctx.userA.id, sess.id, dnr.id);
    expect(error).not.toBeNull();
    expect((error as Error).message.toLowerCase()).toMatch(/do_not_remember|cannot derive/);
  });

  it("later DNR turn cannot leak into a durable signal even when an earlier normal turn exists", async () => {
    const sess = await createSession(ctx.userA, "pattern");
    const normal = await insertUserMessage(ctx.userA, sess.id, "first turn is normal");
    const dnr = await insertUserMessage(ctx.userA, sess.id, "second turn is protected", "do_not_remember");
    const { error: bad } = await pipelineInsertSignal(ctx.userA.id, sess.id, dnr.id);
    expect(bad).not.toBeNull();
    const { error: ok } = await pipelineInsertSignal(ctx.userA.id, sess.id, normal.id, { kind: "emotion", origin: "inferred", confidence: 0.5 });
    expect(ok).toBeNull();
  });

  it("DNR message cannot back a durable pattern_evidence row (DB trigger blocks it)", async () => {
    const sess = await createSession(ctx.userA, "pattern");
    const dnr = await insertUserMessage(ctx.userA, sess.id, "protected", "do_not_remember");
    const { data: pat, error: pErr } = await ctx.admin
      .from("patterns")
      .insert({ user_id: ctx.userA.id, idempotency_key: `pev-${Date.now()}`, title: "test", lifecycle: "proposed" })
      .select("id")
      .single();
    expect(pErr).toBeNull();
    const { error } = await ctx.admin.from("pattern_evidence").insert({
      pattern_id: pat!.id, user_id: ctx.userA.id, kind: "supporting", source_message_id: dnr.id,
    });
    expect(error).not.toBeNull();
    expect((error as Error).message.toLowerCase()).toMatch(/do_not_remember|cannot become/);
  });

  it("owner isolation — User B cannot read User A's session or messages", async () => {
    const sess = await createSession(ctx.userA, "companion");
    await insertUserMessage(ctx.userA, sess.id, "private content");
    const { data: readSess } = await ctx.userB.client.from("sessions").select("id").eq("id", sess.id);
    expect(readSess ?? []).toEqual([]);
    const { data: readMsg } = await ctx.userB.client.from("messages").select("id").eq("session_id", sess.id);
    expect(readMsg ?? []).toEqual([]);
  });

  it("owner isolation — User B cannot insert a message into User A's session", async () => {
    const sess = await createSession(ctx.userA, "companion");
    const { error } = await ctx.userB.client.from("messages").insert({
      user_id: ctx.userB.id, session_id: sess.id, role: "user", content: "hostile", memory_directive: "normal",
    });
    expect(error).not.toBeNull();
  });
});
