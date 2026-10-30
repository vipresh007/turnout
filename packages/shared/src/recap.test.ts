import assert from "node:assert/strict";
import { test } from "node:test";
import { recapMessage, recapSummary } from "./recap.ts";

const session = { id: "s1", startsAt: "2026-10-27T23:30:00.000Z", cap: 12 };
const played = [{ memberId: "a", name: "Maya" }, { memberId: "b", name: "Jordan" }, { memberId: "c", name: "Priya" }];

test("recap: counts shout-outs, picks the MVP, knows what the viewer gave", () => {
  const r = recapSummary(session, played, [
    { fromMemberId: "b", toMemberId: "a", kind: "mvp" },
    { fromMemberId: "c", toMemberId: "a", kind: "mvp" },
    { fromMemberId: "a", toMemberId: "c", kind: "thanks" },
    { fromMemberId: "zzz", toMemberId: "a", kind: "mvp" }, // someone who didn't play: ignored for counts? No: from doesn't matter, to must have played
    { fromMemberId: "b", toMemberId: "nobody", kind: "thanks" }, // to someone who didn't play: ignored
  ], "a");
  assert.equal(r.mvp?.name, "Maya");
  assert.equal(r.mvp?.mvp, 3);
  assert.deepEqual(r.players.map((p) => p.name), ["Maya", "Priya", "Jordan"]);
  assert.deepEqual(r.yours, { mvp: null, thanks: "c" });
  assert.equal(r.voters, 4);
  assert.equal(recapSummary(session, played, [], "nobody").yours, null);
  assert.equal(recapSummary(session, played, [], null).mvp, null);
});

test("recap message: what, when, how many, who shone", () => {
  const r = recapSummary(session, played, [{ fromMemberId: "b", toMemberId: "a", kind: "mvp" }, { fromMemberId: "a", toMemberId: "c", kind: "thanks" }], null);
  const msg = recapMessage({ name: "Tuesday Basketball", activity: "basketball", timezone: "America/Toronto" }, r, "https://t.example/g/x");
  assert.match(msg, /🏀 Tuesday Basketball recap · Tue, Oct 27/);
  assert.match(msg, /3 played/);
  assert.match(msg, /MVP: Maya$/m);
  assert.match(msg, /Shout-outs: Priya/);
  assert.match(msg, /Next game: https:\/\/t.example\/g\/x$/);
});
