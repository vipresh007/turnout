import { test } from "node:test";
import assert from "node:assert/strict";
import { currentSessionStart, lastScheduledStart, scheduledStarts } from "./schedule.ts";

const tuesday7pmToronto = {
  weekdays: [2], intervalWeeks: 1, startsOn: "2026-01-01", endsOn: null,
  startTime: "19:00", durationMinutes: 90, timezone: "America/Toronto",
};

test("next occurrence later this week", () => {
  // Sunday 2026-09-27 12:00 Toronto (EDT, UTC-4)
  const start = currentSessionStart(tuesday7pmToronto, new Date("2026-09-27T16:00:00Z"));
  assert.equal(start.toISOString(), "2026-09-29T23:00:00.000Z");
});

test("stays on today's session until it ends, then rolls to next week", () => {
  const during = currentSessionStart(tuesday7pmToronto, new Date("2026-09-30T00:00:00Z")); // Tue 20:00 local
  assert.equal(during.toISOString(), "2026-09-29T23:00:00.000Z");
  const afterEnd = currentSessionStart(tuesday7pmToronto, new Date("2026-09-30T00:45:00Z")); // Tue 20:45 local
  assert.equal(afterEnd.toISOString(), "2026-10-06T23:00:00.000Z");
});

test("handles DST change (Toronto falls back 2026-11-01)", () => {
  const start = currentSessionStart(tuesday7pmToronto, new Date("2026-11-01T12:00:00Z"));
  assert.equal(start.toISOString(), "2026-11-04T00:00:00.000Z"); // 19:00 EST = 00:00Z
});

test("two days a week: Thursday comes after Tuesday", () => {
  const s = { ...tuesday7pmToronto, weekdays: [2, 4] };
  assert.deepEqual(
    scheduledStarts(s, new Date("2026-09-27T16:00:00Z"), 3).map((d) => d.toISOString()),
    ["2026-09-29T23:00:00.000Z", "2026-10-01T23:00:00.000Z", "2026-10-06T23:00:00.000Z"],
  );
});

test("daylight saving: a 7:30 PM game stays at 7:30 PM local across the change", () => {
  const s = { weekdays: [2], intervalWeeks: 1, startsOn: "2026-10-01", endsOn: null, startTime: "19:30", durationMinutes: 120, timezone: "America/Toronto" };
  const [before, after] = scheduledStarts(s, new Date("2026-10-26T12:00:00Z"), 2);
  assert.equal(before!.toISOString(), "2026-10-27T23:30:00.000Z"); // EDT, UTC-4
  assert.equal(after!.toISOString(), "2026-11-04T00:30:00.000Z"); // EST, UTC-5: still 7:30 PM Tuesday
  const spring = scheduledStarts(s, new Date("2027-03-08T12:00:00Z"), 2);
  assert.equal(spring[0]!.toISOString(), "2027-03-10T00:30:00.000Z"); // Tue Mar 9, EST
  assert.equal(spring[1]!.toISOString(), "2027-03-16T23:30:00.000Z"); // Tue Mar 16, EDT
});

test("a late game that crosses midnight belongs to the day it starts", () => {
  const s = { weekdays: [5], intervalWeeks: 1, startsOn: "2026-10-01", endsOn: null, startTime: "23:00", durationMinutes: 120, timezone: "America/Vancouver" };
  const [first] = scheduledStarts(s, new Date("2026-10-05T12:00:00Z"), 1);
  assert.equal(first!.toISOString(), "2026-10-10T06:00:00.000Z"); // Fri Oct 9, 11 PM PDT
  // Two hours in, it's still this week's game.
  assert.equal(currentSessionStart(s, new Date("2026-10-10T07:30:00Z")).toISOString(), "2026-10-10T06:00:00.000Z");
  assert.equal(currentSessionStart(s, new Date("2026-10-10T08:30:00Z")).toISOString(), "2026-10-17T06:00:00.000Z");
});

test("every other week counts from the season start, and the last game respects the end date", () => {
  const s = { weekdays: [3], intervalWeeks: 2, startsOn: "2026-09-30", endsOn: "2026-11-11", startTime: "20:00", durationMinutes: 120, timezone: "UTC" };
  const dates = scheduledStarts(s, new Date("2026-09-01T00:00:00Z"), 10).map((d) => d.toISOString().slice(0, 10));
  assert.deepEqual(dates, ["2026-09-30", "2026-10-14", "2026-10-28", "2026-11-11"]);
  assert.equal(lastScheduledStart(s)!.toISOString(), "2026-11-11T20:00:00.000Z");
});
