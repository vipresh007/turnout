// A player's own record: how often they play, their streak, what they owe. Private to that player.

/** What happened for one player at one past game. Cancelled games are left out before this point. */
export type PlayerGameStatus = "played" | "waitlist" | "out" | "none";

export interface PlayerGame {
  startsAt: string;
  status: PlayerGameStatus;
  /** Said out close to game time. */
  lateDrop: boolean;
  /** Marked paid by the organizer (only meaningful when they played). */
  paid: boolean;
}

export interface PlayerStats {
  /** Past games (not cancelled) since the player joined. */
  games: number;
  played: number;
  /** played / games, or null before their first game. */
  attendance: number | null;
  /** Games played in a row, up to the most recent one. */
  streak: number;
  bestStreak: number;
  lateDrops: number;
  /** Games played but not marked paid (only counted when the group has a per-game cost). */
  unpaid: number;
  lastPlayed: string | null;
}

/** Stats from a player's games, newest first. `tracksPayment` is false for groups with no per-game cost. */
export function playerStats(games: PlayerGame[], tracksPayment = false): PlayerStats {
  let streak = 0;
  let run = 0;
  let bestStreak = 0;
  let countingCurrent = true;
  for (const g of games) {
    if (g.status === "played") {
      run++;
      bestStreak = Math.max(bestStreak, run);
      if (countingCurrent) streak = run;
    } else {
      run = 0;
      countingCurrent = false;
    }
  }
  const played = games.filter((g) => g.status === "played");
  return {
    games: games.length,
    played: played.length,
    attendance: games.length ? played.length / games.length : null,
    streak,
    bestStreak,
    lateDrops: games.filter((g) => g.status === "out" && g.lateDrop).length,
    unpaid: tracksPayment ? played.filter((g) => !g.paid).length : 0,
    lastPlayed: played[0]?.startsAt ?? null,
  };
}

/** Totals across groups for the "Your stats" summary. The streak shown is the best current one. */
export function combinePlayerStats(all: PlayerStats[]): PlayerStats {
  const games = all.reduce((n, s) => n + s.games, 0);
  const played = all.reduce((n, s) => n + s.played, 0);
  const last = all.map((s) => s.lastPlayed).filter((d): d is string => !!d).sort().at(-1) ?? null;
  return {
    games,
    played,
    attendance: games ? played / games : null,
    streak: Math.max(0, ...all.map((s) => s.streak)),
    bestStreak: Math.max(0, ...all.map((s) => s.bestStreak)),
    lateDrops: all.reduce((n, s) => n + s.lateDrops, 0),
    unpaid: all.reduce((n, s) => n + s.unpaid, 0),
    lastPlayed: last,
  };
}
