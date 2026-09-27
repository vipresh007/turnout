import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGroupSentence } from "./heuristic.ts";

test("parses a typical pickup sentence", () => {
  assert.deepEqual(parseGroupSentence("Tuesday soccer at Riverside Park, 7:30pm, 14 players"), {
    weekdays: [2],
    startTime: "19:30",
    cap: 14,
    activity: "soccer",
    location: "Riverside Park",
    name: "Tuesday Soccer",
  });
});

test("handles 24h time and 'max'", () => {
  const d = parseGroupSentence("basketball every thursday 18:00 max 10");
  assert.deepEqual(d.weekdays, [4]);
  assert.equal(d.startTime, "18:00");
  assert.equal(d.cap, 10);
});

test("several days and every other week", () => {
  const d = parseGroupSentence("pickup hoops tuesdays and thursdays 6pm, every other week");
  assert.deepEqual(d.weekdays, [2, 4]);
  assert.equal(d.intervalWeeks, 2);
});
