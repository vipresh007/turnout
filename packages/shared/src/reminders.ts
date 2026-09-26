export interface ReminderSettings {
  /** Send at 6pm (group time) the evening before the game. */
  dayBefore: boolean;
  /** Hours before the start to send the final reminder; null turns it off. */
  hoursBefore: number | null;
}

export const defaultReminderSettings: ReminderSettings = { dayBefore: true, hoursBefore: 2 };

export type ReminderKind = "dayBefore" | "hoursBefore";

/** A reminder that fires later than this after its due time is skipped rather than sent late. */
export const REMINDER_GRACE_MS = 3 * 60 * 60 * 1000;

/**
 * When each reminder for a session is due. `startsAt` is the session start; `timezone` is the
 * group's IANA zone. The day-before reminder is 18:00 local time on the previous calendar day.
 */
export function reminderTimes(startsAt: Date, timezone: string, settings: ReminderSettings): Partial<Record<ReminderKind, Date>> {
  const times: Partial<Record<ReminderKind, Date>> = {};
  if (settings.hoursBefore !== null) {
    times.hoursBefore = new Date(startsAt.getTime() - settings.hoursBefore * 3_600_000);
  }
  if (settings.dayBefore) {
    const local = localParts(startsAt, timezone);
    // Noon UTC on the previous local day, then walk to 18:00 in the group's zone.
    const prevDay = new Date(Date.UTC(local.year, local.month - 1, local.day - 1, 12));
    const at = zonedTime(prevDay.getUTCFullYear(), prevDay.getUTCMonth() + 1, prevDay.getUTCDate(), 18, 0, timezone);
    // Skip it when it would land after (or right on top of) the final reminder, e.g. a morning game.
    if (!times.hoursBefore || at.getTime() < times.hoursBefore.getTime() - 60 * 60_000) times.dayBefore = at;
  }
  return times;
}

/** Reminders that should go out now: due, not past the grace window, and before the game starts. */
export function dueReminders(startsAt: Date, timezone: string, settings: ReminderSettings, now: Date): ReminderKind[] {
  if (now >= startsAt) return [];
  const times = reminderTimes(startsAt, timezone, settings);
  return (Object.entries(times) as [ReminderKind, Date][])
    .filter(([, at]) => at <= now && now.getTime() - at.getTime() <= REMINDER_GRACE_MS)
    .map(([kind]) => kind);
}

function localParts(d: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** The instant when the wall clock in `timezone` reads the given local time (DST-safe). */
function zonedTime(year: number, month: number, day: number, hour: number, minute: number, timezone: string): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes settle the offset, including across DST changes.
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(guess), timezone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += Date.UTC(year, month - 1, day, hour, minute) - asUtc;
  }
  return new Date(guess);
}

/** Messages, kept here so every channel (push, email, group chat) says the same thing. */
export function reminderText(kind: ReminderKind | "nudge", groupName: string, whenLabel: string, confirmed: number, cap: number | null) {
  const count = cap ? `${confirmed}/${cap} in` : `${confirmed} in`;
  switch (kind) {
    case "dayBefore":
      return { title: `${groupName} is tomorrow`, body: `${whenLabel} · ${count}. See you there!` };
    case "hoursBefore":
      return { title: `${groupName} starts soon`, body: `${whenLabel} · ${count}. Can't make it? Tap to drop out so someone else can play.` };
    case "nudge":
      return { title: `Are you in for ${groupName}?`, body: `${whenLabel} · ${count}. Tap to let everyone know.` };
  }
}

export function groupChatReminder(groupName: string, whenLabel: string, confirmed: number, cap: number | null, link: string): string {
  const need = cap && confirmed < cap ? ` We need ${cap - confirmed} more!` : cap && confirmed >= cap ? " We're full 🎉" : "";
  return `⏰ ${groupName}: ${whenLabel}. ${cap ? `${confirmed}/${cap}` : confirmed} in so far.${need} Tap to confirm: ${link}`;
}
