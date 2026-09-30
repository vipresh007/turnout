const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const weekdayName = (d: number) => weekdays[d] ?? "";

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

export function formatSessionDate(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: timezone });
}

const DAY = 86_400_000;

/** "Today", "Tomorrow", "in 3 days", in the group's timezone. */
export function relativeDay(iso: string, timezone: string, now = new Date()): string {
  // The calendar date in the group's timezone as YYYY-MM-DD, compared as UTC midnights. (Parsing a
  // toLocaleString result back into a Date works in browsers but gives NaN in the iOS/Android JS engine.)
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const day = (d: Date) => Date.parse(`${ymd.format(d)}T00:00:00Z`);
  const diff = Math.round((day(new Date(iso)) - day(now)) / DAY);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `in ${diff} days`;
}

/** "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** "Wed, Sep 30 · 8:00–9:30 PM" in the group's timezone. */
export function sessionWhen(startsAt: string, durationMinutes: number, timezone: string): string {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const day = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: timezone });
  const t = (d: Date, withPeriod: boolean) =>
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: timezone }).replace(withPeriod ? /$^/ : /\s?[AP]M$/i, "");
  const samePeriod = t(start, true).slice(-2) === t(end, true).slice(-2);
  return `${day} · ${t(start, !samePeriod)}–${t(end, true)}`;
}

export const mapsUrl = (location: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;

/** Hours from now until `iso` (negative once it has passed). */
export const hoursUntil = (iso: string, now = Date.now()) => (new Date(iso).getTime() - now) / 3_600_000;
