import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlayerStats } from "./playerStats.ts";
import { shouldOfferSignIn } from "./prompts.ts";

const stats = (played: number): PlayerStats => ({ games: played, played, attendance: 1, streak: played, bestStreak: played, lateDrops: 0, unpaid: 0, lastPlayed: null });
const day = 86_400_000;

test("sign-in prompt: after two games, at most twice, a month apart", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  assert.equal(shouldOfferSignIn(stats(1), { shows: 0, lastAt: null }, now), false);
  assert.equal(shouldOfferSignIn(stats(2), { shows: 0, lastAt: null }, now), true);
  assert.equal(shouldOfferSignIn(stats(5), { shows: 1, lastAt: new Date(now.getTime() - 3 * day).toISOString() }, now), false);
  assert.equal(shouldOfferSignIn(stats(5), { shows: 1, lastAt: new Date(now.getTime() - 31 * day).toISOString() }, now), true);
  assert.equal(shouldOfferSignIn(stats(20), { shows: 2, lastAt: new Date(now.getTime() - 90 * day).toISOString() }, now), false);
});
