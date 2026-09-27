import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import {
  buildRoster,
  cancelSessionSchema,
  createGroupSchema,
  emailSchema,
  joinGroupSchema,
  mergeMemberSchema,
  paidSchema,
  parseGroupSchema,
  promotedMembers,
  pushSubscriptionSchema,
  rsvpSchema,
  saveTeamsSchema,
  sessionUpdateSchema,
  skillSchema,
  tokenSchema,
  updateGroupSchema,
  type Group,
  type MemberSelf,
  type MemberSummary,
} from "@turnout/shared";
import { draftGroupFromSentence } from "./ai/parse-group.ts";
import { registerAuthEvents } from "./authEvents.ts";
import { groupCalendar } from "./calendar.ts";
import { groupCardSvg, renderPng } from "./ogImage.ts";
import { currentOrganizer, HttpError, requireMember, requireOrganizer } from "./auth.ts";
import type { Db } from "./db/client.ts";
import { events, liveUrl, liveUrlForGroups } from "./events.ts";
import { currentSession, findGroupBySlug, groupColumns, groupPage, listOrganizerGroups, organizerDashboard, publicGroup, sessionRsvps, upcomingWeeks, type GroupRow } from "./groups.ts";
import { hashToken, newMemberToken, randomSlug } from "./ids.ts";
import { emailEnabled, emailHtml, pushPublicKey, sendEmail, webUrl } from "./notify.ts";
import { LATE_DROP_HOURS, notifyPromoted, onSpotOpened, remindNow } from "./reminders.ts";
import { atLocal, isValidTimezone, localDate, scheduledStarts, todayIn } from "./schedule.ts";

type SlugParams = { Params: { slug: string } };

