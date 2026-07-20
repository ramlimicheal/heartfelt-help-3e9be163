import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type JourneyEvent = {
  id: string;
  eventType: string;
  note: string | null;
  fruit: string[];
  patternId: string | null;
  prayerId: string | null;
  practiceId: string | null;
  at: string;
};

export const getJourneyTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<JourneyEvent[]> => {
    const { data, error } = await context.supabase
      .from("formation_events")
      .select("id, event_type, note, fruit, pattern_id, prayer_id, practice_id, at")
      .eq("user_id", context.userId)
      .order("at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      eventType: r.event_type,
      note: r.note,
      fruit: r.fruit ?? [],
      patternId: r.pattern_id,
      prayerId: r.prayer_id,
      practiceId: r.practice_id,
      at: r.at,
    }));
  });
