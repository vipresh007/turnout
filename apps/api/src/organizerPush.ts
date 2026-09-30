import type { Db } from "./db/client.ts";

/** A push to an organizer's phone (the Turnout iOS/Android app). `path` is the in-app screen to open on tap. */
export interface OrganizerPush {
  title: string;
  body: string;
  path: string;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Sends to every registered phone of these organizers through Expo's push service (which relays to APNs/FCM).
 * Tokens Expo reports as no longer registered are removed. Never throws: email is still the main channel.
 */
export async function pushToOrganizers(db: Db, organizerIds: string[], message: OrganizerPush): Promise<number> {
  if (!organizerIds.length) return 0;
  const tokens = await db.query<{ token: string }>(`SELECT token FROM organizer_push_tokens WHERE organizer_id = ANY($1::uuid[])`, [organizerIds]);
  if (!tokens.length) return 0;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(tokens.map(({ token }) => ({ to: token, title: message.title, body: message.body, sound: "default", data: { path: message.path } }))),
      signal: AbortSignal.timeout(10_000),
    });
    const { data } = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    const gone = (data ?? []).map((r, i) => (r.details?.error === "DeviceNotRegistered" ? tokens[i]!.token : null)).filter(Boolean);
    if (gone.length) await db.query(`DELETE FROM organizer_push_tokens WHERE token = ANY($1::text[])`, [gone]);
    return (data ?? []).filter((r) => r.status === "ok").length;
  } catch (err) {
    console.warn("organizer push failed", err);
    return 0;
  }
}
