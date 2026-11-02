import assert from "node:assert/strict";
import { test } from "node:test";
import { referralSource, weeklyDigest, type DigestGroup } from "./digest.ts";

const group = (over: Partial<DigestGroup>): DigestGroup => ({ name: "Sunday Soccer", activity: "soccer", slug: "s1", last: null, next: null, streaks: [], newPlayers: 0, ...over });

test("digest: a line per group with what happened and what's next", () => {
  const d = weeklyDigest([
    group({ last: { played: 14, cap: 16, cancelled: false, lateDrops: 2, unpaidCents: 1600 }, next: { startsAt: "2026-11-08T15:00:00Z", when: "Sun 10am", confirmed: 5, goal: 16 }, streaks: [{ name: "Maya", streak: 6 }], newPlayers: 1 }),
    group({ name: "Tuesday Basketball", activity: "basketball", slug: "b1", last: { played: 0, cap: 12, cancelled: true, lateDrops: 0, unpaidCents: null } }),
  ]);
  assert.equal(d.lines[0]!.text, "14 of 16 played last week · 2 late drops · $16 unpaid · 1 new player · Maya 6 in a row · next: Sun 10am, 5/16 in so far");
  assert.equal(d.lines[1]!.text, "Last week was cancelled");
  assert.match(d.tip!, /\$16 is still unpaid for Sunday Soccer/);
  assert.equal(d.subject, "Your week on Turnout: 1 game played, 1 thing to do");
  assert.equal(d.empty, false);
});

test("digest: tip falls back to a short game, then late drops; empty when nothing happened", () => {
  const short = weeklyDigest([group({ last: { played: 10, cap: 16, cancelled: false, lateDrops: 0, unpaidCents: null }, next: { startsAt: "x", when: "Sun", confirmed: 3, goal: 16 } })]);
  assert.match(short.tip!, /3 of 16 so far/);
  const flaky = weeklyDigest([group({ last: { played: 12, cap: 16, cancelled: false, lateDrops: 3, unpaidCents: null } })]);
  assert.match(flaky.tip!, /3 late drops/);
  assert.equal(weeklyDigest([group({})]).empty, true);
});

test("referral source: ref beats utm, values are cleaned", () => {
  assert.equal(referralSource({ ref: "AbC123" }), "group:abc123");
  assert.equal(referralSource({ utm_source: "Instagram", utm_campaign: "fall launch!" }), "instagram/falllaunch");
  assert.equal(referralSource({ utm_source: "reddit" }), "reddit");
  assert.equal(referralSource({}), null);
});
