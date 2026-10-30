import type { PlayerStats } from "./playerStats.ts";

// Badges a player earns from their own record. They're a reason to come back and, later, a reason to sign in so
// they follow you to a new phone. Everything here is derived from PlayerStats, so there's nothing to store.

export type BadgeId = "first_game" | "regular" | "veteran" | "on_a_roll" | "unbreakable" | "reliable";

export interface Badge {
  id: BadgeId;
  title: string;
  /** What it takes, in one line. */
  body: string;
  earned: boolean;
  /** 0..1 toward earning it (1 when earned). */
  progress: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const RULES: { id: BadgeId; title: string; body: string; progress: (s: PlayerStats) => number }[] = [
  { id: "first_game", title: "First game", body: "Played your first game", progress: (s) => clamp01(s.played / 1) },
  { id: "on_a_roll", title: "On a roll", body: "3 games in a row", progress: (s) => clamp01(s.streak / 3) },
  { id: "regular", title: "Regular", body: "10 games played", progress: (s) => clamp01(s.played / 10) },
  { id: "reliable", title: "Reliable", body: "90% attendance over 8+ games, no late drops", progress: (s) => (s.games < 8 ? clamp01(s.games / 8) * 0.9 : s.lateDrops === 0 ? clamp01((s.attendance ?? 0) / 0.9) : 0.9) },
  { id: "unbreakable", title: "Unbreakable", body: "8 games in a row", progress: (s) => clamp01(s.bestStreak / 8) },
  { id: "veteran", title: "Veteran", body: "25 games played", progress: (s) => clamp01(s.played / 25) },
];

/** Every badge with whether it's earned and how close it is, in the order they're usually earned. */
export function badges(stats: PlayerStats): Badge[] {
  return RULES.map((r) => {
    const progress = r.progress(stats);
    return { id: r.id, title: r.title, body: r.body, earned: progress >= 1, progress };
  });
}

/** The unearned badge the player is closest to, for a "next up" line. */
export function nextBadge(stats: PlayerStats): Badge | null {
  const open = badges(stats).filter((b) => !b.earned);
  if (open.length === 0) return null;
  return open.reduce((best, b) => (b.progress > best.progress ? b : best));
}

/** Badges earned in `after` that weren't in `before`, for a one-time "you earned…" moment. */
export function newlyEarned(before: PlayerStats, after: PlayerStats): Badge[] {
  const had = new Set(badges(before).filter((b) => b.earned).map((b) => b.id));
  return badges(after).filter((b) => b.earned && !had.has(b.id));
}
