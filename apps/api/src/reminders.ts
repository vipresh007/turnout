import { buildRoster, dueReminders, groupChatReminder, placeOf, reminderText, type Rsvp, type Session } from "@turnout/shared";
import { HttpError } from "./auth.ts";
import type { Db } from "./db/client.ts";
import { currentSession, groupColumns, sessionRsvps, type GroupRow } from "./groups.ts";
import { notifyMember, webUrl, type Message } from "./notify.ts";

/** "Wed 8:00 PM" in the group's timezone. */
export function whenLabel(startsAt: string, timezone: string): string {
  return new Date(startsAt).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: timezone });
}

const reachableMembers = (db: Db, groupId: string) =>
  db.query<{ id: string }>(
    `SELECT m.id FROM members m
     WHERE m.group_id = $1
       AND (m.email_confirmed_at IS NOT NULL OR EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.member_id = m.id))`,
    [groupId],
  );

/** What to tell one member, based on where they stand this week. Null = nothing to say. */
function messageFor(kind: "dayBefore" | "hoursBefore" | "manual", group: GroupRow, session: Pick<Session, "startsAt" | "location" | "note">, rsvps: Rsvp[], memberId: string): Message | null {
  const message = messageBody(kind, group, session.startsAt, rsvps, memberId);
  if (!message) return null;
  // This week's changes ride along with every reminder.
  const change = [session.location && `This week at ${session.location}.`, session.note].filter(Boolean).join(" ");
  return change ? { ...message, body: `${message.body} ${change}` } : message;
}

function messageBody(kind: "dayBefore" | "hoursBefore" | "manual", group: GroupRow, startsAt: string, rsvps: Rsvp[], memberId: string): Message | null {
  const roster = buildRoster(rsvps, group.cap);
  const when = whenLabel(startsAt, group.timezone);
  const url = `${webUrl()}/g/${group.slug}`;
  const place = placeOf(roster, memberId);
  const count = roster.confirmed.length;
  if (place.kind === "confirmed") {
    const text = reminderText(kind === "manual" ? "dayBefore" : kind, group.name, when, count, group.cap);
    return { ...text, url, rsvpActions: kind === "hoursBefore" };
  }
  if (place.kind === "waitlist") {
    return { title: `You're #${place.position} on the waitlist for ${group.name}`, body: `${when}. We'll tell you the moment a spot opens.`, url };
  }
  // Nudge people who haven't answered, once (the evening before, or when the organizer asks).
  if (place.kind === "none" && kind !== "hoursBefore") {
    return { ...reminderText("nudge", group.name, when, count, group.cap), url, rsvpActions: true };
  }
  return null;
}

/**
 * The scheduled job: sends every reminder that is due right now. Safe to run as often as you like;
 * the notifications_sent table records each send before it happens, so nothing goes out twice.
 */
export async function runReminders(db: Db, now = new Date()): Promise<{ groups: number; sent: number }> {
  const groups = await db.query<GroupRow>(
    `SELECT ${groupColumns}, organizer_id AS "organizerId" FROM groups g
     WHERE EXISTS (
       SELECT 1 FROM members m WHERE m.group_id = g.id
         AND (m.email_confirmed_at IS NOT NULL OR EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.member_id = m.id))
     )`,
  );
  let sent = 0;
  for (const group of groups) {
    const session = await currentSession(db, group, now);
    if (session.cancelled) continue;
    const due = dueReminders(new Date(session.startsAt), group.timezone, group.reminders, now);
    if (!due.length) continue;
    const rsvps = await sessionRsvps(db, session.id);
    for (const member of await reachableMembers(db, group.id)) {
      for (const kind of due) {
        const message = messageFor(kind, group, session, rsvps, member.id);
        if (!message) continue;
        const [claimed] = await db.query(
          `INSERT INTO notifications_sent (session_id, member_id, kind) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1`,
          [session.id, member.id, kind],
        );
        if (claimed) sent += await notifyMember(db, member.id, message);
      }
    }
  }
  return { groups: groups.length, sent };
}

/** Organizer's "Send reminder now": notifies subscribed members and returns text for the group chat. At most once an hour. */
export async function remindNow(db: Db, group: GroupRow): Promise<{ notified: number; reachable: number; message: string }> {
  const session = await currentSession(db, group);
  if (session.cancelled) throw new HttpError(409, "This week is cancelled");
  const [claimed] = await db.query(
    `UPDATE sessions SET last_reminded_at = now()
     WHERE id = $1 AND (last_reminded_at IS NULL OR last_reminded_at < now() - interval '1 hour')
     RETURNING 1`,
    [session.id],
  );
  const rsvps = await sessionRsvps(db, session.id);
  const roster = buildRoster(rsvps, group.cap);
  const message = groupChatReminder(group.name, whenLabel(session.startsAt, group.timezone), roster.confirmed.length, group.cap, `${webUrl()}/g/${group.slug}`);
  const members = await reachableMembers(db, group.id);
  if (!claimed) return { notified: 0, reachable: members.length, message }; // already sent within the hour; still give the chat text
  let notified = 0;
  for (const m of members) {
    const msg = messageFor("manual", group, session, rsvps, m.id);
    if (msg && (await notifyMember(db, m.id, msg)) > 0) notified++;
  }
  return { notified, reachable: members.length, message };
}

/** "You're in!" for members who just moved up from the waitlist. */
export async function notifyPromoted(db: Db, group: GroupRow, startsAt: string, memberIds: string[]): Promise<void> {
  const when = whenLabel(startsAt, group.timezone);
  for (const id of memberIds) {
    await notifyMember(db, id, {
      title: `You're in for ${group.name}! 🎉`,
      body: `A spot opened up for ${when}. Can't make it anymore? Tap to drop out so the next person gets it.`,
      url: `${webUrl()}/g/${group.slug}`,
      rsvpActions: true,
    }).catch((err) => console.warn("promotion notify failed", err));
  }
}
