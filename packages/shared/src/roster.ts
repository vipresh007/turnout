export type RsvpStatus = "in" | "out";

export interface Rsvp {
  memberId: string;
  name: string;
  status: RsvpStatus;
  /** ISO timestamp of the most recent change. Queue position is based on when someone last said "in". */
  respondedAt: string;
}

export interface Roster {
  confirmed: Rsvp[];
  waitlist: Rsvp[];
  out: Rsvp[];
  cap: number | null;
  /** Players still needed to reach the cap; 0 when full or when there is no cap. */
  spotsLeft: number;
}

const byRespondedAt = (a: Rsvp, b: Rsvp) =>
  a.respondedAt.localeCompare(b.respondedAt) || a.memberId.localeCompare(b.memberId);

/**
 * Builds the roster from the RSVPs. It is never stored: the first `cap` people who said "in"
 * are confirmed and the rest wait in line. When a confirmed player drops, the next person on
 * the waitlist moves up automatically.
 */
export function buildRoster(rsvps: readonly Rsvp[], cap: number | null): Roster {
  const ins = rsvps.filter((r) => r.status === "in").sort(byRespondedAt);
  const out = rsvps.filter((r) => r.status === "out").sort(byRespondedAt);
  const limit = cap ?? Infinity;
  const confirmed = ins.slice(0, limit);
  return {
    confirmed,
    waitlist: ins.slice(limit),
    out,
    cap,
    spotsLeft: cap === null ? 0 : Math.max(0, cap - confirmed.length),
  };
}

/** Members who moved from the waitlist to confirmed between two rosters. Use this to send "you're in" notifications. */
export function promotedMembers(before: Roster, after: Roster): Rsvp[] {
  const wasWaiting = new Set(before.waitlist.map((r) => r.memberId));
  return after.confirmed.filter((r) => wasWaiting.has(r.memberId));
}

export type MemberPlace =
  | { kind: "confirmed" }
  | { kind: "waitlist"; position: number }
  | { kind: "out" }
  | { kind: "none" };

export function placeOf(roster: Roster, memberId: string): MemberPlace {
  if (roster.confirmed.some((r) => r.memberId === memberId)) return { kind: "confirmed" };
  const w = roster.waitlist.findIndex((r) => r.memberId === memberId);
  if (w >= 0) return { kind: "waitlist", position: w + 1 };
  if (roster.out.some((r) => r.memberId === memberId)) return { kind: "out" };
  return { kind: "none" };
}

/** Builds the shareable "we need 2 more" message. */
export function needPlayersMessage(groupName: string, roster: Roster, link: string): string | null {
  return needPlayersText(groupName, roster.confirmed.length, roster.cap, link);
}

/** The same message from plain counts, for places that don't have the full roster. */
export function needPlayersText(groupName: string, confirmed: number, cap: number | null, link: string): string | null {
  if (cap === null || confirmed >= cap) return null;
  const n = cap - confirmed;
  return `${groupName}: ${confirmed}/${cap} in, we need ${n} more ${n === 1 ? "player" : "players"}! Tap to join: ${link}`;
}
