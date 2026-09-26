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
