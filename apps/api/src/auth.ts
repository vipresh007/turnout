import type { FastifyRequest } from "fastify";
import type { Db } from "./db/client.ts";
import { hashToken } from "./ids.ts";

export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Finds the signed-in organizer, creating their record on first sight.
 * TODO: verify Microsoft Entra External ID access tokens (JWKS). Until then only the dev header is
 * accepted, and only when ALLOW_DEV_AUTH=true.
 */
export async function requireOrganizer(db: Db, req: FastifyRequest): Promise<{ id: string }> {
  const devUser = process.env.ALLOW_DEV_AUTH === "true" ? req.headers["x-dev-user"] : undefined;
  if (typeof devUser !== "string" || !devUser) throw new HttpError(401, "Sign in required");
  const [row] = await db.query<{ id: string }>(
    `INSERT INTO organizers (external_id) VALUES ($1)
     ON CONFLICT (external_id) DO UPDATE SET external_id = EXCLUDED.external_id
     RETURNING id`,
    [`dev:${devUser}`],
  );
  return row!;
}

/** Members have no account. They send the token they received when they joined. */
export async function requireMember(db: Db, req: FastifyRequest, groupId: string) {
  const token = req.headers["x-member-token"];
  if (typeof token !== "string") throw new HttpError(401, "Join the group first");
  const [member] = await db.query<{ id: string; name: string }>(
    `SELECT id, name FROM members WHERE token_hash = $1 AND group_id = $2`,
    [hashToken(token), groupId],
  );
  if (!member) throw new HttpError(401, "Unknown member");
  return member;
}
