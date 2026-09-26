import { buildRoster, type ActivityItem, type Dashboard, type Group, type GroupPage, type OrganizerStats, type Rsvp, type Session } from "@turnout/shared";
import type { Db } from "./db/client.ts";
import { currentSessionStart } from "./schedule.ts";

const groupColumns = `id, slug, name, activity, location, weekday, start_time AS "startTime",
  duration_minutes AS "durationMinutes", timezone, cap`;

export type GroupRow = Group & { organizerId: string };

export async function findGroupBySlug(db: Db, slug: string): Promise<GroupRow | undefined> {
  const [group] = await db.query<GroupRow>(`SELECT ${groupColumns}, organizer_id AS "organizerId" FROM groups WHERE slug = $1`, [slug]);
  return group;
}

/** Strips internal columns before a group is sent to clients. */
export function publicGroup({ organizerId: _, ...group }: GroupRow): Group {
  return group;
}

export async function listOrganizerGroups(db: Db, organizerId: string): Promise<Group[]> {
  return db.query<Group>(`SELECT ${groupColumns} FROM groups WHERE organizer_id = $1 ORDER BY created_at DESC`, [organizerId]);
}

/** This week's session, created on first access. */
export async function currentSession(db: Db, group: Group, now = new Date()): Promise<Session> {
  const startsAt = currentSessionStart(group, now);
  const [session] = await db.query<Session>(
    `INSERT INTO sessions (group_id, starts_at) VALUES ($1, $2)
     ON CONFLICT (group_id, starts_at) DO UPDATE SET group_id = EXCLUDED.group_id
     RETURNING id, group_id AS "groupId", starts_at AS "startsAt", cancelled`,
    [group.id, startsAt.toISOString()],
  );
  return { ...session!, startsAt: new Date(session!.startsAt).toISOString() };
}

export async function sessionRsvps(db: Db, sessionId: string): Promise<Rsvp[]> {
  const rows = await db.query<Rsvp & { respondedAt: Date | string }>(
    `SELECT r.member_id AS "memberId", m.name, r.status, r.responded_at AS "respondedAt"
     FROM rsvps r JOIN members m ON m.id = r.member_id WHERE r.session_id = $1`,
    [sessionId],
  );
  return rows.map((r) => ({ ...r, respondedAt: new Date(r.respondedAt).toISOString() }));
}

export async function groupPage(db: Db, group: GroupRow, viewerOrganizerId: string | null): Promise<GroupPage> {
  const session = await currentSession(db, group);
  const roster = buildRoster(await sessionRsvps(db, session.id), group.cap);
  return { group: publicGroup(group), session, roster, viewer: { isOrganizer: viewerOrganizerId === group.organizerId } };
}

/** Everything the organizer's home screen shows, in one request. */
export async function organizerDashboard(db: Db, organizerId: string): Promise<Dashboard> {
  const [organizer] = await db.query<{ name: string | null; email: string | null }>(`SELECT name, email FROM organizers WHERE id = $1`, [organizerId]);
  const rows = await db.query<GroupRow>(`SELECT ${groupColumns}, organizer_id AS "organizerId" FROM groups WHERE organizer_id = $1`, [organizerId]);

  const groups = await Promise.all(
    rows.map(async (row) => {
      const session = await currentSession(db, row);
      const roster = buildRoster(await sessionRsvps(db, session.id), row.cap);
      return {
        group: publicGroup(row),
        session,
        confirmed: roster.confirmed.length,
        waitlist: roster.waitlist.length,
        out: roster.out.length,
        spotsLeft: roster.spotsLeft,
      };
    }),
  );
  groups.sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt));

  const activity = await db.query<ActivityItem & { at: Date | string }>(
    `SELECT g.slug AS "groupSlug", g.name AS "groupName", m.name, r.status, r.responded_at AS at
     FROM rsvps r
     JOIN members m ON m.id = r.member_id
     JOIN groups g ON g.id = m.group_id
     WHERE g.organizer_id = $1
     ORDER BY r.responded_at DESC
     LIMIT 12`,
    [organizerId],
  );

  return {
    organizer: organizer ?? { name: null, email: null },
    stats: await organizerStats(db, organizerId),
    groups,
    activity: activity.map((a) => ({ ...a, at: new Date(a.at).toISOString() })),
  };
}

const WEEKS_BACK = 8;
const WEEK_MS = 7 * 86_400_000;

/**
 * Turnout over the last 8 weeks plus the upcoming one, in 7-day buckets counted back from now.
 * Only weeks where someone opened the group page have a session row; the rest count as zero.
 */
export async function organizerStats(db: Db, organizerId: string, now = new Date()): Promise<OrganizerStats> {
  const from = new Date(now.getTime() - WEEKS_BACK * WEEK_MS);
  const to = new Date(now.getTime() + WEEK_MS);
  const rows = await db.query<{ starts_at: Date | string; cap: number | null; cancelled: boolean; ins: number; responses: number }>(
    `SELECT s.starts_at, g.cap, s.cancelled,
            count(r.member_id) FILTER (WHERE r.status = 'in')::int AS ins,
            count(r.member_id)::int AS responses
     FROM sessions s
     JOIN groups g ON g.id = s.group_id
     LEFT JOIN rsvps r ON r.session_id = s.id
     WHERE g.organizer_id = $1 AND s.starts_at >= $2 AND s.starts_at < $3
     GROUP BY s.id, g.cap`,
    [organizerId, from.toISOString(), to.toISOString()],
  );

  const weeks = Array.from({ length: WEEKS_BACK + 1 }, (_, i) => ({
    start: new Date(from.getTime() + i * WEEK_MS).toISOString(),
    players: 0,
    spots: 0,
    responses: 0,
  }));
  for (const r of rows) {
    const bucket = weeks[Math.min(WEEKS_BACK, Math.floor((new Date(r.starts_at).getTime() - from.getTime()) / WEEK_MS))]!;
    bucket.responses += r.responses;
    if (r.cancelled) continue;
    bucket.players += r.cap === null ? r.ins : Math.min(r.ins, r.cap);
    bucket.spots += r.cap ?? 0;
  }

  const past = weeks.slice(0, WEEKS_BACK);
  const filled = past.reduce((n, w) => n + (w.spots ? w.players : 0), 0);
  const offered = past.reduce((n, w) => n + w.spots, 0);

  const regulars = await db.query<{ name: string; groupName: string; games: number }>(
    `SELECT m.name, g.name AS "groupName", count(*)::int AS games
     FROM rsvps r
     JOIN sessions s ON s.id = r.session_id
     JOIN members m ON m.id = r.member_id
     JOIN groups g ON g.id = s.group_id
     WHERE g.organizer_id = $1 AND r.status = 'in' AND s.starts_at >= $2 AND s.starts_at < $3 AND NOT s.cancelled
     GROUP BY m.id, m.name, g.name
     ORDER BY games DESC, min(r.responded_at)
     LIMIT 5`,
    [organizerId, from.toISOString(), to.toISOString()],
  );

  return {
    weeks,
    fillRate: offered ? filled / offered : null,
    responses: weeks.reduce((n, w) => n + w.responses, 0),
    regulars,
  };
}
