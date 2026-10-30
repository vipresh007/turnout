import type { PlayerStats } from "./playerStats.ts";

// When to suggest, gently, that a player signs in. Never before they've had a couple of games, never more than
// twice, and never twice in a month: the account is optional and should feel like it.

export const SIGN_IN_PROMPT_MIN_PLAYED = 2;
export const SIGN_IN_PROMPT_MAX_SHOWS = 2;
export const SIGN_IN_PROMPT_COOLDOWN_DAYS = 30;

export interface PromptSeen {
  shows: number;
  /** ISO time of the last show, or null. */
  lastAt: string | null;
}

export function shouldOfferSignIn(stats: PlayerStats, seen: PromptSeen, now = new Date()): boolean {
  if (stats.played < SIGN_IN_PROMPT_MIN_PLAYED) return false;
  if (seen.shows >= SIGN_IN_PROMPT_MAX_SHOWS) return false;
  if (seen.lastAt && now.getTime() - new Date(seen.lastAt).getTime() < SIGN_IN_PROMPT_COOLDOWN_DAYS * 86_400_000) return false;
  return true;
}
