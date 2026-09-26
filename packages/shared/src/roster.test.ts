import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRoster, needPlayersMessage, placeOf, promotedMembers, type Rsvp } from "./roster.ts";

const r = (memberId: string, status: Rsvp["status"], minute: number): Rsvp => ({
  memberId,
  name: memberId.toUpperCase(),
  status,
  respondedAt: new Date(Date.UTC(2026, 0, 1, 12, minute)).toISOString(),
});

test("first come, first served up to the cap", () => {
  const roster = buildRoster([r("c", "in", 3), r("a", "in", 1), r("b", "in", 2)], 2);
  assert.deepEqual(roster.confirmed.map((x) => x.memberId), ["a", "b"]);
  assert.deepEqual(roster.waitlist.map((x) => x.memberId), ["c"]);
  assert.equal(roster.spotsLeft, 0);
});

test("a dropout promotes the first waitlisted member", () => {
  const before = buildRoster([r("a", "in", 1), r("b", "in", 2), r("c", "in", 3), r("d", "in", 4)], 2);
  const after = buildRoster([r("a", "out", 5), r("b", "in", 2), r("c", "in", 3), r("d", "in", 4)], 2);
  assert.deepEqual(promotedMembers(before, after).map((x) => x.memberId), ["c"]);
  assert.deepEqual(placeOf(after, "d"), { kind: "waitlist", position: 1 });
  assert.deepEqual(placeOf(after, "a"), { kind: "out" });
});

test("rejoining goes to the back of the line", () => {
  const roster = buildRoster([r("a", "in", 10), r("b", "in", 2), r("c", "in", 3)], 2);
  assert.deepEqual(roster.waitlist.map((x) => x.memberId), ["a"]);
});

test("no cap means everyone is confirmed", () => {
  const roster = buildRoster([r("a", "in", 1), r("b", "in", 2)], null);
  assert.equal(roster.confirmed.length, 2);
  assert.equal(roster.spotsLeft, 0);
});

test("need-players message", () => {
  const roster = buildRoster([r("a", "in", 1)], 3);
  assert.equal(
    needPlayersMessage("Tuesday Soccer", roster, "https://x/g/abc"),
    "Tuesday Soccer: 1/3 in, we need 2 more players! Tap to join: https://x/g/abc",
  );
  assert.equal(needPlayersMessage("Full", buildRoster([r("a", "in", 1)], 1), "x"), null);
});
