import { WebPubSubServiceClient } from "@azure/web-pubsub";
import type { Rsvp } from "@turnout/shared";

const HUB = "turnout";
const connectionString = process.env.WEB_PUBSUB_CONNECTION_STRING;
const pubsub = connectionString ? new WebPubSubServiceClient(connectionString, HUB) : null;

const channel = (groupSlug: string) => `g-${groupSlug}`;

/**
 * Real-time channel for a group page. Clients connect with a token that joins them to the group's
 * channel and allows nothing else. Returns null when Web PubSub isn't configured; clients then poll.
 */
export async function liveUrl(groupSlug: string): Promise<string | null> {
  if (!pubsub) return null;
  const { url } = await pubsub.getClientAccessToken({ groups: [channel(groupSlug)], expirationTimeInMinutes: 60 });
  return url;
}

/** Side effects of roster changes. Failures are logged and never block the RSVP. */
export const events = {
  async rosterChanged(groupSlug: string) {
    // The message carries no roster data. Clients re-fetch, so names never go out on the public channel.
    await pubsub?.group(channel(groupSlug)).sendToAll({ type: "changed" }).catch((err) => console.warn("Web PubSub send failed", err));
  },
  promoted(groupSlug: string, members: Rsvp[]) {
    // TODO(V2): push notification "You're in!" (Expo push, registered alongside reminders).
    for (const m of members) console.info(`[promoted] ${m.name} is now in for ${groupSlug}`);
  },
};
