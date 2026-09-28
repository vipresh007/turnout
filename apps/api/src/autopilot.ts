import { buildRoster, describeForecast, LATE_WARNING_HOURS } from "@turnout/shared";
import { track } from "./analytics.ts";
import type { Db } from "./db/client.ts";
import { currentSession, groupColumns, groupInsightsFor, sessionRsvps, type GroupRow } from "./groups.ts";
import { emailHtml, sendEmail, webUrl } from "./notify.ts";
import { whenLabel } from "./reminders.ts";

/** Too close to the start to do anything useful about it. */
const TOO_LATE_HOURS = 2;

/**
 * Autopilot's heads-up: within a day of the game, if the forecast says the group will probably be short,
 * email its organizers once with who to ask. Safe to run as often as the reminder job runs.
 */
export async function runForecastAlerts(db: Db, now = new Date()): Promise<{ checked: number; alerted: number }> {
  const groups = await db.query<GroupRow>(`SELECT ${groupColumns}, organizer_id AS "organizerId" FROM groups WHERE cap IS NOT NULL`);
  let checked = 0;
  let alerted = 0;
  for (const group of groups) {
    const session = await currentSession(db, group, now);
    const hoursToGo = (new Date(session.startsAt).getTime() - now.getTime()) / 3_600_000;
    if (session.cancelled || hoursToGo > LATE_WARNING_HOURS || hoursToGo < TOO_LATE_HOURS) continue;
    const [already] = await db.query(`SELECT 1 FROM sessions WHERE id = $1 AND forecast_alerted_at IS NOT NULL`, [session.id]);
    if (already) continue;
    checked++;
    const roster = buildRoster(await sessionRsvps(db, session.id), group.cap);
    const { forecast } = await groupInsightsFor(db, group, { roster, cancelled: false }, now);
    if (forecast?.status !== "short") continue;
    const [claimed] = await db.query(`UPDATE sessions SET forecast_alerted_at = now() WHERE id = $1 AND forecast_alerted_at IS NULL RETURNING 1`, [session.id]);
    if (!claimed) continue;

    const { detail } = describeForecast(forecast, roster.confirmed.length, group.cap!);
    const title = `${group.name} may be ${forecast.short} short`;
    const body = `${whenLabel(session.startsAt, group.timezone)}. ${detail} Open the group to ask them with one tap.`;
    const url = `${webUrl()}/dashboard?from=forecast`;
    const organizers = await db.query<{ id: string; email: string }>(
      `SELECT id, email FROM organizers WHERE email IS NOT NULL AND (id = $1 OR id IN (SELECT organizer_id FROM group_admins WHERE group_id = $2))`,
      [group.organizerId, group.id],
    );
    for (const o of organizers) {
      await sendEmail(o.email, title, emailHtml({ title, body, url }, undefined, "See who to ask"), `${title}. ${body} ${url}`)
        .catch((err) => console.warn("forecast alert failed", err));
      await track(db, "forecast_alert_sent", { groupId: group.id, sessionId: session.id, organizerId: o.id, props: { short: forecast.short, hoursToGo: Math.round(hoursToGo) } });
    }
    alerted++;
  }
  return { checked, alerted };
}
