import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PrayerListItem = {
  id: string;
  title: string;
  mode: string;
  lineCount: number;
  createdAt: string;
  finalizedAt: string | null;
};

export const listPrayers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PrayerListItem[]> => {
    const { data, error } = await context.supabase
      .from("prayers")
      .select("id, title, mode, created_at, finalized_at, prayer_lines(count)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const linesAgg = r.prayer_lines as unknown as { count: number }[] | null;
      return {
        id: r.id,
        title: r.title,
        mode: r.mode,
        lineCount: linesAgg?.[0]?.count ?? 0,
        createdAt: r.created_at,
        finalizedAt: r.finalized_at,
      };
    });
  });

export type PrayerLineSource = {
  id: string;
  passageId: string;
  reference: string;
  passageText: string;
  derivation: string;
  explanation: string;
  tier: string;
};

export type PrayerLineDetail = {
  id: string;
  ordering: number;
  movement: string;
  text: string;
  confidence: number;
  sources: PrayerLineSource[];
};

export type PrayerDetail = {
  id: string;
  title: string;
  mode: string;
  createdAt: string;
  finalizedAt: string | null;
  lines: PrayerLineDetail[];
};

const detailInput = z.object({ prayerId: z.string().uuid() });

export const getPrayerDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof detailInput>) => detailInput.parse(d))
  .handler(async ({ data, context }): Promise<PrayerDetail | null> => {
    const { data: prayer, error } = await context.supabase
      .from("prayers")
      .select("id, title, mode, created_at, finalized_at, user_id")
      .eq("id", data.prayerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prayer || prayer.user_id !== context.userId) return null;

    const { data: lines, error: lErr } = await context.supabase
      .from("prayer_lines")
      .select("id, ordering, movement, text, confidence")
      .eq("prayer_id", prayer.id)
      .order("ordering", { ascending: true });
    if (lErr) throw new Error(lErr.message);

    const lineIds = (lines ?? []).map((l) => l.id);
    let sourceRows: Array<{
      id: string;
      prayer_line_id: string;
      passage_id: string;
      derivation: string;
      explanation: string;
      tier: string;
      source_passages: { reference: string; text: string } | null;
    }> = [];
    if (lineIds.length) {
      const { data: srcs, error: sErr } = await context.supabase
        .from("prayer_line_sources")
        .select(
          "id, prayer_line_id, passage_id, derivation, explanation, tier, source_passages(reference, text)",
        )
        .in("prayer_line_id", lineIds);
      if (sErr) throw new Error(sErr.message);
      sourceRows = (srcs ?? []) as typeof sourceRows;
    }

    return {
      id: prayer.id,
      title: prayer.title,
      mode: prayer.mode,
      createdAt: prayer.created_at,
      finalizedAt: prayer.finalized_at,
      lines: (lines ?? []).map((l) => ({
        id: l.id,
        ordering: l.ordering,
        movement: l.movement,
        text: l.text,
        confidence: Number(l.confidence),
        sources: sourceRows
          .filter((s) => s.prayer_line_id === l.id)
          .map((s) => ({
            id: s.id,
            passageId: s.passage_id,
            reference: s.source_passages?.reference ?? "",
            passageText: s.source_passages?.text ?? "",
            derivation: s.derivation,
            explanation: s.explanation,
            tier: s.tier,
          })),
      })),
    };
  });
