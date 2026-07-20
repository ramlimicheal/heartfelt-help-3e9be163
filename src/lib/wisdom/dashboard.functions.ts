import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DashboardSlice, type FormationState } from "./dashboard.schemas";

export const getDashboardSlice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [
      sessionsRes,
      patternsRes,
      personaAcceptedRes,
      personaProposedRes,
      prayerRes,
      formationRes,
      checkInRes,
    ] = await Promise.all([
      supabase
        .from("sessions")
        .select("id,title,mode,created_at,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("patterns")
        .select("id,title,lifecycle,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(50),
      supabase
        .from("persona_facts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "accepted"),
      supabase
        .from("persona_facts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "proposed"),
      supabase
        .from("prayers")
        .select("id,title,mode,finalized_at,created_at,prayer_lines(count)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("formation_events")
        .select("event_type,at,fruit")
        .eq("user_id", userId)
        .order("at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("check_ins")
        .select("id,observed,setback,at")
        .eq("user_id", userId)
        .order("at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const sessions = sessionsRes.data ?? [];
    const currentSession = sessions[0]
      ? {
          id: sessions[0].id,
          title: sessions[0].title,
          mode: sessions[0].mode,
          createdAt: sessions[0].created_at,
          updatedAt: sessions[0].updated_at,
        }
      : null;

    // pipeline_runs only records terminal states (ok/error/skipped); there is
    // no persisted "running" row. Treat "Live" as false until we add a live
    // channel. Never surface a fake Live badge.
    const runningPipeline = false;

    const patternsRaw = patternsRes.data ?? [];
    const counts = {
      proposed: 0,
      accepted: 0,
      improving: 0,
      recurring: 0,
      total: patternsRaw.length,
    };
    for (const p of patternsRaw) {
      const lc = p.lifecycle;
      if (lc === "proposed") counts.proposed++;
      else if (lc === "accepted") counts.accepted++;
      else if (lc === "refined") counts.improving++;
      else if (lc === "reconsidered") counts.recurring++;
    }
    const mostRecent = patternsRaw[0]
      ? {
          id: patternsRaw[0].id,
          title: patternsRaw[0].title,
          lifecycle: patternsRaw[0].lifecycle,
          updatedAt: patternsRaw[0].updated_at,
          hasConfidence: false,
          confidence: null,
        }
      : null;

    const acceptedCount = personaAcceptedRes.count ?? 0;
    const proposedCount = personaProposedRes.count ?? 0;

    const prayer = prayerRes.data;
    const latestPrayer = prayer
      ? {
          id: prayer.id,
          title: prayer.title,
          mode: prayer.mode,
          movementCount:
            Array.isArray(prayer.prayer_lines) && prayer.prayer_lines[0]
              ? (prayer.prayer_lines[0] as { count: number }).count
              : 0,
          finalizedAt: prayer.finalized_at,
          createdAt: prayer.created_at,
        }
      : null;

    const formEvent = formationRes.data;
    const checkIn = checkInRes.data;
    let formationState: FormationState = "no_check_in";
    let lastEventAt: string | null = null;
    if (checkIn) {
      lastEventAt = checkIn.at;
      if (checkIn.setback) formationState = "setback_recorded";
      else if (checkIn.observed) formationState = "fruit_observed";
      else formationState = "check_in_scheduled";
    }
    if (formEvent) {
      const at = formEvent.at as string;
      if (!lastEventAt || at > lastEventAt) {
        lastEventAt = at;
        const t = formEvent.event_type;
        if (t === "practice_assigned") formationState = "one_next_act_selected";
        else if (t === "check_in") formationState = "check_in_scheduled";
        else if (t === "prayer" && Array.isArray(formEvent.fruit) && formEvent.fruit.length > 0)
          formationState = "fruit_observed";
      }
    }

    const emptyFlags = {
      noSessions: sessions.length === 0,
      noPatterns: patternsRaw.length === 0,
      noPersona: acceptedCount === 0 && proposedCount === 0,
      noPrayer: !latestPrayer,
      noFormation: !formEvent && !checkIn,
    };

    const suggestedNext: "start_wisdom" | "review_pattern" | "confirm_memory" | "open_prayer" =
      emptyFlags.noSessions
        ? "start_wisdom"
        : counts.proposed > 0
          ? "review_pattern"
          : proposedCount > 0
            ? "confirm_memory"
            : latestPrayer
              ? "open_prayer"
              : "start_wisdom";

    const slice = {
      currentSession,
      runningPipeline,
      recentSessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        mode: s.mode,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })),
      patterns: { counts, mostRecent },
      persona: { acceptedCount, proposedCount },
      latestPrayer,
      formation: { state: formationState, lastEventAt },
      suggestedNext,
      emptyFlags,
    };

    return DashboardSlice.parse(slice);
  });
