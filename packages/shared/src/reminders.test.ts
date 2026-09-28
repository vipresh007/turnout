import { test } from "node:test";
import assert from "node:assert/strict";
import { dueReminders, groupChatReminder, reminderTimes } from "./reminders.ts";

const tz = "America/Toronto";
// Wed 2026-09-30 20:00 Toronto (EDT) = 2026-10-01T00:00Z
const start = new Date("2026-10-01T00:00:00Z");

test("day-before is 6pm local the previous day; hours-before counts back from start", () => {
  const t = reminderTimes(start, tz, { dayBefore: true, hoursBefore: 2 });
  assert.equal(t.dayBefore?.toISOString(), "2026-09-29T22:00:00.000Z"); // Tue 18:00 EDT
  assert.equal(t.hoursBefore?.toISOString(), "2026-09-30T22:00:00.000Z"); // Wed 18:00 EDT
});

test("day-before across the DST change uses the right offset", () => {
  // Mon 2026-11-02 19:00 EST = 2026-11-03T00:00Z; the day before (Sun Nov 1) is already EST.
  const t = reminderTimes(new Date("2026-11-03T00:00:00Z"), tz, { dayBefore: true, hoursBefore: null });
  assert.equal(t.dayBefore?.toISOString(), "2026-11-01T23:00:00.000Z");
});

test("due only inside the grace window and before the game", () => {
  const s = { dayBefore: true, hoursBefore: 2 };
  assert.deepEqual(dueReminders(start, tz, s, new Date("2026-09-29T21:59:00Z")), []);
  assert.deepEqual(dueReminders(start, tz, s, new Date("2026-09-29T22:05:00Z")), ["dayBefore"]);
  assert.deepEqual(dueReminders(start, tz, s, new Date("2026-09-30T03:00:00Z")), []); // 5h late: skipped
  assert.deepEqual(dueReminders(start, tz, s, new Date("2026-09-30T22:10:00Z")), ["hoursBefore"]);
  assert.deepEqual(dueReminders(start, tz, s, new Date("2026-10-01T00:01:00Z")), []); // game started
});

test("morning games drop the day-before reminder when it would collide", () => {
  // 8am game with a 16-hour reminder lands before 6pm the previous day, so only one is kept.
  const t = reminderTimes(new Date("2026-10-01T12:00:00Z"), tz, { dayBefore: true, hoursBefore: 16 });
  assert.equal(t.dayBefore, undefined);
  assert.ok(t.hoursBefore);
});

test("group chat reminder text", () => {
  assert.equal(
    groupChatReminder("Volleyball", "Wed 8pm", 9, 14, "https://x/g/a"),
    "⏰ Volleyball: Wed 8pm. 9/14 in so far. We need 5 more! Tap to confirm: https://x/g/a",
  );
});

test("first reminder 24 hours before, then the final one", () => {
  const start = new Date("2026-10-06T23:30:00Z");
  const t = reminderTimes(start, "America/Toronto", { dayBefore: true, hoursBefore: 2, first: "24h" });
  assert.equal(t.dayBefore!.toISOString(), "2026-10-05T23:30:00.000Z");
  assert.equal(t.hoursBefore!.toISOString(), "2026-10-06T21:30:00.000Z");
});
