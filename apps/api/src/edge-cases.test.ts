// End-to-end edge cases for players and recurring schedules (the "boring stuff" before real users).
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "./app.ts";
import { createDb, type Db } from "./db/client.ts";

process.env.NODE_ENV = "test";
process.env.ALLOW_DEV_AUTH = "true";

let db: Db;
let app: Awaited<ReturnType<typeof buildApp>>;
before(async () => {
  db = await createDb("");
  app = await buildApp(db);
});
after(async () => {
  await app.close();
  await db.close();
});

const org = { "x-dev-user": "edge-org" };
const DAY = 86_400_000;
const weekdayIn = (days: number, tz = "UTC") => Number(new Date(Date.now() + days * DAY).toLocaleDateString("en-US", { weekday: "short", timeZone: tz }).replace(/^(\w{3}).*/, (d) => String(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(d))));

async function group(payload: Record<string, unknown>) {
  const res = await app.inject({ method: "POST", url: "/groups", headers: org, payload: { name: "Edge", startTime: "19:00", timezone: "UTC", cap: null, ...payload } });
  assert.equal(res.statusCode, 201, res.body);
  return res.json().group as { slug: string; id: string };
}
const join = async (slug: string, name: string) => (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name, confirmNew: true } })).json() as { member: { id: string }; token: string };
const rsvp = (slug: string, token: string, status: "in" | "out") => app.inject({ method: "PUT", url: `/groups/${slug}/rsvp`, headers: { "x-member-token": token }, payload: { status } });
const page = async (slug: string) => (await app.inject({ url: `/groups/${slug}`, headers: org })).json();

test("changing the start time keeps this week's answers", async () => {
  const g = await group({ weekdays: [weekdayIn(3)] });
  const a = await join(g.slug, "Ann");
  await rsvp(g.slug, a.token, "in");
  const before = (await page(g.slug)).session.scheduledAt;
  await app.inject({ method: "PATCH", url: `/groups/${g.slug}`, headers: org, payload: { startTime: "20:30" } });
  const p = await page(g.slug);
  assert.notEqual(p.session.scheduledAt, before);
  assert.equal(new Date(p.session.startsAt).getUTCHours(), 20);
  assert.deepEqual(p.roster.confirmed.map((r: { name: string }) => r.name), ["Ann"]);
});

test("moving the game to another day keeps this week's answers", async () => {
  const g = await group({ weekdays: [weekdayIn(3)] });
  const a = await join(g.slug, "Bo");
  await rsvp(g.slug, a.token, "in");
  await app.inject({ method: "PATCH", url: `/groups/${g.slug}`, headers: org, payload: { weekdays: [weekdayIn(4)] } });
  const p = await page(g.slug);
  assert.equal(new Date(p.session.startsAt).getUTCDay(), weekdayIn(4));
  assert.deepEqual(p.roster.confirmed.map((r: { name: string }) => r.name), ["Bo"]);
});

test("raising the cap moves waitlisted players up", async () => {
  const g = await group({ weekdays: [weekdayIn(2)], cap: 1 });
  const a = await join(g.slug, "Cy");
  const b = await join(g.slug, "Di");
  await rsvp(g.slug, a.token, "in");
  await rsvp(g.slug, b.token, "in");
  assert.deepEqual((await page(g.slug)).roster.waitlist.map((r: { name: string }) => r.name), ["Di"]);
  const p = (await app.inject({ method: "PATCH", url: `/groups/${g.slug}`, headers: org, payload: { cap: 2 } })).json();
  assert.deepEqual(p.roster.confirmed.map((r: { name: string }) => r.name).sort(), ["Cy", "Di"]);
  const promoted = await db.query(`SELECT 1 FROM events WHERE kind = 'waitlist_promoted' AND member_id = $1`, [b.member.id]);
  assert.equal(promoted.length, 1);
});

test("waitlist → promoted → drops → rejoins goes to the back", async () => {
  const g = await group({ weekdays: [weekdayIn(2)], cap: 2 });
  const [a, b, c] = [await join(g.slug, "E1"), await join(g.slug, "E2"), await join(g.slug, "E3")];
  for (const p of [a, b, c]) await rsvp(g.slug, p.token, "in");
  await rsvp(g.slug, a.token, "out"); // E3 moves up
  let p = await page(g.slug);
  assert.deepEqual(p.roster.confirmed.map((r: { name: string }) => r.name), ["E2", "E3"]);
  await rsvp(g.slug, a.token, "in"); // back of the line
  p = await page(g.slug);
  assert.deepEqual(p.roster.waitlist.map((r: { name: string }) => r.name), ["E1"]);
});

