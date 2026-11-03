import { test } from "node:test";
import assert from "node:assert/strict";
import { balanceTeams, keepTeams, type TeamPlayer, teamsText } from "./teams.ts";

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

test("teams text reads as a chat post: title, when and where, a block per team, the link", () => {
  assert.equal(
    teamsText("Sunday Soccer", [["Arjun", "Grace"], ["Yusuf"]], "soccer"),
    "⚽ *Sunday Soccer · Teams*\n\n🟢 *Team A* (2)\n1. Arjun\n2. Grace\n\n🔵 *Team B* (1)\n1. Yusuf\n\nSee you there 🙌",
  );
  const text = teamsText("Sunday Soccer", [["Arjun"], ["Yusuf"]], "soccer", { startsAt: "2026-11-08T15:00:00Z", timezone: "America/Toronto", location: "Lamport Stadium", link: "https://turnout.dataeaver.ca/g/s1" });
  assert.equal(text.split("\n")[1], "Sun, Nov 8 · 10:00 AM · Lamport Stadium");
  assert.ok(text.endsWith("See you there 🙌\nhttps://turnout.dataeaver.ca/g/s1"));
});

test("saved teams follow who's in: leavers drop out, newcomers join the smallest team", () => {
  const p = (memberId: string, skill = 3): TeamPlayer => ({ memberId, name: memberId, skill });
  const { teams, added } = keepTeams([["a", "b", "c"], ["d", "e", "f"]], [p("a"), p("b"), p("d", 5), p("e"), p("f"), p("g", 2)]);
  assert.deepEqual(teams.map((t) => t.players.map((x) => x.memberId)), [["a", "b", "g"], ["d", "e", "f"]]);
  assert.deepEqual(teams.map((t) => t.total), [8, 11]);
  assert.deepEqual(added.map((x) => x.memberId), ["g"]);
});
