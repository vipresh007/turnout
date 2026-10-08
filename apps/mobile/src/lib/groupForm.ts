import { createGroupSchema, endTimeFor, isOneOff, minutesBetween, weekdayOf, parseMoney, defaultReminderSettings, type CreateGroupInput, type Group, type GroupDraft, type ReminderSettings } from "@turnout/shared";

/** Form state as the inputs hold it: strings, plus the day chips and repeat choice. */
export interface GroupFormValues {
  name: string;
  activity: string;
  location: string;
  weekdays: number[];
  intervalWeeks: number;
  /** A one-time event on `date` instead of a repeating schedule. */
  once: boolean;
  /** The event's date when `once`, YYYY-MM-DD. */
  date: string;
  /** Optional last date, YYYY-MM-DD. */
  endsOn: string;
  startTime: string;
  /** "21:30"; with startTime it sets how long each game runs. */
  endTime: string;
  cap: string;
  /** How the cost works: per player each game, a total split each game, or a season fee paid up front. */
  costMode: "none" | "per" | "split" | "season";
  /** Optional cost as typed, e.g. "10" or "7.50". Per game; in season mode, the drop-in price for subs. */
  fee: string;
  feeSplit: boolean;
  /** Season mode: the season total, split between season members. */
  seasonFee: string;
  /** Without a max: how many players the group aims for. */
  target: string;
  payNote: string;
  reminders: ReminderSettings;
}

export const emptyGroupForm: GroupFormValues = { name: "", activity: "", location: "", weekdays: [], intervalWeeks: 1, once: false, date: "", endsOn: "", startTime: "", endTime: "", cap: "", costMode: "none", fee: "", feeSplit: false, seasonFee: "", target: "", payNote: "", reminders: defaultReminderSettings };

const dollars = (cents: number | null) => (cents ? String(cents / 100) : "");

export const fromGroup = (g: Group): GroupFormValues => ({
  name: g.name,
  activity: g.activity ?? "",
  location: g.location ?? "",
  weekdays: g.weekdays,
  intervalWeeks: g.intervalWeeks,
  once: isOneOff(g),
  date: isOneOff(g) ? g.startsOn : "",
  endsOn: isOneOff(g) ? "" : g.endsOn ?? "",
  startTime: g.startTime,
  endTime: endTimeFor(g.startTime, g.durationMinutes),
  cap: g.cap ? String(g.cap) : "",
  costMode: g.seasonFeeCents ? "season" : !g.feeCents ? "none" : g.feeSplit ? "split" : "per",
  fee: dollars(g.feeCents),
  feeSplit: g.feeSplit,
  seasonFee: dollars(g.seasonFeeCents),
  target: g.targetPlayers ? String(g.targetPlayers) : "",
  payNote: g.payNote ?? "",
  reminders: g.reminders,
});

/** Fills in what the draft found and keeps what the organizer already typed for the rest. */
export const applyDraft = (v: GroupFormValues, d: GroupDraft): GroupFormValues => ({
  name: d.name ?? v.name,
  activity: d.activity ?? v.activity,
  location: d.location ?? v.location,
  weekdays: d.weekdays?.length ? d.weekdays : v.weekdays,
  intervalWeeks: d.intervalWeeks ?? v.intervalWeeks,
  once: v.once,
  date: v.date,
  endsOn: v.endsOn,
  startTime: d.startTime ?? v.startTime,
  endTime: d.startTime && d.durationMinutes ? endTimeFor(d.startTime, d.durationMinutes) : v.endTime,
  cap: d.cap ? String(d.cap) : v.cap,
  costMode: d.seasonFeeCents ? "season" : d.feeCents ? (d.feeSplit ? "split" : "per") : v.costMode,
  // In season mode, fee is the drop-in price for subs, so a per-game price only fills it when the sentence gave one.
  fee: d.feeCents ? dollars(d.feeCents) : d.seasonFeeCents ? "" : v.fee,
  feeSplit: d.feeCents ? !!d.feeSplit : v.feeSplit,
  seasonFee: d.seasonFeeCents ? dollars(d.seasonFeeCents) : v.seasonFee,
  target: d.targetPlayers ? String(d.targetPlayers) : v.target,
  payNote: d.payNote ?? v.payNote,
  reminders: v.reminders,
});

const labels: Record<string, string> = { name: "Group name", weekdays: "Days", startTime: "Start time", cap: "Max players", endsOn: "Ends on", feeCents: "Cost", payNote: "How to pay", targetPlayers: "Target players", seasonFeeCents: "Season fee" };

export function toGroupInput(v: GroupFormValues, timezone: string): { ok: true; input: CreateGroupInput } | { ok: false; error: string } {
  const durationMinutes = v.endTime.trim() ? minutesBetween(v.startTime, v.endTime) : 90;
  if (durationMinutes === null) return { ok: false, error: "End time: use 24h like 21:30, different from the start time" };
  const feeCents = v.costMode === "none" ? null : parseMoney(v.fee);
  if (feeCents === undefined) return { ok: false, error: `${v.costMode === "season" ? "Drop-in price" : "Cost"}: enter an amount like 10 or 7.50` };
  const seasonFeeCents = v.costMode === "season" ? parseMoney(v.seasonFee) : null;
  if (seasonFeeCents === undefined) return { ok: false, error: "Season fee: enter an amount like 2500" };
  const date = v.date.trim();
  if (v.once && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Date: enter it like 2026-10-24" };
  const parsed = createGroupSchema.safeParse({
    name: v.name,
    activity: v.activity || undefined,
    location: v.location || undefined,
    // A one-time event is a schedule whose first and last game are the same day.
    weekdays: v.once ? [weekdayOf(date)] : v.weekdays,
    intervalWeeks: v.once ? 1 : v.intervalWeeks,
    ...(v.once ? { startsOn: date } : {}),
    endsOn: v.once ? date : v.endsOn.trim() || null,
    startTime: v.startTime,
    durationMinutes,
    timezone,
    cap: v.cap ? Number(v.cap) : null,
    feeCents,
    feeSplit: v.costMode === "split",
    seasonFeeCents,
    targetPlayers: !v.cap && v.target ? Number(v.target) : null,
    payNote: v.costMode === "none" ? null : v.payNote.trim() || null,
    reminders: v.reminders,
  });
  if (parsed.success) return { ok: true, input: parsed.data };
  const issue = parsed.error.issues[0]!;
  const field = String(issue.path[0] ?? "");
  const message = field === "weekdays" ? "pick at least one day" : issue.message === "Required" ? "required" : issue.message;
  return { ok: false, error: `${labels[field] ?? "Form"}: ${message}` };
}
