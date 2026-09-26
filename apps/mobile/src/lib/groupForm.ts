import { createGroupSchema, type CreateGroupInput, type Group, type GroupDraft } from "@turnout/shared";

/** Form state as the inputs hold it: strings, plus the weekday chip. */
export interface GroupFormValues {
  name: string;
  activity: string;
  location: string;
  weekday: number | null;
  startTime: string;
  cap: string;
}

export const emptyGroupForm: GroupFormValues = { name: "", activity: "", location: "", weekday: null, startTime: "", cap: "" };

export const fromGroup = (g: Group): GroupFormValues => ({
  name: g.name,
  activity: g.activity ?? "",
  location: g.location ?? "",
  weekday: g.weekday,
  startTime: g.startTime,
  cap: g.cap ? String(g.cap) : "",
});

/** Fills in what the draft found and keeps what the organizer already typed for the rest. */
export const applyDraft = (v: GroupFormValues, d: GroupDraft): GroupFormValues => ({
  name: d.name ?? v.name,
  activity: d.activity ?? v.activity,
  location: d.location ?? v.location,
  weekday: d.weekday ?? v.weekday,
  startTime: d.startTime ?? v.startTime,
  cap: d.cap ? String(d.cap) : v.cap,
});

const labels: Record<string, string> = { name: "Group name", weekday: "Day", startTime: "Start time", cap: "Max players" };

export function toGroupInput(v: GroupFormValues, timezone: string): { ok: true; input: CreateGroupInput } | { ok: false; error: string } {
  const parsed = createGroupSchema.safeParse({
    name: v.name,
    activity: v.activity || undefined,
    location: v.location || undefined,
    weekday: v.weekday ?? undefined,
    startTime: v.startTime,
    timezone,
    cap: v.cap ? Number(v.cap) : null,
  });
  if (parsed.success) return { ok: true, input: parsed.data };
  const issue = parsed.error.issues[0]!;
  const field = String(issue.path[0] ?? "");
  return { ok: false, error: `${labels[field] ?? "Form"}: ${issue.message === "Required" ? "required" : issue.message}` };
}
