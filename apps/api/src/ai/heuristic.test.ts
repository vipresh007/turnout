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

test("time ranges and costs", () => {
  const d = parseGroupSentence("Season game, every wed 8-10pm, volleyball at David Suzuki School. Cost for the whole season is 2500, max 16 people.");
  assert.deepEqual(d.weekdays, [3]);
  assert.equal(d.startTime, "20:00");
  assert.equal(d.durationMinutes, 120);
  assert.equal(d.seasonFeeCents, 250000);
  assert.equal(d.feeCents, undefined);
  assert.equal(d.cap, 16);
  assert.equal(d.location, "David Suzuki School");
  assert.equal(parseGroupSentence("Tuesday soccer 7:30pm to 9:30pm, $10 each").feeCents, 1000);
  const split = parseGroupSentence("Friday hoops 6-8pm, $150 court split between everyone");
  assert.deepEqual([split.feeCents, split.feeSplit, split.startTime, split.durationMinutes], [15000, true, "18:00", 120]);
  assert.equal(parseGroupSentence("Sunday run club at 7am, 20 people").feeCents, undefined);
});
