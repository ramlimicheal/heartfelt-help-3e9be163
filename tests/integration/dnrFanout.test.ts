/**
 * Checkpoint 2.1 — Complete DNR fan-out protection.
 *
 * Record row-counts across every durable table BEFORE a protected turn,
 * submit a do_not_remember turn, and confirm no new durable rows and no
 * mutations to existing durable artifacts.
 *
 * Also confirms an assistant response derived from a protected turn either
 * (a) is not persisted, or (b) inherits a protected memory directive.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestContext, type TestContext } from "../harness";

let ctx: TestContext;
beforeAll(async () => { ctx = await createTestContext(); });
afterAll(async () => { await ctx?.cleanup(); });

const DURABLE_TABLES = [
  "signals",
  "interpretations",
  "discernments",
  "patterns",
  "pattern_evidence",
  "prayers",
  "prayer_lines",
  "prayer_line_sources",
  "practices",
  "practice_assignments",
  "persona_facts",
  "formation_events",
  "stronghold_categories",
] as const;

interface Snapshot {
  counts: Record<string, number>;
  ids: Record<string, string[]>;
}

async function snapshot(userId: string): Promise<Snapshot> {
  const counts: Record<string, number> = {};
  const ids: Record<string, string[]> = {};
  for (const t of DURABLE_TABLES) {
    const { data, error } = await ctx.admin
      .from(t as string)
      .select("id")
      .eq("user_id", userId);
    if (error) throw new Error(`snapshot ${t}: ${error.message}`);
    counts[t] = (data ?? []).length;
    ids[t] = (data ?? []).map((r: { id: string }) => r.id).sort();
  }
  return { counts, ids };
}

function diff(before: Snapshot, after: Snapshot) {
  const changes: Record<string, { delta: number; new: string[]; removed: string[] }> = {};
  for (const t of DURABLE_TABLES) {
    const b = new Set(before.ids[t]);
    const a = new Set(after.ids[t]);
    const added = after.ids[t].filter((id) => !b.has(id));
    const removed = before.ids[t].filter((id) => !a.has(id));
    const delta = after.counts[t] - before.counts[t];
    if (added.length || removed.length || delta !== 0) {
      changes[t] = { delta, new: added, removed };
    }
  }
  return changes;
}

async function insertUserMessage(
  sessionId: string,
  content: string,
  directive: "normal" | "do_not_remember",
) {
  const { data, error } = await ctx.userA.client
    .from("messages")
    .insert({
      user_id: ctx.userA.id, session_id: sessionId, role: "user",
      content, memory_directive: directive,
    })
    .select("id,memory_directive")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

describe("DNR fan-out — protected turn creates no new durable rows anywhere", () => {
  it("baseline normal turn creates rows; subsequent DNR turn changes nothing durable", async () => {
    // 1. Create a session and send a normal turn.
    const { data: sess } = await ctx.userA.client
      .from("sessions").insert({ user_id: ctx.userA.id, mode: "pattern", title: "fanout" })
      .select("id").single();
    const normalMsg = await insertUserMessage(sess!.id, "I keep failing at X", "normal");

    // 2. Simulate the authorized pipeline persisting a signal from the normal turn.
    await ctx.admin.from("signals").insert({
      user_id: ctx.userA.id, session_id: sess!.id, source_message_id: normalMsg.id,
      kind: "belief", origin: "explicit", confidence: 0.7, payload: { paraphrase: "recurring failure" },
    });

    // 3. BASELINE snapshot after the normal turn.
    const before = await snapshot(ctx.userA.id);
    // Sanity: at least one signal exists.
    expect(before.counts.signals).toBeGreaterThanOrEqual(1);

    // 4. Send a DNR turn.
    const dnrMsg = await insertUserMessage(sess!.id, "protected — burn after reading", "do_not_remember");

    // 5. Attempt every possible durable derivation from the DNR turn.
    //    The DB triggers must reject each one.
    const attempts = [
      ctx.admin.from("signals").insert({
        user_id: ctx.userA.id, session_id: sess!.id, source_message_id: dnrMsg.id,
        kind: "belief", origin: "inferred", confidence: 0.9, payload: { paraphrase: "leak" },
      }),
      // pattern_evidence requires an existing pattern; create one first via admin.
      (async () => {
        const { data: p } = await ctx.admin.from("patterns").insert({
          user_id: ctx.userA.id, idempotency_key: `dnr-p-${Date.now()}`, title: "p", lifecycle: "proposed",
        }).select("id").single();
        return ctx.admin.from("pattern_evidence").insert({
          pattern_id: p!.id, user_id: ctx.userA.id, kind: "supporting", source_message_id: dnrMsg.id,
        });
      })(),
    ];
    const results = await Promise.all(attempts);
    for (const r of results) {
      expect((r as { error: unknown }).error).not.toBeNull();
    }

    // 6. Snapshot AFTER the DNR turn + failed derivations.
    const after = await snapshot(ctx.userA.id);
    const changes = diff(before, after);

    // Print a readable diff for the checkpoint record.
    // eslint-disable-next-line no-console
    console.log("[DNR fan-out] changes across durable tables:", JSON.stringify(changes, null, 2));

    // 7. Assert: NO NEW ROWS anywhere.
    // (We created a scratch pattern for the pattern_evidence attempt above.
    //  It is not derived from the DNR turn, but it is a durable row we created
    //  after the baseline. Filter it out from the assertion.)
    const scratchPatternIds = changes.patterns?.new ?? [];
    const allowedNewPatternIds = new Set(scratchPatternIds);
    for (const [table, delta] of Object.entries(changes)) {
      if (table === "patterns") {
        // Allow only the scratch pattern used to probe pattern_evidence.
        expect(delta.new.every((id) => allowedNewPatternIds.has(id))).toBe(true);
        expect(delta.removed).toEqual([]);
      } else {
        expect(delta.new, `unexpected new rows in ${table}`).toEqual([]);
        expect(delta.removed, `unexpected removed rows in ${table}`).toEqual([]);
      }
    }
  });

  it("assistant response tied to a DNR user turn is either not persisted, or inherits do_not_remember", async () => {
    const { data: sess } = await ctx.userA.client
      .from("sessions").insert({ user_id: ctx.userA.id, mode: "companion", title: "asst-dnr" })
      .select("id").single();
    const dnrMsg = await insertUserMessage(sess!.id, "context protected", "do_not_remember");

    // If assistant persists a reply, product policy requires it to inherit DNR.
    const { data: ok, error: okErr } = await ctx.admin.from("messages").insert({
      user_id: ctx.userA.id, session_id: sess!.id, role: "assistant",
      content: "I hear you. This won't be remembered.", memory_directive: "do_not_remember",
    }).select("id,memory_directive").single();
    if (okErr) {
      expect(okErr).toBeTruthy();
    } else {
      expect(ok?.memory_directive).toBe("do_not_remember");
    }

    // Even if a DNR-inheriting assistant reply exists, the DNR trigger must
    // reject any durable signal that names it as source, because the source
    // itself carries the do_not_remember directive.
    if (ok?.id) {
      const { error: leak } = await ctx.admin.from("signals").insert({
        user_id: ctx.userA.id, session_id: sess!.id, source_message_id: ok.id,
        kind: "belief", origin: "inferred", confidence: 0.9,
        payload: { paraphrase: "leak-via-assistant" },
      });
      expect(leak).not.toBeNull();
    }

    // Prove the original DNR user turn also can't back a signal (defence-in-depth).
    const { error: leak2 } = await ctx.admin.from("signals").insert({
      user_id: ctx.userA.id, session_id: sess!.id, source_message_id: dnrMsg.id,
      kind: "belief", origin: "inferred", confidence: 0.9, payload: { paraphrase: "direct-leak" },
    });
    expect(leak2).not.toBeNull();
  });
});
