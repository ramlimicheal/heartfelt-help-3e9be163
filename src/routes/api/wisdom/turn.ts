/**
 * Checkpoint 3B — SSE route for the unified Wisdom turn.
 *
 * Server route (not createServerFn) because we need raw HTTP streaming and
 * bearer-token verification independent of TanStack's RPC protocol.
 *
 * Flow:
 *   1. Verify bearer token → user id.
 *   2. Zod-parse body; compute payload + user-text hashes.
 *   3. Atomic per-user rate limit (RPC).
 *   4. Verify session ownership; ensure the triggering user message exists
 *      (insert on first attempt; on retry, verify content hash matches to
 *      detect payload drift → 409).
 *   5. Detect existing turn for this triggering message + payload hash;
 *      replay if completed.
 *   6. Emit `status: processing` frame, run the unified orchestrator, emit
 *      `result` (or `error`) frame, close.
 *
 * Never returns free-form model prose. Every result frame carries a
 * validated UnifiedResult DTO from the orchestrator.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  runUnifiedTurnCore,
  sha256Hex,
} from "@/lib/wisdom/unified.functions";
import { resolveWisdomAccess } from "@/lib/wisdom/gate";
import type { UnifiedMode } from "@/lib/wisdom/unified.schemas";

const BodySchema = z.object({
  sessionId: z.string().uuid(),
  triggeringUserMessageId: z.string().uuid(),
  userText: z.string().min(1).max(8000),
  memoryDirective: z.enum(["normal", "session_only", "do_not_remember"]).default("normal"),
  clientRequestedMode: z.enum(["companion", "pattern", "deep_wisdom", "curse_breaker"]).optional(),
});
type Body = z.infer<typeof BodySchema>;

const RATE_LIMIT = 20; // attempts per rolling 5-minute window per user
const RATE_WINDOW = 300;
const MAX_BODY_BYTES = 32 * 1024;
const RETRY_MAX_ATTEMPTS = 3;

export const Route = createFileRoute("/api/wisdom/turn")({
  server: {
    handlers: {
      POST: async ({ request }) => handlePost(request),
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "authorization, content-type",
          },
        }),
    },
  },
});

async function handlePost(request: Request): Promise<Response> {
  // 1. Auth: verify bearer token
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthenticated" }, 401);
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) return json({ error: "unauthenticated" }, 401);

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return json({ error: "misconfigured" }, 500);

  const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { fetch: makeSupabaseFetch(SUPABASE_PUBLISHABLE_KEY), headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: claims, error: cErr } = await authClient.auth.getClaims(token);
  if (cErr || !claims?.claims?.sub) return json({ error: "unauthenticated" }, 401);
  const userId = claims.claims.sub as string;

  // Gate: authenticated users only (canary removed for beta).
  const decision = resolveWisdomAccess({ authenticated: true });
  if (!decision.allowed) return json({ error: decision.reason }, 401);

  // 2. Body parse
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);
  let body: Body;
  try {
    body = BodySchema.parse(JSON.parse(raw));
  } catch (e) {
    return json({ error: "invalid body", detail: String((e as Error).message).slice(0, 400) }, 400);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 3. Sliding-window rate limit (20 / rolling 5 min). Runs BEFORE any turn/message writes.
  const { data: rl, error: rlErr } = await supabaseAdmin.rpc(
    "wisdom_turn_rate_limit_v2",
    { p_user: userId, p_limit: RATE_LIMIT, p_window_seconds: RATE_WINDOW },
  );
  if (rlErr) return json({ error: "rate_limit_check_failed" }, 500);
  const rlObj = (rl ?? {}) as { allowed?: boolean; retry_after?: number };
  if (rlObj.allowed === false) {
    return new Response(JSON.stringify({ error: "rate_limited", retry_after: rlObj.retry_after ?? 60 }), {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(rlObj.retry_after ?? 60),
      },
    });
  }

  // 4. Session ownership + stored mode
  const { data: sess } = await supabaseAdmin
    .from("sessions")
    .select("id,user_id,mode,mode_locked_at")
    .eq("id", body.sessionId).maybeSingle();
  if (!sess || sess.user_id !== userId) return json({ error: "session not found" }, 404);
  const storedMode = sess.mode as UnifiedMode;

  // 4b. Ensure triggering user message exists; payload-drift check on retry.
  const userTextHash = await sha256Hex(body.userText);
  const { data: existingMsg } = await supabaseAdmin
    .from("messages")
    .select("id,user_id,session_id,role,memory_directive,content")
    .eq("id", body.triggeringUserMessageId)
    .maybeSingle();

  if (existingMsg) {
    if (existingMsg.user_id !== userId || existingMsg.session_id !== body.sessionId || existingMsg.role !== "user") {
      return json({ error: "message_mismatch" }, 409);
    }
    if (existingMsg.content !== body.userText || existingMsg.memory_directive !== body.memoryDirective) {
      return json({ error: "payload_drift" }, 409);
    }
  }

  // 5. Payload hash for drift detection at the turn level
  const inputPayload = {
    sessionId: body.sessionId,
    triggeringUserMessageId: body.triggeringUserMessageId,
    userTextHash,
    memoryDirective: body.memoryDirective,
    clientRequestedMode: body.clientRequestedMode ?? null,
    storedMode,
  };
  const payloadHash = await sha256Hex(JSON.stringify(inputPayload));

  // 5b. Detect existing turn for this triggering message BEFORE inserting the message row.
  let retryTurnId: string | undefined;
  const { data: existingTurn } = await supabaseAdmin
    .from("wisdom_turns")
    .select("id,status,result,artifact_ids,payload_hash,attempt_count,processing_expires_at,memory_directive")
    .eq("triggering_user_message_id", body.triggeringUserMessageId)
    .maybeSingle();

  if (existingTurn) {
    // Drift → 409, no writes.
    if (existingTurn.payload_hash && existingTurn.payload_hash !== payloadHash) {
      return json({ error: "payload_drift" }, 409);
    }
    if (existingTurn.status === "completed") {
      // DNR completed turns intentionally stored no result — do NOT synthesize one.
      if (existingTurn.memory_directive === "do_not_remember") {
        return json({ error: "dnr_no_replay", message: "Do-not-remember results are ephemeral and cannot be replayed." }, 410);
      }
      return sseReplay({
        turnId: existingTurn.id as string,
        result: existingTurn.result,
        artifactIds: existingTurn.artifact_ids,
      });
    }
    if (existingTurn.status === "failed" || existingTurn.status === "processing") {
      // Attempt atomic retry-claim (respects owner, hash, lease-expiry, max attempts).
      const { data: claimRaw, error: claimErr } = await supabaseAdmin.rpc("claim_turn_retry", {
        p_turn_id: existingTurn.id as string,
        p_expected_user: userId,
        p_payload_hash: payloadHash,
        p_max_attempts: RETRY_MAX_ATTEMPTS,
        p_lease_seconds: 120,
      });
      if (claimErr) return json({ error: "retry_claim_failed" }, 500);
      const claim = (claimRaw ?? {}) as { ok?: boolean; reason?: string; attempt?: number };
      if (!claim.ok) {
        if (claim.reason === "payload_drift") return json({ error: "payload_drift" }, 409);
        if (claim.reason === "retry_exhausted") return json({ error: "retry_exhausted", attempt: claim.attempt }, 409);
        if (claim.reason === "processing_active") return json({ error: "processing_active", turnId: existingTurn.id }, 409);
        if (claim.reason === "already_completed") return json({ error: "already_completed", turnId: existingTurn.id }, 409);
        return json({ error: "retry_denied", reason: claim.reason ?? "unknown" }, 409);
      }
      retryTurnId = existingTurn.id as string;
      // Fall through: run the turn again under the same protected turn identity.
    }
  } else {
    // First attempt: insert the triggering message now (immutable thereafter).
    const { error: insErr } = await supabaseAdmin.from("messages").insert({
      id: body.triggeringUserMessageId,
      session_id: body.sessionId,
      user_id: userId,
      role: "user",
      content: body.userText,
      memory_directive: body.memoryDirective,
    });
    if (insErr) return json({ error: "message_insert_failed" }, 500);
  }

  // 6. Stream: processing frame → run → result/error frame
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(new TextEncoder().encode(
          `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
        ));
      };
      send("status", { phase: "processing", mode: storedMode });
      try {
        const outcome = await runUnifiedTurnCore({
          userId,
          sessionId: body.sessionId,
          triggeringUserMessageId: body.triggeringUserMessageId,
          retryTurnId,
          storedSessionMode: storedMode,
          memoryDirective: body.memoryDirective,
          userText: body.userText,
          clientRequestedMode: body.clientRequestedMode,
          inputPayload,
          payloadHash,
        });
        if (outcome.kind === "unsupported") {
          send("error", { error: "unsupported_mode", message: outcome.error });
        } else {
          send("result", {
            turnId: outcome.turnId,
            kind: outcome.kind,
            result: outcome.result,
          });
        }
      } catch (err) {
        // Server-side diagnostics (never sent to client).
        console.error("[wisdom.turn] orchestrator failed", {
          userId,
          sessionId: body.sessionId,
          message: (err as Error)?.message,
          stack: (err as Error)?.stack?.split("\n").slice(0, 5).join(" | "),
        });
        // Never leak stack traces, prompts, model output, or DNR content.
        send("error", { error: "turn_failed", code: "internal_error" });
      } finally {
        send("done", { ok: true });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      "connection": "keep-alive",
    },
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sseReplay(payload: { turnId: string; result: unknown; artifactIds: unknown }) {
  const enc = new TextEncoder();
  const frames =
    `event: status\ndata: ${JSON.stringify({ phase: "replay" })}\n\n` +
    `event: result\ndata: ${JSON.stringify({ turnId: payload.turnId, kind: "reused", result: payload.result, artifactIds: payload.artifactIds })}\n\n` +
    `event: done\ndata: ${JSON.stringify({ ok: true })}\n\n`;
  return new Response(new ReadableStream({
    start(c) { c.enqueue(enc.encode(frames)); c.close(); },
  }), {
    status: 200,
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
  });
}

function makeSupabaseFetch(key: string): typeof fetch {
  const isNew = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNew && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}
