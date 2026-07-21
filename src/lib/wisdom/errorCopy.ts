/**
 * User-safe error copy for the Wisdom composer. Never leaks internals.
 * All keys are the coded errors emitted by /api/wisdom/turn and the stream client.
 */
export type WisdomErrorCode =
  | "unauthenticated"
  | "unified_disabled"
  | "canary_denied"
  | "email_unverified"
  | "payload_drift"
  | "processing_active"
  | "already_completed"
  | "retry_exhausted"
  | "retry_denied"
  | "dnr_no_replay"
  | "rate_limited"
  | "session not found"
  | "message_mismatch"
  | "message_insert_failed"
  | "curse_breaker_unavailable"
  | "invalid body"
  | "payload too large"
  | "unsupported_mode"
  | "turn_failed"
  | "network_error"
  | "misconfigured"
  | "unknown";

export type UserSafeError = {
  title: string;
  body: string;
  retryable: boolean;
  retryAfterSeconds?: number;
};

export function mapWisdomError(
  code: string | undefined,
  extra?: { retryAfter?: number },
): UserSafeError {
  const c = (code ?? "unknown") as WisdomErrorCode;
  switch (c) {
    case "unauthenticated":
      return { title: "Sign in required", body: "Please sign in to talk with Wisdom.", retryable: false };
    case "unified_disabled":
      return {
        title: "Private beta",
        body: "Wisdom is currently in a limited private beta. It isn't available on your account yet.",
        retryable: false,
      };
    case "canary_denied":
      return {
        title: "Private beta",
        body: "You aren't on the canary allowlist yet. Wisdom will open more broadly soon.",
        retryable: false,
      };
    case "email_unverified":
      return {
        title: "Verify your email",
        body: "Verify your email before continuing so we can confirm your beta access.",
        retryable: false,
      };
    case "payload_drift":
      return {
        title: "Message changed mid-flight",
        body: "The message content changed between attempts. Start a new message and try again.",
        retryable: false,
      };
    case "processing_active":
      return {
        title: "Still thinking",
        body: "Wisdom is still working on your previous message. Give it a moment.",
        retryable: false,
      };
    case "already_completed":
      return {
        title: "Already answered",
        body: "This message has already been answered. Open the session to see the result.",
        retryable: false,
      };
    case "retry_exhausted":
      return {
        title: "Please start a new message",
        body: "This message has been retried the maximum number of times. Start a new message to continue.",
        retryable: false,
      };
    case "retry_denied":
      return { title: "Cannot retry", body: "This message can't be retried right now.", retryable: false };
    case "dnr_no_replay":
      return {
        title: "Not saved",
        body: "You asked Wisdom not to remember this. The response was ephemeral and can't be replayed.",
        retryable: false,
      };
    case "rate_limited":
      return {
        title: "Please slow down",
        body: `You're sending messages a bit fast. Try again in about ${
          extra?.retryAfter ?? 60
        } seconds.`,
        retryable: true,
        retryAfterSeconds: extra?.retryAfter ?? 60,
      };
    case "session not found":
    case "message_mismatch":
      return {
        title: "Session mismatch",
        body: "Something didn't line up with this session. Try starting a new one.",
        retryable: false,
      };
    case "message_insert_failed":
      return { title: "Couldn't save your message", body: "Please try again.", retryable: true };
    case "curse_breaker_unavailable":
      return {
        title: "Curse Breaker unavailable",
        body: "Curse Breaker is disabled while its taxonomy is being repaired.",
        retryable: false,
      };
    case "invalid body":
      return { title: "Message not accepted", body: "The message couldn't be sent. Please rephrase and try again.", retryable: false };
    case "payload too large":
      return { title: "Message too long", body: "Please shorten your message and try again.", retryable: false };
    case "unsupported_mode":
      return { title: "Mode unavailable", body: "That mode isn't available right now.", retryable: false };
    case "turn_failed":
      return {
        title: "Wisdom couldn't complete",
        body: "Something went wrong on our side. You can try again.",
        retryable: true,
      };
    case "network_error":
      return {
        title: "Connection interrupted",
        body: "We lost the connection while Wisdom was replying. Try again.",
        retryable: true,
      };
    case "misconfigured":
      return {
        title: "Service unavailable",
        body: "Wisdom isn't reachable right now. Please try again later.",
        retryable: false,
      };
    default:
      return { title: "Something went wrong", body: "Please try again.", retryable: true };
  }
}
