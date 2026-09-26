import type { FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Db } from "./db/client.ts";
import { hashToken } from "./ids.ts";

export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

interface Identity {
  externalId: string;
  email: string | null;
  name: string | null;
}

// ── Microsoft Entra External ID ─────────────────────────────
// ENTRA_AUTHORITY: https://<tenant>.ciamlogin.com/<tenant-id>/v2.0
// ENTRA_API_CLIENT_ID: the API app registration's client ID (the token audience)

let verifier: Promise<(token: string) => Promise<JWTPayload>> | undefined;

function entraVerifier() {
  const authority = process.env.ENTRA_AUTHORITY;
  const audience = process.env.ENTRA_API_CLIENT_ID;
  if (!authority || !audience) return undefined;
  verifier ??= (async () => {
    const res = await fetch(`${authority.replace(/\/$/, "")}/.well-known/openid-configuration`);
    if (!res.ok) throw new Error(`Entra discovery failed: ${res.status}`);
    const { issuer, jwks_uri } = (await res.json()) as { issuer: string; jwks_uri: string };
    const jwks = createRemoteJWKSet(new URL(jwks_uri));
    return async (token: string) => (await jwtVerify(token, jwks, { issuer, audience })).payload;
  })().catch((err) => {
    verifier = undefined; // retry discovery on the next request
    throw err;
  });
  return verifier;
}

async function identify(req: FastifyRequest): Promise<Identity | null> {
  const auth = req.headers.authorization;
  const verify = entraVerifier();
  if (verify && auth?.startsWith("Bearer ")) {
    let claims: JWTPayload;
    try {
      claims = await (await verify)(auth.slice(7));
    } catch (err) {
      req.log.info({ err }, "rejected access token");
      throw new HttpError(401, "Your session has expired. Sign in again.");
    }
    const oid = (claims.oid ?? claims.sub) as string;
    return {
      externalId: `entra:${oid}`,
      email: (claims.email as string | undefined) ?? (claims.preferred_username as string | undefined) ?? null,
      name: (claims.name as string | undefined) ?? null,
    };
  }
  // Local development only. Never set ALLOW_DEV_AUTH in a deployed environment.
  const devUser = process.env.ALLOW_DEV_AUTH === "true" ? req.headers["x-dev-user"] : undefined;
  if (typeof devUser === "string" && devUser) return { externalId: `dev:${devUser}`, email: null, name: null };
  return null;
}

/** The signed-in organizer, or null. Creates the organizer record on first sight. */
export async function currentOrganizer(db: Db, req: FastifyRequest): Promise<{ id: string } | null> {
  const identity = await identify(req);
  if (!identity) return null;
  const [row] = await db.query<{ id: string }>(
    `INSERT INTO organizers (external_id, email, name) VALUES ($1, $2, $3)
     ON CONFLICT (external_id) DO UPDATE SET
       email = COALESCE(EXCLUDED.email, organizers.email),
       name = COALESCE(EXCLUDED.name, organizers.name)
     RETURNING id`,
    [identity.externalId, identity.email, identity.name],
  );
  return row!;
}

export async function requireOrganizer(db: Db, req: FastifyRequest): Promise<{ id: string }> {
  const organizer = await currentOrganizer(db, req);
  if (!organizer) throw new HttpError(401, "Sign in required");
  return organizer;
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
