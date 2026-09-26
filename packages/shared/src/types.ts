import type { Roster } from "./roster.ts";

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
}
