import { describe, it, expect } from "vitest";
import {
  selectDurableUserMessages,
  hasAnyDurableUserInput,
  assertValidSignalAttribution,
  type MessageForDnr,
} from "@/lib/wisdom/dnr";

const M = (over: Partial<MessageForDnr>): MessageForDnr => ({
  id: over.id ?? "m",
  role: over.role ?? "user",
  content: over.content ?? "hi",
  memory_directive: over.memory_directive ?? "normal",
});

describe("dnr helpers", () => {
  it("strips do_not_remember user turns", () => {
    const msgs = [
      M({ id: "1", memory_directive: "normal", content: "a" }),
      M({ id: "2", memory_directive: "do_not_remember", content: "b" }),
      M({ id: "3", memory_directive: "session_only", content: "c" }),
    ];
    expect(selectDurableUserMessages(msgs).map((m) => m.id)).toEqual(["1", "3"]);
  });

  it("hasAnyDurableUserInput = false when every user turn is DNR", () => {
    const msgs = [
      M({ id: "1", memory_directive: "do_not_remember" }),
      M({ id: "2", role: "assistant", memory_directive: "normal" }),
    ];
    expect(hasAnyDurableUserInput(msgs)).toBe(false);
  });

  it("hasAnyDurableUserInput = true when at least one durable user turn exists", () => {
    expect(
      hasAnyDurableUserInput([
        M({ id: "1", memory_directive: "do_not_remember" }),
        M({ id: "2", memory_directive: "normal" }),
      ]),
    ).toBe(true);
  });

  it("assertValidSignalAttribution rejects DNR source", () => {
    const msgs = [M({ id: "1", memory_directive: "do_not_remember" })];
    expect(() =>
      assertValidSignalAttribution({ sourceMessageId: "1", sessionMessages: msgs }),
    ).toThrow(/do_not_remember/);
  });

  it("assertValidSignalAttribution rejects unknown source", () => {
    expect(() =>
      assertValidSignalAttribution({ sourceMessageId: "x", sessionMessages: [] }),
    ).toThrow(/unknown message/);
  });

  it("assertValidSignalAttribution rejects assistant source", () => {
    const msgs = [M({ id: "1", role: "assistant", memory_directive: "normal" })];
    expect(() =>
      assertValidSignalAttribution({ sourceMessageId: "1", sessionMessages: msgs }),
    ).toThrow(/non-user/);
  });

  it("assertValidSignalAttribution accepts a normal user turn", () => {
    const msgs = [M({ id: "1", memory_directive: "normal" })];
    expect(() =>
      assertValidSignalAttribution({ sourceMessageId: "1", sessionMessages: msgs }),
    ).not.toThrow();
  });
});
