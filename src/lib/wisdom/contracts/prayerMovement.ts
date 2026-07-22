/**
 * Canonical prayer-movement contract.
 *
 * Single source of truth for the `prayer_movement` DB enum
 * (see migration 0006 — public.prayer_movement).
 *
 * Consumers:
 *  - src/lib/wisdom/unified.schemas.ts (server contract for prayer drafts)
 *
 * If you need the type in a new module, import it from here — never
 * redeclare the enum values inline.
 */
import { z } from "zod";

export const zPrayerMovement = z.enum([
  "adoration",
  "confession",
  "renunciation",
  "forgiveness",
  "deliverance",
  "healing",
  "blessing",
  "commissioning",
  "thanksgiving",
]);

export type PrayerMovement = z.infer<typeof zPrayerMovement>;
