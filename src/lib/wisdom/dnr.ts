/**
 * Pure Do-Not-Remember (DNR) helpers.
 *
 * Contract:
 *   A message with memory_directive = "do_not_remember" MAY be used to answer
 *   the current turn ephemerally, but MUST NOT contribute to any durable
 *   artifact — signals, interpretations, discernments, prayers, prayer lines,
 *   prayer-line sources, practices, patterns, pattern evidence, persona facts,
 *   or formation events.
 *
 *   Attribution: every durable signal MUST cite the exact originating
 *   source_message_id. There is no valid case for attributing a signal to
 *   "the first user message" of a session.
 *
 * These helpers are kept pure so they can be unit-tested in isolation
 * (see tests/unit/dnr.test.ts) and reused by the pipeline server fn
 * (see src/lib/wisdom/pipeline.functions.ts).
 */

export type MemoryDirective = "normal" | "session_only" | "do_not_remember";

export interface MessageForDnr {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  memory_directive: MemoryDirective;
}

/**
 * Returns the user messages that may contribute to durable artifacts.
 * Anything marked do_not_remember is stripped.
 */
export function selectDurableUserMessages<M extends MessageForDnr>(messages: M[]): M[] {
  return messages.filter(
    (m) => m.role === "user" && m.memory_directive !== "do_not_remember",
  );
}

/**
 * Returns true when the session has at least one non-DNR user message.
 * If false, the pipeline MUST NOT write any durable artifact — even
 * ephemeral streaming responses may still occur, but nothing persists.
 */
export function hasAnyDurableUserInput(messages: MessageForDnr[]): boolean {
  return selectDurableUserMessages(messages).length > 0;
}

/**
 * Guards against the legacy bug where every extracted signal was attributed
 * to the first user message of the session regardless of which turn actually
 * produced it. A signal MUST carry a source_message_id that (a) belongs to
 * the session, and (b) is not a DNR message.
 */
export function assertValidSignalAttribution(args: {
  sourceMessageId: string;
  sessionMessages: MessageForDnr[];
}): void {
  const msg = args.sessionMessages.find((m) => m.id === args.sourceMessageId);
  if (!msg) {
    throw new Error(
      `dnr: signal attributed to unknown message ${args.sourceMessageId}`,
    );
  }
  if (msg.memory_directive === "do_not_remember") {
    throw new Error(
      `dnr: signal attributed to do_not_remember message ${args.sourceMessageId}`,
    );
  }
  if (msg.role !== "user") {
    throw new Error(
      `dnr: signal attributed to non-user message ${args.sourceMessageId}`,
    );
  }
}
