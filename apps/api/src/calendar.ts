import type { Group } from "@turnout/shared";

const icsDays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Escapes text per RFC 5545 and folds long lines. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const fold = (line: string) => line.match(/.{1,73}/g)!.join("\r\n ");

/** "20260929T193000" in the given timezone. */
function localStamp(at: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(at);
  const p = (t: string) => parts.find((x) => x.type === t)!.value;
  return `${p("year")}${p("month")}${p("day")}T${p("hour")}${p("minute")}00`;
}

/** A calendar file with the group's game as a weekly repeating event, in the group's timezone. */
export function groupCalendar(group: Group, firstStart: Date, url: string, skipped: Date[] = []): string {
  const dtstart = localStamp(firstStart, group.timezone);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Turnout//Turnout//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(group.name)}`,
    "BEGIN:VEVENT",
    `UID:${group.id}@turnout`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${group.timezone}:${dtstart}`,
    `DURATION:PT${group.durationMinutes}M`,
    `RRULE:FREQ=WEEKLY;INTERVAL=${group.intervalWeeks};BYDAY=${group.weekdays.map((d) => icsDays[d]).join(",")}${
      group.endsOn ? `;UNTIL=${group.endsOn.replace(/-/g, "")}T235959Z` : ""
    }`,
    ...skipped.map((d) => `EXDATE;TZID=${group.timezone}:${localStamp(d, group.timezone)}`),
    `SUMMARY:${esc(group.name)}`,
    ...(group.location ? [`LOCATION:${esc(group.location)}`] : []),
    `DESCRIPTION:${esc(`Tap in or out each week: ${url}`)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
