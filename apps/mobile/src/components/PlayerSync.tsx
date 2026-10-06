import { useEffect, useRef } from "react";
import { memberships, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Signed in, links the groups this device has joined to the account and brings down any linked groups this device
 * doesn't have yet, so a player's games and stats are the same on every phone and on the website. Renders nothing.
 */
export function PlayerSync() {
  const { status } = useAuth();
  const api = useApi();
  const synced = useRef(false);

  useEffect(() => {
    if (status !== "signedIn") {
      synced.current = false;
      return;
    }
    if (synced.current) return;
    synced.current = true;
    (async () => {
      const links: { slug: string; token: string }[] = [];
      for (const slug of await memberships.slugs()) {
        const m = await memberships.get(slug);
        if (m) links.push({ slug, token: m.token });
      }
      const { memberships: linked } = await api.syncMemberships(links);
      for (const m of linked) {
        if (m.token) await memberships.set(m.slug, { memberId: m.memberId, name: m.name, token: m.token });
      }
    })().catch(() => {
      synced.current = false; // try again next time
    });
  }, [status, api]);

  return null;
}
