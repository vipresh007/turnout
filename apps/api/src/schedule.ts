import { DateTime } from "luxon";
import { addDays, nextDates, type Recurrence } from "@turnout/shared";

export interface Schedule extends Recurrence {
  startTime: string; // HH:MM in the group's timezone
  durationMinutes: number;
  timezone: string;
}

/** The instant a game on local date `date` (YYYY-MM-DD) at `time` (HH:MM) starts, DST-safe. */
export function atLocal(date: string, time: string, timezone: string): Date {
  return DateTime.fromISO(`${date}T${time}`, { zone: timezone }).toJSDate();
}

/** The group's local calendar date for an instant. */
export function localDate(at: Date, timezone: string): string {
  return DateTime.fromJSDate(at, { zone: timezone }).toISODate()!;
}

/** Scheduled start times on or after the local date of `from`. */
export function scheduledStarts(s: Schedule, from: Date, count: number): Date[] {
  return nextDates(localDate(from, s.timezone), s, count).map((d) => atLocal(d, s.startTime, s.timezone));
}

/** The most recent scheduled start, for schedules that have ended. */
export function lastScheduledStart(s: Schedule): Date | null {
  if (!s.endsOn) return null;
  const dates = nextDates(addDays(s.endsOn, -120), s, 200).filter((d) => d <= s.endsOn!);
  const last = dates.at(-1);
  return last ? atLocal(last, s.startTime, s.timezone) : null;
}

/**
 * The current week's scheduled start: the first one that hasn't ended yet, so a game stays
 * "this week's" until it finishes. (Callers apply this week's overrides; see groups.currentSession.)
 */
export function currentSessionStart(s: Schedule, now: Date = new Date()): Date {
  const upcoming = scheduledStarts(s, new Date(now.getTime() - 86_400_000), 3);
  return upcoming.find((d) => d.getTime() + s.durationMinutes * 60_000 > now.getTime()) ?? upcoming[0] ?? lastScheduledStart(s) ?? now;
}

export function isValidTimezone(tz: string): boolean {
  return DateTime.local().setZone(tz).isValid;
}

export const todayIn = (timezone: string) => DateTime.now().setZone(timezone).toISODate()!;
