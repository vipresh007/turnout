import type { CreateGroupInput, Dashboard, Group, GroupDraft, GroupPage, MemberSelf, MemberSummary, RsvpStatus, SessionUpdateInput, UpcomingWeek, UpdateGroupInput } from "@turnout/shared";
import { useMemo } from "react";
import { useAuth } from "./auth";
import { config } from "./config";
import { storage } from "./storage";

export const shareUrl = (slug: string) => `${config.webUrl}/g/${slug}`;

export interface Membership {
  memberId: string;
  name: string;
  token: string;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** Joining with a name someone in the group already has. */
export class NameTakenError extends Error {
  existing: { id: string; name: string; hasEmail: boolean };
  constructor(existing: NameTakenError["existing"]) {
    super(`There's already a ${existing.name} in this group`);
    this.existing = existing;
  }
}

type Headers = Record<string, string>;

async function request<T>(path: string, init: { method?: string; body?: unknown; headers?: Headers } = {}): Promise<T> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    method: init.method ?? "GET",
    headers: { ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...init.headers },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`, data);
  return data as T;
}

const membershipKey = (slug: string) => `membership:${slug}`;

export const memberships = {
  get: async (slug: string): Promise<Membership | null> => {
    const raw = await storage.get(membershipKey(slug));
    return raw ? (JSON.parse(raw) as Membership) : null;
  },
  forget: (slug: string) => storage.remove(membershipKey(slug)),
  set: (slug: string, m: Membership) => storage.set(membershipKey(slug), JSON.stringify(m)),
};

function createApi(authHeaders: () => Promise<Headers>) {
  const asOrganizer = async (init: { method?: string; body?: unknown } = {}) => ({ ...init, headers: await authHeaders() });

  return {
    // Organizer
    draftGroup: async (sentence: string) =>
      request<{ draft: GroupDraft; source: "ai" | "rules" }>("/ai/group-draft", await asOrganizer({ method: "POST", body: { sentence } })),
    createGroup: async (input: CreateGroupInput) => request<{ group: Group }>("/groups", await asOrganizer({ method: "POST", body: input })),
    myGroups: async () => request<{ groups: Group[] }>("/me/groups", await asOrganizer()),
    dashboard: async () => request<Dashboard>("/me/dashboard", await asOrganizer()),
    dashboardLive: async () => request<{ url: string | null }>("/me/live", await asOrganizer()),
    updateGroup: async (slug: string, input: UpdateGroupInput) =>
      request<GroupPage>(`/groups/${slug}`, await asOrganizer({ method: "PATCH", body: input })),
    setCancelled: async (slug: string, cancelled: boolean) =>
      request<GroupPage>(`/groups/${slug}/session/cancelled`, await asOrganizer({ method: "PUT", body: { cancelled } })),
    removeMember: async (slug: string, memberId: string) =>
      request<GroupPage>(`/groups/${slug}/members/${memberId}`, await asOrganizer({ method: "DELETE" })),
    setPaid: async (slug: string, memberId: string, paid: boolean) =>
      request<GroupPage>(`/groups/${slug}/members/${memberId}/paid`, await asOrganizer({ method: "PUT", body: { paid } })),
    setSkill: async (slug: string, memberId: string, skill: number) =>
      request<GroupPage>(`/groups/${slug}/members/${memberId}/skill`, await asOrganizer({ method: "PUT", body: { skill } })),
    saveTeams: async (slug: string, teams: string[][] | null) =>
      request<GroupPage>(`/groups/${slug}/session/teams`, await asOrganizer({ method: "PUT", body: { teams } })),
    weeks: async (slug: string) => request<{ weeks: UpcomingWeek[] }>(`/groups/${slug}/weeks`, await asOrganizer()),
    updateWeek: async (slug: string, scheduledAt: string, input: SessionUpdateInput) =>
      request<{ weeks: UpcomingWeek[] }>(`/groups/${slug}/weeks/${encodeURIComponent(scheduledAt)}`, await asOrganizer({ method: "PUT", body: input })),
    remind: async (slug: string) =>
      request<{ notified: number; reachable: number; message: string }>(`/groups/${slug}/remind`, await asOrganizer({ method: "POST", body: {} })),

    // Anyone (the organizer's identity is attached so the page knows to show controls)
    groupPage: async (slug: string) => request<GroupPage>(`/groups/${slug}`, { headers: await authHeaders() }),
    liveUrl: (slug: string) => request<{ url: string | null }>(`/groups/${slug}/live`),

    // Members
    join: async (slug: string, name: string, confirmNew = false): Promise<Membership> => {
      let joined: { member: { id: string; name: string }; token: string };
      try {
        joined = await request(`/groups/${slug}/members`, { method: "POST", body: { name, confirmNew } });
      } catch (e) {
        const body = e instanceof ApiError ? (e.body as { error?: string; existing?: NameTakenError["existing"] }) : undefined;
        if (e instanceof ApiError && e.status === 409 && body?.existing) throw new NameTakenError(body.existing);
        throw e;
      }
      const { member, token } = joined;
      const membership = { memberId: member.id, name: member.name, token };
      await storage.set(membershipKey(slug), JSON.stringify(membership));
      return membership;
    },
    rsvp: (slug: string, token: string, status: RsvpStatus) =>
      request<GroupPage>(`/groups/${slug}/rsvp`, { method: "PUT", body: { status }, headers: { "x-member-token": token } }),

    // Reminder channels (member token)
    reminderOptions: () => request<{ publicKey: string | null; email: boolean }>("/push/key"),
    memberSelf: (slug: string, token: string) => request<MemberSelf>(`/groups/${slug}/me`, { headers: { "x-member-token": token } }),
    subscribePush: (slug: string, token: string, subscription: PushSubscriptionJSON) =>
      request<MemberSelf>(`/groups/${slug}/me/push`, { method: "PUT", body: subscription, headers: { "x-member-token": token } }),
    unsubscribePush: (slug: string, token: string) =>
      request<MemberSelf>(`/groups/${slug}/me/push`, { method: "DELETE", headers: { "x-member-token": token } }),
    setEmail: (slug: string, token: string, email: string) =>
      request<MemberSelf>(`/groups/${slug}/me/email`, { method: "PUT", body: { email }, headers: { "x-member-token": token } }),
    removeEmail: (slug: string, token: string) =>
      request<MemberSelf>(`/groups/${slug}/me/email`, { method: "DELETE", headers: { "x-member-token": token } }),
    requestRestore: (slug: string, memberId: string) =>
      request<{ sent: boolean }>(`/groups/${slug}/members/${memberId}/restore`, { method: "POST", body: {} }),
    restore: async (token: string) => {
      const r = await request<{ slug: string; member: { id: string; name: string }; token: string }>("/restore", { method: "POST", body: { token } });
      await memberships.set(r.slug, { memberId: r.member.id, name: r.member.name, token: r.token });
      return r;
    },
    members: async (slug: string) => request<{ members: MemberSummary[] }>(`/groups/${slug}/members`, await asOrganizer()),
    mergeMember: async (slug: string, memberId: string, intoId: string) =>
      request<{ ok: true }>(`/groups/${slug}/members/${memberId}/merge`, await asOrganizer({ method: "POST", body: { intoId } })),
    confirmEmail: (token: string) => request<{ groupName: string; slug: string }>("/email/confirm", { method: "POST", body: { token } }),
    unsubscribeEmail: (token: string) => request<{ groupName: string; slug: string }>("/email/unsubscribe", { method: "POST", body: { token } }),
  };
}

export type Api = ReturnType<typeof createApi>;

export function useApi(): Api {
  const { authHeaders } = useAuth();
  return useMemo(() => createApi(authHeaders), [authHeaders]);
}

/**
 * Wakes the API. It scales to zero when idle and takes a while to start, and Entra only waits
 * about 2 seconds when it calls us during sign-in, so screens that lead to sign-in call this early.
 */
export function wakeApi(): void {
  fetch(`${config.apiUrl}/health`).catch(() => {});
}

/** Calendar feed for a group. webcal:// subscribes on Apple devices so the calendar stays up to date. */
export function calendarUrl(slug: string): string {
  const https = `${config.apiUrl}/groups/${slug}/calendar.ics`;
  const apple = typeof navigator !== "undefined" && /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  return apple ? https.replace(/^https?:/, "webcal:") : https;
}
