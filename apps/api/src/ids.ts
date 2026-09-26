import { createHash, randomBytes } from "node:crypto";

const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes (0/o, 1/l/i)

export function randomSlug(length = 8): string {
  return Array.from(randomBytes(length), (b) => alphabet[b % alphabet.length]).join("");
}

export function newMemberToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
