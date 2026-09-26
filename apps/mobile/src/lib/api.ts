import type { CreateGroupInput, Group, GroupDraft, GroupPage, RsvpStatus } from "@turnout/shared";
import { storage } from "./storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:8081";
export const shareUrl = (slug: string) => `${WEB_URL}/g/${slug}`;

export interface Membership {
  memberId: string;
  name: string;
  token: string;
}

/** Temporary organizer identity until Entra External ID sign-in is wired up. */
async function organizerHeaders(): Promise<Record<string, string>> {
  let id = await storage.get("devOrganizerId");
  if (!id) {
    id = Math.random().toString(36).slice(2);
    await storage.set("devOrganizerId", id);
  }
  return { "x-dev-user": id };
}

async function request<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  draftGroup: async (sentence: string) =>
    request<{ draft: GroupDraft; source: "ai" | "rules" }>("/ai/group-draft", { method: "POST", body: { sentence }, headers: await organizerHeaders() }),
  createGroup: async (input: CreateGroupInput) =>
    request<{ group: Group }>("/groups", { method: "POST", body: input, headers: await organizerHeaders() }),
  myGroups: async () => request<{ groups: Group[] }>("/me/groups", { headers: await organizerHeaders() }),

  groupPage: (slug: string) => request<GroupPage>(`/groups/${slug}`),
  join: async (slug: string, name: string): Promise<Membership> => {
    const { member, token } = await request<{ member: { id: string; name: string }; token: string }>(`/groups/${slug}/members`, {
      method: "POST",
      body: { name },
    });
    const membership = { memberId: member.id, name: member.name, token };
    await storage.set(`membership:${slug}`, JSON.stringify(membership));
    return membership;
  },
  membership: async (slug: string): Promise<Membership | null> => {
    const raw = await storage.get(`membership:${slug}`);
    return raw ? (JSON.parse(raw) as Membership) : null;
  },
  rsvp: (slug: string, token: string, status: RsvpStatus) =>
    request<GroupPage>(`/groups/${slug}/rsvp`, { method: "PUT", body: { status }, headers: { "x-member-token": token } }),
};
