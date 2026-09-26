import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { GroupPage } from "@turnout/shared";
import { buildApp } from "./app.ts";
import { createDb, type Db } from "./db/client.ts";

process.env.NODE_ENV = "test";
process.env.ALLOW_DEV_AUTH = "true";

let db: Db;
let app: Awaited<ReturnType<typeof buildApp>>;
before(async () => {
  db = await createDb(""); // in-memory PGlite
  app = await buildApp(db);
});
after(async () => {
  await app.close();
  await db.close();
});

const organizer = { "x-dev-user": "alex" };

test("create a group, join, RSVP, and auto-promote from the waitlist", async () => {
  const created = await app.inject({
    method: "POST", url: "/groups", headers: organizer,
    payload: { name: "Tuesday Soccer", weekday: 2, startTime: "19:00", timezone: "America/Toronto", cap: 2 },
  });
  assert.equal(created.statusCode, 201);
  const { slug } = created.json().group;

  const join = async (name: string) => (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name } })).json();
  const rsvp = async (token: string, status: "in" | "out") =>
    (await app.inject({ method: "PUT", url: `/groups/${slug}/rsvp`, headers: { "x-member-token": token }, payload: { status } })).json() as GroupPage;

  const [a, b, c] = [await join("Ana"), await join("Ben"), await join("Cy")];
  await rsvp(a.token, "in");
  await rsvp(b.token, "in");
  let page = await rsvp(c.token, "in");
  assert.deepEqual(page.roster.confirmed.map((r) => r.name), ["Ana", "Ben"]);
  assert.deepEqual(page.roster.waitlist.map((r) => r.name), ["Cy"]);

  page = await rsvp(a.token, "out");
  assert.deepEqual(page.roster.confirmed.map((r) => r.name), ["Ben", "Cy"]);

  const publicPage = (await app.inject({ url: `/groups/${slug}` })).json() as GroupPage;
  assert.equal(publicPage.roster.out[0]?.name, "Ana");
});

test("organizer routes need sign-in; RSVPs need a member token", async () => {
  assert.equal((await app.inject({ method: "GET", url: "/me/groups" })).statusCode, 401);
  const res = await app.inject({ method: "POST", url: "/groups", headers: organizer, payload: { name: "X", weekday: 1, startTime: "18:00", timezone: "UTC", cap: null } });
  const { slug } = res.json().group;
  assert.equal((await app.inject({ method: "PUT", url: `/groups/${slug}/rsvp`, payload: { status: "in" } })).statusCode, 401);
});

test("CORS preflight allows PUT (RSVP from the web app)", async () => {
  const res = await app.inject({
    method: "OPTIONS", url: "/groups/x/rsvp",
    headers: { origin: "http://localhost:8081", "access-control-request-method": "PUT", "access-control-request-headers": "content-type,x-member-token" },
  });
  assert.match(String(res.headers["access-control-allow-methods"]), /PUT/);
});

