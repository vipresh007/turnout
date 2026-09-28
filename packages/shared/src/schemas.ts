import { z } from "zod";

export const weekdaySchema = z.number().int().min(0).max(6); // 0 = Sunday
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)");

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** The fields of a group. Requests may still send a single `weekday`; see withLegacyWeekday. */
export const groupFields = z.object({
  name: z.string().trim().min(1).max(80),
  activity: z.string().trim().max(40).optional(),
  location: z.string().trim().max(120).optional(),
  weekdays: z.array(weekdaySchema).min(1).max(7).transform((d) => [...new Set(d)].sort()),
  intervalWeeks: z.number().int().min(1).max(4).default(1),
  startsOn: dateSchema.optional(),
  endsOn: dateSchema.nullable().optional(),
  startTime: timeSchema,
  durationMinutes: z.number().int().min(15).max(24 * 60).default(90),
  timezone: z.string().min(1),
  cap: z.number().int().min(1).max(500).nullable(),
  /** Optional cost in cents: per player, or the total split between everyone in. */
  feeCents: z.number().int().min(1).max(10_000_000).nullable().optional(),
  feeSplit: z.boolean().optional(),
  /** Upfront season fee in cents, split between the season members. */
  seasonFeeCents: z.number().int().min(1).max(100_000_000).nullable().optional(),
  /** Without a cap: how many players the group aims for ("need N more" counts toward it). */
  targetPlayers: z.number().int().min(2).max(500).nullable().optional(),
  /** How to pay, e.g. "e-Transfer to sam@example.com". */
  payNote: z.string().trim().max(200).nullable().optional(),
  reminders: z
    .object({
      dayBefore: z.boolean(),
      hoursBefore: z.number().int().min(1).max(48).nullable(),
      first: z.enum(["evening", "24h"]).optional(),
      nudgeAgain: z.boolean().optional(),
    })
    .default({ dayBefore: true, hoursBefore: 2 }),
});

/** Older clients (and the AI draft) send one `weekday`; turn it into `weekdays`. */
const withLegacyWeekday = (v: unknown) => {
  if (v && typeof v === "object" && "weekday" in v && !("weekdays" in v)) {
    const { weekday, ...rest } = v as { weekday: unknown };
    return typeof weekday === "number" ? { ...rest, weekdays: [weekday] } : rest;
  }
  return v;
};

export const createGroupSchema = z.preprocess(withLegacyWeekday, groupFields);
export type CreateGroupInput = z.infer<typeof groupFields>;

export const updateGroupSchema = z
  .preprocess(withLegacyWeekday, groupFields.partial())
  .refine((v) => Object.keys(v as object).length > 0, "Nothing to update");
export type UpdateGroupInput = Partial<CreateGroupInput>;

export const cancelSessionSchema = z.object({ cancelled: z.boolean() });

/** Changes to one week only: skip it, move it, or leave a note. null clears an override. */
export const sessionUpdateSchema = z
  .object({
    cancelled: z.boolean().optional(),
    startTime: timeSchema.nullable().optional(),
    location: z.string().trim().max(120).nullable().optional(),
    note: z.string().trim().max(200).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>;

/** Draft returned by the one-sentence AI setup. Every field is optional so the organizer can fill in the gaps. */
export const groupDraftSchema = z.preprocess(withLegacyWeekday, groupFields.partial().extend({ timezone: z.string().optional() }));
export type GroupDraft = Partial<CreateGroupInput>;

export const joinGroupSchema = z.object({
  name: z.string().trim().min(1).max(40),
  /** Join even though someone with this name is already in the group. */
  confirmNew: z.boolean().optional(),
});
export const mergeMemberSchema = z.object({ intoId: z.string().uuid() });
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

export const transferOwnerSchema = z.object({ organizerId: z.string().uuid() });
export const acceptAdminInviteSchema = z.object({ token: z.string().min(10).max(100) });

/** Organizer: mark someone a season member, and whether they've paid the season fee. */
export const seasonMemberSchema = z.object({ member: z.boolean().optional(), paid: z.boolean().optional() }).refine((v) => v.member !== undefined || v.paid !== undefined, "Nothing to update");

/** Organizer adds players up front (e.g. a season roster): names, and an email for reminders if they have one. */
export const addPlayersSchema = z.object({
  players: z.array(z.object({ name: z.string().trim().min(1).max(40), email: z.string().trim().email().max(254).optional() })).min(1).max(60),
});
