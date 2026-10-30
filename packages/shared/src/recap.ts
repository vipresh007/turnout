import { activityEmoji, shortWhen } from "./share.ts";

// The post-game recap: who played, who got the shout-outs, and a line to post in the chat. The API builds it from
// the last played game; this file is the arithmetic and the words.

export type ShoutoutKind = "mvp" | "thanks";

export interface Shoutout {
  fromMemberId: string;
  toMemberId: string;
  kind: ShoutoutKind;
}

export interface RecapPlayer {
  memberId: string;
  name: string;
  mvp: number;
  thanks: number;
}

export interface Recap {
  sessionId: string;
  startsAt: string;
  cap: number | null;
  /** Everyone who played, with their shout-out counts, most-praised first. */
  players: RecapPlayer[];
  /** The MVP: most votes, at least one; ties go to whoever was named first. */
  mvp: RecapPlayer | null;
  /** How many players gave any shout-out. */
  voters: number;
  /** For the member asking: who they named, or null when they didn't play. */
  yours: { mvp: string | null; thanks: string | null } | null;
}

export function recapSummary(
  session: { id: string; startsAt: string; cap: number | null },
  played: { memberId: string; name: string }[],
  shoutouts: Shoutout[],
  viewerMemberId: string | null,
): Recap {
  const counts = new Map(played.map((p) => [p.memberId, { ...p, mvp: 0, thanks: 0 }]));
  const order = new Map<string, number>();
  for (const s of shoutouts) {
    const to = counts.get(s.toMemberId);
    if (!to) continue;
    to[s.kind]++;
    if (!order.has(s.toMemberId)) order.set(s.toMemberId, order.size);
  }
  const players = [...counts.values()].sort((a, b) => b.mvp - a.mvp || b.thanks - a.thanks || (order.get(a.memberId) ?? 1e9) - (order.get(b.memberId) ?? 1e9) || a.name.localeCompare(b.name));
  const top = players[0];
  const mvp = top && top.mvp > 0 ? top : null;
  const viewerPlayed = !!viewerMemberId && counts.has(viewerMemberId);
  const yours = viewerPlayed
    ? {
        mvp: shoutouts.find((s) => s.fromMemberId === viewerMemberId && s.kind === "mvp")?.toMemberId ?? null,
        thanks: shoutouts.find((s) => s.fromMemberId === viewerMemberId && s.kind === "thanks")?.toMemberId ?? null,
      }
    : null;
  return { sessionId: session.id, startsAt: session.startsAt, cap: session.cap, players, mvp, voters: new Set(shoutouts.map((s) => s.fromMemberId)).size, yours };
}

/** The recap as a chat message: "🏀 Tuesday Basketball · Tue, Oct 27 · 12 played · MVP Maya (4 votes)". */
export function recapMessage(group: { name: string; activity: string | null; timezone: string }, recap: Recap, link: string): string {
  const lines = [`${activityEmoji(group.activity, group.name)} ${group.name} recap · ${shortWhen(recap.startsAt, group.timezone)}`, `👥 ${recap.players.length} played`];
  if (recap.mvp) lines.push(`🏆 MVP: ${recap.mvp.name}${recap.mvp.mvp > 1 ? ` (${recap.mvp.mvp} votes)` : ""}`);
  const thanked = recap.players.filter((p) => p.thanks > 0 && p !== recap.mvp).slice(0, 3);
  if (thanked.length) lines.push(`🙌 Shout-outs: ${thanked.map((p) => p.name).join(", ")}`);
  lines.push("", `Next game: ${link}`);
  return lines.join("\n");
}
