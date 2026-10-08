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

/** Show "ask these regulars" this close to the game, and the late-dropout warning this close. */
export const ASK_WINDOW_HOURS = 48;
export const LATE_WARNING_HOURS = 24;

/**
 * Autopilot's read on this week: who's likely to end up playing, from everyone's history.
 * projected = in now + each non-answerer's chance of saying in − late dropouts the waitlist won't cover.
 */
export interface Forecast {
  status: "good" | "short" | "full";
  /** Expected players at game time (rounded), capped at the cap. */
  projected: number;
  /** Spots likely still open at game time (0 when good or full). */
  short: number;
  unanswered: number;
  expectedLateDrops: number;
  /** Non-answerers most likely to say yes, best first. */
  likely: InviteSuggestion[];
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
  /** Null without a cap or target, without enough history (3 games), or when this week is cancelled. */
  forecast: Forecast | null;
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
  /** Without a cap, the forecast aims for this many players. */
  target?: number | null;
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

  const expectedLateDrops = Math.round(avgLateDrops ?? 0);
  let forecast: Forecast | null = null;
  const goal = cap ?? input.target ?? null;
  if (input.current && !input.current.cancelled && goal && played.length >= 3) {
    const { roster } = input.current;
    const answered = new Set([...roster.confirmed, ...roster.waitlist, ...roster.out].map((r) => r.memberId));
    const pending = players.filter((p) => !answered.has(p.memberId));
    const expectedYes = pending.reduce((n, p) => n + (p.games ? p.played / p.games : 0), 0);
    const uncoveredLate = Math.max(0, (avgLateDrops ?? 0) - roster.waitlist.length);
    const raw = roster.confirmed.length + roster.waitlist.length + expectedYes - uncoveredLate;
    const floor = Math.max(roster.confirmed.length - Math.ceil(uncoveredLate), Math.round(raw));
    const projected = cap ? Math.min(cap, floor) : floor;
    const short = Math.max(0, goal - projected);
    forecast = {
      status: cap && roster.spotsLeft === 0 && short === 0 ? "full" : short > 0 ? "short" : "good",
      projected,
      short,
      unanswered: pending.length,
      expectedLateDrops,
      likely: invite,
    };
  }

  return { health, timeSlots, players, invite, expectedLateDrops, forecast };
}

/** "Hey Mike! We're short 3 for Tuesday Soccer (Tue, Sep 30 · 7:30 PM). Want to play? Tap in here: …" */
export function inviteMessage(firstName: string, groupName: string, needed: number, when: string, link: string): string {
  const short = needed > 0 ? `We're short ${needed} for ${groupName}` : `We might lose a couple of players for ${groupName}`;
  return `Hey ${firstName}! ${short} (${when}). Want to play?\n\nTap in here: ${link}`;
}

/** "about 2h", "about 1 day", "about 3 days". */
export function describeLead(hours: number): string {
  if (hours < 1) return "under an hour";
  if (hours < 36) return `about ${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `about ${days} ${days === 1 ? "day" : "days"}`;
}

/** What the organizer sees for this week's forecast: a headline and a line of detail. */
export function describeForecast(f: Forecast, confirmed: number, cap: number): { headline: string; detail: string } {
  const likelyNames = f.likely.slice(0, 2).map((p) => p.name);
  const usually = likelyNames.length ? ` ${likelyNames.join(" and ")} usually ${likelyNames.length === 1 ? "plays" : "play"} but ${likelyNames.length === 1 ? "hasn't" : "haven't"} answered.` : "";
  if (f.status === "full") {
    return {
      headline: "Full",
      detail: f.expectedLateDrops > 0 ? `You usually lose ${f.expectedLateDrops === 1 ? "a player" : `${f.expectedLateDrops} players`} late. A backup on the waitlist would cover it.` : "Nothing to do.",
    };
  }
  if (f.status === "good") {
    return { headline: "You're probably good", detail: `${confirmed} of ${cap} in, ${f.unanswered} haven't answered.${usually}` };
  }
  const late = f.expectedLateDrops > 0 ? ` You usually lose ${f.expectedLateDrops === 1 ? "one" : f.expectedLateDrops} close to game time.` : "";
  return { headline: `You may be ${f.short} short`, detail: `${confirmed} of ${cap} in.${late}${usually}` };
}
