import { test } from "node:test";
import assert from "node:assert/strict";
import { combinePlayerStats, playerStats, type PlayerGame } from "./playerStats.ts";

const game = (status: PlayerGame["status"], extra: Partial<PlayerGame> = {}, i = 0): PlayerGame => ({
  startsAt: new Date(Date.UTC(2026, 8, 30 - i * 7)).toISOString(), status, lateDrop: false, paid: false, ...extra,
});
const history = (...s: PlayerGame["status"][]) => s.map((status, i) => game(status, {}, i)); // newest first

test("streak counts back from the latest game; best streak looks at all of them", () => {
  const s = playerStats(history("played", "played", "out", "played", "played", "played", "none"));
  assert.equal(s.streak, 2);
  assert.equal(s.bestStreak, 3);
  assert.equal(s.played, 5);
  assert.equal(s.games, 7);
  assert.equal(s.attendance, 5 / 7);
});

test("missing the latest game resets the current streak, not the best", () => {
  const s = playerStats(history("waitlist", "played", "played"));
  assert.deepEqual([s.streak, s.bestStreak], [0, 2]);
});

test("no games yet: attendance is unknown, not zero", () => {
  const s = playerStats([]);
  assert.equal(s.attendance, null);
  assert.equal(s.lastPlayed, null);
  assert.equal(s.streak, 0);
});

test("late drops and unpaid games are counted; unpaid only when the group tracks payment", () => {
  const games = [game("played", { paid: true }, 0), game("played", {}, 1), game("out", { lateDrop: true }, 2), game("out", {}, 3)];
  assert.equal(playerStats(games, true).unpaid, 1);
  assert.equal(playerStats(games, false).unpaid, 0);
  assert.equal(playerStats(games).lateDrops, 1);
  assert.equal(playerStats(games).lastPlayed, games[0]!.startsAt);
});

test("totals across groups add up, keep the best streak and the latest game", () => {
  const a = playerStats(history("played", "played", "out"));
  const b = playerStats(history("out", "played", "played", "played"));
  const all = combinePlayerStats([a, b]);
  assert.deepEqual([all.games, all.played, all.streak, all.bestStreak], [7, 5, 2, 3]);
  assert.equal(all.lastPlayed, a.lastPlayed);
  assert.equal(combinePlayerStats([]).attendance, null);
});
