import type { CreateGroupInput, Dashboard, Group, GroupDraft, GroupPage, MemberSelf, RsvpStatus, UpdateGroupInput } from "@turnout/shared";
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
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
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
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

const membershipKey = (slug: string) => `membership:${slug}`;

export const memberships = {
  get: async (slug: string): Promise<Membership | null> => {
    const raw = await storage.get(membershipKey(slug));
    return raw ? (JSON.parse(raw) as Membership) : null;
  },
  forget: (slug: string) => storage.remove(membershipKey(slug)),
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
    remind: async (slug: string) =>
      request<{ notified: number; reachable: number; message: string }>(`/groups/${slug}/remind`, await asOrganizer({ method: "POST", body: {} })),

    // Anyone (the organizer's identity is attached so the page knows to show controls)
    groupPage: async (slug: string) => request<GroupPage>(`/groups/${slug}`, { headers: await authHeaders() }),
    liveUrl: (slug: string) => request<{ url: string | null }>(`/groups/${slug}/live`),

    // Members
    join: async (slug: string, name: string): Promise<Membership> => {
      const { member, token } = await request<{ member: { id: string; name: string }; token: string }>(`/groups/${slug}/members`, {
        method: "POST",
        body: { name },
      });
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
    confirmEmail: (token: string) => request<{ groupName: string; slug: string }>("/email/confirm", { method: "POST", body: { token } }),
    unsubscribeEmail: (token: string) => request<{ groupName: string; slug: string }>("/email/unsubscribe", { method: "POST", body: { token } }),
  };
}

export type Api = ReturnType<typeof createApi>;

export function useApi(): Api {
  const { authHeaders } = useAuth();
  return useMemo(() => createApi(authHeaders), [authHeaders]);
}
