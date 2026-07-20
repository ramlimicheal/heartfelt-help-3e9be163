import { z } from "zod";

export const SessionSummary = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  mode: z.string(),
  updatedAt: z.string(),
  createdAt: z.string(),
});
export type SessionSummary = z.infer<typeof SessionSummary>;

export const PatternSummary = z.object({
  id: z.string().uuid(),
  title: z.string(),
  lifecycle: z.string(),
  updatedAt: z.string(),
  hasConfidence: z.boolean(),
  confidence: z.number().nullable(),
});
export type PatternSummary = z.infer<typeof PatternSummary>;

export const PrayerSummary = z.object({
  id: z.string().uuid(),
  title: z.string(),
  mode: z.string(),
  movementCount: z.number().int().nonnegative(),
  finalizedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type PrayerSummary = z.infer<typeof PrayerSummary>;

export const FormationState = z.enum([
  "no_check_in",
  "one_next_act_selected",
  "check_in_scheduled",
  "fruit_observed",
  "setback_recorded",
]);
export type FormationState = z.infer<typeof FormationState>;

export const DashboardSlice = z.object({
  currentSession: SessionSummary.nullable(),
  runningPipeline: z.boolean(),
  recentSessions: z.array(SessionSummary),
  patterns: z.object({
    counts: z.object({
      proposed: z.number().int().nonnegative(),
      accepted: z.number().int().nonnegative(),
      improving: z.number().int().nonnegative(),
      recurring: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
    mostRecent: PatternSummary.nullable(),
  }),
  persona: z.object({
    acceptedCount: z.number().int().nonnegative(),
    proposedCount: z.number().int().nonnegative(),
  }),
  latestPrayer: PrayerSummary.nullable(),
  formation: z.object({
    state: FormationState,
    lastEventAt: z.string().nullable(),
  }),
  suggestedNext: z.enum([
    "start_wisdom",
    "review_pattern",
    "confirm_memory",
    "open_prayer",
  ]),
  emptyFlags: z.object({
    noSessions: z.boolean(),
    noPatterns: z.boolean(),
    noPersona: z.boolean(),
    noPrayer: z.boolean(),
    noFormation: z.boolean(),
  }),
});
export type DashboardSlice = z.infer<typeof DashboardSlice>;
