import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRoster } from "./roster.ts";
import { describeLead, groupInsights, inviteMessage, type PastGame } from "./insights.ts";

const h = (base: string, hoursBefore: number) => new Date(Date.parse(base) - hoursBefore * 3_600_000).toISOString();
const game = (startsAt: string, answers: [string, "in" | "out", number, boolean?][], cancelled = false): PastGame => ({
  startsAt, cancelled,
  rsvps: answers.map(([id, status, before, lateDrop]) => ({ memberId: id, name: id, status, respondedAt: h(startsAt, before), lateDrop: !!lateDrop })),
});
const members = ["mike", "raj", "sam", "ana"].map((id) => ({ id, name: id, joinedAt: "2026-01-01T00:00:00Z" }));

const games = [
  game("2026-09-01T23:00:00Z", [["mike", "in", 48], ["raj", "in", 30], ["sam", "in", 10], ["ana", "out", 2, true]]),
  game("2026-09-08T23:00:00Z", [["mike", "in", 50], ["raj", "in", 20], ["sam", "out", 1, true]]),
  game("2026-09-15T23:00:00Z", [], true),
  game("2026-09-22T23:00:00Z", [["mike", "in", 40], ["sam", "in", 5], ["raj", "in", 3]]),
];

test("player reliability counts spots, outs, silence and late drops", () => {
  const { players } = groupInsights({ cap: 2, timezone: "America/Toronto", games, members });
  const mike = players.find((p) => p.memberId === "mike")!;
  assert.deepEqual([mike.played, mike.games, mike.out, mike.noAnswer, mike.lateDrops], [3, 3, 0, 0, 0]);
  const raj = players.find((p) => p.memberId === "raj")!;
  assert.equal(raj.played, 2); // waitlisted in the last game (cap 2)
  const ana = players.find((p) => p.memberId === "ana")!;
  assert.deepEqual([ana.played, ana.out, ana.noAnswer, ana.lateDrops], [0, 1, 2, 1]);
  assert.equal(players[0]!.memberId, "mike");
  assert.equal(mike.answerLeadHours, 48);
});

test("group health: turnout, waitlist, late drops, cancellations, fill time", () => {
  const { health, expectedLateDrops } = groupInsights({ cap: 2, timezone: "America/Toronto", games, members });
  assert.equal(health.games, 4);
  assert.equal(health.cancelled, 1);
  assert.equal(health.avgPlayers, 2);
  assert.equal(health.fillRate, 1);
  assert.equal(health.avgWaitlist, 2 / 3);
  assert.equal(health.filledGames, 3);
  assert.equal(health.fullLeadHours, 20); // filled 30h, 20h and 5h before
  assert.equal(expectedLateDrops, 1); // 2 late drops over 3 games
});

test("invite suggestions: regulars who haven't answered this week, best first", () => {
  const roster = buildRoster([{ memberId: "sam", name: "sam", status: "in", respondedAt: "2026-09-28T00:00:00Z" }], 4);
  const { invite } = groupInsights({ cap: 4, timezone: "America/Toronto", games, members, current: { roster, cancelled: false } });
  assert.deepEqual(invite.map((i) => i.memberId), ["mike", "raj"]); // ana never played; sam already in
  assert.equal(groupInsights({ cap: 4, timezone: "America/Toronto", games, members, current: { roster, cancelled: true } }).invite.length, 0);
});

test("new members only count games since they joined", () => {
  const late = [...members, { id: "zoe", name: "zoe", joinedAt: "2026-09-20T00:00:00Z" }];
  const zoe = groupInsights({ cap: 2, timezone: "America/Toronto", games, members: late }).players.find((p) => p.memberId === "zoe")!;
  assert.deepEqual([zoe.games, zoe.noAnswer], [1, 1]);
});

test("messages and durations", () => {
  assert.equal(inviteMessage("Mike", "Tuesday Hoops", 3, "Tue · 7 PM", "https://x/g/a"), "Hey Mike! We're short 3 for Tuesday Hoops (Tue · 7 PM). Want to play? Tap in here: https://x/g/a");
  assert.equal(describeLead(0.5), "under an hour");
  assert.equal(describeLead(5), "about 5h");
  assert.equal(describeLead(50), "about 2 days");
});

test("time slots compare turnout by day and time", () => {
  const same = groupInsights({ cap: 10, timezone: "America/Toronto", games, members });
  assert.deepEqual(same.timeSlots, []); // every game was Tue 7 PM
  const mixed = [...games, game("2026-09-25T01:00:00Z", [["mike", "in", 5]])]; // Thu 9 PM Toronto
  const slots = groupInsights({ cap: 10, timezone: "America/Toronto", games: mixed, members }).timeSlots;
  assert.deepEqual(slots.map((s) => s.label), ["Tue 7:00 PM", "Thu 9:00 PM"]);
  assert.equal(slots[1]!.avgPlayers, 1);
});
