import { randomBytes } from "node:crypto";
import { buildRoster, ORGANIZER_NOTIFY_DEFAULTS, playerGoal, weeklyDigest, type DigestGroup, type OrganizerNotify } from "@turnout/shared";
import { track } from "./analytics.ts";
import type { Db } from "./db/client.ts";
import { currentSession, gameHistory, groupColumns, sessionRsvps, type GroupRow } from "./groups.ts";
import { EMAIL, emailHtml, emailShell, sendEmail, webUrl } from "./notify.ts";
import { pushToOrganizers } from "./organizerPush.ts";
import { whenLabel } from "./reminders.ts";
import { localDate } from "./schedule.ts";

const DAY = 86_400_000;
/** Monday morning in the organizer's own timezone (from their first group). */
const DIGEST_WEEKDAY = 1;
const DIGEST_HOUR = 9;

export const notifyPrefs = (raw: unknown): OrganizerNotify => ({ ...ORGANIZER_NOTIFY_DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) });

/** The numbers for one group: last week's game, the next one, streaks and new players. */
export async function digestGroup(db: Db, group: GroupRow, now = new Date()): Promise<DigestGroup> {
  const history = await gameHistory(db, group, 12, now);
  // Last week's game, if one actually happened: cancelled, or at least someone answered. A week nobody touched isn't news.
  const latest = history[0] && now.getTime() - new Date(history[0].startsAt).getTime() <= 7 * DAY ? history[0] : null;
  const recent = latest && (latest.cancelled || latest.played + latest.out + latest.waitlist > 0) ? latest : null;
  const session = await currentSession(db, group, now);
  const roster = buildRoster(await sessionRsvps(db, session.id), group.cap);
  // Current streaks from the played (not cancelled) games, newest first.
  const played = history.filter((g) => !g.cancelled);
  const streak = new Map<string, number>();
  const broken = new Set<string>();
  for (const game of played) {
    const ins = new Set(game.players.filter((p) => p.status === "in").map((p) => p.name));
    for (const name of new Set([...streak.keys(), ...ins])) {
      if (broken.has(name)) continue;
      if (ins.has(name)) streak.set(name, (streak.get(name) ?? 0) + 1);
      else broken.add(name);
    }
  }
  const [{ n: newPlayers }] = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM members WHERE group_id = $1 AND created_at > $2`, [group.id, new Date(now.getTime() - 7 * DAY).toISOString()])) as [{ n: number }];
  const upcoming = !session.cancelled && new Date(session.startsAt).getTime() > now.getTime();
  return {
    name: group.name,
    activity: group.activity,
    slug: group.slug,
    last: recent
      ? { played: recent.played, cap: recent.cap, cancelled: recent.cancelled, lateDrops: recent.lateDrops, unpaidCents: recent.expectedCents !== null && recent.collectedCents !== null ? recent.expectedCents - recent.collectedCents || null : null }
      : null,
    next: upcoming ? { startsAt: session.startsAt, when: whenLabel(session.startsAt, group.timezone), confirmed: roster.confirmed.length, goal: playerGoal(group) } : null,
    streaks: [...streak.entries()].filter(([, s]) => s >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, s]) => ({ name, streak: s })),
    newPlayers,
  };
}

function digestEmail(digest: ReturnType<typeof weeklyDigest>, stopUrl: string): { html: string; text: string } {
  const c = EMAIL;
  const url = `${webUrl()}/dashboard?from=digest`;
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  const rows = digest.lines
    .map((l) => `<tr><td style="padding:14px 32px 0"><a href="${webUrl()}/g/${l.slug}" style="color:${c.text};font-size:16px;font-weight:800;text-decoration:none">${esc(l.group)}</a><div style="color:${c.muted};font-size:15px;line-height:22px;padding-top:2px">${esc(l.text)}</div></td></tr>`)
    .join("");
  const tip = digest.tip
    ? `<tr><td style="padding:20px 32px 0"><div style="border:1px solid ${c.border};border-left:3px solid ${c.accent};border-radius:12px;padding:12px 14px;color:${c.text};font-size:15px;line-height:22px"><b style="color:${c.accent}">One thing to do:</b> ${esc(digest.tip)}</div></td></tr>`
    : "";
  const title = `<tr><td style="padding:24px 32px 0;font-size:22px;font-weight:800;color:${c.text}">Your week</td></tr>`;
  const button = `<tr><td style="padding:24px 32px 24px"><a href="${url}" style="display:inline-block;background:${c.button};color:#FFFFFF;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:12px">Open Turnout</a></td></tr>`;
  return {
    html: emailShell(
      `${title}${rows}${tip}${button}`,
      `You get this on Monday mornings because you run a group on Turnout. <a href="${stopUrl}" style="color:${c.muted};font-weight:700">Unsubscribe from the weekly digest</a> (or turn it off in Account &rsaquo; Notifications).`,
    ),
    text: ["Your week on Turnout", ...digest.lines.map((l) => `${l.group}: ${l.text}`), digest.tip ? `One thing to do: ${digest.tip}` : "", url, `Unsubscribe from the weekly digest: ${stopUrl}`].filter(Boolean).join("\n\n"),
  };
}

/** The organizer's unsubscribe token (digest and game alert emails), made the first time it's needed. */
async function organizerEmailToken(db: Db, organizerId: string): Promise<string> {
  const [row] = await db.query<{ token: string }>(
    `UPDATE organizers SET email_token = COALESCE(email_token, $2) WHERE id = $1 RETURNING email_token AS token`,
    [organizerId, randomBytes(18).toString("base64url")],
  );
  return row!.token;
}

/** Emails an organizer can stop from the email itself, without signing in. */
export type OrganizerEmail = "digest" | "alertEmails";

/** Turns that kind of email off for whoever holds this token. Returns false for an unknown token. */
export async function stopOrganizerEmail(db: Db, token: string, kind: OrganizerEmail): Promise<boolean> {
  const rows = await db.query(`UPDATE organizers SET notify = notify || jsonb_build_object($2::text, false) WHERE email_token = $1 RETURNING 1`, [token, kind]);
  return rows.length > 0;
}

/**
 * A game alert by email (may be short, someone dropped out), unless the organizer turned those off. Carries a
 * one-click unsubscribe; push for the same alert is sent separately.
 */
export async function sendOrganizerAlertEmail(
  db: Db,
  o: { id: string; email: string | null; notify: unknown },
  m: { subject: string; title: string; body: string; url: string; button: string },
): Promise<void> {
  if (!o.email || !notifyPrefs(o.notify).alertEmails) return;
  const token = await organizerEmailToken(db, o.id);
  const html = emailHtml(m, `${webUrl()}/email?alerts=${token}`, m.button, "You get game alerts because you run this group on Turnout. Push notifications on your phone are separate.");
  await sendEmail(o.email, m.subject, html, `${m.title}. ${m.body} ${m.url}\n\nUnsubscribe from game alert emails: ${webUrl()}/email?alerts=${token}`, `${webUrl()}/api/unsubscribe?alerts=${token}`, { oneClick: true });
}

/**
 * Monday mornings: one digest per organizer who wants it, across the groups they run. Runs from the reminder job
 * every 15 minutes; `digest_sent_for` keeps it to once a week.
 */
export async function runWeeklyDigest(db: Db, now = new Date()): Promise<{ sent: number }> {
  const organizers = await db.query<{ id: string; email: string | null; notify: unknown; sentFor: string | Date | null }>(
    `SELECT id, email, notify, digest_sent_for AS "sentFor" FROM organizers o
     WHERE EXISTS (SELECT 1 FROM groups g WHERE g.organizer_id = o.id OR g.id IN (SELECT group_id FROM group_admins WHERE organizer_id = o.id))`,
  );
  let sent = 0;
  for (const o of organizers) {
    if (!notifyPrefs(o.notify).digest) continue;
    const groups = await db.query<GroupRow>(
      `SELECT ${groupColumns}, organizer_id AS "organizerId" FROM groups WHERE organizer_id = $1 OR id IN (SELECT group_id FROM group_admins WHERE organizer_id = $1) ORDER BY created_at`,
      [o.id],
    );
    const tz = groups[0]!.timezone;
    const today = localDate(now, tz);
    const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    if (local.getDay() !== DIGEST_WEEKDAY || local.getHours() < DIGEST_HOUR) continue;
    if (o.sentFor && String(o.sentFor instanceof Date ? o.sentFor.toISOString().slice(0, 10) : o.sentFor).slice(0, 10) === today) continue;
    const [claimed] = await db.query(`UPDATE organizers SET digest_sent_for = $2 WHERE id = $1 AND (digest_sent_for IS NULL OR digest_sent_for < $2) RETURNING 1`, [o.id, today]);
    if (!claimed) continue;

    const digest = weeklyDigest(await Promise.all(groups.map((g) => digestGroup(db, g, now))));
    if (digest.empty) continue;
    if (o.email) {
      const token = await organizerEmailToken(db, o.id);
      const { html, text } = digestEmail(digest, `${webUrl()}/email?digest=${token}`);
      // One-click unsubscribe (RFC 8058) goes to the web app's function, which forwards to the API.
      await sendEmail(o.email, digest.subject, html, text, `${webUrl()}/api/unsubscribe?digest=${token}`, { oneClick: true }).catch((err) => console.warn("digest email failed", err));
    }
    await pushToOrganizers(db, [o.id], { title: digest.subject, body: digest.tip ?? digest.lines.map((l) => `${l.group}: ${l.text}`).join(" · ").slice(0, 180), path: "/dashboard" });
    await track(db, "digest_sent", { organizerId: o.id, props: { groups: groups.length, tip: !!digest.tip } });
    sent++;
  }
  return { sent };
}
