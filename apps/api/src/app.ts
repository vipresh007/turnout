import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import {
  acceptAdminInviteSchema,
  pushTokenSchema,
  feedbackSchema,
  addPlayersSchema,
  buildRoster,
  cancelSessionSchema,
  createGroupSchema,
  emailSchema,
  formatMoney,
  joinGroupSchema,
  mergeMemberSchema,
  paidSchema,
  parseGroupSchema,
  promotedMembers,
  pushSubscriptionSchema,
  appPushSchema,
  membershipLinksSchema,
  contactSchema,
  reportSchema,
  type LinkedMembership,
  rsvpSchema,
  saveTeamsSchema,
  seasonMemberSchema,
  newSeasonSchema,
  sessionUpdateSchema,
  skillSchema,
  tokenSchema,
  transferOwnerSchema,
  updateGroupSchema,
  type Group,
  type GroupOrganizer,
  type GroupRole,
  type MemberSelf,
  type MemberSummary,
} from "@turnout/shared";
import { draftGroupFromSentence } from "./ai/parse-group.ts";
import { CLIENT_EVENTS, track } from "./analytics.ts";
import { isAdminEmail, productMetrics } from "./metrics.ts";
import { registerAuthEvents } from "./authEvents.ts";
import { groupCalendar } from "./calendar.ts";
import { groupCardSvg, renderPng } from "./ogImage.ts";
import { currentOrganizer, HttpError, requireMember, requireOrganizer } from "./auth.ts";
import type { Db } from "./db/client.ts";
import { events, liveUrl, liveUrlForGroups } from "./events.ts";
import { currentSession, findGroupBySlug, gameHistory, memberStats, groupColumns, groupInsightsFor, groupPage, groupRole, managedBy, organizerActivity, seasonOf, listOrganizerGroups, organizerDashboard, publicGroup, sessionRsvps, upcomingWeeks, type GroupRow } from "./groups.ts";
import { hashToken, newMemberToken, randomSlug } from "./ids.ts";
import { APP_PUSH_PREFIX, emailEnabled, emailHtml, notifyMember, pushPublicKey, sendEmail, webUrl } from "./notify.ts";
import { LATE_DROP_HOURS, notifyPromoted, onSpotOpened, remindNow } from "./reminders.ts";
import { atLocal, currentSessionStart, isValidTimezone, localDate, scheduledStarts, todayIn } from "./schedule.ts";

