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
  reminders: z
    .object({ dayBefore: z.boolean(), hoursBefore: z.number().int().min(1).max(48).nullable() })
    .default({ dayBefore: true, hoursBefore: 2 }),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = createGroupSchema.partial().refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const cancelSessionSchema = z.object({ cancelled: z.boolean() });

/** Draft returned by the one-sentence AI setup. Every field is optional so the organizer can fill in the gaps. */
export const groupDraftSchema = createGroupSchema.partial().extend({
  timezone: z.string().optional(),
});
export type GroupDraft = z.infer<typeof groupDraftSchema>;

export const joinGroupSchema = z.object({ name: z.string().trim().min(1).max(40) });
export const rsvpSchema = z.object({ status: z.enum(["in", "out"]) });
export const parseGroupSchema = z.object({ sentence: z.string().trim().min(3).max(500), timezone: z.string().optional() });

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
export const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });
export const tokenSchema = z.object({ token: z.string().min(10).max(100) });
export const paidSchema = z.object({ paid: z.boolean() });
export const skillSchema = z.object({ skill: z.number().int().min(1).max(5) });
export const saveTeamsSchema = z.object({ teams: z.array(z.array(z.string().uuid()).max(100)).min(2).max(4).nullable() });
