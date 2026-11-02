import { formatMoney } from "./cost.ts";
import { activityEmoji } from "./share.ts";

// The organizer's weekly digest: last week's games across their groups, what's coming, and one thing to do.
// The API gathers the numbers; this file decides what's worth saying and how.

export interface DigestGroup {
  name: string;
  activity: string | null;
  slug: string;
  /** Last week's game, if there was one in the last 7 days. */
  last: { played: number; cap: number | null; cancelled: boolean; lateDrops: number; unpaidCents: number | null } | null;
  /** The next game. */
  next: { startsAt: string; when: string; confirmed: number; goal: number | null } | null;
  /** Players with the longest current streak in this group (2+ in a row). */
  streaks: { name: string; streak: number }[];
  newPlayers: number;
}

export interface Digest {
  subject: string;
  /** One line per group, for the email and the push. */
  lines: { group: string; slug: string; text: string }[];
  /** The single most useful nudge, if any. */
  tip: string | null;
  /** Nothing happened worth an email (no games last week and none coming). */
  empty: boolean;
}

export function weeklyDigest(groups: DigestGroup[]): Digest {
  const lines = groups.map((g) => {
    const parts: string[] = [];
    if (g.last?.cancelled) parts.push("last week was cancelled");
    else if (g.last) parts.push(`${g.last.played}${g.last.cap ? ` of ${g.last.cap}` : ""} played last week`);
    if (g.last && !g.last.cancelled && g.last.lateDrops) parts.push(`${g.last.lateDrops} late ${g.last.lateDrops === 1 ? "drop" : "drops"}`);
    if (g.last?.unpaidCents) parts.push(`${formatMoney(g.last.unpaidCents)} unpaid`);
    if (g.newPlayers) parts.push(`${g.newPlayers} new ${g.newPlayers === 1 ? "player" : "players"}`);
    const top = g.streaks[0];
    if (top && top.streak >= 3) parts.push(`${top.name} ${top.streak} in a row`);
    if (g.next) parts.push(`next: ${g.next.when}, ${g.next.confirmed}${g.next.goal ? `/${g.next.goal}` : ""} in so far`);
    return { group: `${activityEmoji(g.activity, g.name)} ${g.name}`, slug: g.slug, text: parts.length ? cap(parts.join(" · ")) : "No games last week" };
  });

  // One nudge, most useful first: money owed, then a game that's short, then late drops.
  const owed = groups.filter((g) => g.last?.unpaidCents).sort((a, b) => b.last!.unpaidCents! - a.last!.unpaidCents!)[0];
  const short = groups.find((g) => g.next && g.next.goal && g.next.confirmed < g.next.goal / 2);
  const flaky = groups.find((g) => (g.last?.lateDrops ?? 0) >= 2);
  const tip = owed
    ? `${formatMoney(owed.last!.unpaidCents!)} is still unpaid for ${owed.name}. "Remind unpaid" on the group page nudges just those players.`
    : short
      ? `${short.name} has ${short.next!.confirmed} of ${short.next!.goal} so far. Share the link now; people answer most the first day.`
      : flaky
        ? `${flaky.name} had ${flaky.last!.lateDrops} late drops. A reminder the evening before usually cuts them.`
        : null;

  const empty = groups.every((g) => !g.last && !g.next);
  const games = groups.filter((g) => g.last && !g.last.cancelled).length;
  const subject = games
    ? `Your week on Turnout: ${games} ${games === 1 ? "game" : "games"} played${tip ? ", 1 thing to do" : ""}`
    : "Your week on Turnout";
  return { subject, lines, tip, empty };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Where a new organizer came from, for attribution: a `ref` (the group whose page they came from) or UTM tags.
 * First touch wins; the client keeps it and sends it with their first group.
 */
export function referralSource(params: Record<string, string | undefined>): string | null {
  const clean = (v: string | undefined) => (v ? v.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40) : "");
  const ref = clean(params.ref);
  if (ref) return `group:${ref}`;
  const source = clean(params.utm_source);
  if (!source) return null;
  const campaign = clean(params.utm_campaign);
  return campaign ? `${source}/${campaign}` : source;
}
