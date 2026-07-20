import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestContext, type TestContext } from "../harness";

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx?.cleanup();
});

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
      user_id: user.id,
      session_id: sessionId,
      role: "user",
      content,
      memory_directive: directive,
    })
    .select("id,memory_directive")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

describe("DNR integration — RLS + triggers exercised via authed clients", () => {
  it("normal message can produce a durable signal attributed to itself", async () => {
    const sess = await createSession(ctx.userA, "pattern");
    const msg = await insertUserMessage(ctx.userA, sess.id, "I keep failing at X");
    const { error } = await ctx.userA.client.from("signals").insert({
      user_id: ctx.userA.id,
      session_id: sess.id,
      source_message_id: msg.id,
      kind: "belief",
      origin: "explicit",
      confidence: 0.7,
      payload: { paraphrase: "recurring failure" },
    });
    expect(error).toBeNull();

    const { data: signals } = await ctx.userA.client
      .from("signals")
      .select("id,source_message_id")
      .eq("session_id", sess.id);
    expect(signals?.length).toBe(1);
    expect(signals?.[0].source_message_id).toBe(msg.id);
  });

  it("DNR message cannot back a durable signal (DB trigger blocks it)", async () => {
    const sess = await createSession(ctx.userA, "companion");
    const dnr = await insertUserMessage(ctx.userA, sess.id, "burn after reading", "do_not_remember");
    const { error } = await ctx.userA.client.from("signals").insert({
      user_id: ctx.userA.id,
      session_id: sess.id,
      source_message_id: dnr.id,
      kind: "belief",
      origin: "explicit",
      confidence: 0.7,
      payload: { paraphrase: "should be blocked" },
    });
    expect(error).not.toBeNull();
    expect((error as Error).message.toLowerCase()).toMatch(/do_not_remember|cannot derive/);
  });

  it("later DNR turn cannot leak into a durable signal even when an earlier normal turn exists", async () => {
    const sess = await createSession(ctx.userA, "pattern");
    const normal = await insertUserMessage(ctx.userA, sess.id, "first turn is normal");
    const dnr = await insertUserMessage(ctx.userA, sess.id, "second turn is protected", "do_not_remember");
    // Attempt to back a signal by the DNR message — must be blocked.
    const { error: bad } = await ctx.userA.client.from("signals").insert({
      user_id: ctx.userA.id,
      session_id: sess.id,
      source_message_id: dnr.id,
      kind: "emotion",
      origin: "inferred",
      confidence: 0.5,
      payload: { paraphrase: "leak attempt" },
    });
    expect(bad).not.toBeNull();
    // The normal turn attribution still works.
    const { error: ok } = await ctx.userA.client.from("signals").insert({
      user_id: ctx.userA.id,
      session_id: sess.id,
      source_message_id: normal.id,
      kind: "emotion",
      origin: "inferred",
      confidence: 0.5,
      payload: { paraphrase: "kept" },
    });
    expect(ok).toBeNull();
  });

  it("DNR message cannot back a durable pattern_evidence row (DB trigger blocks it)", async () => {
    const sess = await createSession(ctx.userA, "pattern");
    const dnr = await insertUserMessage(ctx.userA, sess.id, "protected", "do_not_remember");
    // Create a pattern owned by user A to have a valid pattern_id.
    const { data: pat, error: pErr } = await ctx.userA.client
      .from("patterns")
      .insert({
        user_id: ctx.userA.id,
        idempotency_key: `pev-${Date.now()}`,
        title: "test pattern",
        lifecycle: "proposed",
      })
      .select("id")
      .single();
    expect(pErr).toBeNull();
    const { error } = await ctx.userA.client.from("pattern_evidence").insert({
      pattern_id: pat!.id,
      user_id: ctx.userA.id,
      kind: "supporting",
      source_message_id: dnr.id,
    });
    expect(error).not.toBeNull();
    expect((error as Error).message.toLowerCase()).toMatch(/do_not_remember|cannot become/);
  });

  it("owner isolation — User B cannot read User A's session, messages, or patterns", async () => {
    const sess = await createSession(ctx.userA, "companion");
    await insertUserMessage(ctx.userA, sess.id, "private content");
    const { data: readSess } = await ctx.userB.client
      .from("sessions")
      .select("id")
      .eq("id", sess.id);
    expect(readSess ?? []).toEqual([]);
    const { data: readMsg } = await ctx.userB.client
      .from("messages")
      .select("id")
      .eq("session_id", sess.id);
    expect(readMsg ?? []).toEqual([]);
  });

  it("owner isolation — User B cannot insert a message into User A's session", async () => {
    const sess = await createSession(ctx.userA, "companion");
    const { error } = await ctx.userB.client.from("messages").insert({
      user_id: ctx.userB.id,
      session_id: sess.id,
      role: "user",
      content: "hostile",
      memory_directive: "normal",
    });
    expect(error).not.toBeNull();
  });
});
