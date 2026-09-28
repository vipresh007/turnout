import type { Db } from "./db/client.ts";

/**
 * Product events, kept in our own database (no third-party trackers). Sent from the server where it can see
 * the action; a few come from the app (see CLIENT_EVENTS). Tracking never blocks or fails a request.
 */
export type EventKind =
  | "group_created" | "player_joined" | "rsvp_in" | "rsvp_out" | "waitlisted" | "waitlist_promoted"
  | "player_dropped" | "late_dropout" | "reminder_sent" | "spot_alert_sent" | "spot_alert_claimed"
  | "teams_created" | "payment_marked" | "forecast_alert_sent" | ClientEventKind;

/** Events the app reports itself, because only the browser sees them. */
export const CLIENT_EVENTS = ["link_shared", "invite_asked", "reminder_opened", "pricing_interest"] as const;
export type ClientEventKind = (typeof CLIENT_EVENTS)[number];

export interface EventRefs {
  groupId?: string | null;
  sessionId?: string | null;
  memberId?: string | null;
  organizerId?: string | null;
  props?: Record<string, unknown>;
}

export function track(db: Db, kind: EventKind, refs: EventRefs = {}): Promise<void> {
  return db
    .query(
      `INSERT INTO events (kind, group_id, session_id, member_id, organizer_id, props) VALUES ($1, $2, $3, $4, $5, $6)`,
      [kind, refs.groupId ?? null, refs.sessionId ?? null, refs.memberId ?? null, refs.organizerId ?? null, refs.props ? JSON.stringify(refs.props) : null],
    )
    .then(() => undefined, (err) => console.warn(`track ${kind} failed`, err));
}
