// One-off: mark everyone in an organizer's season group as in for this week's game, except the names in SKIP.
// Run with ./infra/mark-in.sh <organizer email> <live|test> "<name to skip>[,<name>...]". Paths are inside the API image.
import { createDb } from "/app/apps/api/src/db/client.ts";
import { currentSession, groupColumns, type GroupRow } from "/app/apps/api/src/groups.ts";

const db = await createDb();
const skip = (process.env.SKIP ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const [org] = await db.query<{ id: string }>(`SELECT id FROM organizers WHERE lower(email) = lower($1) ORDER BY created_at LIMIT 1`, [process.env.SEED_EMAIL!]);
if (!org) throw new Error("No organizer with that email");
const groups = await db.query<GroupRow>(
  `SELECT ${groupColumns}, organizer_id AS "organizerId" FROM groups WHERE season_fee_cents IS NOT NULL AND (organizer_id = $1 OR id IN (SELECT group_id FROM group_admins WHERE organizer_id = $1))`,
  [org.id],
);
if (groups.length !== 1) throw new Error(`Expected one season group, found ${groups.length}`);
const group = groups[0]!;
const session = await currentSession(db, group);
const members = await db.query<{ id: string; name: string }>(`SELECT id, name FROM members WHERE group_id = $1 ORDER BY lower(name)`, [group.id]);
const marked: string[] = [];
for (const m of members) {
  if (skip.includes(m.name.trim().toLowerCase())) continue;
  await db.query(
    `INSERT INTO rsvps (session_id, member_id, status) VALUES ($1, $2, 'in') ON CONFLICT (session_id, member_id) DO UPDATE SET status = 'in', responded_at = now()`,
    [session.id, m.id],
  );
  marked.push(m.name);
}
console.log(`${group.name} · ${session.startsAt} · marked in ${marked.length}: ${marked.join(", ")}`);
console.log(`skipped: ${members.filter((m) => !marked.includes(m.name)).map((m) => m.name).join(", ") || "nobody"}`);
