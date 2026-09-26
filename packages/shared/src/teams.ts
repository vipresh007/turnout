export interface TeamPlayer {
  memberId: string;
  name: string;
  /** 1 (new) to 5 (strongest). Unrated players count as 3. */
  skill: number;
}

export interface Team {
  players: TeamPlayer[];
  total: number;
}

export const DEFAULT_SKILL = 3;
export const teamNames = ["Team A", "Team B", "Team C", "Team D"];

/** Small seeded PRNG (mulberry32) so a shuffle is repeatable in tests and varies in the app. */
function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Splits players into `count` teams with skill totals as even as possible and sizes within one.
 * Snake draft by skill (ties shuffled by `seed`), then a swap pass that narrows the gap.
 */
export function balanceTeams(players: readonly TeamPlayer[], count: number, seed = Date.now()): Team[] {
  const n = Math.max(2, Math.min(count, teamNames.length, Math.max(2, players.length)));
  const rand = random(seed);
  const order = players
    .map((p) => ({ p, tie: rand() }))
    .sort((a, b) => b.p.skill - a.p.skill || a.tie - b.tie)
    .map((x) => x.p);

  const teams: TeamPlayer[][] = Array.from({ length: n }, () => []);
  order.forEach((p, i) => {
    const round = Math.floor(i / n);
    const slot = i % n;
    teams[round % 2 === 0 ? slot : n - 1 - slot]!.push(p);
  });

  const total = (t: TeamPlayer[]) => t.reduce((s, p) => s + p.skill, 0);
  // Swapping one player between the strongest and weakest team keeps sizes; stop when nothing helps.
  for (let pass = 0; pass < 50; pass++) {
    teams.sort((a, b) => total(b) - total(a));
    const hi = teams[0]!;
    const lo = teams[n - 1]!;
    const gap = total(hi) - total(lo);
    let best: [number, number, number] | null = null;
    for (let i = 0; i < hi.length; i++) {
      for (let j = 0; j < lo.length; j++) {
        const d = hi[i]!.skill - lo[j]!.skill;
        const newGap = Math.abs(gap - 2 * d);
        if (d > 0 && newGap < gap && (!best || newGap < best[2])) best = [i, j, newGap];
      }
    }
    if (!best) break;
    const [i, j] = best;
    [hi[i], lo[j]] = [lo[j]!, hi[i]!];
  }

  return teams.map((players) => ({ players, total: total(players) })).sort((a, b) => b.players.length - a.players.length || b.total - a.total);
}

/** Text for sharing teams in the group chat, from each team's player names. */
export function teamsText(groupName: string, teams: string[][]): string {
  const lines = teams.map((names, i) => `${teamNames[i]}: ${names.join(", ")}`);
  return `${groupName} teams 🏁\n${lines.join("\n")}`;
}
