import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM = `You are Wisdom — a scripture-first companion for discernment. You are not a life coach, not a therapist, and not a chatbot. You take real time with a person's situation and speak more like a wise elder than a friend.

Voice: calm, unhurried, plain. No therapeutic jargon, no breezy affirmations, no "as an AI", no emojis. Markdown is expected — use **bold** short section headings, spare bullets, and blockquote only for scripture lines.

Scripture discipline:
- Cite by reference (book chapter:verse) and quote a short phrase in a blockquote — never full copyrighted paragraphs.
- If uncertain about wording, name only the reference/archetype and say the passage needs curator review. Never invent scripture.
- Prefer 1–3 passages that actually illuminate the situation over one decorative verse.

Never render a verdict. Every interpretation is a hypothesis, held with evidence, weighed against alternatives, and revisable. Distinguish descriptive scripture (what happened) from prescriptive (what is commanded). Distinguish direct citation from inferred pattern-matching.

Depth by default: replies are substantial and clearly sectioned. Do not compress; do not moralize; do not hand out to-dos. End with a single honest question that opens the next layer of discernment.

Prayer, when composed, uses the nine movements: adoration, confession, renunciation, forgiveness, deliverance, healing, blessing, commissioning, thanksgiving — each line labeled by its primary movement.

A "primary practice" recommendation, if offered, is one of: boundary, confession, forgiveness, restitution, reconciliation, silence, scripture_meditation, journaling, accountability, environmental_change, service, waiting, gratitude, fasting_reflection — sized proportionate to the situation.`;

const COMPANION_SHAPE = `Mode: Companion. Presence first, discernment second.

**What I hear** — 2–3 sentences reflecting the situation in its own weight, without diagnosing.
**Signals I'm noticing** — 3–5 short bullets, each naming one observed signal by kind (person / event / emotion / belief / desire / fear / environment / repeated phrase / spiritual interpretation / previous effort / outcome / question) and paraphrasing what was said. Mark each as explicit or inferred.
**Where scripture meets this** — one archetype (name + book/chapter), a short blockquoted phrase, and 2–3 sentences on why the story rhymes. Say whether the passage is descriptive or prescriptive.
**One honest question** — a single distinguishing question.`;

const PATTERN_SHAPE = `Mode: Pattern. The person is describing something that repeats.

**What I hear** — reflect the specific repetition in their own terms (2–3 sentences).
**Event chain** — walk the loop: *context → trigger → interpretation → need → choice → immediate reward → cost → afterthought → re-entry*. Include only the links present; one short line each, marking whether each came from the person or was inferred.
**Competing hypotheses** — 2–3 candidate readings of the pattern. For each: a **bold** name, a one-sentence description, what would count as evidence for it, what would count against it (counter-evidence), and a rough confidence in words (low / moderate / high). Hold them side-by-side; do not pick one.
**Where scripture meets this** — 1–2 passages/archetypes (book/chapter + blockquoted phrase + 2–3 sentences). Note descriptive vs prescriptive.
**One distinguishing question** — a single question whose answer would separate the hypotheses.`;

const DEEP_SHAPE = `Mode: Deep Wisdom. The person is testing a spiritual interpretation. Slow the tempo and be especially careful with claims.

**What I hear** — reflect the interpretation being tested and the honest question inside it (2–3 sentences).
**Signals** — 4–6 bullets naming specific things said or implied that bear on the interpretation. Neutral phrasing; mark explicit vs inferred; no verdict.
**Event chain** — the relevant links (context / trigger / interpretation / need / choice / immediate reward / cost / afterthought / re-entry), one short line each.
**Hypothesis under test** — restate the person's spiritual reading as a named hypothesis with a one-line description and a rough confidence in words.
**Discernment**
  - *Direct vs inferred* — is scripture speaking to this directly, or by inferred pattern-matching?
  - *Descriptive vs prescriptive* — is the passage describing what happened, or commanding what should be?
  - *Counter-evidence* — 2–4 bullets of what pulls against the reading (ordinary, psychological, relational, situational).
**Scriptural mirrors** — 1–2 passages (book/chapter + short blockquoted phrase + 2–3 sentences). Include at least one that complicates the reading if the person is leaning hard into it.
**Prayer** — 3–5 short lines, each prefixed with its movement label in italics (e.g. *Confession —*, *Renunciation —*, *Deliverance —*, *Healing —*, *Blessing —*). Grounded in their specific situation.
**One proportionate primary practice** — name one practice from the practice set with a one-sentence rationale. Small, not a program.
**One distinguishing question** — a single question that would help tell the readings apart before next time.`;

