import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import {
  buildRoster,
  cancelSessionSchema,
  createGroupSchema,
  joinGroupSchema,
  parseGroupSchema,
  promotedMembers,
  rsvpSchema,
  updateGroupSchema,
  type Group,
} from "@turnout/shared";
import { draftGroupFromSentence } from "./ai/parse-group.ts";
import { currentOrganizer, HttpError, requireMember, requireOrganizer } from "./auth.ts";
import type { Db } from "./db/client.ts";
import { events, liveUrl } from "./events.ts";
import { currentSession, findGroupBySlug, groupPage, listOrganizerGroups, organizerDashboard, sessionRsvps, type GroupRow } from "./groups.ts";
import { hashToken, newMemberToken, randomSlug } from "./ids.ts";
import { isValidTimezone } from "./schedule.ts";

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
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  const strict = (max: number) => ({ config: { rateLimit: { max, timeWindow: "1 minute" } } });

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
      if (promoted.length) events.promoted(group.slug, promoted);
    }
    return page;
  };

  app.get("/health", async () => ({ ok: true }));

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
      `INSERT INTO groups (slug, organizer_id, name, activity, location, weekday, start_time, duration_minutes, timezone, cap)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, slug, name, activity, location, weekday, start_time AS "startTime",
                 duration_minutes AS "durationMinutes", timezone, cap`,
      [randomSlug(), organizer.id, input.name, input.activity ?? null, input.location ?? null, input.weekday,
       input.startTime, input.durationMinutes, input.timezone, input.cap],
    );
    return reply.status(201).send({ group });
  });

  app.get("/me/groups", async (req) => {
    const organizer = await requireOrganizer(db, req);
    return { groups: await listOrganizerGroups(db, organizer.id) };
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
      name: input.name, activity: input.activity, location: input.location, weekday: input.weekday,
      start_time: input.startTime, duration_minutes: input.durationMinutes, timezone: input.timezone, cap: input.cap,
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

  app.get<SlugParams>("/groups/:slug/live", strict(30), async (req) => {
    const group = await groupOr404(req.params.slug);
    return { url: await liveUrl(group.slug) };
  });

  app.post<SlugParams>("/groups/:slug/members", strict(10), async (req, reply) => {
    const group = await groupOr404(req.params.slug);
    const { name } = joinGroupSchema.parse(req.body);
    const token = newMemberToken();
    const [member] = await db.query<{ id: string; name: string }>(
      `INSERT INTO members (group_id, name, token_hash) VALUES ($1, $2, $3) RETURNING id, name`,
      [group.id, name, hashToken(token)],
    );
    return reply.status(201).send({ member, token });
  });

  app.put<SlugParams>("/groups/:slug/rsvp", strict(30), async (req) => {
    const group = await groupOr404(req.params.slug);
    const member = await requireMember(db, req, group.id);
    const { status } = rsvpSchema.parse(req.body);
    const session = await currentSession(db, group);
    if (session.cancelled) throw new HttpError(409, "This week's session is cancelled");

    const before = buildRoster(await sessionRsvps(db, session.id), group.cap);
    // Saying "in" again keeps your place. Any change moves your timestamp, so rejoining puts you at the back.
    await db.query(
      `INSERT INTO rsvps (session_id, member_id, status) VALUES ($1, $2, $3)
       ON CONFLICT (session_id, member_id) DO UPDATE SET
         status = EXCLUDED.status,
         responded_at = CASE WHEN rsvps.status = EXCLUDED.status THEN rsvps.responded_at ELSE now() END`,
      [session.id, member.id, status],
    );
    return changed(group, before);
  });

  return app;
}
