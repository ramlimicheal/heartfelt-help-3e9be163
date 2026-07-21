/**
 * Browser client for /api/wisdom/turn SSE stream.
 * Uses fetch + ReadableStream (EventSource is GET-only).
 */
import { supabase } from "@/integrations/supabase/client";
import type { UnifiedResult } from "./unified.schemas";

export type TurnEvent =
  | { type: "status"; phase: "processing" | "replay"; mode?: string }
  | { type: "result"; turnId: string; kind: "created" | "reused"; result: UnifiedResult; artifactIds?: unknown }
  | { type: "error"; error: string; message?: string }
  | { type: "done" };

export type StartTurnInput = {
  sessionId: string;
  triggeringUserMessageId: string;
  userText: string;
  memoryDirective?: "normal" | "session_only" | "do_not_remember";
  clientRequestedMode?: "companion" | "pattern" | "deep_wisdom" | "curse_breaker";
};

export async function* streamUnifiedTurn(
  input: StartTurnInput,
  signal?: AbortSignal,
): AsyncGenerator<TurnEvent, void, void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not_authenticated");

  const res = await fetch("/api/wisdom/turn", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
    signal,
  });

  if (!res.ok || !res.body) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.error ?? msg; } catch { /* ignore */ }
    yield { type: "error", error: `http_${res.status}`, message: msg };
    yield { type: "done" };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const parsed = parseFrame(frame);
      if (parsed) yield parsed;
    }
  }
  yield { type: "done" };
}

function parseFrame(frame: string): TurnEvent | null {
  let event = "message";
  let dataLine = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return null;
  try {
    const data = JSON.parse(dataLine);
    if (event === "status") return { type: "status", ...data };
    if (event === "result") return { type: "result", ...data };
    if (event === "error") return { type: "error", ...data };
    if (event === "done") return { type: "done" };
  } catch {
    return null;
  }
  return null;
}
