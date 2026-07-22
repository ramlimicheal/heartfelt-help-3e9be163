/**
 * Phase 2B — prayer finalization: DB guard + RLS + library filter.
 *
 * The `finalizePrayer` server function performs the full validation set
 * (ownership, empty check, memory-directive check, missing-citation check,
 * idempotency). Those app-layer branches are asserted by
 * tests/unit/prayerFinalization.test.ts against the source.
 *
 * These integration tests prove the *last line of defense*:
 *   - the DB `prayers_finalize_guard` still rejects a raw UPDATE that
 *     tries to set finalized_at on a prayer whose lines are missing
 *     citations;
 *   - RLS blocks another user from finalizing or seeing another user's
 *     prayer;
 *   - a finalized-only listing (as `listPrayers` does) excludes drafts.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestContext, type TestContext } from "../harness";

let ctx: TestContext;
beforeAll(async () => { ctx = await createTestContext(); });
afterAll(async () => { await ctx?.cleanup(); });

async function makeSession(user: TestContext["userA"], mode = "pattern") {
  const { data, error } = await user.client
    .from("sessions")
    .insert({ user_id: user.id, mode, title: `p2b-${mode}` })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function makePrayer(user: TestContext["userA"], sessionId: string, title = "Test prayer") {
  const { data, error } = await user.client
    .from("prayers")
    .insert({ user_id: user.id, session_id: sessionId, title, mode: "full" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function makeLine(
  user: TestContext["userA"],
  prayerId: string,
  ordering: number,
  text: string,
) {
  const { data, error } = await user.client
    .from("prayer_lines")
    .insert({
      user_id: user.id, prayer_id: prayerId, ordering,
      movement: "blessing", text, confidence: 0.7, user_edited: false,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function citeLine(
  user: TestContext["userA"],
  lineId: string,
  passageId: string,
) {
  const { error } = await user.client
    .from("prayer_line_sources")
    .insert({
      user_id: user.id, prayer_line_id: lineId, passage_id: passageId,
      derivation: "inferred", explanation: "test citation", tier: "S1",
    });
  if (error) throw new Error(error.message);
}

async function pickPassage(): Promise<string> {
  const { data, error } = await ctx.admin
    .from("source_passages")
    .select("id")
    .limit(1)
    .single();
  if (error || !data) throw new Error(`no passages seeded: ${error?.message}`);
  return data.id as string;
}

async function attemptFinalize(user: TestContext["userA"], prayerId: string) {
  return user.client
    .from("prayers")
    .update({ finalized_at: new Date().toISOString() })
    .eq("id", prayerId)
    .is("finalized_at", null)
    .select("id, finalized_at");
}

describe("Phase 2B — prayer finalization DB integrity", () => {
  it("owner can finalize a prayer whose every line has a citation", async () => {
    const passageId = await pickPassage();
    const sess = await makeSession(ctx.userA);
    const prayerId = await makePrayer(ctx.userA, sess);
    const l1 = await makeLine(ctx.userA, prayerId, 1, "Line one.");
    const l2 = await makeLine(ctx.userA, prayerId, 2, "Line two.");
    await citeLine(ctx.userA, l1, passageId);
    await citeLine(ctx.userA, l2, passageId);

    const { data, error } = await attemptFinalize(ctx.userA, prayerId);
    expect(error).toBeNull();
    expect(data?.[0]?.finalized_at).toBeTruthy();
  });

  it("DB guard rejects finalization when any line lacks a citation", async () => {
    const passageId = await pickPassage();
    const sess = await makeSession(ctx.userA);
    const prayerId = await makePrayer(ctx.userA, sess, "Missing citation");
    const l1 = await makeLine(ctx.userA, prayerId, 1, "Cited line.");
    await makeLine(ctx.userA, prayerId, 2, "Uncited line."); // no citation
    await citeLine(ctx.userA, l1, passageId);

    const { error } = await attemptFinalize(ctx.userA, prayerId);
    expect(error).not.toBeNull();
    expect((error as Error).message.toLowerCase()).toMatch(
      /source|citation|prayer_line/,
    );
  });

  it("RLS: another user cannot finalize or read the prayer", async () => {
    const passageId = await pickPassage();
    const sess = await makeSession(ctx.userA);
    const prayerId = await makePrayer(ctx.userA, sess, "Private prayer");
    const l1 = await makeLine(ctx.userA, prayerId, 1, "Only line.");
    await citeLine(ctx.userA, l1, passageId);

    // Cross-user read: RLS hides the row.
    const { data: seen } = await ctx.userB.client
      .from("prayers")
      .select("id")
      .eq("id", prayerId);
    expect(seen ?? []).toEqual([]);

    // Cross-user update: RLS filters WHERE clause to zero rows.
    const { data: updated, error } = await ctx.userB.client
      .from("prayers")
      .update({ finalized_at: new Date().toISOString() })
      .eq("id", prayerId)
      .is("finalized_at", null)
      .select("id, finalized_at");
    expect(error).toBeNull();
    expect(updated ?? []).toEqual([]);

    // Original owner still sees a draft.
    const { data: mine } = await ctx.userA.client
      .from("prayers")
      .select("id, finalized_at")
      .eq("id", prayerId)
      .single();
    expect(mine?.finalized_at).toBeNull();
  });

  it("idempotent: a second UPDATE guarded by is-null returns zero rows", async () => {
    const passageId = await pickPassage();
    const sess = await makeSession(ctx.userA);
    const prayerId = await makePrayer(ctx.userA, sess, "Idempotent");
    const l1 = await makeLine(ctx.userA, prayerId, 1, "Only line.");
    await citeLine(ctx.userA, l1, passageId);

    const first = await attemptFinalize(ctx.userA, prayerId);
    expect(first.error).toBeNull();
    expect(first.data?.[0]?.finalized_at).toBeTruthy();

    const second = await attemptFinalize(ctx.userA, prayerId);
    expect(second.error).toBeNull();
    expect(second.data ?? []).toEqual([]);
  });

  it("library filter: only finalized prayers appear in the listing query", async () => {
    const passageId = await pickPassage();
    // Unique-index prayers_one_draft_per_session forbids two unfinalized
    // prayers in one session — use separate sessions per prayer.
    const draftSess = await makeSession(ctx.userA);
    const draftId = await makePrayer(ctx.userA, draftSess, "Draft only");
    await makeLine(ctx.userA, draftId, 1, "Uncited.");
    // Finalized prayer.
    const finalSess = await makeSession(ctx.userA);
    const finalId = await makePrayer(ctx.userA, finalSess, "Truly finalized");
    const fl = await makeLine(ctx.userA, finalId, 1, "Cited.");
    await citeLine(ctx.userA, fl, passageId);
    const fin = await attemptFinalize(ctx.userA, finalId);
    expect(fin.error).toBeNull();

    // Mirror listPrayers filter: user_id + finalized_at is not null.
    const { data: library } = await ctx.userA.client
      .from("prayers")
      .select("id,title,finalized_at")
      .eq("user_id", ctx.userA.id)
      .not("finalized_at", "is", null);
    const ids = (library ?? []).map((r) => r.id);
    expect(ids).toContain(finalId);
    expect(ids).not.toContain(draftId);
  });
});
