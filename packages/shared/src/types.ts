import type { Roster, RsvpStatus } from "./roster.ts";

export interface Group {
  id: string;
  slug: string;
  name: string;
  activity: string | null;
  location: string | null;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  timezone: string;
  cap: number | null;
}

export interface Session {
  id: string;
  groupId: string;
  startsAt: string;
  cancelled: boolean;
}

/** Payload behind a group's public page (/g/:slug). */
export interface GroupPage {
  group: Group;
  session: Session;
  roster: Roster;
  /** What the requester may do. Only set from a verified organizer identity. */
  viewer: { isOrganizer: boolean };
}

/** One group as the organizer's dashboard shows it: this week's session and counts. */
export interface DashboardGroup {
  group: Group;
  session: Session;
  confirmed: number;
  waitlist: number;
  out: number;
  spotsLeft: number;
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
  organizer: { name: string | null; email: string | null };
  stats: OrganizerStats;
  /** Sorted by next session, soonest first. */
  groups: DashboardGroup[];
  /** Latest RSVP changes across all the organizer's groups, newest first. */
  activity: ActivityItem[];
}
