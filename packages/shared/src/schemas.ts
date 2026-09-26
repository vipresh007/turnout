import { z } from "zod";

export const weekdaySchema = z.number().int().min(0).max(6); // 0 = Sunday
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)");

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  activity: z.string().trim().max(40).optional(),
  location: z.string().trim().max(120).optional(),
  weekday: weekdaySchema,
  startTime: timeSchema,
  durationMinutes: z.number().int().min(15).max(24 * 60).default(90),
  timezone: z.string().min(1),
  cap: z.number().int().min(1).max(500).nullable(),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

/** Draft returned by the one-sentence AI setup. Every field is optional so the organizer can fill in the gaps. */
export const groupDraftSchema = createGroupSchema.partial().extend({
  timezone: z.string().optional(),
});
export type GroupDraft = z.infer<typeof groupDraftSchema>;

export const joinGroupSchema = z.object({ name: z.string().trim().min(1).max(40) });
export const rsvpSchema = z.object({ status: z.enum(["in", "out"]) });
export const parseGroupSchema = z.object({ sentence: z.string().trim().min(3).max(500), timezone: z.string().optional() });
