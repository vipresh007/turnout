import { DateTime } from "luxon";

interface Schedule {
  weekday: number; // 0 = Sunday
  startTime: string; // HH:MM in the group's timezone
  durationMinutes: number;
  timezone: string;
}

/** Start of the current session: the next one that hasn't ended yet, so a game stays "this week's" until it finishes. */
export function currentSessionStart(s: Schedule, now: Date = new Date()): Date {
  const [hour, minute] = s.startTime.split(":").map(Number) as [number, number];
  const local = DateTime.fromJSDate(now, { zone: s.timezone });
  const luxonWeekday = s.weekday === 0 ? 7 : s.weekday; // luxon: 1 = Monday … 7 = Sunday
  let start = local.set({ hour, minute, second: 0, millisecond: 0 }).plus({ days: (luxonWeekday - local.weekday + 7) % 7 });
  if (start.plus({ minutes: s.durationMinutes }) <= local) start = start.plus({ weeks: 1 });
  return start.toJSDate();
}

export function isValidTimezone(tz: string): boolean {
  return DateTime.local().setZone(tz).isValid;
}
