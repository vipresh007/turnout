import type { Db } from "./db/client.ts";

/** Organizers allowed to see product metrics: ADMIN_EMAILS, comma-separated. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}

const pct = (n: number, d: number) => (d ? n / d : null);

/**
 * What Turnout is actually used for, across every group. The North Star is games run: past, not cancelled,
 * at least two players in. Event-based rates only count from when event tracking started.
 */
export async function productMetrics(db: Db, days = 90, now = new Date()) {
  const from = new Date(now.getTime() - days * 86_400_000).toISOString();
  const nowIso = now.toISOString();
  const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params))[0]!;

  // Every past game in the window with its turnout.
  const games = await db.query<{ id: string; startsAt: Date | string; cancelled: boolean; cap: number | null; ins: number; groupId: string }>(
    `SELECT s.id, COALESCE(s.starts_at_override, s.starts_at) AS "startsAt", s.cancelled, g.cap, g.id AS "groupId",
            (SELECT count(*)::int FROM rsvps r WHERE r.session_id = s.id AND r.status = 'in') AS ins
     FROM sessions s JOIN groups g ON g.id = s.group_id
     WHERE COALESCE(s.starts_at_override, s.starts_at) BETWEEN $1 AND $2`,
    [from, nowIso],
  );
  const run = games.filter((g) => !g.cancelled && g.ins >= 2);
  const weeks = Array.from({ length: Math.ceil(days / 7) }, (_, i) => ({ start: new Date(now.getTime() - (Math.ceil(days / 7) - i) * 7 * 86_400_000).toISOString(), games: 0 }));
  for (const g of run) {
    const i = weeks.findIndex((w, j) => new Date(g.startsAt) >= new Date(w.start) && (j === weeks.length - 1 || new Date(g.startsAt) < new Date(weeks[j + 1]!.start)));
    if (i >= 0) weeks[i]!.games++;
  }

  const { trackingSince } = await one<{ trackingSince: Date | string | null }>(`SELECT min(at) AS "trackingSince" FROM events`);
  const since = trackingSince ? new Date(Math.max(new Date(trackingSince).getTime(), Date.parse(from))).toISOString() : nowIso;
  const counts = Object.fromEntries(
    (await db.query<{ kind: string; n: number }>(`SELECT kind, count(*)::int AS n FROM events WHERE at BETWEEN $1 AND $2 GROUP BY kind`, [from, nowIso])).map((r) => [r.kind, r.n]),
  ) as Record<string, number>;
  const c = (k: string) => counts[k] ?? 0;

  const players = await one<{ joined: number; responded: number }>(
    `SELECT count(*)::int AS joined, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM rsvps r WHERE r.member_id = m.id))::int AS responded
     FROM members m WHERE m.created_at BETWEEN $1 AND $2`,
    [from, nowIso],
  );
  const answers = await one<{ total: number; beforeReminder: number }>(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE NOT COALESCE((props->>'afterReminder')::boolean, false))::int AS "beforeReminder"
     FROM events WHERE kind IN ('rsvp_in', 'rsvp_out') AND at BETWEEN $1 AND $2`,
    [since, nowIso],
  );
  const trackedRun = run.filter((g) => new Date(g.startsAt) >= new Date(since));
  const reminded = trackedRun.length
    ? (await one<{ n: number }>(`SELECT count(DISTINCT session_id)::int AS n FROM events WHERE kind = 'reminder_sent' AND session_id = ANY($1::uuid[])`, [trackedRun.map((g) => g.id)])).n
    : 0;
  const capped = run.filter((g) => g.cap !== null);
  const groups = await one<{ created: number; total: number }>(
    `SELECT count(*) FILTER (WHERE created_at BETWEEN $1 AND $2)::int AS created, count(*)::int AS total FROM groups`,
    [from, nowIso],
  );

  return {
    days,
    trackingSince: trackingSince ? new Date(trackingSince).toISOString() : null,
    northStar: { gamesRun: run.length, weeks },
    groups: { created: groups.created, total: groups.total, active: new Set(run.map((g) => g.groupId)).size },
    games: { scheduled: games.length, cancelled: games.filter((g) => g.cancelled).length, run: run.length, avgPlayers: run.length ? run.reduce((n, g) => n + Math.min(g.ins, g.cap ?? g.ins), 0) / run.length : null },
    players: { joined: players.joined, responded: players.responded },
    rates: {
      respondBeforeReminder: pct(answers.beforeReminder, answers.total),
      gamesNeedingReminder: pct(reminded, trackedRun.length),
      gamesUsingWaitlist: pct(capped.filter((g) => g.ins > g.cap!).length, capped.length),
      lateDropsPerGame: pct(c("late_dropout"), trackedRun.length),
      spotAlertClaimRate: pct(c("spot_alert_claimed"), c("spot_alert_sent")),
    },
    events: counts,
  };
}
