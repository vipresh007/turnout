import { test } from "node:test";
import assert from "node:assert/strict";
import { describeRecurrence, endTimeFor, minutesBetween, nextDates, occursOn } from "./schedule.ts";

const weekly = { weekdays: [2], intervalWeeks: 1, startsOn: "2026-09-01", endsOn: null };

test("weekly on one day", () => {
  assert.deepEqual(nextDates("2026-09-27", weekly, 3), ["2026-09-29", "2026-10-06", "2026-10-13"]);
});

test("two days a week", () => {
  assert.deepEqual(nextDates("2026-09-27", { ...weekly, weekdays: [2, 4] }, 4), ["2026-09-29", "2026-10-01", "2026-10-06", "2026-10-08"]);
});

test("every other week, anchored to the start date's week", () => {
  const r = { weekdays: [3], intervalWeeks: 2, startsOn: "2026-09-30", endsOn: null }; // Wed Sep 30
  assert.deepEqual(nextDates("2026-09-27", r, 3), ["2026-09-30", "2026-10-14", "2026-10-28"]);
  assert.equal(occursOn("2026-10-07", r), false);
});

test("sunday games belong to the Monday-started week for intervals", () => {
  const r = { weekdays: [0, 6], intervalWeeks: 2, startsOn: "2026-09-26", endsOn: null }; // Sat + Sun
  assert.deepEqual(nextDates("2026-09-26", r, 4), ["2026-09-26", "2026-09-27", "2026-10-10", "2026-10-11"]);
});

test("respects start and end dates", () => {
  assert.deepEqual(nextDates("2026-08-01", { ...weekly, endsOn: "2026-09-15" }, 5), ["2026-09-01", "2026-09-08", "2026-09-15"]);
});

test("describes the schedule", () => {
  assert.equal(describeRecurrence({ weekdays: [4, 2], intervalWeeks: 1 }), "Every Tue & Thu");
  assert.equal(describeRecurrence({ weekdays: [3], intervalWeeks: 2 }), "Every other Wed");
  assert.equal(describeRecurrence({ weekdays: [1, 3, 5], intervalWeeks: 3 }), "Every 3 weeks on Mon, Wed & Fri");
  assert.equal(describeRecurrence({ weekdays: [0, 6], intervalWeeks: 1 }), "Every Sat & Sun");
});

test("start and end times ↔ duration", () => {
  assert.equal(endTimeFor("19:30", 120), "21:30");
  assert.equal(endTimeFor("22:00", 180), "01:00");
  assert.equal(minutesBetween("19:30", "21:30"), 120);
  assert.equal(minutesBetween("20:00", "00:00"), 240);
  assert.equal(minutesBetween("22:00", "01:00"), 180);
  assert.equal(minutesBetween("19:30", "19:30"), null);
  assert.equal(minutesBetween("7pm", "9pm"), null);
});
