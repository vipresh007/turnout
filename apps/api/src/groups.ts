import { buildRoster, groupInsights, type ActivityItem, type GroupInsights, type PastGame, type Roster, type Dashboard, type DashboardPlayer, type Group, type GroupPage, type GroupRole, type OrganizerStats, type Rsvp, type Session, type UpcomingWeek } from "@turnout/shared";
import type { Db } from "./db/client.ts";
import { currentSessionStart, lastScheduledStart, scheduledStarts } from "./schedule.ts";

export const groupColumns = `id, slug, name, activity, location, weekdays, interval_weeks AS "intervalWeeks",
  to_char(starts_on, 'YYYY-MM-DD') AS "startsOn", to_char(ends_on, 'YYYY-MM-DD') AS "endsOn",
  start_time AS "startTime", duration_minutes AS "durationMinutes", timezone, cap,
  fee_cents AS "feeCents", fee_split AS "feeSplit", pay_note AS "payNote", reminders`;

const sessionColumns = `id, group_id AS "groupId", starts_at AS "scheduledAt", starts_at_override AS "startsAtOverride",
  cancelled, location_override AS "location", note, teams`;

type SessionRow = Omit<Session, "startsAt" | "scheduledAt"> & { scheduledAt: Date | string; startsAtOverride: Date | string | null };

const toSession = (r: SessionRow): Session => {
  const { startsAtOverride, ...rest } = r;
  const scheduledAt = new Date(r.scheduledAt).toISOString();
  return { ...rest, scheduledAt, startsAt: startsAtOverride ? new Date(startsAtOverride).toISOString() : scheduledAt };
};

export type GroupRow = Group & { organizerId: string };

export async function findGroupBySlug(db: Db, slug: string): Promise<GroupRow | undefined> {
  const [group] = await db.query<GroupRow>(`SELECT ${groupColumns}, organizer_id AS "organizerId" FROM groups WHERE slug = $1`, [slug]);
  return group;
}

/** Strips internal columns before a group is sent to clients. */
export function publicGroup({ organizerId: _, ...group }: GroupRow): Group {
  return group;
}

/** SQL condition: the organizer in `param` owns or co-runs the group aliased `alias`. */
export const managedBy = (alias: string, param: string) =>
  `(${alias}.organizer_id = ${param} OR EXISTS (SELECT 1 FROM group_admins ga WHERE ga.group_id = ${alias}.id AND ga.organizer_id = ${param}))`;

export async function groupRole(db: Db, group: GroupRow, organizerId: string | null): Promise<GroupRole | null> {
  if (!organizerId) return null;
  if (group.organizerId === organizerId) return "owner";
  const [admin] = await db.query(`SELECT 1 FROM group_admins WHERE group_id = $1 AND organizer_id = $2`, [group.id, organizerId]);
  return admin ? "admin" : null;
}

export async function listOrganizerGroups(db: Db, organizerId: string): Promise<Group[]> {
  return db.query<Group>(`SELECT ${groupColumns} FROM groups g WHERE ${managedBy("g", "$1")} ORDER BY created_at DESC`, [organizerId]);
}

/** Session rows for these scheduled starts that already exist (overrides, cancellations, RSVPs). */
export async function sessionsAt(db: Db, groupId: string, starts: Date[]): Promise<Map<string, Session>> {
  if (!starts.length) return new Map();
  const rows = await db.query<SessionRow>(
    `SELECT ${sessionColumns} FROM sessions WHERE group_id = $1 AND starts_at = ANY($2::timestamptz[])`,
    [groupId, starts.map((d) => d.toISOString())],
  );
  return new Map(rows.map((r) => [new Date(r.scheduledAt).toISOString(), toSession(r)]));
}

/**
 * This week's session, created on first access: the first scheduled game that hasn't ended,
 * counting this week's time change if the organizer moved it.
 */
export async function currentSession(db: Db, group: Group, now = new Date()): Promise<Session> {
  const candidates = scheduledStarts(group, new Date(now.getTime() - 2 * 86_400_000), 4);
  const existing = await sessionsAt(db, group.id, candidates);
  const durationMs = group.durationMinutes * 60_000;
  const current =
    candidates.find((c) => {
      const start = existing.get(c.toISOString())?.startsAt ?? c.toISOString();
      return new Date(start).getTime() + durationMs > now.getTime();
    }) ?? candidates.at(-1) ?? lastScheduledStart(group) ?? currentSessionStart(group, now);
  const [row] = await db.query<SessionRow>(
    `INSERT INTO sessions (group_id, starts_at) VALUES ($1, $2)
     ON CONFLICT (group_id, starts_at) DO UPDATE SET group_id = EXCLUDED.group_id
     RETURNING ${sessionColumns}`,
    [group.id, current.toISOString()],
  );
  return toSession(row!);
}

/** The next weeks from this one on, with any skips or changes, for the organizer's schedule view. */
export async function upcomingWeeks(db: Db, group: Group, count = 8): Promise<UpcomingWeek[]> {
  const current = await currentSession(db, group);
  const starts = scheduledStarts(group, new Date(current.scheduledAt), count);
  const existing = await sessionsAt(db, group.id, starts);
  return starts.map((d) => {
    const s = existing.get(d.toISOString());
    return { scheduledAt: d.toISOString(), startsAt: s?.startsAt ?? d.toISOString(), cancelled: s?.cancelled ?? false, location: s?.location ?? null, note: s?.note ?? null };
  });
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
  const role = await groupRole(db, group, viewerOrganizerId);
  const isOrganizer = role !== null;
  const page: GroupPage = { group: publicGroup(group), session, roster, viewer: role ? { isOrganizer, role } : { isOrganizer } };
  if (isOrganizer) page.organizer = await organizerDetails(db, group.id, session.id);
  return page;
}

