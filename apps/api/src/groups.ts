import { buildRoster, type Group, type GroupPage, type Rsvp, type Session } from "@turnout/shared";
import type { Db } from "./db/client.ts";
import { currentSessionStart } from "./schedule.ts";

const groupColumns = `id, slug, name, activity, location, weekday, start_time AS "startTime",
  duration_minutes AS "durationMinutes", timezone, cap`;

export async function findGroupBySlug(db: Db, slug: string): Promise<Group | undefined> {
  const [group] = await db.query<Group>(`SELECT ${groupColumns} FROM groups WHERE slug = $1`, [slug]);
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

export async function groupPage(db: Db, group: Group): Promise<GroupPage> {
  const session = await currentSession(db, group);
  const roster = buildRoster(await sessionRsvps(db, session.id), group.cap);
  return { group, session, roster };
}
