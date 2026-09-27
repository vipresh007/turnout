/**
 * Recurrence rules, on calendar dates in the group's own timezone (no instants here; the API turns
 * dates into times with the group's timezone). Dates are "YYYY-MM-DD" strings.
 */
export interface Recurrence {
  /** Days of the week the group plays, 0 = Sunday. */
  weekdays: number[];
  /** 1 = every week, 2 = every other week, ... */
  intervalWeeks: number;
  /** First date the schedule applies; also anchors which weeks count for intervals over 1. */
  startsOn: string;
  /** Last date the schedule applies, or null for no end. */
  endsOn: string | null;
}

const DAY = 86_400_000;
const toUtc = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
export const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (date: string, days: number) => ymd(toUtc(date) + days * DAY);
export const weekdayOf = (date: string) => new Date(toUtc(date)).getUTCDay();
/** Monday-based week start, so a Sunday game belongs to the week that started the Monday before. */
const weekStart = (date: string) => toUtc(date) - ((weekdayOf(date) + 6) % 7) * DAY;

export function occursOn(date: string, r: Recurrence): boolean {
  if (date < r.startsOn || (r.endsOn && date > r.endsOn)) return false;
  if (!r.weekdays.includes(weekdayOf(date))) return false;
  const weeks = Math.round((weekStart(date) - weekStart(r.startsOn)) / (7 * DAY));
  return weeks % Math.max(1, r.intervalWeeks) === 0;
}

/** The next `count` dates on or after `from` (searches up to two years ahead). */
export function nextDates(from: string, r: Recurrence, count: number): string[] {
  const out: string[] = [];
  for (let i = 0, d = from; out.length < count && i < 730; i++, d = addDays(d, 1)) {
    if (occursOn(d, r)) out.push(d);
  }
  return out;
}

/** "Tue & Thu", "Every other Wed", "Every 3 weeks on Mon". */
export function describeRecurrence(r: Pick<Recurrence, "weekdays" | "intervalWeeks">): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = [...r.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => names[d]);
  const list = days.length <= 2 ? days.join(" & ") : `${days.slice(0, -1).join(", ")} & ${days.at(-1)}`;
  if (r.intervalWeeks === 1) return `Every ${list}`;
  if (r.intervalWeeks === 2) return `Every other ${list}`;
  return `Every ${r.intervalWeeks} weeks on ${list}`;
}