export async function buildApp(db: Db) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    trustProxy: true, // behind the Container Apps ingress; needed for per-client rate limits
  });
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });
  // Tests make many requests from one address; production limits are per client.
  const limit = (max: number) => (process.env.NODE_ENV === "test" ? 100_000 : max);
  await app.register(rateLimit, { max: limit(300), timeWindow: "1 minute" });
  const strict = (max: number) => ({ config: { rateLimit: { max: limit(max), timeWindow: "1 minute" } } });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ error: err.issues[0]?.message ?? "Invalid input", issues: err.issues });
    if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: err.message });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.status(status).send({ error: (err as Error).message });
    app.log.error(err);
    return reply.status(500).send({ error: "Something went wrong" });
  });

  const groupOr404 = async (slug: string): Promise<GroupRow> => {
    const group = await findGroupBySlug(db, slug);
    if (!group) throw new HttpError(404, "Group not found");
    return group;
  };

  const ownedGroup = async (req: Parameters<typeof requireOrganizer>[1], slug: string) => {
    const [organizer, group] = await Promise.all([requireOrganizer(db, req), groupOr404(slug)]);
    if (group.organizerId !== organizer.id) throw new HttpError(403, "Only the organizer can do that");
    return { organizer, group };
  };

  const changed = async (group: GroupRow, before?: ReturnType<typeof buildRoster>, organizerId: string | null = null) => {
    const page = await groupPage(db, group, organizerId);
    await events.rosterChanged(group.slug);
    if (before) {
      const promoted = promotedMembers(before, page.roster);
      if (promoted.length) await notifyPromoted(db, group, page.session.startsAt, promoted.map((p) => p.memberId));
    }
    return page;
  };

  app.get("/health", async () => ({ ok: true }));
  registerAuthEvents(app);

  // ── Organizer ──────────────────────────────────────────────
  app.post("/ai/group-draft", strict(10), async (req) => {
    await requireOrganizer(db, req);
    const { sentence } = parseGroupSchema.parse(req.body);
    return draftGroupFromSentence(sentence);
  });

  app.post("/groups", strict(20), async (req, reply) => {
    const organizer = await requireOrganizer(db, req);
    const input = createGroupSchema.parse(req.body);
    if (!isValidTimezone(input.timezone)) throw new HttpError(400, "Unknown timezone");
    const [group] = await db.query<Group>(
      `INSERT INTO groups (slug, organizer_id, name, activity, location, weekday, weekdays, interval_weeks, starts_on, ends_on,
                           start_time, duration_minutes, timezone, cap, reminders)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING ${groupColumns}`,
      [randomSlug(), organizer.id, input.name, input.activity ?? null, input.location ?? null, input.weekdays[0], input.weekdays,
       input.intervalWeeks, input.startsOn ?? todayIn(input.timezone), input.endsOn ?? null,
       input.startTime, input.durationMinutes, input.timezone, input.cap, JSON.stringify(input.reminders)],
    );
    return reply.status(201).send({ group });
  });

  app.get("/me/groups", async (req) => {
    const organizer = await requireOrganizer(db, req);
    return { groups: await listOrganizerGroups(db, organizer.id) };
  });

  // Live updates for the dashboard: one channel covering all of the organizer's groups.
  app.get("/me/live", strict(30), async (req) => {
    const organizer = await requireOrganizer(db, req);
    const groups = await listOrganizerGroups(db, organizer.id);
    return { url: await liveUrlForGroups(groups.map((g) => g.slug)) };
  });

  app.get("/me/dashboard", async (req) => {
    const organizer = await requireOrganizer(db, req);
    return organizerDashboard(db, organizer.id);
  });

  app.patch<SlugParams>("/groups/:slug", async (req) => {
    const { organizer, group } = await ownedGroup(req, req.params.slug);
    const input = updateGroupSchema.parse(req.body);
    if (input.timezone && !isValidTimezone(input.timezone)) throw new HttpError(400, "Unknown timezone");
    const columns: Record<string, unknown> = {
      name: input.name, activity: input.activity, location: input.location,
      weekdays: input.weekdays, weekday: input.weekdays?.[0], interval_weeks: input.intervalWeeks,
      starts_on: input.startsOn, ends_on: input.endsOn,
      start_time: input.startTime, duration_minutes: input.durationMinutes, timezone: input.timezone, cap: input.cap,
      reminders: input.reminders && JSON.stringify(input.reminders),
    };
    const entries = Object.entries(columns).filter(([, v]) => v !== undefined);
    await db.query(
      `UPDATE groups SET ${entries.map(([k], i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`,
      [group.id, ...entries.map(([, v]) => v)],
    );
    const updated = (await findGroupBySlug(db, group.slug))!;
    // A lower cap or a new schedule can reshuffle the roster.
    return changed(updated, undefined, organizer.id);
  });

  // ── Organizer: the schedule, week by week ─────────────────
  app.get<SlugParams>("/groups/:slug/weeks", async (req) => {
    const { group } = await ownedGroup(req, req.params.slug);
    return { weeks: await upcomingWeeks(db, group) };
  });

  // Skip one week, move it, change its place, or leave a note. The regular schedule is untouched.
  app.put<{ Params: { slug: string; scheduledAt: string } }>("/groups/:slug/weeks/:scheduledAt", async (req) => {
    const { group } = await ownedGroup(req, req.params.slug);
    const input = sessionUpdateSchema.parse(req.body);
    const scheduled = new Date(req.params.scheduledAt);
    if (Number.isNaN(scheduled.getTime())) throw new HttpError(400, "Unknown week");
    const isScheduled = scheduledStarts(group, new Date(scheduled.getTime() - 86_400_000), 3).some((d) => d.getTime() === scheduled.getTime());
    if (!isScheduled) throw new HttpError(400, "That isn't one of this group's games");

    const set: Record<string, unknown> = {};
    if (input.cancelled !== undefined) set.cancelled = input.cancelled;
    if (input.startTime !== undefined) {
      set.starts_at_override = input.startTime === null ? null : atLocal(localDate(scheduled, group.timezone), input.startTime, group.timezone).toISOString();
    }
    if (input.location !== undefined) set.location_override = input.location || null;
    if (input.note !== undefined) set.note = input.note || null;
    const cols = Object.keys(set);
    await db.query(
      `INSERT INTO sessions (group_id, starts_at, ${cols.join(", ")}) VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(", ")})
       ON CONFLICT (group_id, starts_at) DO UPDATE SET ${cols.map((c) => `${c} = EXCLUDED.${c}`).join(", ")}`,
      [group.id, scheduled.toISOString(), ...cols.map((c) => set[c])],
    );
    await events.rosterChanged(group.slug); // players looking at this week see the change
    return { weeks: await upcomingWeeks(db, group) };
  });

  app.put<SlugParams>("/groups/:slug/session/cancelled", async (req) => {
    const { organizer, group } = await ownedGroup(req, req.params.slug);
    const { cancelled } = cancelSessionSchema.parse(req.body);
    const session = await currentSession(db, group);
    await db.query(`UPDATE sessions SET cancelled = $2 WHERE id = $1`, [session.id, cancelled]);
    return changed(group, undefined, organizer.id);
  });

  app.delete<{ Params: { slug: string; memberId: string } }>("/groups/:slug/members/:memberId", async (req) => {
    const { organizer, group } = await ownedGroup(req, req.params.slug);
    const session = await currentSession(db, group);
    const before = buildRoster(await sessionRsvps(db, session.id), group.cap);
    const [removed] = await db.query(`DELETE FROM members WHERE id = $1 AND group_id = $2 RETURNING id`, [req.params.memberId, group.id]);
    if (!removed) throw new HttpError(404, "Member not found");
    return changed(group, before, organizer.id);
  });

  // ── Members (no account) ───────────────────────────────────
  app.get<SlugParams>("/groups/:slug", async (req) => {
    const group = await groupOr404(req.params.slug);
    const organizer = await currentOrganizer(db, req).catch(() => null); // an expired token shouldn't hide a public page
    return groupPage(db, group, organizer?.id ?? null);
  });

  // Link-preview image for chat apps (Open Graph). Short cache so the count stays fresh.
  app.get<{ Params: { slug: string } }>("/og/:slug.png", async (req, reply) => {
    const group = await groupOr404(req.params.slug);
    const page = await groupPage(db, group, null);
    reply.header("content-type", "image/png").header("cache-control", "public, max-age=300");
    return renderPng(groupCardSvg(page));
  });

  // Subscribable calendar: the game as a weekly repeating event.
  app.get<SlugParams>("/groups/:slug/calendar.ics", async (req, reply) => {
    const group = await groupOr404(req.params.slug);
    const session = await currentSession(db, group);
    reply.header("content-type", "text/calendar; charset=utf-8").header("content-disposition", `inline; filename="${group.slug}.ics"`);
    const skipped = (await upcomingWeeks(db, group, 26)).filter((w) => w.cancelled).map((w) => new Date(w.scheduledAt));
    return groupCalendar(publicGroup(group), new Date(session.scheduledAt), `${webUrl()}/g/${group.slug}`, skipped);
  });

  app.get<SlugParams>("/groups/:slug/live", strict(30), async (req) => {
    const group = await groupOr404(req.params.slug);
    return { url: await liveUrl(group.slug) };
  });

  app.post<SlugParams>("/groups/:slug/members", strict(10), async (req, reply) => {
    const group = await groupOr404(req.params.slug);
    const { name, confirmNew } = joinGroupSchema.parse(req.body);
    // Same name already here? Ask "is that you?" before creating a second one.
    const [existing] = await db.query<{ id: string; name: string; hasEmail: boolean }>(
      `SELECT id, name, email_confirmed_at IS NOT NULL AS "hasEmail" FROM members
       WHERE group_id = $1 AND lower(trim(name)) = lower($2) ORDER BY created_at LIMIT 1`,
      [group.id, name],
    );
    if (existing && !confirmNew) return reply.status(409).send({ error: "name_taken", existing });
    const [member] = await db.query<{ id: string; name: string }>(
      `INSERT INTO members (group_id, name) VALUES ($1, $2) RETURNING id, name`,
      [group.id, name],
    );
    const token = await issueDeviceToken(member!.id);
    return reply.status(201).send({ member, token });
  });

  const issueDeviceToken = async (memberId: string) => {
    const token = newMemberToken();
    await db.query(`INSERT INTO member_tokens (token_hash, member_id) VALUES ($1, $2)`, [hashToken(token), memberId]);
    return token;
  };

  // "That's me" on a new phone: email a one-time link to the address they use for reminders.
  // The response never reveals the address or whether one exists beyond sent/not sent.
  app.post<{ Params: { slug: string; memberId: string } }>("/groups/:slug/members/:memberId/restore", strict(5), async (req) => {
    const group = await groupOr404(req.params.slug);
    const [m] = await db.query<{ id: string; name: string; email: string | null }>(
      `SELECT id, name, CASE WHEN email_confirmed_at IS NOT NULL THEN email END AS email FROM members WHERE id = $1 AND group_id = $2`,
      [req.params.memberId, group.id],
    );
    if (!m) throw new HttpError(404, "Member not found");
    if (!m.email || !emailEnabled()) return { sent: false };
    const token = newMemberToken();
    await db.query(`INSERT INTO member_restores (token_hash, member_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')`, [hashToken(token), m.id]);
    const url = `${webUrl()}/restore?t=${token}`;
    await sendEmail(
      m.email,
      `Use Turnout on your new phone`,
      emailHtml({ title: `Is this you, ${m.name}?`, body: `Tap below on your new phone to pick up where you left off in ${group.name}. The link works once, for an hour. Didn't ask for this? Ignore it.`, url }, undefined, "Continue on this phone"),
      `Continue in ${group.name} on your new phone: ${url} (works once, for an hour)`,
    );
    return { sent: true };
  });

  app.post("/restore", strict(20), async (req) => {
    const { token } = tokenSchema.parse(req.body);
    const [row] = await db.query<{ memberId: string; name: string; slug: string }>(
      `DELETE FROM member_restores r USING members m, groups g
       WHERE r.token_hash = $1 AND r.expires_at > now() AND m.id = r.member_id AND g.id = m.group_id
       RETURNING r.member_id AS "memberId", m.name, g.slug`,
      [hashToken(token)],
    );
    if (!row) throw new HttpError(404, "This link has expired. Ask for a new one from the group page.");
    return { slug: row.slug, member: { id: row.memberId, name: row.name }, token: await issueDeviceToken(row.memberId) };
  });

  // ── Organizer: members ────────────────────────────────────
  app.get<SlugParams>("/groups/:slug/members", async (req) => {
    const { group } = await ownedGroup(req, req.params.slug);
    const members = await db.query<MemberSummary & { joinedAt: Date | string }>(
      `SELECT m.id, m.name, m.email_confirmed_at IS NOT NULL AS "hasEmail", m.created_at AS "joinedAt",
              (SELECT count(*)::int FROM member_tokens t WHERE t.member_id = m.id) AS devices,
              (SELECT count(*)::int FROM rsvps r WHERE r.member_id = m.id AND r.status = 'in') AS "gamesIn"
       FROM members m WHERE m.group_id = $1 ORDER BY lower(m.name), m.created_at`,
      [group.id],
    );
    return { members: members.map((m) => ({ ...m, joinedAt: new Date(m.joinedAt).toISOString() })) };
  });

  // Two entries for one person (e.g. a new phone): move everything onto one and remove the other.
  app.post<{ Params: { slug: string; memberId: string } }>("/groups/:slug/members/:memberId/merge", async (req) => {
    const { organizer, group } = await ownedGroup(req, req.params.slug);
    const { intoId } = mergeMemberSchema.parse(req.body);
    const from = req.params.memberId;
    if (from === intoId) throw new HttpError(400, "Pick a different player to merge into");
    const found = await db.query(`SELECT id FROM members WHERE group_id = $1 AND id = ANY($2::uuid[])`, [group.id, [from, intoId]]);
    if (found.length !== 2) throw new HttpError(404, "Member not found");
    await db.query(`UPDATE member_tokens SET member_id = $2 WHERE member_id = $1`, [from, intoId]);
    await db.query(
      `INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth)
       SELECT $2, endpoint, p256dh, auth FROM push_subscriptions WHERE member_id = $1 ON CONFLICT DO NOTHING`,
      [from, intoId],
    );
    // Answers: keep the merged-into player's where both answered the same week.
    await db.query(
      `UPDATE rsvps SET member_id = $2 WHERE member_id = $1
       AND session_id NOT IN (SELECT session_id FROM rsvps WHERE member_id = $2)`,
      [from, intoId],
    );
    await db.query(
      `UPDATE members t SET email = f.email, email_confirmed_at = f.email_confirmed_at, email_token = f.email_token
       FROM members f WHERE t.id = $2 AND f.id = $1 AND t.email IS NULL`,
      [from, intoId],
    );
    await db.query(`UPDATE members t SET skill = COALESCE(t.skill, f.skill) FROM members f WHERE t.id = $2 AND f.id = $1`, [from, intoId]);
    await db.query(`DELETE FROM members WHERE id = $1`, [from]);
    await changed(group, undefined, organizer.id);
    return { ok: true };
  });

  app.put<SlugParams>("/groups/:slug/rsvp", strict(30), async (req) => {
    const group = await groupOr404(req.params.slug);
    const member = await requireMember(db, req, group.id);
    const { status } = rsvpSchema.parse(req.body);
    const session = await currentSession(db, group);
    if (session.cancelled) throw new HttpError(409, "This week's session is cancelled");

    const before = buildRoster(await sessionRsvps(db, session.id), group.cap);
    const wasConfirmed = before.confirmed.some((r) => r.memberId === member.id);
    const hoursToGo = (new Date(session.startsAt).getTime() - Date.now()) / 3_600_000;
    const lateDrop = status === "out" && wasConfirmed && hoursToGo > 0 && hoursToGo <= LATE_DROP_HOURS;
    // Saying "in" again keeps your place. Any change moves your timestamp, so rejoining puts you at the back.
    await db.query(
      `INSERT INTO rsvps (session_id, member_id, status, late_drop) VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, member_id) DO UPDATE SET
         status = EXCLUDED.status,
         late_drop = EXCLUDED.late_drop OR (rsvps.late_drop AND EXCLUDED.status = 'out'),
         responded_at = CASE WHEN rsvps.status = EXCLUDED.status THEN rsvps.responded_at ELSE now() END`,
      [session.id, member.id, status, lateDrop],
    );
    const page = await changed(group, before);
    // A confirmed player left and nobody moved up: chase the open spot.
    if (wasConfirmed && status === "out" && promotedMembers(before, page.roster).length === 0) {
      const rsvps = await sessionRsvps(db, session.id);
      await onSpotOpened(db, group, session, rsvps, member.name).catch((err) => req.log.warn({ err }, "spot-opened failed"));
    }
    return page;
  });

  // ── Organizer: payments, skills, teams, reminders ─────────
  const ownedMember = async (group: GroupRow, memberId: string) => {
    const [m] = await db.query<{ id: string }>(`SELECT id FROM members WHERE id = $1 AND group_id = $2`, [memberId, group.id]);
    if (!m) throw new HttpError(404, "Member not found");
  };

  app.put<{ Params: { slug: string; memberId: string } }>("/groups/:slug/members/:memberId/paid", async (req) => {
    const { organizer, group } = await ownedGroup(req, req.params.slug);
    await ownedMember(group, req.params.memberId);
    const { paid } = paidSchema.parse(req.body);
    const session = await currentSession(db, group);
    const [row] = await db.query(
      `UPDATE rsvps SET paid_at = ${paid ? "now()" : "NULL"} WHERE session_id = $1 AND member_id = $2 RETURNING 1`,
      [session.id, req.params.memberId],
    );
    if (!row) throw new HttpError(409, "They haven't responded this week");
    return groupPage(db, group, organizer.id);
  });

  app.put<{ Params: { slug: string; memberId: string } }>("/groups/:slug/members/:memberId/skill", async (req) => {
    const { organizer, group } = await ownedGroup(req, req.params.slug);
    await ownedMember(group, req.params.memberId);
    const { skill } = skillSchema.parse(req.body);
    await db.query(`UPDATE members SET skill = $2 WHERE id = $1`, [req.params.memberId, skill]);
    return groupPage(db, group, organizer.id);
  });

  app.put<SlugParams>("/groups/:slug/session/teams", async (req) => {
    const { organizer, group } = await ownedGroup(req, req.params.slug);
    const { teams } = saveTeamsSchema.parse(req.body);
    const session = await currentSession(db, group);
    if (teams) {
      const ids = teams.flat();
      if (new Set(ids).size !== ids.length) throw new HttpError(400, "A player is on two teams");
      const members = await db.query<{ id: string }>(`SELECT id FROM members WHERE group_id = $1 AND id = ANY($2::uuid[])`, [group.id, ids]);
      if (members.length !== ids.length) throw new HttpError(400, "Unknown player");
    }
    await db.query(`UPDATE sessions SET teams = $2 WHERE id = $1`, [session.id, teams ? JSON.stringify({ teams, savedAt: new Date().toISOString() }) : null]);
    return changed(group, undefined, organizer.id);
  });

  app.post<SlugParams>("/groups/:slug/remind", strict(10), async (req) => {
    const { group } = await ownedGroup(req, req.params.slug);
    return remindNow(db, group);
  });

  // ── Members: reminder channels ────────────────────────────
  app.get("/push/key", async () => ({ publicKey: pushPublicKey(), email: emailEnabled() }));

  const memberSelf = async (memberId: string): Promise<MemberSelf> => {
    const [row] = await db.query<{ id: string; name: string; email: string | null; confirmed: boolean; push: number }>(
      `SELECT m.id, m.name, m.email, m.email_confirmed_at IS NOT NULL AS confirmed,
              (SELECT count(*)::int FROM push_subscriptions p WHERE p.member_id = m.id) AS push
       FROM members m WHERE m.id = $1`,
      [memberId],
    );
    return { member: { id: row!.id, name: row!.name }, channels: { push: row!.push, email: row!.email, emailConfirmed: row!.confirmed } };
  };

  app.get<SlugParams>("/groups/:slug/me", async (req) => {
    const group = await groupOr404(req.params.slug);
    return memberSelf((await requireMember(db, req, group.id)).id);
  });

  app.put<SlugParams>("/groups/:slug/me/push", strict(20), async (req) => {
    const group = await groupOr404(req.params.slug);
    const member = await requireMember(db, req, group.id);
    const sub = pushSubscriptionSchema.parse(req.body);
    await db.query(
      `INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)
       ON CONFLICT (member_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [member.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth],
    );
    return memberSelf(member.id);
  });

  app.delete<SlugParams>("/groups/:slug/me/push", async (req) => {
    const group = await groupOr404(req.params.slug);
    const member = await requireMember(db, req, group.id);
    await db.query(`DELETE FROM push_subscriptions WHERE member_id = $1`, [member.id]);
    return memberSelf(member.id);
  });

  app.put<SlugParams>("/groups/:slug/me/email", strict(5), async (req) => {
    const group = await groupOr404(req.params.slug);
    const member = await requireMember(db, req, group.id);
    const { email } = emailSchema.parse(req.body);
    const token = newMemberToken();
    // Typing your own email on the page is the consent; reminders start right away. The welcome
    // email says who we are and has a one-tap stop, so a mistyped or someone-else's address is
    // stopped by its owner with one tap (CASL: identify the sender, include an unsubscribe).
    await db.query(`UPDATE members SET email = $2, email_confirmed_at = now(), email_token = $3 WHERE id = $1`, [member.id, email, token]);
    const stopUrl = `${webUrl()}/email?unsubscribe=${token}`;
    await sendEmail(
      email,
      `You're set for ${group.name} reminders`,
      emailHtml(
        { title: `You'll get reminders for ${group.name}`, body: `We'll email you before each game, and that's all. Not you, or changed your mind? Tap “Stop these emails” below.`, url: `${webUrl()}/g/${group.slug}` },
        stopUrl,
        `Open ${group.name}`,
      ),
      `You'll get reminders for ${group.name}. Not you? Stop these emails: ${stopUrl}`,
      stopUrl,
    ).catch((err) => req.log.warn({ err }, "welcome email failed"));
    return memberSelf(member.id);
  });

  app.delete<SlugParams>("/groups/:slug/me/email", async (req) => {
    const group = await groupOr404(req.params.slug);
    const member = await requireMember(db, req, group.id);
    await db.query(`UPDATE members SET email = NULL, email_confirmed_at = NULL, email_token = NULL WHERE id = $1`, [member.id]);
    return memberSelf(member.id);
  });

  const byEmailToken = async (token: string) => {
    const [row] = await db.query<{ id: string; groupName: string; slug: string }>(
      `SELECT m.id, g.name AS "groupName", g.slug FROM members m JOIN groups g ON g.id = m.group_id WHERE m.email_token = $1`,
      [token],
    );
    if (!row) throw new HttpError(404, "This link has expired");
    return row;
  };

  app.post("/email/confirm", strict(20), async (req) => {
    const { token } = tokenSchema.parse(req.body);
    const row = await byEmailToken(token);
    await db.query(`UPDATE members SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = $1`, [row.id]);
    return { groupName: row.groupName, slug: row.slug };
  });

  app.post("/email/unsubscribe", strict(20), async (req) => {
    const { token } = tokenSchema.parse(req.body);
    const row = await byEmailToken(token);
    await db.query(`UPDATE members SET email = NULL, email_confirmed_at = NULL, email_token = NULL WHERE id = $1`, [row.id]);
    return { groupName: row.groupName, slug: row.slug };
  });

  return app;
}
