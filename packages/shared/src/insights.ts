import { buildRoster, type Roster, type Rsvp } from "./roster.ts";

/** A past game and everyone's final answer. `lateDrop`: said out close to game time. */
export interface PastGame {
  startsAt: string;
  cancelled: boolean;
  rsvps: (Rsvp & { lateDrop: boolean })[];
}

export interface PlayerReliability {
  memberId: string;
  name: string;
  /** Games they got a spot in, out of the games played since they joined. */
  played: number;
  games: number;
  out: number;
  noAnswer: number;
  lateDrops: number;
  /** Typical hours before the game they answer (median), or null with no answers. */
  answerLeadHours: number | null;
}

export interface GroupHealth {
  /** Past games looked at, including cancelled ones. */
  games: number;
  cancelled: number;
  cap: number | null;
  avgPlayers: number | null;
  /** Share of spots filled, when there's a cap. */
  fillRate: number | null;
  avgWaitlist: number | null;
  avgLateDrops: number | null;
  answerLeadHours: number | null;
  /** Games that filled up, and typically how many hours before the start they did (median). */
  filledGames: number;
  fullLeadHours: number | null;
}

export interface InviteSuggestion {
  memberId: string;
  name: string;
  played: number;
  games: number;
}

/** Average turnout by weekday and start time ("Tue 7:30 PM"), best first. */
export interface TimeSlot {
  label: string;
  games: number;
  avgPlayers: number;
}

export interface GroupInsights {
  health: GroupHealth;
  /** Only when games happened at more than one day/time. */
  timeSlots: TimeSlot[];
  players: PlayerReliability[];
  /** Regulars who haven't answered this week, most reliable first. */
  invite: InviteSuggestion[];
  /** Late dropouts to expect this week, from past games (rounded). */
  expectedLateDrops: number;
}

const HOUR = 3_600_000;
const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};
const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const hoursBefore = (at: string, startsAt: string) => Math.max(0, (Date.parse(startsAt) - Date.parse(at)) / HOUR);

/**
 * What an organizer can learn from recent games: how dependable each player is, how healthy the group is,
 * and who to ask when this week is short. Rosters are rebuilt from final answers, so "filled at" is when the
 * last confirmed player last said in: a close estimate.
 */
export function groupInsights(input: {
  cap: number | null;
  timezone: string;
  games: PastGame[];
  members: { id: string; name: string; joinedAt: string }[];
  current?: { roster: Roster; cancelled: boolean };
}): GroupInsights {
  const { cap, members } = input;
  const played = input.games.filter((g) => !g.cancelled);
  const rosters = played.map((g) => ({ game: g, roster: buildRoster(g.rsvps, cap) }));

  const players: PlayerReliability[] = members.map((m) => {
    const eligible = rosters.filter(({ game }) => game.startsAt >= m.joinedAt || game.rsvps.some((r) => r.memberId === m.id));
    let got = 0, out = 0, noAnswer = 0, lateDrops = 0;
    const leads: number[] = [];
    for (const { game, roster } of eligible) {
      const answer = game.rsvps.find((r) => r.memberId === m.id);
      if (!answer) noAnswer++;
      else {
        leads.push(hoursBefore(answer.respondedAt, game.startsAt));
        if (answer.lateDrop) lateDrops++;
        if (answer.status === "out") out++;
        else if (roster.confirmed.some((r) => r.memberId === m.id)) got++;
      }
    }
    return { memberId: m.id, name: m.name, played: got, games: eligible.length, out, noAnswer, lateDrops, answerLeadHours: median(leads) };
  });
  players.sort((a, b) => b.played - a.played || a.lateDrops - b.lateDrops || a.name.localeCompare(b.name));

  const fullLeads = cap
    ? rosters.filter(({ roster }) => roster.confirmed.length >= cap).map(({ game, roster }) => hoursBefore(roster.confirmed[cap - 1]!.respondedAt, game.startsAt))
    : [];
  const avgPlayers = mean(rosters.map(({ roster }) => roster.confirmed.length));
  const avgLateDrops = mean(played.map((g) => g.rsvps.filter((r) => r.lateDrop).length));
  const health: GroupHealth = {
    games: input.games.length,
    cancelled: input.games.length - played.length,
    cap,
    avgPlayers,
    fillRate: cap && avgPlayers !== null ? avgPlayers / cap : null,
    avgWaitlist: mean(rosters.map(({ roster }) => roster.waitlist.length)),
    avgLateDrops,
    answerLeadHours: median(played.flatMap((g) => g.rsvps.map((r) => hoursBefore(r.respondedAt, g.startsAt)))),
    filledGames: fullLeads.length,
    fullLeadHours: median(fullLeads),
  };

  let invite: InviteSuggestion[] = [];
  if (input.current && !input.current.cancelled) {
    const { roster } = input.current;
    const answered = new Set([...roster.confirmed, ...roster.waitlist, ...roster.out].map((r) => r.memberId));
    invite = players
      .filter((p) => !answered.has(p.memberId) && p.played > 0)
      .slice(0, 5)
      .map(({ memberId, name, played, games }) => ({ memberId, name, played, games }));
  }

  const slots = new Map<string, number[]>();
  for (const { game, roster } of rosters) {
    const d = new Date(game.startsAt);
    const label = `${d.toLocaleDateString("en-US", { weekday: "short", timeZone: input.timezone })} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: input.timezone })}`;
    slots.set(label, [...(slots.get(label) ?? []), roster.confirmed.length]);
  }
  const timeSlots = slots.size > 1
    ? [...slots].map(([label, counts]) => ({ label, games: counts.length, avgPlayers: mean(counts)! })).sort((a, b) => b.avgPlayers - a.avgPlayers)
    : [];

  return { health, timeSlots, players, invite, expectedLateDrops: Math.round(avgLateDrops ?? 0) };
}

/** "Hey Mike! We're short 3 for Tuesday Soccer (Tue, Sep 30 · 7:30 PM). Want to play? Tap in here: …" */
export function inviteMessage(firstName: string, groupName: string, needed: number, when: string, link: string): string {
  const short = needed > 0 ? `We're short ${needed} for ${groupName}` : `We might lose a couple of players for ${groupName}`;
  return `Hey ${firstName}! ${short} (${when}). Want to play? Tap in here: ${link}`;
}

/** "about 2h", "about 1 day", "about 3 days". */
export function describeLead(hours: number): string {
  if (hours < 1) return "under an hour";
  if (hours < 36) return `about ${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `about ${days} ${days === 1 ? "day" : "days"}`;
}
