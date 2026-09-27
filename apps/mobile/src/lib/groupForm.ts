import { createGroupSchema, formatMoney, parseMoney, defaultReminderSettings, type CreateGroupInput, type Group, type GroupDraft, type ReminderSettings } from "@turnout/shared";

/** Form state as the inputs hold it: strings, plus the day chips and repeat choice. */
export interface GroupFormValues {
  name: string;
  activity: string;
  location: string;
  weekdays: number[];
  intervalWeeks: number;
  /** Optional last date, YYYY-MM-DD. */
  endsOn: string;
  startTime: string;
  cap: string;
  /** Optional cost as typed, e.g. "10" or "7.50". */
  fee: string;
  feeSplit: boolean;
  payNote: string;
  reminders: ReminderSettings;
}

export const emptyGroupForm: GroupFormValues = { name: "", activity: "", location: "", weekdays: [], intervalWeeks: 1, endsOn: "", startTime: "", cap: "", fee: "", feeSplit: false, payNote: "", reminders: defaultReminderSettings };

export const fromGroup = (g: Group): GroupFormValues => ({
  name: g.name,
  activity: g.activity ?? "",
  location: g.location ?? "",
  weekdays: g.weekdays,
  intervalWeeks: g.intervalWeeks,
  endsOn: g.endsOn ?? "",
  startTime: g.startTime,
  cap: g.cap ? String(g.cap) : "",
  fee: g.feeCents ? formatMoney(g.feeCents).slice(1) : "",
  feeSplit: g.feeSplit,
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
  endsOn: v.endsOn,
  startTime: d.startTime ?? v.startTime,
  cap: d.cap ? String(d.cap) : v.cap,
  fee: v.fee,
  feeSplit: v.feeSplit,
  payNote: v.payNote,
  reminders: v.reminders,
});

const labels: Record<string, string> = { name: "Group name", weekdays: "Days", startTime: "Start time", cap: "Max players", endsOn: "Ends on", feeCents: "Cost", payNote: "How to pay" };

export function toGroupInput(v: GroupFormValues, timezone: string): { ok: true; input: CreateGroupInput } | { ok: false; error: string } {
  const feeCents = parseMoney(v.fee);
  if (feeCents === undefined) return { ok: false, error: "Cost: enter an amount like 10 or 7.50" };
  const parsed = createGroupSchema.safeParse({
    name: v.name,
    activity: v.activity || undefined,
    location: v.location || undefined,
    weekdays: v.weekdays,
    intervalWeeks: v.intervalWeeks,
    endsOn: v.endsOn.trim() || null,
    startTime: v.startTime,
    timezone,
    cap: v.cap ? Number(v.cap) : null,
    feeCents,
    feeSplit: v.feeSplit,
    payNote: v.payNote.trim() || null,
    reminders: v.reminders,
  });
  if (parsed.success) return { ok: true, input: parsed.data };
  const issue = parsed.error.issues[0]!;
  const field = String(issue.path[0] ?? "");
  const message = field === "weekdays" ? "pick at least one day" : issue.message === "Required" ? "required" : issue.message;
  return { ok: false, error: `${labels[field] ?? "Form"}: ${message}` };
}
