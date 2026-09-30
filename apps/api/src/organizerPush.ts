import type { Db } from "./db/client.ts";

/** A push to an organizer's phone (the Turnout iOS/Android app). `path` is the in-app screen to open on tap. */
export interface OrganizerPush {
  title: string;
  body: string;
  path: string;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  /** In-app path to open on tap, e.g. /g/tuesday-hoops. */
  path: string;
}

/**
 * Sends through Expo's push service (which relays to APNs/FCM). Returns how many were accepted and which
 * tokens Expo says are no longer registered, so callers can forget them. Never throws.
 */
export async function sendExpoPush(messages: ExpoMessage[]): Promise<{ ok: number; gone: string[] }> {
  if (!messages.length) return { ok: 0, gone: [] };
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(messages.map((m) => ({ to: m.to, title: m.title, body: m.body, sound: "default", data: { path: m.path } }))),
      signal: AbortSignal.timeout(10_000),
    });
    const { data } = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    const gone = (data ?? []).flatMap((r, i) => (r.details?.error === "DeviceNotRegistered" ? [messages[i]!.to] : []));
    return { ok: (data ?? []).filter((r) => r.status === "ok").length, gone };
  } catch (err) {
    console.warn("expo push failed", err);
    return { ok: 0, gone: [] };
  }
}

/** Sends to every registered phone of these organizers. Email is still their main channel. */
export async function pushToOrganizers(db: Db, organizerIds: string[], message: OrganizerPush): Promise<number> {
  if (!organizerIds.length) return 0;
  const tokens = await db.query<{ token: string }>(`SELECT token FROM organizer_push_tokens WHERE organizer_id = ANY($1::uuid[])`, [organizerIds]);
  const { ok, gone } = await sendExpoPush(tokens.map(({ token }) => ({ to: token, ...message })));
  if (gone.length) await db.query(`DELETE FROM organizer_push_tokens WHERE token = ANY($1::text[])`, [gone]);
  return ok;
}
