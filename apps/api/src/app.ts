import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import {
  buildRoster,
  createGroupSchema,
  joinGroupSchema,
  parseGroupSchema,
  promotedMembers,
  rsvpSchema,
  type Group,
} from "@turnout/shared";
import { draftGroupFromSentence } from "./ai/parse-group.ts";
import { HttpError, requireMember, requireOrganizer } from "./auth.ts";
import type { Db } from "./db/client.ts";
import { events } from "./events.ts";
import { currentSession, findGroupBySlug, groupPage, listOrganizerGroups, sessionRsvps } from "./groups.ts";
import { hashToken, newMemberToken, randomSlug } from "./ids.ts";
import { isValidTimezone } from "./schedule.ts";

export async function buildApp(db: Db) {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ error: "Invalid input", issues: err.issues });
    if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: err.message });
    app.log.error(err);
    return reply.status(500).send({ error: "Something went wrong" });
  });

  const groupOr404 = async (slug: string): Promise<Group> => {
    const group = await findGroupBySlug(db, slug);
    if (!group) throw new HttpError(404, "Group not found");
    return group;
  };

  app.get("/health", async () => ({ ok: true }));

  // ── Organizer ──────────────────────────────────────────────
  app.post("/ai/group-draft", async (req) => {
    await requireOrganizer(db, req);
    const { sentence } = parseGroupSchema.parse(req.body);
    return draftGroupFromSentence(sentence);
  });

  app.post("/groups", async (req, reply) => {
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

  // ── Members (no account) ───────────────────────────────────
  app.get<{ Params: { slug: string } }>("/groups/:slug", async (req) => groupPage(db, await groupOr404(req.params.slug)));

  app.post<{ Params: { slug: string } }>("/groups/:slug/members", async (req, reply) => {
    const group = await groupOr404(req.params.slug);
    const { name } = joinGroupSchema.parse(req.body);
    const token = newMemberToken();
    const [member] = await db.query<{ id: string; name: string }>(
      `INSERT INTO members (group_id, name, token_hash) VALUES ($1, $2, $3) RETURNING id, name`,
      [group.id, name, hashToken(token)],
    );
    return reply.status(201).send({ member, token });
  });

  app.put<{ Params: { slug: string } }>("/groups/:slug/rsvp", async (req) => {
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
    const page = await groupPage(db, group);
    events.rosterChanged(group.slug);
    const promoted = promotedMembers(before, page.roster);
    if (promoted.length) events.promoted(group.slug, promoted);
    return page;
  });

  return app;
}
