import { test } from "node:test";
import assert from "node:assert/strict";
import { currentSessionStart } from "./schedule.ts";

const tuesday7pmToronto = { weekday: 2, startTime: "19:00", durationMinutes: 90, timezone: "America/Toronto" };

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
