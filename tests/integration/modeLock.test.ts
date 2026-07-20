import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestContext, type TestContext } from "../harness";

let ctx: TestContext;
beforeAll(async () => { ctx = await createTestContext(); });
afterAll(async () => { await ctx?.cleanup(); });

async function newSession(user: TestContext["userA"], mode: string) {
  const { data, error } = await user.client
    .from("sessions")
    .insert({ user_id: user.id, mode, title: `t-${mode}` })
    .select("id,mode,mode_locked_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
async function send(user: TestContext["userA"], sessionId: string, content: string) {
  const { data, error } = await user.client
    .from("messages")
    .insert({ user_id: user.id, session_id: sessionId, role: "user", content, memory_directive: "normal" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

describe("mode-lock integration — DB trigger enforces immutability", () => {
  it("first user message locks the mode (mode_locked_at + first_user_message_id populated)", async () => {
    const sess = await newSession(ctx.userA, "pattern");
    expect(sess.mode_locked_at).toBeNull();
    const msg = await send(ctx.userA, sess.id, "opening turn");
    const { data: after } = await ctx.userA.client
      .from("sessions")
      .select("mode,mode_locked_at,first_user_message_id")
      .eq("id", sess.id)
      .single();
    expect(after?.mode).toBe("pattern");
    expect(after?.mode_locked_at).not.toBeNull();
    expect(after?.first_user_message_id).toBe(msg.id);
  });

  it("same-mode retry succeeds (updating with identical mode is allowed)", async () => {
    const sess = await newSession(ctx.userA, "companion");
    await send(ctx.userA, sess.id, "opening");
    const { error } = await ctx.userA.client
      .from("sessions")
      .update({ mode: "companion", title: "renamed" })
      .eq("id", sess.id);
    expect(error).toBeNull();
  });

  it("different-mode update is rejected once the session is locked", async () => {
    const sess = await newSession(ctx.userA, "pattern");
    await send(ctx.userA, sess.id, "opening");
    const { error } = await ctx.userA.client
      .from("sessions")
      .update({ mode: "curse_breaker" })
      .eq("id", sess.id);
    expect(error).not.toBeNull();
    expect((error as Error).message.toLowerCase()).toMatch(/locked/);
  });

  it("mode can still be corrected BEFORE the first user message", async () => {
    const sess = await newSession(ctx.userA, "pattern");
    const { error } = await ctx.userA.client
      .from("sessions")
      .update({ mode: "companion" })
      .eq("id", sess.id);
    expect(error).toBeNull();
  });

  it("owner isolation — User B cannot update User A's session mode", async () => {
    const sess = await newSession(ctx.userA, "pattern");
    // Even before locking, RLS should prevent B from touching A's row.
    const { data: touched, error } = await ctx.userB.client
      .from("sessions")
      .update({ mode: "curse_breaker" })
      .eq("id", sess.id)
      .select("id");
    // Either RLS returns an empty update set, or an error — never a successful mutation.
    expect((touched ?? []).length).toBe(0);
    // No assertion on error being non-null: PostgREST returns [] for RLS-filtered updates.
    expect(true).toBe(true);
    // Confirm A's session is unchanged.
    const { data: check } = await ctx.userA.client
      .from("sessions")
      .select("mode")
      .eq("id", sess.id)
      .single();
    expect(check?.mode).toBe("pattern");
  });

  it("cross-user message insertion is rejected by the lock trigger's owner check", async () => {
    const sess = await newSession(ctx.userA, "pattern");
    const { error } = await ctx.userB.client
      .from("messages")
      .insert({ user_id: ctx.userB.id, session_id: sess.id, role: "user", content: "x", memory_directive: "normal" });
    expect(error).not.toBeNull();
  });
});