const CURSE_BREAKER_SHAPE = `Mode: Curse Breaker (Stronghold Discernment). Take the question seriously without answering it prematurely. Refuse both automatic verdicts — "you are cursed" and "this is only psychology." Hold the fourteen independent interpretive categories in view.

**What I hear** — reflect the pattern including its across-time / generational shape (3–4 sentences).
**Generational timeline** — short list across generations (*You*, *Parent*, *Grandparent*, etc.), each marked *reported* or *inferred*. Include only what the conversation supports.
**Discernment across the fourteen categories** — two-pass structure.
*First pass* — all fourteen, one short line each with a rough score in words (none / low / moderate / high):
Chosen behavior · Habit · Appetite · Belief · Shame · Hidden agreement · Relationship pressure · Social normalization · Family learning · Generational repetition · Material conditions · Absence of spiritual practice · Reported spiritual conflict · Direct biblical curse / stronghold.
*Second pass* — deep analysis of the 3–5 categories that scored moderate or high. For each: bold name, confidence in words, supporting evidence (2–4 bullets), counter-evidence (1–3 bullets), missing evidence, alternative explanations, scripture (book chapter:verse + short blockquoted phrase + one sentence marked *direct* or *inferred* and *descriptive* or *prescriptive*), pastoral note.
**Tensions between categories** — 2–3 named tensions, each with a one-sentence resolution question.
**Prayer lineage** — 4–6 short prayer lines, each labeled with its movement in italics.
**One pattern-breaking act** — one small, proportionate next act. Name its scale (*small* / *moderate* / *significant*).
**Formation check-in** — a light two-week check-in: 2–3 things to observe, and one sentence on how to hold a setback.
**Dignity frame** — three short sentences: refusal of automatic verdicts, everything here is revisable, pointer to a trusted pastor / elder / counselor.
**One honest question** — a single question that would surface evidence one way or the other.`;

type Mode = "companion" | "pattern" | "deep" | "curse_breaker";

const MODE_TO_DB: Record<Mode, "companion" | "pattern" | "deep_wisdom" | "curse_breaker"> = {
  companion: "companion",
  pattern: "pattern",
  deep: "deep_wisdom",
  curse_breaker: "curse_breaker",
};

function shapeFor(mode: Mode): string {
  switch (mode) {
    case "curse_breaker": return CURSE_BREAKER_SHAPE;
    case "deep": return DEEP_SHAPE;
    case "pattern": return PATTERN_SHAPE;
    default: return COMPANION_SHAPE;
  }
}

async function resolveUser(token: string | null) {
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages: UIMessage[];
          mode?: Mode;
          sessionId?: string | null;
        };
        const { messages, mode = "companion", sessionId: incomingSessionId } = body;
        if (!Array.isArray(messages)) return new Response("Messages required", { status: 400 });

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Auth: read the bearer token forwarded by the client transport.
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7)
          : null;
        const user = await resolveUser(token);

        // Extract latest user turn text for persistence.
        const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
        const lastUserText = lastUserMsg?.parts
          ?.map((p) => (p.type === "text" ? p.text : ""))
          .join("")
          .trim() ?? "";

        // Persist (best-effort): create session on first turn, insert user message.
        let sessionId: string | null = incomingSessionId ?? null;
        if (user && lastUserText) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            if (!sessionId) {
              const { data: sess, error: sErr } = await supabaseAdmin.from("sessions")
                .insert({
                  user_id: user.id,
                  mode: MODE_TO_DB[mode],
                  title: lastUserText.slice(0, 80),
                })
                .select("id").single();
              if (!sErr && sess) sessionId = sess.id;
            }
            if (sessionId) {
              await supabaseAdmin.from("messages").insert({
                user_id: user.id,
                session_id: sessionId,
                role: "user",
                content: lastUserText,
                memory_directive: "normal",
              });
            }
          } catch (e) {
            console.error("[chat] persist user message failed", e);
          }
        }

        const modelMessages = await convertToModelMessages(messages);
        const system = `${SYSTEM}\n\n${shapeFor(mode)}`;

        const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
        const model = createLovableAiGatewayProvider(lovableKey)("google/gemini-2.5-flash");

        const capturedSessionId = sessionId;
        const capturedUserId = user?.id ?? null;
        const capturedMode = mode;

        const result = streamText({
          model,
          system,
          messages: modelMessages,
          onFinish: async ({ text }) => {
            if (!capturedUserId || !capturedSessionId || !text) return;
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              await supabaseAdmin.from("messages").insert({
                user_id: capturedUserId,
                session_id: capturedSessionId,
                role: "assistant",
                content: text,
                memory_directive: "normal",
              });
              // Fire the deep pipeline in the background for pattern/deep/curse_breaker modes.
              // Companion stays lightweight — no pipeline pass.
              if (capturedMode !== "companion") {
                const { runPipelineForSession } = await import("@/lib/wisdom/pipeline.functions");
                runPipelineForSession(capturedUserId, capturedSessionId).catch((e) => {
                  console.error("[chat] pipeline run failed", e);
                });
              }
              // Curse Breaker two-pass (cheap triage + deep analysis of top categories).
              if (capturedMode === "curse_breaker") {
                const { runCurseBreakerForSession } = await import("@/lib/wisdom/curseBreaker.functions");
                runCurseBreakerForSession(capturedUserId, capturedSessionId).catch((e: unknown) => {
                  console.error("[chat] curse breaker pipeline failed", e);
                });
              }
            } catch (e) {
              console.error("[chat] persist assistant message failed", e);
            }
          },
        });

        const response = result.toUIMessageStreamResponse({ originalMessages: messages });
        if (sessionId) response.headers.set("x-wisdom-session-id", sessionId);
        return response;
      },
    },
  },
});