/** Games run before the one-time "how's it working?" check-in, and before asking whether they'd keep it for $49/year. */
const FEEDBACK_ASK_AFTER_GAMES = 3;
const PRICING_ASK_AFTER_GAMES = 5;

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

  /** The group, for its owner or an admin. */
  const ownedGroup = async (req: Parameters<typeof requireOrganizer>[1], slug: string) => {
    const [organizer, group] = await Promise.all([requireOrganizer(db, req), groupOr404(slug)]);
    const role = await groupRole(db, group, organizer.id);
    if (!role) throw new HttpError(403, "Only the group's organizers can do that");
    return { organizer, group, role };
  };

  /** The group, for its owner only: managing admins and ownership. */
  const ownerOnly = async (req: Parameters<typeof requireOrganizer>[1], slug: string) => {
    const owned = await ownedGroup(req, slug);
    if (owned.role !== "owner") throw new HttpError(403, "Only the group's owner can do that");
    return owned;
  };

  const changed = async (group: GroupRow, before?: ReturnType<typeof buildRoster>, organizerId: string | null = null) => {
    const page = await groupPage(db, group, organizerId);
    await events.rosterChanged(group.slug);
    if (before) {
      const promoted = promotedMembers(before, page.roster);
      if (promoted.length) {
        await notifyPromoted(db, group, page.session.startsAt, promoted.map((p) => p.memberId));
        for (const p of promoted) await track(db, "waitlist_promoted", { groupId: group.id, sessionId: page.session.id, memberId: p.memberId });
      }
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
                           start_time, duration_minutes, timezone, cap, reminders, fee_cents, fee_split, pay_note, season_fee_cents, target_players)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING ${groupColumns}`,
      [randomSlug(), organizer.id, input.name, input.activity ?? null, input.location ?? null, input.weekdays[0], input.weekdays,
       input.intervalWeeks, input.startsOn ?? todayIn(input.timezone), input.endsOn ?? null,
       input.startTime, input.durationMinutes, input.timezone, input.cap, JSON.stringify(input.reminders),
       input.feeCents ?? null, input.feeSplit ?? false, input.payNote || null, input.seasonFeeCents ?? null, input.targetPlayers ?? null],
    );
    await track(db, "group_created", { groupId: group!.id, organizerId: organizer.id, props: { cap: input.cap, weekdays: input.weekdays.length, fee: !!input.feeCents } });
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

  // Who's signed in, for the account menu in the site header.
  app.get("/me", async (req) => {
    const organizer = await requireOrganizer(db, req);
    const [row] = await db.query<{ name: string | null; email: string | null }>(`SELECT name, email FROM organizers WHERE id = $1`, [organizer.id]);
    return { name: row?.name ?? null, email: row?.email ?? null, isAdmin: isAdminEmail(row?.email) };
  });

  // The organizer app registers its push token after sign-in (and removes it on sign-out).
  app.put("/me/push-token", strict(20), async (req) => {
    const organizer = await requireOrganizer(db, req);
    const { token, platform } = pushTokenSchema.parse(req.body);
    await db.query(
      `INSERT INTO organizer_push_tokens (token, organizer_id, platform) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET organizer_id = EXCLUDED.organizer_id, platform = EXCLUDED.platform`,
      [token, organizer.id, platform ?? null],
    );
    return { ok: true };
  });

  app.delete("/me/push-token", async (req) => {
    const organizer = await requireOrganizer(db, req);
    const { token } = pushTokenSchema.pick({ token: true }).parse(req.body ?? {});
    await db.query(`DELETE FROM organizer_push_tokens WHERE token = $1 AND organizer_id = $2`, [token, organizer.id]);
    return { ok: true };
  });

  // Everything that happened across the organizer's groups, newest first (the app's Activity tab).
  app.get<{ Querystring: { limit?: string } }>("/me/activity", async (req) => {
    const organizer = await requireOrganizer(db, req);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    return { activity: await organizerActivity(db, organizer.id, limit) };
  });

  // Delete your organizer account (required by the App Store). Groups you co-run with someone else pass to
  // them; groups only you run are deleted with their players and history.
  app.delete("/me", strict(5), async (req) => {
    const organizer = await requireOrganizer(db, req);
    const owned = await db.query<{ id: string; heir: string | null }>(
      `SELECT g.id, (SELECT a.organizer_id FROM group_admins a WHERE a.group_id = g.id AND a.organizer_id <> $1 ORDER BY a.added_at LIMIT 1) AS heir
       FROM groups g WHERE g.organizer_id = $1`,
      [organizer.id],
    );
    let handedOver = 0;
    let deleted = 0;
    for (const g of owned) {
      if (g.heir) {
        await db.query(`UPDATE groups SET organizer_id = $2 WHERE id = $1`, [g.id, g.heir]);
        await db.query(`DELETE FROM group_admins WHERE group_id = $1 AND organizer_id = $2`, [g.id, g.heir]);
        handedOver++;
      } else {
        await db.query(`DELETE FROM groups WHERE id = $1`, [g.id]);
        deleted++;
      }
    }
    await db.query(`DELETE FROM organizers WHERE id = $1`, [organizer.id]);
    return { deletedGroups: deleted, handedOverGroups: handedOver };
  });

  app.get("/me/dashboard", async (req) => {
    const organizer = await requireOrganizer(db, req);
    const dashboard = await organizerDashboard(db, organizer.id);
    // After a few real games: a one-time check-in, then (once that's answered) whether they'd keep it for $49/year.
    const [row] = await db.query<{ games: number; checkedIn: boolean; priced: boolean }>(
      `SELECT (SELECT count(*)::int FROM sessions s JOIN groups g ON g.id = s.group_id
               WHERE ${managedBy("g", "$1")} AND NOT s.cancelled AND s.starts_at < now()
                 AND (SELECT count(*) FROM rsvps r WHERE r.session_id = s.id AND r.status = 'in') >= 2) AS games,
              EXISTS (SELECT 1 FROM feedback f WHERE f.organizer_id = $1 AND f.source = 'checkin') AS "checkedIn",
              o.pricing_answer IS NOT NULL AS priced
       FROM organizers o WHERE o.id = $1`,
      [organizer.id],
    );
    const games = row?.games ?? 0;
    return {
      ...dashboard,
      organizer: {
        ...dashboard.organizer,
        isAdmin: isAdminEmail(dashboard.organizer.email),
        askFeedback: games >= FEEDBACK_ASK_AFTER_GAMES && !row?.checkedIn,
        askPricing: games >= PRICING_ASK_AFTER_GAMES && !!row?.checkedIn && !row?.priced,
      },
    };
  });

  // Organizer feedback. Anything that isn't "great" (or has words) is emailed to the admins.
  // Report a group or a person in it. Anyone with the link can report; it goes to our inbox to review within 24 hours.
  app.post<SlugParams>("/groups/:slug/report", strict(5), async (req) => {
    const group = await groupOr404(req.params.slug);
    const { reason, memberId, email: from } = reportSchema.parse(req.body ?? {});
    const [who] = memberId ? await db.query<{ name: string }>(`SELECT name FROM members WHERE id = $1 AND group_id = $2`, [memberId, group.id]) : [];
    const organizer = await currentOrganizer(db, req).catch(() => null);
    const message = `Report on group "${group.name}" (${webUrl()}/g/${group.slug})${who ? ` about player "${who.name}"` : ""}: ${reason}`;
    await db.query(`INSERT INTO feedback (organizer_id, source, message, email) VALUES ($1, 'report', $2, $3)`, [organizer?.id ?? null, message, from ?? null]);
    const to = process.env.SUPPORT_EMAIL ?? "contact@dataeaver.ca";
    const title = `Report: ${group.name}`;
    await sendEmail(to, title, emailHtml({ title, body: message, url: `${webUrl()}/g/${group.slug}` }, undefined, "Open the group"), message, undefined, from ? { replyTo: from } : {})
      .catch((err) => console.warn("report email failed", (err as Error).message));
    return { ok: true };
  });

  // The support page's contact form. Anyone can write; it lands in our inbox with Reply going to them.
  app.post("/support/contact", strict(3), async (req) => {
    const { name, email: from, message, website } = contactSchema.parse(req.body ?? {});
    if (website) return { ok: true }; // a bot filled the hidden field
    const organizer = await currentOrganizer(db, req).catch(() => null);
    await db.query(`INSERT INTO feedback (organizer_id, source, message, email, name) VALUES ($1, 'support', $2, $3, $4)`, [organizer?.id ?? null, message, from, name || null]);
    const to = process.env.SUPPORT_EMAIL ?? "contact@dataeaver.ca";
    const title = `Support: ${name || from}`;
    const body = `${message}\n\nFrom ${name ? `${name} <${from}>` : from}${organizer ? " (signed in)" : ""}`;
    try {
      await sendEmail(to, title, emailHtml({ title, body, url: `mailto:${from}` }, undefined, "Reply"), body, undefined, { replyTo: from });
    } catch (err) {
      console.warn("support email failed", (err as Error).message);
      throw new HttpError(502, "Couldn't send that just now. Please email contact@dataeaver.ca instead.");
    }
    return { ok: true };
  });

  app.post("/me/feedback", strict(10), async (req) => {
    const organizer = await requireOrganizer(db, req);
    const { source, rating, message } = feedbackSchema.parse(req.body);
    await db.query(`INSERT INTO feedback (organizer_id, source, rating, message) VALUES ($1, $2, $3, $4)`, [organizer.id, source, rating ?? null, message || null]);
    await track(db, "feedback_given", { organizerId: organizer.id, props: { source, rating: rating ?? "", hasMessage: !!message } });
    const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    if (admins.length && (message || rating !== "great")) {
      const [who] = await db.query<{ name: string | null; email: string | null }>(`SELECT name, email FROM organizers WHERE id = $1`, [organizer.id]);
      const from = who?.name || who?.email || "An organizer";
      const face = rating === "great" ? "😀" : rating === "okay" ? "😐" : rating === "missing" ? "😕" : "💡";
      const title = `${face} Feedback from ${from}`;
      const body = `${source === "checkin" ? `Check-in: ${rating}.` : "Suggestion."}${message ? ` “${message}”` : ""}${who?.email ? ` Reply to ${who.email}.` : ""}`;
      for (const to of admins) await sendEmail(to, title, emailHtml({ title, body, url: `${webUrl()}/admin` }, undefined, "Open metrics"), body).catch(() => {});
    }
    return { ok: true };
  });

  // Pricing test. "I'd pay for this" on the landing page and the dashboard question both land here. Nothing is charged.
  app.post("/me/pricing", strict(10), async (req) => {
    const organizer = await requireOrganizer(db, req);
    const body = (req.body ?? {}) as { answer?: string; reason?: string; source?: string };
    const answer = ["yes", "maybe", "no"].find((a) => a === body.answer);
    if (!answer) throw new HttpError(400, "Pick yes, maybe or no");
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) || null : null;
    const source = body.source === "landing" ? "landing" : "dashboard";
    const [row] = await db.query<{ name: string | null; email: string | null }>(
      `UPDATE organizers SET pricing_answer = $2, pricing_reason = COALESCE($3, pricing_reason), pricing_answered_at = now() WHERE id = $1 RETURNING name, email`,
      [organizer.id, answer, reason],
    );
    await track(db, "pricing_answer", { organizerId: organizer.id, props: { answer, source, hasReason: !!reason } });
    const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
    if (answer === "yes" && admins.length) {
      const who = row?.name || row?.email || "An organizer";
      const title = `${who} would pay for Turnout`;
      const body = `${who}${row?.email ? ` (${row.email})` : ""} said yes to $49/year from the ${source}.${reason ? ` They said: “${reason}”` : ""}`;
      for (const to of admins) await sendEmail(to, title, emailHtml({ title, body, url: `${webUrl()}/admin` }, undefined, "Open metrics"), `${body}`).catch(() => {});
    }
    return { answer };
  });

  // Product metrics across all groups, for the people running Turnout (ADMIN_EMAILS).
  app.get<{ Querystring: { days?: string } }>("/admin/metrics", async (req) => {
    const organizer = await requireOrganizer(db, req);
    const [row] = await db.query<{ email: string | null }>(`SELECT email FROM organizers WHERE id = $1`, [organizer.id]);
    if (!isAdminEmail(row?.email)) throw new HttpError(404, "Not found");
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 90));
    const pricing = await db.query<{ name: string | null; email: string | null; answer: string; reason: string | null; at: Date | string }>(
      `SELECT name, email, pricing_answer AS answer, pricing_reason AS reason, pricing_answered_at AS at FROM organizers
       WHERE pricing_answer IS NOT NULL ORDER BY pricing_answered_at DESC LIMIT 100`,
    );
    const feedback = await db.query<{ name: string | null; email: string | null; source: string; rating: string | null; message: string | null; at: Date | string }>(
      `SELECT o.name, o.email, f.source, f.rating, f.message, f.created_at AS at FROM feedback f LEFT JOIN organizers o ON o.id = f.organizer_id
       ORDER BY f.created_at DESC LIMIT 100`,
    );
    return {
      ...(await productMetrics(db, days)),
      pricing: pricing.map((p) => ({ ...p, at: new Date(p.at).toISOString() })),
      feedback: feedback.map((f) => ({ ...f, at: new Date(f.at).toISOString() })),
    };
  });

  app.patch<SlugParams>("/groups/:slug", async (req) => {
    const { organizer, group } = await ownedGroup(req, req.params.slug);
    const input = updateGroupSchema.parse(req.body);
    if (input.timezone && !isValidTimezone(input.timezone)) throw new HttpError(400, "Unknown timezone");
    // This week as it stands, so answers can follow a schedule change and waitlisted players who move up hear about it.
    const beforeSession = await currentSession(db, group);
    const before = buildRoster(await sessionRsvps(db, beforeSession.id), group.cap);
    const columns: Record<string, unknown> = {
      name: input.name, activity: input.activity, location: input.location,
      weekdays: input.weekdays, weekday: input.weekdays?.[0], interval_weeks: input.intervalWeeks,
      starts_on: input.startsOn, ends_on: input.endsOn,
      start_time: input.startTime, duration_minutes: input.durationMinutes, timezone: input.timezone, cap: input.cap,
      reminders: input.reminders && JSON.stringify(input.reminders),
      fee_cents: input.feeCents, fee_split: input.feeSplit, pay_note: input.payNote === "" ? null : input.payNote,
      season_fee_cents: input.seasonFeeCents, target_players: input.targetPlayers,
    };
    const entries = Object.entries(columns).filter(([, v]) => v !== undefined);
    await db.query(
      `UPDATE groups SET ${entries.map(([k], i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`,
      [group.id, ...entries.map(([, v]) => v)],
    );
    const updated = (await findGroupBySlug(db, group.slug))!;
    // New day or time for a game that hasn't started: this week's answers move with it.
    const scheduleChanged = ["weekdays", "startTime", "intervalWeeks", "startsOn", "timezone"].some((k) => k in input);
    const answered = before.confirmed.length + before.waitlist.length + before.out.length > 0;
    if (scheduleChanged && answered && new Date(beforeSession.startsAt).getTime() > Date.now()) {
      const next = currentSessionStart(updated).toISOString();
      if (next !== beforeSession.scheduledAt) {
        const [taken] = await db.query<{ id: string; answers: number }>(
          `SELECT s.id, (SELECT count(*)::int FROM rsvps r WHERE r.session_id = s.id) AS answers FROM sessions s WHERE group_id = $1 AND starts_at = $2`,
          [group.id, next],
        );
        if (taken && taken.answers === 0) await db.query(`DELETE FROM sessions WHERE id = $1`, [taken.id]);
        if (!taken || taken.answers === 0) {
          await db.query(`UPDATE sessions SET starts_at = $2, starts_at_override = NULL WHERE id = $1`, [beforeSession.id, next]);
        }
      }
    }
    // A new cap can move people on or off the waitlist; anyone who moves up is told.
    return changed(updated, before, organizer.id);
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
    const [existing] = await db.query<{ id: string; name: string; hasEmail: boolean; claimable: boolean }>(
      `SELECT id, name, email_confirmed_at IS NOT NULL AS "hasEmail",
              NOT EXISTS (SELECT 1 FROM member_tokens t WHERE t.member_id = members.id) AS claimable FROM members
       WHERE group_id = $1 AND lower(trim(name)) = lower($2) ORDER BY created_at LIMIT 1`,
      [group.id, name],
    );
    if (existing && !confirmNew) return reply.status(409).send({ error: "name_taken", existing });
    const [member] = await db.query<{ id: string; name: string }>(
      `INSERT INTO members (group_id, name) VALUES ($1, $2) RETURNING id, name`,
      [group.id, name],
    );
    const token = await issueDeviceToken(member!.id);
    await track(db, "player_joined", { groupId: group.id, memberId: member!.id });
    return reply.status(201).send({ member, token });
  });

  /**
   * Turn on email reminders and send the welcome email: who we are, what to expect, and a one-tap stop
   * (CASL: identify the sender, include an unsubscribe). `addedBy` when the organizer entered the address.
   */
  const startEmailReminders = async (group: GroupRow, memberId: string, email: string, addedBy?: string) => {
    const token = newMemberToken();
    await db.query(`UPDATE members SET email = $2, email_confirmed_at = now(), email_token = $3 WHERE id = $1`, [memberId, email, token]);
    const stopUrl = `${webUrl()}/email?unsubscribe=${token}`;
    const title = addedBy ? `${addedBy} added you to ${group.name}` : `You'll get reminders for ${group.name}`;
    const body = addedBy
      ? `${group.name} uses Turnout to see who's in each week. We'll email you before each game so you can tap in or out, no app or account needed. Not you, or rather not? Tap “Stop these emails” below.`
      : `We'll email you before each game, and that's all. Not you, or changed your mind? Tap “Stop these emails” below.`;
    await sendEmail(email, addedBy ? title : `You're set for ${group.name} reminders`, emailHtml({ title, body, url: `${webUrl()}/g/${group.slug}` }, stopUrl, `Open ${group.name}`), `${title}. ${body} Stop these emails: ${stopUrl}`, stopUrl)
      .catch((err) => app.log.warn({ err }, "welcome email failed"));
  };

  const issueDeviceToken = async (memberId: string) => {
    const token = newMemberToken();
    await db.query(`INSERT INTO member_tokens (token_hash, member_id) VALUES ($1, $2)`, [hashToken(token), memberId]);
    return token;
  };

  // Organizer adds players up front (a season roster). Names already in the group are skipped.
  app.post<SlugParams>("/groups/:slug/members/add", strict(20), async (req) => {
    const { organizer, group } = await ownedGroup(req, req.params.slug);
    const { players } = addPlayersSchema.parse(req.body);
    const [who] = await db.query<{ name: string | null; email: string | null }>(`SELECT name, email FROM organizers WHERE id = $1`, [organizer.id]);
    const addedBy = who?.name || "Your organizer";
    const added: string[] = [];
    const skipped: string[] = [];
    for (const p of players) {
      const [dupe] = await db.query(`SELECT 1 FROM members WHERE group_id = $1 AND lower(trim(name)) = lower($2)`, [group.id, p.name]);
      if (dupe) {
        skipped.push(p.name);
        continue;
      }
      const [m] = await db.query<{ id: string }>(`INSERT INTO members (group_id, name, season_member) VALUES ($1, $2, $3) RETURNING id`, [group.id, p.name, !!group.seasonFeeCents]);
      await track(db, "player_joined", { groupId: group.id, memberId: m!.id, organizerId: organizer.id, props: { addedByOrganizer: true, email: !!p.email } });
      if (p.email) await startEmailReminders(group, m!.id, p.email, addedBy);
      added.push(p.name);
    }
    await events.rosterChanged(group.slug);
    return { added, skipped };
  });

  // A player the organizer added opens the link on their phone: tap your name to claim it.
  // Only while nobody has claimed it yet; after that, a new phone uses the email restore link.
  app.post<{ Params: { slug: string; memberId: string } }>("/groups/:slug/members/:memberId/claim", strict(10), async (req) => {
    const group = await groupOr404(req.params.slug);
    const [m] = await db.query<{ id: string; name: string }>(
      `SELECT id, name FROM members m WHERE id = $1 AND group_id = $2 AND NOT EXISTS (SELECT 1 FROM member_tokens t WHERE t.member_id = m.id)`,
      [req.params.memberId, group.id],
    );
    if (!m) throw new HttpError(409, "That name is already set up on another phone. Use “That's me” to get a link by email.");
    return { member: m, token: await issueDeviceToken(m.id) };
  });

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
              (SELECT count(*)::int FROM rsvps r WHERE r.member_id = m.id AND r.status = 'in') AS "gamesIn",
              m.season_member AS "seasonMember", m.season_paid_at IS NOT NULL AS "seasonPaid"
       FROM members m WHERE m.group_id = $1 ORDER BY lower(m.name), m.created_at`,
      [group.id],
    );
    return { members: members.map((m) => ({ ...m, joinedAt: new Date(m.joinedAt).toISOString() })), season: !!group.seasonFeeCents };
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
    await db.query(`UPDATE members SET account_id = (SELECT account_id FROM members WHERE id = $1) WHERE id = $2 AND account_id IS NULL`, [from, intoId]);
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
    if (new Date(session.startsAt).getTime() + group.durationMinutes * 60_000 < Date.now()) throw new HttpError(409, "This season has ended");

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
    const refs = { groupId: group.id, sessionId: session.id, memberId: member.id };
    const [nudged] = await db.query<{ reminded: boolean; alerted: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM events WHERE session_id = $1 AND member_id = $2 AND kind = 'reminder_sent') AS reminded,
              EXISTS (SELECT 1 FROM notifications_sent WHERE session_id = $1 AND member_id = $2 AND kind = 'spotOpened') AS alerted`,
      [session.id, member.id],
    );
    await track(db, status === "in" ? "rsvp_in" : "rsvp_out", { ...refs, props: { hoursToGo: Math.round(hoursToGo * 10) / 10, afterReminder: nudged!.reminded } });
    if (status === "in" && page.roster.waitlist.some((r) => r.memberId === member.id) && !before.waitlist.some((r) => r.memberId === member.id)) await track(db, "waitlisted", refs);
    if (status === "in" && nudged!.alerted && page.roster.confirmed.some((r) => r.memberId === member.id)) await track(db, "spot_alert_claimed", refs);
    if (wasConfirmed && status === "out") await track(db, lateDrop ? "late_dropout" : "player_dropped", { ...refs, props: { hoursToGo: Math.round(hoursToGo * 10) / 10 } });
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
    if (paid) await track(db, "payment_marked", { groupId: group.id, sessionId: session.id, memberId: req.params.memberId, organizerId: organizer.id });
    return groupPage(db, group, organizer.id);
  });

  app.put<{ Params: { slug: string; memberId: string } }>("/groups/:slug/members/:memberId/skill", async (req) => {
    const { organizer, group } = await ownedGroup(req, req.params.slug);
    await ownedMember(group, req.params.memberId);
    const { skill } = skillSchema.parse(req.body);
    await db.query(`UPDATE members SET skill = $2 WHERE id = $1`, [req.params.memberId, skill]);
    return groupPage(db, group, organizer.id);
  });

  // Season groups: who's a season member, and who has paid the season fee.
  app.put<{ Params: { slug: string; memberId: string } }>("/groups/:slug/members/:memberId/season", async (req) => {
    const { organizer, group } = await ownedGroup(req, req.params.slug);
    await ownedMember(group, req.params.memberId);
    const { member, paid } = seasonMemberSchema.parse(req.body);
    if (member !== undefined) await db.query(`UPDATE members SET season_member = $2, season_paid_at = CASE WHEN $2 THEN season_paid_at END WHERE id = $1`, [req.params.memberId, member]);
    if (paid !== undefined) {
      await db.query(`UPDATE members SET season_member = season_member OR $2, season_paid_at = ${paid ? "COALESCE(season_paid_at, now())" : "NULL"} WHERE id = $1`, [req.params.memberId, paid]);
      if (paid) await track(db, "payment_marked", { groupId: group.id, memberId: req.params.memberId, organizerId: organizer.id, props: { season: true } });
    }
    return groupPage(db, group, organizer.id);
  });

  // Season groups: a new season keeps the members, clears payments, and can set a new fee and dates.
  app.post<SlugParams>("/groups/:slug/season/new", async (req) => {
    const { organizer, group } = await ownedGroup(req, req.params.slug);
    const input = newSeasonSchema.parse(req.body ?? {});
    await db.query(`UPDATE members SET season_paid_at = NULL WHERE group_id = $1`, [group.id]);
    const set = Object.entries({ season_fee_cents: input.seasonFeeCents, starts_on: input.startsOn, ends_on: input.endsOn }).filter(([, v]) => v !== undefined);
    if (set.length) await db.query(`UPDATE groups SET ${set.map(([k], i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`, [group.id, ...set.map(([, v]) => v)]);
    await track(db, "season_started", { groupId: group.id, organizerId: organizer.id, props: { fee: input.seasonFeeCents ?? group.seasonFeeCents } });
    return changed((await findGroupBySlug(db, group.slug))!, undefined, organizer.id);
  });

  // Nudge season members who haven't paid: notify those with reminders on, and give text for the group chat.
  app.post<SlugParams>("/groups/:slug/season/remind", strict(10), async (req) => {
    const { group } = await ownedGroup(req, req.params.slug);
    const season = await seasonOf(db, group);
    if (!season?.shareCents) throw new HttpError(409, "This group doesn't have a season fee");
    const unpaid = await db.query<{ id: string; name: string }>(`SELECT id, name FROM members WHERE group_id = $1 AND season_member AND season_paid_at IS NULL`, [group.id]);
    const amount = formatMoney(season.shareCents);
    const how = group.payNote ? ` ${group.payNote}.` : ""; // for the push/email body
    let notified = 0;
    for (const m of unpaid) {
      notified += (await notifyMember(db, m.id, { title: `Season fee for ${group.name}: ${amount}`, body: `Your share of the season is ${amount}.${how} Thanks!`, url: `${webUrl()}/g/${group.slug}?from=season` }).catch(() => 0)) > 0 ? 1 : 0;
    }
    const message = [`💵 ${group.name} season fee: ${amount} each`, group.payNote, `Still to pay: ${unpaid.map((m) => m.name).join(", ") || "nobody 🎉"}`].filter(Boolean).join("\n");
    return { unpaid: unpaid.length, notified, message };
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
    if (teams) await track(db, "teams_created", { groupId: group.id, sessionId: session.id, organizerId: organizer.id, props: { teams: teams.length, players: teams.flat().length } });
    return changed(group, undefined, organizer.id);
  });

  app.post<SlugParams>("/groups/:slug/remind", strict(10), async (req) => {
    const { group } = await ownedGroup(req, req.params.slug);
    return remindNow(db, group);
  });

  app.get<SlugParams>("/groups/:slug/history", async (req) => {
    const { group } = await ownedGroup(req, req.params.slug);
    return { games: await gameHistory(db, group) };
  });

  app.get<SlugParams>("/groups/:slug/insights", async (req) => {
    const { group } = await ownedGroup(req, req.params.slug);
    const session = await currentSession(db, group);
    const roster = buildRoster(await sessionRsvps(db, session.id), group.cap);
    return groupInsightsFor(db, group, { roster, cancelled: session.cancelled });
  });

  // Events only the browser sees (a share tapped, a reminder link opened). Anyone can send them; they're counted, never trusted for anything else.
  app.post("/events", strict(60), async (req, reply) => {
    const body = (req.body ?? {}) as { kind?: string; slug?: string; props?: Record<string, unknown> };
    const kind = CLIENT_EVENTS.find((k) => k === body.kind);
    if (!kind) throw new HttpError(400, "Unknown event");
    const group = typeof body.slug === "string" ? await findGroupBySlug(db, body.slug) : undefined;
    const token = req.headers["x-member-token"];
    const [member] = group && typeof token === "string"
      ? await db.query<{ id: string }>(`SELECT m.id FROM member_tokens t JOIN members m ON m.id = t.member_id WHERE t.token_hash = $1 AND m.group_id = $2`, [hashToken(token), group.id])
      : [];
    const organizer = await currentOrganizer(db, req).catch(() => null);
    const props = Object.fromEntries(Object.entries(body.props ?? {}).filter(([, v]) => ["string", "number", "boolean"].includes(typeof v)).slice(0, 8).map(([k, v]) => [k.slice(0, 40), typeof v === "string" ? v.slice(0, 80) : v]));
    const session = group ? await currentSession(db, group) : undefined;
    await track(db, kind, { groupId: group?.id, sessionId: session?.id, memberId: member?.id, organizerId: organizer?.id, props });
    return reply.status(204).send();
  });

  // ── Organizer: co-organizers ──────────────────────────────
  const organizersOf = async (group: GroupRow, viewerId: string): Promise<GroupOrganizer[]> => {
    const rows = await db.query<{ id: string; name: string | null; email: string | null; role: GroupRole }>(
      `SELECT o.id, o.name, o.email, 'owner' AS role FROM organizers o WHERE o.id = $2
       UNION ALL
       SELECT o.id, o.name, o.email, 'admin' AS role FROM group_admins a JOIN organizers o ON o.id = a.organizer_id WHERE a.group_id = $1`,
      [group.id, group.organizerId],
    );
    const rank = (r: { role: GroupRole }) => (r.role === "owner" ? 0 : 1);
    return rows
      .map((r) => ({ id: r.id, name: r.name || r.email || "Organizer", role: r.role, isYou: r.id === viewerId }))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  };

  app.get<SlugParams>("/groups/:slug/organizers", async (req) => {
    const { organizer, group, role } = await ownedGroup(req, req.params.slug);
    return { role, organizers: await organizersOf(group, organizer.id) };
  });

  // A one-time link, valid for a week; whoever opens it signed in becomes an admin.
  app.post<SlugParams>("/groups/:slug/organizers/invite", strict(20), async (req) => {
    const { group } = await ownerOnly(req, req.params.slug);
    const token = newMemberToken();
    await db.query(`INSERT INTO admin_invites (token_hash, group_id, expires_at) VALUES ($1, $2, now() + interval '7 days')`, [hashToken(token), group.id]);
    return { url: `${webUrl()}/organize?t=${token}` };
  });

  // What the invite is for, so the page can say "Help run Tuesday Soccer" before sign-in.
  app.get<{ Params: { token: string } }>("/organizer-invites/:token", strict(30), async (req) => {
    const [invite] = await db.query<{ name: string }>(
      `SELECT g.name FROM admin_invites i JOIN groups g ON g.id = i.group_id WHERE i.token_hash = $1 AND i.expires_at > now()`,
      [hashToken(req.params.token)],
    );
    if (!invite) throw new HttpError(404, "This invite has expired or was already used. Ask for a new one.");
    return { groupName: invite.name };
  });

  app.post("/organizer-invites/accept", strict(20), async (req) => {
    const organizer = await requireOrganizer(db, req);
    const { token } = acceptAdminInviteSchema.parse(req.body);
    const [invite] = await db.query<{ groupId: string; slug: string; ownerId: string }>(
      `DELETE FROM admin_invites i USING groups g WHERE i.token_hash = $1 AND i.expires_at > now() AND g.id = i.group_id
       RETURNING g.id AS "groupId", g.slug, g.organizer_id AS "ownerId"`,
      [hashToken(token)],
    );
    if (!invite) throw new HttpError(404, "This invite has expired or was already used. Ask for a new one.");
    if (invite.ownerId !== organizer.id) {
      await db.query(`INSERT INTO group_admins (group_id, organizer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [invite.groupId, organizer.id]);
    }
    return { slug: invite.slug };
  });

  // The owner removes an admin, or an admin leaves.
  app.delete<{ Params: { slug: string; organizerId: string } }>("/groups/:slug/organizers/:organizerId", async (req) => {
    const { organizer, group, role } = await ownedGroup(req, req.params.slug);
    const target = req.params.organizerId;
    if (target === group.organizerId) throw new HttpError(400, "Hand the group to someone else before leaving it");
    if (role !== "owner" && target !== organizer.id) throw new HttpError(403, "Only the group's owner can remove organizers");
    await db.query(`DELETE FROM group_admins WHERE group_id = $1 AND organizer_id = $2`, [group.id, target]);
    return { organizers: target === organizer.id ? [] : await organizersOf(group, organizer.id) };
  });

  // Hand the group to an admin; the old owner stays on as an admin.
  app.put<SlugParams>("/groups/:slug/owner", async (req) => {
    const { organizer, group } = await ownerOnly(req, req.params.slug);
    const { organizerId } = transferOwnerSchema.parse(req.body);
    const [admin] = await db.query(`DELETE FROM group_admins WHERE group_id = $1 AND organizer_id = $2 RETURNING 1`, [group.id, organizerId]);
    if (!admin) throw new HttpError(400, "Add them as an organizer first");
    await db.query(`UPDATE groups SET organizer_id = $2 WHERE id = $1`, [group.id, organizerId]);
    await db.query(`INSERT INTO group_admins (group_id, organizer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [group.id, organizer.id]);
    return { role: "admin", organizers: await organizersOf({ ...group, organizerId }, organizer.id) };
  });

  // ── Members: reminder channels ────────────────────────────
  app.get("/push/key", async () => ({ publicKey: pushPublicKey(), email: emailEnabled() }));

  const memberSelf = async (memberId: string): Promise<MemberSelf> => {
    const [row] = await db.query<{ id: string; name: string; email: string | null; confirmed: boolean; push: number; season: boolean; seasonMember: boolean; seasonPaid: boolean }>(
      `SELECT m.id, m.name, m.email, m.email_confirmed_at IS NOT NULL AS confirmed,
              (SELECT count(*)::int FROM push_subscriptions p WHERE p.member_id = m.id) AS push,
              g.season_fee_cents IS NOT NULL AS season, m.season_member AS "seasonMember", m.season_paid_at IS NOT NULL AS "seasonPaid"
       FROM members m JOIN groups g ON g.id = m.group_id WHERE m.id = $1`,
      [memberId],
    );
    return {
      member: { id: row!.id, name: row!.name },
      channels: { push: row!.push, email: row!.email, emailConfirmed: row!.confirmed },
      season: row!.season ? { member: row!.seasonMember, paid: row!.seasonPaid } : null,
    };
  };

  app.get<SlugParams>("/groups/:slug/me", async (req) => {
    const group = await groupOr404(req.params.slug);
    return memberSelf((await requireMember(db, req, group.id)).id);
  });

  // A player's own stats in this group. Only ever with their own member token: nobody else sees them here.
  app.get<SlugParams>("/groups/:slug/me/stats", async (req) => {
    const group = await groupOr404(req.params.slug);
    return memberStats(db, group, (await requireMember(db, req, group.id)).id);
  });

  // ── Optional player accounts ──────────────────────────────
  // Signed in, the app sends the player entries this device holds. They're linked to the account (never taken from
  // another account), along with entries whose confirmed reminder email matches it. Back come all linked entries,
  // with a fresh device token for any this device didn't have, so the same games show up on every device.
  app.post("/me/memberships", strict(30), async (req) => {
    const account = await requireOrganizer(db, req);
    const { links } = membershipLinksSchema.parse(req.body ?? {});
    const held = new Set<string>();
    for (const { slug, token } of links) {
      const [m] = await db.query<{ id: string }>(
        `SELECT m.id FROM member_tokens t JOIN members m ON m.id = t.member_id JOIN groups g ON g.id = m.group_id WHERE t.token_hash = $1 AND g.slug = $2`,
        [hashToken(token), slug],
      );
      if (!m) continue;
      held.add(m.id);
      await db.query(`UPDATE members SET account_id = $2 WHERE id = $1 AND account_id IS NULL`, [m.id, account.id]);
    }
    await db.query(
      `UPDATE members m SET account_id = o.id FROM organizers o
       WHERE o.id = $1 AND o.email IS NOT NULL AND m.account_id IS NULL AND m.email_confirmed_at IS NOT NULL AND lower(m.email) = lower(o.email)`,
      [account.id],
    );
    const linked = await db.query<{ id: string; name: string; slug: string }>(
      `SELECT m.id, m.name, g.slug FROM members m JOIN groups g ON g.id = m.group_id WHERE m.account_id = $1 ORDER BY m.created_at`,
      [account.id],
    );
    const memberships: LinkedMembership[] = [];
    for (const m of linked) {
      let token: string | null = null;
      if (!held.has(m.id)) {
        token = newMemberToken();
        await db.query(`INSERT INTO member_tokens (token_hash, member_id) VALUES ($1, $2)`, [hashToken(token), m.id]);
      }
      memberships.push({ slug: m.slug, memberId: m.id, name: m.name, token });
    }
    return { memberships };
  });

  // "That's not me": unlink one player entry from the account. The entry and its history stay in the group.
  app.delete<{ Params: { memberId: string } }>("/me/memberships/:memberId", async (req) => {
    const account = await requireOrganizer(db, req);
    await db.query(`UPDATE members SET account_id = NULL WHERE id = $1 AND account_id = $2`, [req.params.memberId, account.id]);
    return { ok: true };
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

  // The Turnout app on a player's phone: reminders arrive as app notifications.
  app.put<SlugParams>("/groups/:slug/me/app-push", strict(20), async (req) => {
    const group = await groupOr404(req.params.slug);
    const member = await requireMember(db, req, group.id);
    const { token } = appPushSchema.parse(req.body);
    await db.query(
      `INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth) VALUES ($1, $2, '', '') ON CONFLICT (member_id, endpoint) DO NOTHING`,
      [member.id, APP_PUSH_PREFIX + token],
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
    await startEmailReminders(group, member.id, email);
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
