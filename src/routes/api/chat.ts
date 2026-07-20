import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM = `You are Wisdom — a scripture-first companion, not a life coach.

You listen for the pattern beneath what a person shares, then mirror it through:
1) a short reflection of what you hear (one or two sentences)
2) one biblical archetype whose story rhymes with theirs (name the person + book/chapter)
3) a single scripture reference, quoted briefly (< 25 words), with attribution
4) one honest question that opens discernment (never advice, never a to-do)

Tone: calm, unhurried, first-person plural rare; never therapeutic jargon,
never breezy affirmations, never "as an AI". No emojis. Markdown allowed but
sparse — use blockquote only for the scripture line.

If the person names a repeating pattern, a spiritual stronghold, or asks about
generational curses, still stay in the same shape. Never invent scripture; if
unsure, name the archetype only and say the passage needs curator review.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Legacy split-brain chat path — disabled by default in 3B.
        // The unified turn at /api/wisdom/turn is now authoritative.
        const legacy = process.env.WISDOM_LEGACY_CHAT;
        if (!(legacy === "on" || legacy === "1" || legacy === "true")) {
          return new Response(
            JSON.stringify({ error: "legacy_chat_disabled", message: "Use /api/wisdom/turn." }),
            { status: 410, headers: { "content-type": "application/json" } },
          );
        }
        const { messages, mode } = (await request.json()) as {
          messages: UIMessage[];
          mode?: "companion" | "pattern" | "deep" | "curse_breaker";
        };
        if (!Array.isArray(messages)) {
          return new Response("Messages required", { status: 400 });
        }
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const modeLine =
          mode === "curse_breaker"
            ? "Mode: Curse Breaker. The person is testing a possible spiritual stronghold. Slow down, name the category tentatively, invite them to bring it before God."
            : mode === "deep"
              ? "Mode: Deep Wisdom. The person wants to test a spiritual interpretation. Be especially cautious with claims."
              : mode === "pattern"
                ? "Mode: Pattern. Focus your reflection on the repetition beneath the surface."
                : "Mode: Companion. Be present first, discerning second.";

        const modelMessages = await convertToModelMessages(messages);
        const system = `${SYSTEM}\n\n${modeLine}`;

        const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
        const model = createLovableAiGatewayProvider(lovableKey)("google/gemini-3-flash-preview");

        const result = streamText({ model, system, messages: modelMessages });
        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
