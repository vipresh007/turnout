import assert from "node:assert/strict";
import { test } from "node:test";
import { badges, newlyEarned, nextBadge } from "./badges.ts";
import type { PlayerStats } from "./playerStats.ts";

const stats = (over: Partial<PlayerStats>): PlayerStats => ({
  games: 0, played: 0, attendance: null, streak: 0, bestStreak: 0, lateDrops: 0, unpaid: 0, lastPlayed: null, ...over,
});

test("badges: nothing before the first game, first_game after it", () => {
  assert.equal(badges(stats({})).filter((b) => b.earned).length, 0);
  const one = badges(stats({ games: 1, played: 1, attendance: 1, streak: 1, bestStreak: 1 }));
  assert.deepEqual(one.filter((b) => b.earned).map((b) => b.id), ["first_game"]);
  assert.equal(one.find((b) => b.id === "regular")!.progress, 0.1);
});

test("badges: streaks, regular and veteran thresholds", () => {
  const s = stats({ games: 12, played: 10, attendance: 10 / 12, streak: 3, bestStreak: 8 });
  const earned = badges(s).filter((b) => b.earned).map((b) => b.id).sort();
  assert.deepEqual(earned, ["first_game", "on_a_roll", "regular", "unbreakable"]);
  assert.equal(badges(stats({ games: 30, played: 25, attendance: 25 / 30 })).find((b) => b.id === "veteran")!.earned, true);
});

test("badges: reliable needs 8 games, 90% and no late drops", () => {
  assert.equal(badges(stats({ games: 8, played: 8, attendance: 1 })).find((b) => b.id === "reliable")!.earned, true);
  assert.equal(badges(stats({ games: 8, played: 8, attendance: 1, lateDrops: 1 })).find((b) => b.id === "reliable")!.earned, false);
  assert.equal(badges(stats({ games: 4, played: 4, attendance: 1 })).find((b) => b.id === "reliable")!.earned, false);
});

test("nextBadge picks the closest open one; newlyEarned diffs two records", () => {
  const before = stats({ games: 2, played: 2, attendance: 1, streak: 2, bestStreak: 2 });
  assert.equal(nextBadge(before)!.id, "on_a_roll"); // 2 of 3, ahead of regular at 2 of 10
  const after = stats({ games: 3, played: 3, attendance: 1, streak: 3, bestStreak: 3 });
  assert.deepEqual(newlyEarned(before, after).map((b) => b.id), ["on_a_roll"]);
  assert.deepEqual(newlyEarned(after, after), []);
  assert.equal(nextBadge(stats({ games: 40, played: 40, attendance: 1, streak: 40, bestStreak: 40 })), null);
});
