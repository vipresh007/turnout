import type { Rsvp } from "@turnout/shared";

/**
 * Side effects of roster changes. For now these only log.
 * TODO: broadcast through Azure Web PubSub and send pushes via Expo.
 */
export const events = {
  rosterChanged(groupSlug: string) {
    console.info(`[roster] ${groupSlug} changed`);
  },
  promoted(groupSlug: string, members: Rsvp[]) {
    for (const m of members) console.info(`[promoted] ${m.name} is now in for ${groupSlug}`);
  },
};