/** Payment status and skill ratings: visible to the group's organizers only. */
async function organizerDetails(db: Db, groupId: string, sessionId: string): Promise<NonNullable<GroupPage["organizer"]>> {
  const paid = await db.query<{ memberId: string }>(
    `SELECT member_id AS "memberId" FROM rsvps WHERE session_id = $1 AND paid_at IS NOT NULL`,
    [sessionId],
  );
  const skills = await db.query<{ id: string; skill: number }>(`SELECT id, skill FROM members WHERE group_id = $1 AND skill IS NOT NULL`, [groupId]);
  const late = await db.query<{ memberId: string }>(`SELECT member_id AS "memberId" FROM rsvps WHERE session_id = $1 AND late_drop`, [sessionId]);
  return { paid: paid.map((p) => p.memberId), skills: Object.fromEntries(skills.map((m) => [m.id, m.skill])), lateDrops: late.map((l) => l.memberId) };
}

/** Everything the organizer's home screen shows, in one request. */
export async function organizerDashboard(db: Db, organizerId: string): Promise<Dashboard> {
  const [organizer] = await db.query<{ name: string | null; email: string | null }>(`SELECT name, email FROM organizers WHERE id = $1`, [organizerId]);
  const rows = await db.query<GroupRow>(`SELECT ${groupColumns}, organizer_id AS "organizerId" FROM groups g WHERE ${managedBy("g", "$1")}`, [organizerId]);

  const groups = await Promise.all(
    rows.map(async (row) => {
      const session = await currentSession(db, row);
      const roster = buildRoster(await sessionRsvps(db, session.id), row.cap);
      const paid = new Set(
        (await db.query<{ memberId: string }>(`SELECT member_id AS "memberId" FROM rsvps WHERE session_id = $1 AND paid_at IS NOT NULL`, [session.id])).map((p) => p.memberId),
      );
      const player = (status: DashboardPlayer["status"]) => (r: Rsvp): DashboardPlayer => ({ memberId: r.memberId, name: r.name, status, paid: paid.has(r.memberId) });
      return {
        group: publicGroup(row),
        role: (row.organizerId === organizerId ? "owner" : "admin") as GroupRole,
        session,
        confirmed: roster.confirmed.length,
        waitlist: roster.waitlist.length,
        out: roster.out.length,
        spotsLeft: roster.spotsLeft,
        players: [...roster.confirmed.map(player("in")), ...roster.waitlist.map(player("waitlist")), ...roster.out.map(player("out"))],
        weeks: await upcomingWeeks(db, row, 12),
        suggestions: await groupInsightsFor(db, row, { roster, cancelled: session.cancelled }).then((i) => ({
          invite: i.invite,
          expectedLateDrops: i.expectedLateDrops,
          games: i.health.games - i.health.cancelled,
        })),
      };
    }),
  );
  groups.sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt));

  const activity = await db.query<ActivityItem & { at: Date | string }>(
    `SELECT g.slug AS "groupSlug", g.name AS "groupName", m.name, r.status, r.responded_at AS at
     FROM rsvps r
     JOIN members m ON m.id = r.member_id
     JOIN groups g ON g.id = m.group_id
     WHERE ${managedBy("g", "$1")}
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
     WHERE ${managedBy("g", "$1")} AND s.starts_at >= $2 AND s.starts_at < $3
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
     WHERE ${managedBy("g", "$1")} AND r.status = 'in' AND s.starts_at >= $2 AND s.starts_at < $3 AND NOT s.cancelled
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

/** How many recent games the insights look back over. */
const INSIGHT_GAMES = 12;

/** Reliability, group health and who to invite, from the group's recent games. */
export async function groupInsightsFor(db: Db, group: GroupRow, current?: { roster: Roster; cancelled: boolean }, now = new Date()): Promise<GroupInsights> {
  const sessions = await db.query<{ id: string; startsAt: Date | string; cancelled: boolean }>(
    `SELECT id, COALESCE(starts_at_override, starts_at) AS "startsAt", cancelled FROM sessions
     WHERE group_id = $1 AND COALESCE(starts_at_override, starts_at) < $2 ORDER BY starts_at DESC LIMIT ${INSIGHT_GAMES}`,
    [group.id, now.toISOString()],
  );
  const rsvps = sessions.length
    ? await db.query<{ sessionId: string; memberId: string; name: string; status: "in" | "out"; respondedAt: Date | string; lateDrop: boolean }>(
        `SELECT r.session_id AS "sessionId", r.member_id AS "memberId", m.name, r.status, r.responded_at AS "respondedAt", r.late_drop AS "lateDrop"
         FROM rsvps r JOIN members m ON m.id = r.member_id WHERE r.session_id = ANY($1::uuid[])`,
        [sessions.map((s) => s.id)],
      )
    : [];
  const members = await db.query<{ id: string; name: string; joinedAt: Date | string }>(
    `SELECT id, name, created_at AS "joinedAt" FROM members WHERE group_id = $1`,
    [group.id],
  );
  const iso = (d: Date | string) => new Date(d).toISOString();
  const games: PastGame[] = sessions.map((s) => ({
    startsAt: iso(s.startsAt),
    cancelled: s.cancelled,
    rsvps: rsvps.filter((r) => r.sessionId === s.id).map(({ sessionId: _, ...r }) => ({ ...r, respondedAt: iso(r.respondedAt) })),
  }));
  return groupInsights({
    cap: group.cap,
    timezone: group.timezone,
    games,
    members: members.map((m) => ({ ...m, joinedAt: iso(m.joinedAt) })),
    ...(current ? { current } : {}),
  });
}
