import { test } from "node:test";
import assert from "node:assert/strict";
import { balanceTeams, type TeamPlayer } from "./teams.ts";

const p = (name: string, skill: number): TeamPlayer => ({ memberId: name, name, skill });

test("two even teams from mixed skills", () => {
  const players = [p("A", 5), p("B", 5), p("C", 4), p("D", 3), p("E", 3), p("F", 2), p("G", 2), p("H", 1)];
  const teams = balanceTeams(players, 2, 42);
  assert.equal(teams.length, 2);
  assert.deepEqual(teams.map((t) => t.players.length), [4, 4]);
  assert.ok(Math.abs(teams[0]!.total - teams[1]!.total) <= 1, `totals ${teams.map((t) => t.total)}`);
  assert.equal(new Set(teams.flatMap((t) => t.players.map((x) => x.memberId))).size, 8); // everyone once
});

test("odd count keeps sizes within one; three teams work", () => {
  const players = Array.from({ length: 10 }, (_, i) => p(`P${i}`, (i % 5) + 1));
  const teams = balanceTeams(players, 3, 7);
  const sizes = teams.map((t) => t.players.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  const totals = teams.map((t) => t.total);
  assert.ok(Math.max(...totals) - Math.min(...totals) <= 2, `totals ${totals}`);
});

test("same seed, same teams; different seeds can differ among equal skills", () => {
  const players = Array.from({ length: 8 }, (_, i) => p(`P${i}`, 3));
  const a = JSON.stringify(balanceTeams(players, 2, 1));
  assert.equal(JSON.stringify(balanceTeams(players, 2, 1)), a);
  const variants = new Set(Array.from({ length: 10 }, (_, s) => JSON.stringify(balanceTeams(players, 2, s + 100))));
  assert.ok(variants.size > 1);
});