test("cancelled week: nobody can answer", async () => {
  const g = await group({ weekdays: [weekdayIn(2)] });
  const a = await join(g.slug, "F1");
  await app.inject({ method: "PUT", url: `/groups/${g.slug}/session/cancelled`, headers: org, payload: { cancelled: true } });
  assert.equal((await rsvp(g.slug, a.token, "in")).statusCode, 409);
});

test("after the last game of a season, answers are closed and the page says so", async () => {
  const lastWeek = new Date(Date.now() - 3 * DAY);
  const g = await group({ weekdays: [lastWeek.getUTCDay()], startsOn: new Date(Date.now() - 60 * DAY).toISOString().slice(0, 10), endsOn: lastWeek.toISOString().slice(0, 10) });
  const a = await join(g.slug, "G1");
  const p = await page(g.slug);
  assert.equal(p.seasonOver, true);
  assert.equal((await rsvp(g.slug, a.token, "in")).statusCode, 409);
  // Extending the season opens the next game.
  await app.inject({ method: "PATCH", url: `/groups/${g.slug}`, headers: org, payload: { endsOn: new Date(Date.now() + 60 * DAY).toISOString().slice(0, 10) } });
  assert.equal((await page(g.slug)).seasonOver, false);
  assert.equal((await rsvp(g.slug, a.token, "in")).statusCode, 200);
});

test("a season that hasn't started yet shows its first game", async () => {
  const start = new Date(Date.now() + 20 * DAY);
  const g = await group({ weekdays: [start.getUTCDay()], startsOn: start.toISOString().slice(0, 10) });
  const p = await page(g.slug);
  assert.equal(p.session.scheduledAt.slice(0, 10), start.toISOString().slice(0, 10));
});

test("several days a week: the next one is current", async () => {
  const g = await group({ weekdays: [weekdayIn(1), weekdayIn(3)].sort() });
  const p = await page(g.slug);
  assert.equal(new Date(p.session.startsAt).getUTCDay(), weekdayIn(1));
});

test("same person on several devices, and a restore link works only once", async () => {
  const g = await group({ weekdays: [weekdayIn(2)] });
  const a = await join(g.slug, "H1");
  await db.query(`UPDATE members SET email = 'h1@example.com', email_confirmed_at = now() WHERE id = $1`, [a.member.id]);
  const { hashToken } = await import("./ids.ts");
  await db.query(`INSERT INTO member_restores (token_hash, member_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')`, [hashToken("forwarded-link-token"), a.member.id]);
  const phone2 = (await app.inject({ method: "POST", url: "/restore", payload: { token: "forwarded-link-token" } })).json();
  assert.equal(phone2.member.id, a.member.id);
  assert.equal((await app.inject({ method: "POST", url: "/restore", payload: { token: "forwarded-link-token" } })).statusCode, 404); // one use
  // Both devices answer as the same person.
  await rsvp(g.slug, a.token, "in");
  await rsvp(g.slug, phone2.token, "out");
  const p = await page(g.slug);
  assert.equal(p.roster.out.length, 1);
  assert.equal(p.roster.confirmed.length, 0);
});

test("removed player can join again under their name", async () => {
  const g = await group({ weekdays: [weekdayIn(2)] });
  const a = await join(g.slug, "I1");
  await app.inject({ method: "DELETE", url: `/groups/${g.slug}/members/${a.member.id}`, headers: org });
  assert.equal((await rsvp(g.slug, a.token, "in")).statusCode, 401);
  const again = await app.inject({ method: "POST", url: `/groups/${g.slug}/members`, payload: { name: "I1" } });
  assert.equal(again.statusCode, 201);
});

test("season groups: starting a new season keeps members and clears payments", async () => {
  const g = await group({ weekdays: [weekdayIn(2)], seasonFeeCents: 100000 });
  await app.inject({ method: "POST", url: `/groups/${g.slug}/members/add`, headers: org, payload: { players: [{ name: "J1" }, { name: "J2" }] } });
  const ids = (await page(g.slug)).season.memberIds as string[];
  for (const id of ids) await app.inject({ method: "PUT", url: `/groups/${g.slug}/members/${id}/season`, headers: org, payload: { paid: true } });
  assert.equal((await page(g.slug)).organizer.seasonPaid.length, 2);
  const res = await app.inject({ method: "POST", url: `/groups/${g.slug}/season/new`, headers: org, payload: { seasonFeeCents: 120000 } });
  assert.equal(res.statusCode, 200);
  const p = await page(g.slug);
  assert.equal(p.season.memberIds.length, 2);
  assert.equal(p.organizer.seasonPaid.length, 0);
  assert.equal(p.group.seasonFeeCents, 120000);
});
