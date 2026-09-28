import type { Forecast, InviteSuggestion } from "./insights.ts";
import type { ReminderSettings } from "./reminders.ts";
import type { Roster, RsvpStatus } from "./roster.ts";

export interface Group {
  id: string;
  slug: string;
  name: string;
  activity: string | null;
  location: string | null;
  weekdays: number[];
  intervalWeeks: number;
  startsOn: string;
  endsOn: string | null;
  startTime: string;
  durationMinutes: number;
  timezone: string;
  cap: number | null;
  /** Cost in cents, per player or (feeSplit) the total split between everyone in. */
  feeCents: number | null;
  feeSplit: boolean;
  payNote: string | null;
  reminders: ReminderSettings;
}

/** Teams the organizer saved for a session, by member ID. */
export interface SavedTeams {
  teams: string[][];
  savedAt: string;
}

export interface Session {
  id: string;
  groupId: string;
  /** When this week's game actually starts (the scheduled time unless moved for this week). */
  startsAt: string;
  /** The regular scheduled time for this week; identifies the week. */
  scheduledAt: string;
  cancelled: boolean;
  /** This week only: a different place, and a note from the organizer. */
  location: string | null;
  note: string | null;
  teams: SavedTeams | null;
}

/** One upcoming week as the organizer's schedule view shows it. */
export interface UpcomingWeek {
  scheduledAt: string;
  startsAt: string;
  cancelled: boolean;
  location: string | null;
  note: string | null;
}

/** Payload behind a group's public page (/g/:slug). */
export interface GroupPage {
  group: Group;
  session: Session;
  roster: Roster;
  /** What the requester may do. Only set from a verified organizer identity. */
  /** isOrganizer: owner or admin, who get the organizer controls. */
  viewer: { isOrganizer: boolean; role?: GroupRole };
  /** Organizer-only details: who has paid, skill ratings, and who dropped out late this week. */
  organizer?: { paid: string[]; skills: Record<string, number>; lateDrops: string[]; forecast: Forecast | null };
}

/** A member's own settings, seen only with their member token. */
export interface MemberSelf {
  member: { id: string; name: string };
  channels: { push: number; email: string | null; emailConfirmed: boolean };
}

/** One group as the organizer's dashboard shows it: this week's session and counts. */
export interface DashboardPlayer {
  memberId: string;
  name: string;
  status: "in" | "waitlist" | "out";
  paid: boolean;
}

export interface DashboardGroup {
  /** The viewer's role in this group. */
  role: GroupRole;
  group: Group;
  session: Session;
  confirmed: number;
  waitlist: number;
  out: number;
  spotsLeft: number;
  /** This week's answers, in roster order: in, then waitlist, then out. */
  players: DashboardPlayer[];
  /** This week and the next ones, with skips and one-off changes (for the calendar). */
  weeks: UpcomingWeek[];
  /** From recent games: regulars to ask when short, and late dropouts to expect. */
  suggestions: { invite: InviteSuggestion[]; expectedLateDrops: number; games: number; forecast: Forecast | null };
}

export interface ActivityItem {
  groupSlug: string;
  groupName: string;
  name: string;
  status: RsvpStatus;
  at: string;
}

export interface WeekStat {
  /** Start of the 7-day bucket. The last bucket is the upcoming week. */
  start: string;
  /** Players who got a spot (capped), summed over the week's sessions. */
  players: number;
  /** Total spots offered (groups without a cap don't count). */
  spots: number;
  responses: number;
}

export interface Regular {
  name: string;
  groupName: string;
  games: number;
}

export interface OrganizerStats {
  /** 8 past weeks plus the upcoming one, oldest first. */
  weeks: WeekStat[];
  /** Share of offered spots that were filled over the past 8 weeks, or null with no capped games. */
  fillRate: number | null;
  responses: number;
  /** Members who said "in" most often over the past 8 weeks. */
  regulars: Regular[];
}

export interface Dashboard {
  organizer: { name: string | null; email: string | null; isAdmin?: boolean };
  stats: OrganizerStats;
  /** Sorted by next session, soonest first. */
  groups: DashboardGroup[];
  /** Latest RSVP changes across all the organizer's groups, newest first. */
  activity: ActivityItem[];
}

/** A group member as the organizer's members screen shows them. */
export interface MemberSummary {
  id: string;
  name: string;
  hasEmail: boolean;
  devices: number;
  gamesIn: number;
  joinedAt: string;
}

/** Owner: created the group (or had it handed over); the only one who manages admins. Admins run everything else. */
export type GroupRole = "owner" | "admin";

export interface GroupOrganizer {
  id: string;
  /** Name, or email when the sign-in didn't provide one. */
  name: string;
  role: GroupRole;
  isYou: boolean;
}

/** One past game, as it ended: who played, who dropped, what was collected, the teams. */
export interface GameRecord {
  startsAt: string;
  cancelled: boolean;
  note: string | null;
  location: string | null;
  cap: number | null;
  played: number;
  waitlist: number;
  out: number;
  lateDrops: number;
  paid: number;
  /** Collected and expected, using the group's current cost setting; null without a cost. */
  collectedCents: number | null;
  expectedCents: number | null;
  teams: string[][] | null;
  players: { name: string; status: "in" | "waitlist" | "out"; paid: boolean; lateDrop: boolean }[];
}
