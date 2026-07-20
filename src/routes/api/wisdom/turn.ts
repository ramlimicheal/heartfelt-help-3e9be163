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
  isUnifiedTurnEnabled,
  runUnifiedTurnCore,
  sha256Hex,
} from "@/lib/wisdom/unified.functions";
import type { UnifiedMode } from "@/lib/wisdom/unified.schemas";

const BodySchema = z.object({
  sessionId: z.string().uuid(),
  triggeringUserMessageId: z.string().uuid(),
  userText: z.string().min(1).max(8000),
  memoryDirective: z.enum(["normal", "session_only", "do_not_remember"]).default("normal"),
  clientRequestedMode: z.enum(["companion", "pattern", "deep_wisdom", "curse_breaker"]).optional(),
});
type Body = z.infer<typeof BodySchema>;

const RATE_LIMIT = 30; // turns per minute per user
const RATE_WINDOW = 60;
const MAX_BODY_BYTES = 32 * 1024;

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
  if (!isUnifiedTurnEnabled()) {
    return json({ error: "unified turn disabled" }, 503);
  }

  // 1. Auth: verify bearer token
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) return json({ error: "unauthorized" }, 401);

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return json({ error: "misconfigured" }, 500);

  const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { fetch: makeSupabaseFetch(SUPABASE_PUBLISHABLE_KEY), headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: claims, error: cErr } = await authClient.auth.getClaims(token);
  if (cErr || !claims?.claims?.sub) return json({ error: "unauthorized" }, 401);
  const userId = claims.claims.sub as string;

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

  // 3. Atomic rate limit
  const { data: allowed, error: rlErr } = await supabaseAdmin.rpc(
    "wisdom_turn_rate_limit_check",
    { p_user: userId, p_limit: RATE_LIMIT, p_window_seconds: RATE_WINDOW },
  );
  if (rlErr) return json({ error: "rate_limit_check_failed" }, 500);
  if (allowed === false) return json({ error: "rate_limited" }, 429);

  // 4. Session ownership + stored mode
  const { data: sess } = await supabaseAdmin
    .from("sessions")
    .select("id,user_id,mode,mode_locked_at")
    .eq("id", body.sessionId).maybeSingle();
  if (!sess || sess.user_id !== userId) return json({ error: "session not found" }, 404);
  const storedMode = sess.mode as UnifiedMode | "curse_breaker";
  if (storedMode === "curse_breaker") {
    return json({ error: "curse_breaker_unavailable", message: "Curse Breaker taxonomy upgrade pending." }, 409);
  }

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
    // messages are immutable; compare content to detect drift
    if (existingMsg.content !== body.userText || existingMsg.memory_directive !== body.memoryDirective) {
      return json({ error: "payload_drift" }, 409);
    }
  } else {
    const { error: insErr } = await supabaseAdmin.from("messages").insert({
      id: body.triggeringUserMessageId,
      session_id: body.sessionId,
      user_id: userId,
      role: "user",
      content: body.userText,
      memory_directive: body.memoryDirective,
    });
    if (insErr) return json({ error: "message_insert_failed", detail: insErr.message.slice(0, 200) }, 500);
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

  // 5b. Detect existing turn for this triggering message
  const { data: existingTurn } = await supabaseAdmin
    .from("wisdom_turns")
    .select("id,status,result,artifact_ids,payload_hash")
    .eq("triggering_user_message_id", body.triggeringUserMessageId)
    .maybeSingle();
  if (existingTurn) {
    if (existingTurn.payload_hash && existingTurn.payload_hash !== payloadHash) {
      return json({ error: "payload_drift" }, 409);
    }
    if (existingTurn.status === "completed") {
      return sseReplay({
        turnId: existingTurn.id as string,
        result: existingTurn.result,
        artifactIds: existingTurn.artifact_ids,
      });
    }
    if (existingTurn.status === "failed") {
      return json({ error: "prior_attempt_failed", turnId: existingTurn.id }, 409);
    }
    // status === 'processing' → let the new call race with the unique index
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
      } catch (e) {
        send("error", { error: "turn_failed", message: String((e as Error).message ?? e).slice(0, 400) });
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