test("organizer controls: edit, cancel the week, remove a member", async () => {
  const other = { "x-dev-user": "someone-else" };
  const { slug } = (await app.inject({
    method: "POST", url: "/groups", headers: organizer,
    payload: { name: "Pickup", weekday: 3, startTime: "18:00", timezone: "America/Toronto", cap: 3 },
  })).json().group;

  const join = async (name: string) => (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name } })).json();
  const rsvpStatus = async (token: string, status: "in" | "out") =>
    (await app.inject({ method: "PUT", url: `/groups/${slug}/rsvp`, headers: { "x-member-token": token }, payload: { status } })).statusCode;
  const a = await join("Ana");
  const b = await join("Ben");
  await rsvpStatus(a.token, "in");
  await rsvpStatus(b.token, "in");

  // Only the organizer sees organizer controls and can use them.
  assert.equal(((await app.inject({ url: `/groups/${slug}`, headers: organizer })).json() as GroupPage).viewer.isOrganizer, true);
  assert.equal(((await app.inject({ url: `/groups/${slug}`, headers: other })).json() as GroupPage).viewer.isOrganizer, false);
  assert.equal((await app.inject({ method: "PATCH", url: `/groups/${slug}`, headers: other, payload: { cap: 1 } })).statusCode, 403);

  // Lowering the cap moves the latest "in" to the waitlist.
  let page = (await app.inject({ method: "PATCH", url: `/groups/${slug}`, headers: organizer, payload: { cap: 1, name: "Wed Pickup" } })).json() as GroupPage;
  assert.equal(page.group.name, "Wed Pickup");
  assert.deepEqual(page.roster.waitlist.map((r) => r.name), ["Ben"]);

  // Removing a confirmed member promotes the waitlist; their token stops working.
  page = (await app.inject({ method: "DELETE", url: `/groups/${slug}/members/${a.member.id}`, headers: organizer })).json() as GroupPage;
  assert.deepEqual(page.roster.confirmed.map((r) => r.name), ["Ben"]);
  assert.equal(await rsvpStatus(a.token, "in"), 401);

  // A cancelled week rejects RSVPs until it's restored.
  page = (await app.inject({ method: "PUT", url: `/groups/${slug}/session/cancelled`, headers: organizer, payload: { cancelled: true } })).json() as GroupPage;
  assert.equal(page.session.cancelled, true);
  assert.equal(await rsvpStatus(b.token, "out"), 409);
  await app.inject({ method: "PUT", url: `/groups/${slug}/session/cancelled`, headers: organizer, payload: { cancelled: false } });
  assert.equal(await rsvpStatus(b.token, "out"), 200);
});

test("migrations are idempotent across restarts", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(`${tmpdir()}/turnout-`);
  process.env.PGLITE_DIR = dir;
  try {
    await (await createDb("")).close();
    const again = await createDb("");
    const [row] = await again.query<{ n: number }>(`SELECT count(*)::int AS n FROM schema_migrations`);
    assert.equal(row?.n, 1);
    await again.close();
  } finally {
    delete process.env.PGLITE_DIR;
  }
});

test("organizer dashboard: groups with this week's counts and recent activity", async () => {
  const me = { "x-dev-user": "dash-organizer" };
  assert.equal((await app.inject({ url: "/me/dashboard" })).statusCode, 401);

  const empty = (await app.inject({ url: "/me/dashboard", headers: me })).json();
  assert.deepEqual(empty.groups, []);
  assert.deepEqual(empty.activity, []);

  const { slug } = (await app.inject({
    method: "POST", url: "/groups", headers: me,
    payload: { name: "Dash Hoops", weekday: 1, startTime: "19:00", timezone: "America/Toronto", cap: 1 },
  })).json().group;
  const join = async (name: string) => (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name } })).json();
  const a = await join("Ana");
  const b = await join("Ben");
  for (const m of [a, b]) {
    await app.inject({ method: "PUT", url: `/groups/${slug}/rsvp`, headers: { "x-member-token": m.token }, payload: { status: "in" } });
  }

  const dash = (await app.inject({ url: "/me/dashboard", headers: me })).json();
  assert.equal(dash.groups.length, 1);
  assert.equal(dash.groups[0].group.name, "Dash Hoops");
  assert.equal(dash.groups[0].group.organizerId, undefined); // internal column never leaks
  assert.deepEqual([dash.groups[0].confirmed, dash.groups[0].waitlist, dash.groups[0].spotsLeft], [1, 1, 0]);
  assert.deepEqual(dash.activity.map((x: { name: string }) => x.name).sort(), ["Ana", "Ben"]);

  // Stats: this week's session (one capped spot, filled, two responses) lands in one of the recent buckets.
  assert.equal(dash.stats.weeks.length, 9);
  const week = dash.stats.weeks.find((w: { responses: number }) => w.responses > 0);
  assert.deepEqual([week.players, week.spots, week.responses], [1, 1, 2]);
  assert.equal(dash.stats.responses, 2);
  assert.equal(dash.stats.fillRate, null); // no past weeks yet
  assert.deepEqual(dash.stats.regulars.map((r: { name: string }) => r.name), ["Ana", "Ben"]);

  // Other organizers' activity never shows up.
  const other = (await app.inject({ url: "/me/dashboard", headers: { "x-dev-user": "someone-new" } })).json();
  assert.deepEqual(other.activity, []);
});
