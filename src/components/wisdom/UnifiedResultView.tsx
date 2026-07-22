/**
 * Canonical renderer for a validated UnifiedResult.
 * Thin shim over <WisdomResponse>, kept so existing callers
 * (/wisdom, /wisdom/$sessionId, legacy imports) don't have to change.
 *
 * All response layout, ordering, drawers, and mode-specific visibility
 * lives in WisdomResponse. Curse Breaker's layered contract and
 * pastoral actions are still owned by CurseBreakerV2View, which
 * WisdomResponse embeds in place.
 */
import type { UnifiedResult } from "@/lib/wisdom/unified.schemas";
import {
  WisdomResponse,
  type ResponseOrientation,
  type SessionHistorySummary,
} from "./response/WisdomResponse";

export function UnifiedResultView({
  result,
  wisdomTurnId,
  prayerId,
  orientation,
  sessionHistory,
  onContinue,
  onFinalizePrayer,
  finalizeState,
}: {
  result: UnifiedResult;
  wisdomTurnId?: string;
  prayerId?: string;
  orientation?: ResponseOrientation;
  sessionHistory?: SessionHistorySummary;
  onContinue?: (prompt: string) => void;
  onFinalizePrayer?: (prayerId: string) => void;
  finalizeState?: { status: "idle" | "pending" | "done" | "error"; message?: string };
}) {
  return (
    <WisdomResponse
      result={result}
      wisdomTurnId={wisdomTurnId}
      prayerId={prayerId}
      orientation={orientation}
      sessionHistory={sessionHistory}
      onContinue={onContinue}
      onFinalizePrayer={onFinalizePrayer}
      finalizeState={finalizeState}
    />
  );
}
