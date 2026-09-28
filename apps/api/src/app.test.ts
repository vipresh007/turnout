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
    const { migrations } = await import("./db/migrations.ts");
    assert.equal(row?.n, migrations.length);
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
  assert.equal(dash.groups[0].weeks.length, 12);
  assert.equal((await app.inject({ url: "/me/live", headers: me })).json().url, null); // no Web PubSub in tests
  assert.deepEqual(dash.groups[0].players.map((p: { name: string; status: string; paid: boolean }) => [p.name, p.status, p.paid]), [["Ana", "in", false], ["Ben", "waitlist", false]]);
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

test("V2: paid tracking, skills and teams are organizer-only", async () => {
  const org = { "x-dev-user": "v2-org" };
  const other = { "x-dev-user": "v2-other" };
  const { slug } = (await app.inject({
    method: "POST", url: "/groups", headers: org,
    payload: { name: "V2 Soccer", weekday: 2, startTime: "19:00", timezone: "America/Toronto", cap: 10 },
  })).json().group;
  const join = async (name: string) => (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name } })).json();
  const [a, b] = [await join("Ana"), await join("Ben")];
  for (const m of [a, b]) await app.inject({ method: "PUT", url: `/groups/${slug}/rsvp`, headers: { "x-member-token": m.token }, payload: { status: "in" } });

  let page = (await app.inject({ method: "PUT", url: `/groups/${slug}/members/${a.member.id}/paid`, headers: org, payload: { paid: true } })).json() as GroupPage;
  assert.deepEqual(page.organizer?.paid, [a.member.id]);
  assert.equal((await app.inject({ method: "PUT", url: `/groups/${slug}/members/${a.member.id}/paid`, headers: other, payload: { paid: false } })).statusCode, 403);
  assert.equal(((await app.inject({ url: `/groups/${slug}` })).json() as GroupPage).organizer, undefined); // never public

  page = (await app.inject({ method: "PUT", url: `/groups/${slug}/members/${b.member.id}/skill`, headers: org, payload: { skill: 5 } })).json() as GroupPage;
  assert.equal(page.organizer?.skills[b.member.id], 5);

  page = (await app.inject({ method: "PUT", url: `/groups/${slug}/session/teams`, headers: org, payload: { teams: [[a.member.id], [b.member.id]] } })).json() as GroupPage;
  assert.deepEqual(page.session.teams?.teams, [[a.member.id], [b.member.id]]);
  assert.equal((await app.inject({ method: "PUT", url: `/groups/${slug}/session/teams`, headers: org, payload: { teams: [[a.member.id], [a.member.id]] } })).statusCode, 400);
  page = (await app.inject({ method: "PUT", url: `/groups/${slug}/session/teams`, headers: org, payload: { teams: null } })).json() as GroupPage;
  assert.equal(page.session.teams, null);
});

test("V2: reminder channels, double opt-in email, and the reminder job never double-sends", async () => {
  const { currentSessionStart } = await import("./schedule.ts");
  const { reminderTimes } = await import("@turnout/shared");
  const { runReminders, remindNow } = await import("./reminders.ts");
  const { findGroupBySlug } = await import("./groups.ts");

  const org = { "x-dev-user": "v2-remind" };
  const { slug } = (await app.inject({
    method: "POST", url: "/groups", headers: org,
    payload: { name: "V2 Hoops", weekday: 4, startTime: "20:00", timezone: "America/Toronto", cap: 8 },
  })).json().group;
  const a = (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name: "Ana" } })).json();
  const me = { "x-member-token": a.token };

  // Push subscription
  let self = (await app.inject({ method: "PUT", url: `/groups/${slug}/me/push`, headers: me, payload: { endpoint: "https://push.example.com/abc", keys: { p256dh: "k", auth: "a" } } })).json();
  assert.equal(self.channels.push, 1);

  // Email: on right away (the welcome email carries a one-tap stop)
  self = (await app.inject({ method: "PUT", url: `/groups/${slug}/me/email`, headers: me, payload: { email: "Ana@Example.com" } })).json();
  assert.deepEqual([self.channels.email, self.channels.emailConfirmed], ["ana@example.com", true]);
  const [row] = await db.query<{ token: string }>(`SELECT email_token AS token FROM members WHERE id = $1`, [a.member.id]);
  const token = row!.token;
  assert.equal((await app.inject({ method: "POST", url: "/email/confirm", payload: { token } })).json().slug, slug);
  self = (await app.inject({ url: `/groups/${slug}/me`, headers: me })).json();
  assert.equal(self.channels.emailConfirmed, true);

  // Reminder job at the day-before time: Ana hasn't answered, so she gets one nudge, once.
  const group = (await findGroupBySlug(db, slug))!;
  const start = currentSessionStart(group);
  const due = reminderTimes(start, group.timezone, group.reminders).dayBefore!;
  const at = new Date(due.getTime() + 60_000);
  if (at < start) {
    await runReminders(db, at);
    await runReminders(db, at);
    const rows = await db.query(`SELECT kind FROM notifications_sent n JOIN members m ON m.id = n.member_id WHERE m.id = $1`, [a.member.id]);
    assert.deepEqual(rows.map((r) => r.kind), ["dayBefore"]);
  }

  // Organizer "remind now": works once an hour, always returns the group-chat text.
  const first = await remindNow(db, group);
  assert.equal(first.reachable, 1);
  assert.match(first.message, /V2 Hoops/);
  const second = await remindNow(db, group);
  assert.equal(second.notified, 0);

  // Unsubscribe clears the email; the token stops working.
  await app.inject({ method: "POST", url: "/email/unsubscribe", payload: { token } });
  self = (await app.inject({ url: `/groups/${slug}/me`, headers: me })).json();
  assert.equal(self.channels.email, null);
  assert.equal((await app.inject({ method: "POST", url: "/email/confirm", payload: { token } })).statusCode, 404);
});

test("auth events: the sign-in code endpoint only accepts Entra's signed calls", async () => {
  const body = { data: { otpContext: { identifier: "a@example.com", onetimecode: "12345678" } } };
  assert.equal((await app.inject({ method: "POST", url: "/auth-events/otp-send", payload: body })).statusCode, 401);
  assert.equal((await app.inject({ method: "POST", url: "/auth-events/otp-send", headers: { authorization: "Bearer not.a.token" }, payload: body })).statusCode, 401);
  const { otpEmailHtml, otpEmailText, readOtp } = await import("./authEvents.ts");
  assert.deepEqual(readOtp({ data: { otpContext: { identifier: "a@x.com", onetimecode: "123" } } }), { email: "a@x.com", code: "123" });
  assert.deepEqual(readOtp({ data: { otpContext: { email: "a@x.com", oneTimeCode: "123" } } }), { email: "a@x.com", code: "123" });
  assert.match(otpEmailHtml("12345678"), /12345678/);
  assert.match(otpEmailText("12345678"), /12345678/);
});

test("calendar feed: weekly repeating event in the group's timezone", async () => {
  const { slug } = (await app.inject({
    method: "POST", url: "/groups", headers: { "x-dev-user": "cal-org" },
    payload: { name: "Cal Soccer, Tuesdays", location: "Riverside; Field 2", weekday: 2, startTime: "19:30", timezone: "America/Toronto", cap: 10 },
  })).json().group;
  const res = await app.inject({ url: `/groups/${slug}/calendar.ics` });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"] as string, /text\/calendar/);
  const ics = res.body;
  assert.match(ics, /RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=TU/);
  assert.match(ics, /DTSTART;TZID=America\/Toronto:\d{8}T193000/);
  assert.match(ics, /SUMMARY:Cal Soccer\\, Tuesdays/);
  assert.match(ics, /LOCATION:Riverside\\; Field 2/);
});

test("link preview image renders a PNG for a group", async () => {
  const { slug } = (await app.inject({
    method: "POST", url: "/groups", headers: { "x-dev-user": "og-org" },
    payload: { name: "OG <Hoops> & Co", location: "Riverside", weekday: 2, startTime: "19:30", timezone: "America/Toronto", cap: 10 },
  })).json().group;
  const res = await app.inject({ url: `/og/${slug}.png` });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "image/png");
  assert.deepEqual([...res.rawPayload.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]); // PNG signature
  const { groupCardSvg } = await import("./ogImage.ts");
  const svg = groupCardSvg((await app.inject({ url: `/groups/${slug}` })).json());
  assert.match(svg, /OG &lt;Hoops&gt; &amp; Co/); // user text is escaped
  assert.match(svg, /Need 10 more/);
});

test("recurrence: several days, skip a week, move this week, note", async () => {
  const org = { "x-dev-user": "rec-org" };
  const created = (await app.inject({
    method: "POST", url: "/groups", headers: org,
    payload: { name: "Rec Hoops", weekdays: [2, 4], intervalWeeks: 1, startTime: "19:00", timezone: "America/Toronto", cap: 10, location: "Main Gym" },
  })).json().group;
  assert.deepEqual(created.weekdays, [2, 4]);
  assert.equal(created.intervalWeeks, 1);
  const slug = created.slug;

  // Legacy clients sending a single weekday still work.
  const legacy = (await app.inject({ method: "POST", url: "/groups", headers: org, payload: { name: "Old", weekday: 5, startTime: "18:00", timezone: "UTC", cap: null } })).json().group;
  assert.deepEqual(legacy.weekdays, [5]);

  const weeks = (await app.inject({ url: `/groups/${slug}/weeks`, headers: org })).json().weeks;
  assert.equal(weeks.length, 8);
  // Alternates Tue/Thu in Toronto.
  const days = weeks.slice(0, 4).map((w: { scheduledAt: string }) => new Date(w.scheduledAt).toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Toronto" }));
  assert.ok(days.every((d: string) => d === "Tue" || d === "Thu"));
  assert.notEqual(days[0], days[1]);

  // Skip the second game (e.g. a holiday); the calendar leaves it out.
  let res = await app.inject({ method: "PUT", url: `/groups/${slug}/weeks/${weeks[1].scheduledAt}`, headers: org, payload: { cancelled: true } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().weeks[1].cancelled, true);
  assert.match((await app.inject({ url: `/groups/${slug}/calendar.ics` })).body, /EXDATE;TZID=America\/Toronto:/);

  // Move this week's game to 20:30 in another gym with a note; the group page reflects it.
  res = await app.inject({ method: "PUT", url: `/groups/${slug}/weeks/${weeks[0].scheduledAt}`, headers: org, payload: { startTime: "20:30", location: "Gym B", note: "Main gym is closed" } });
  assert.equal(res.statusCode, 200);
  const page = (await app.inject({ url: `/groups/${slug}` })).json() as GroupPage;
  assert.equal(page.session.scheduledAt, weeks[0].scheduledAt);
  assert.equal(new Date(page.session.startsAt).getTime() - new Date(page.session.scheduledAt).getTime(), 90 * 60_000);
  assert.deepEqual([page.session.location, page.session.note], ["Gym B", "Main gym is closed"]);

  // Clearing the overrides restores the regular time and place.
  await app.inject({ method: "PUT", url: `/groups/${slug}/weeks/${weeks[0].scheduledAt}`, headers: org, payload: { startTime: null, location: null, note: null } });
  const restored = (await app.inject({ url: `/groups/${slug}` })).json() as GroupPage;
  assert.equal(restored.session.startsAt, restored.session.scheduledAt);
  assert.equal(restored.session.location, null);

  // Only real scheduled times are accepted, and only by the organizer.
  assert.equal((await app.inject({ method: "PUT", url: `/groups/${slug}/weeks/2026-01-01T00:00:00.000Z`, headers: org, payload: { cancelled: true } })).statusCode, 400);
  assert.equal((await app.inject({ method: "PUT", url: `/groups/${slug}/weeks/${weeks[0].scheduledAt}`, headers: { "x-dev-user": "not-owner" }, payload: { cancelled: true } })).statusCode, 403);
});

test("dropout close to game time: late-drop flag and a spot-opened nudge, once", async () => {
  const org = { "x-dev-user": "drop-org" };
  const start = new Date(Date.now() + 3 * 3_600_000); // a game three hours from now (UTC)
  const hhmm = `${String(start.getUTCHours()).padStart(2, "0")}:${String(start.getUTCMinutes()).padStart(2, "0")}`;
  const { slug } = (await app.inject({
    method: "POST", url: "/groups", headers: org,
    payload: { name: "Drop Test", weekdays: [start.getUTCDay()], startTime: hhmm, timezone: "UTC", cap: 2 },
  })).json().group;
  const join = async (name: string) => (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name } })).json();
  const [a, b, c] = [await join("Ana"), await join("Ben"), await join("Cy")];
  const rsvp = (m: { token: string }, status: "in" | "out") =>
    app.inject({ method: "PUT", url: `/groups/${slug}/rsvp`, headers: { "x-member-token": m.token }, payload: { status } });
  await rsvp(a, "in");
  await rsvp(b, "in");
  // Cy hasn't answered but has reminders on.
  await app.inject({ method: "PUT", url: `/groups/${slug}/me/push`, headers: { "x-member-token": c.token }, payload: { endpoint: "https://push.example.com/cy", keys: { p256dh: "k", auth: "a" } } });

  await rsvp(a, "out"); // full game, no waitlist, 3h to go
  let page = (await app.inject({ url: `/groups/${slug}`, headers: org })).json() as GroupPage;
  assert.deepEqual(page.organizer?.lateDrops, [a.member.id]);
  const sent = async () => (await db.query(`SELECT count(*)::int AS n FROM notifications_sent WHERE member_id = $1 AND kind = 'spotOpened'`, [c.member.id]))[0]!.n;
  assert.equal(await sent(), 1);

  // Ben drops too: Cy isn't nudged twice for the same game. Rejoining clears Ana's late-drop flag.
  await rsvp(b, "out");
  assert.equal(await sent(), 1);
  await rsvp(a, "in");
  page = (await app.inject({ url: `/groups/${slug}`, headers: org })).json() as GroupPage;
  assert.deepEqual(page.organizer?.lateDrops, [b.member.id]);
  // Late drops are organizer-only.
  assert.equal(((await app.inject({ url: `/groups/${slug}` })).json() as GroupPage).organizer, undefined);
});

test("identity: duplicate names ask first, restore links, organizer merge", async () => {
  const org = { "x-dev-user": "id-org" };
  const { slug } = (await app.inject({ method: "POST", url: "/groups", headers: org, payload: { name: "ID Hoops", weekdays: [3], startTime: "19:00", timezone: "UTC", cap: 10 } })).json().group;
  const john = (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name: "John" } })).json();
  await app.inject({ method: "PUT", url: `/groups/${slug}/rsvp`, headers: { "x-member-token": john.token }, payload: { status: "in" } });

  // A second "john" is asked first; confirming creates a separate member.
  let res = await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name: " john " } });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().existing.id, john.member.id);
  const john2 = (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name: "John", confirmNew: true } })).json();
  assert.notEqual(john2.member.id, john.member.id);

  // Without a reminder email there's nothing to send a restore link to.
  assert.deepEqual((await app.inject({ method: "POST", url: `/groups/${slug}/members/${john.member.id}/restore` })).json(), { sent: false });

  // A restore link gives a new device token for the same member, once.
  const { hashToken } = await import("./ids.ts");
  await db.query(`INSERT INTO member_restores (token_hash, member_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')`, [hashToken("restore-token-123"), john.member.id]);
  const restored = (await app.inject({ method: "POST", url: "/restore", payload: { token: "restore-token-123" } })).json();
  assert.deepEqual([restored.slug, restored.member.id], [slug, john.member.id]);
  const me = (await app.inject({ url: `/groups/${slug}/me`, headers: { "x-member-token": restored.token } })).json();
  assert.equal(me.member.id, john.member.id); // new phone, same John
  assert.equal((await app.inject({ method: "POST", url: "/restore", payload: { token: "restore-token-123" } })).statusCode, 404);

  // Organizer merges the duplicate into the original: its device keeps working as John.
  let members = (await app.inject({ url: `/groups/${slug}/members`, headers: org })).json().members;
  assert.equal(members.length, 2);
  res = await app.inject({ method: "POST", url: `/groups/${slug}/members/${john2.member.id}/merge`, headers: org, payload: { intoId: john.member.id } });
  assert.equal(res.statusCode, 200);
  members = (await app.inject({ url: `/groups/${slug}/members`, headers: org })).json().members;
  assert.deepEqual(members.map((m: { id: string; devices: number }) => [m.id, m.devices]), [[john.member.id, 3]]);
  const viaOld = (await app.inject({ url: `/groups/${slug}/me`, headers: { "x-member-token": john2.token } })).json();
  assert.equal(viaOld.member.id, john.member.id);
  assert.equal((await app.inject({ method: "POST", url: `/groups/${slug}/members/${john.member.id}/merge`, headers: { "x-dev-user": "stranger" }, payload: { intoId: john.member.id } })).statusCode, 403);
});

test("optional cost: per player or a split total, with how to pay", async () => {
  const org = { "x-dev-user": "fee-org" };
  const created = (await app.inject({
    method: "POST", url: "/groups", headers: org,
    payload: { name: "Fee Hoops", weekdays: [3], startTime: "19:00", timezone: "UTC", cap: 10, feeCents: 12000, feeSplit: true, payNote: "e-Transfer to sam@example.com" },
  })).json().group;
  assert.equal(created.feeCents, 12000);
  assert.equal(created.feeSplit, true);
  assert.equal(created.payNote, "e-Transfer to sam@example.com");

  const res = await app.inject({ method: "PATCH", url: `/groups/${created.slug}`, headers: org, payload: { feeCents: null, payNote: null } });
  assert.equal(res.statusCode, 200);
  const page = (await app.inject({ url: `/groups/${created.slug}` })).json();
  assert.equal(page.group.feeCents, null);
  assert.equal(page.group.payNote, null);

  const plain = (await app.inject({ method: "POST", url: "/groups", headers: org, payload: { name: "Free", weekdays: [1], startTime: "18:00", timezone: "UTC", cap: null } })).json().group;
  assert.equal(plain.feeCents, null);
  assert.equal(plain.feeSplit, false);
});

test("co-organizers: invite, admin powers, owner-only actions, handover", async () => {
  const owner = { "x-dev-user": "co-owner" };
  const mike = { "x-dev-user": "co-mike" };
  const stranger = { "x-dev-user": "co-stranger" };
  const { slug } = (await app.inject({ method: "POST", url: "/groups", headers: owner, payload: { name: "Co Hoops", weekdays: [2], startTime: "19:00", timezone: "UTC", cap: 10 } })).json().group;

  assert.equal((await app.inject({ method: "POST", url: `/groups/${slug}/remind`, headers: mike, payload: {} })).statusCode, 403);

  const { url } = (await app.inject({ method: "POST", url: `/groups/${slug}/organizers/invite`, headers: owner, payload: {} })).json();
  const token = new URL(url).searchParams.get("t")!;
  assert.equal((await app.inject({ url: `/organizer-invites/${token}` })).json().groupName, "Co Hoops");
  assert.equal((await app.inject({ method: "POST", url: "/organizer-invites/accept", headers: mike, payload: { token } })).json().slug, slug);
  // One use only.
  assert.equal((await app.inject({ method: "POST", url: "/organizer-invites/accept", headers: stranger, payload: { token } })).statusCode, 404);

  // Mike can run the group: see it on his dashboard, get organizer controls, cancel a week.
  const dash = (await app.inject({ url: "/me/dashboard", headers: mike })).json();
  assert.equal(dash.groups.find((g: { group: { slug: string } }) => g.group.slug === slug).role, "admin");
  assert.equal((await app.inject({ url: `/groups/${slug}`, headers: mike })).json().viewer.role, "admin");
  assert.equal((await app.inject({ method: "PUT", url: `/groups/${slug}/session/cancelled`, headers: mike, payload: { cancelled: true } })).statusCode, 200);
  // But not invite others or take over.
  assert.equal((await app.inject({ method: "POST", url: `/groups/${slug}/organizers/invite`, headers: mike, payload: {} })).statusCode, 403);

  const list = (await app.inject({ url: `/groups/${slug}/organizers`, headers: owner })).json();
  assert.deepEqual(list.organizers.map((o: { role: string }) => o.role), ["owner", "admin"]);
  const mikeId = list.organizers.find((o: { role: string }) => o.role === "admin").id;
  const ownerId = list.organizers.find((o: { role: string }) => o.role === "owner").id;

  // Hand over: Mike owns it, the old owner stays as an admin.
  const handed = (await app.inject({ method: "PUT", url: `/groups/${slug}/owner`, headers: owner, payload: { organizerId: mikeId } })).json();
  assert.equal(handed.role, "admin");
  assert.equal((await app.inject({ url: `/groups/${slug}`, headers: mike })).json().viewer.role, "owner");
  // The owner can't leave without handing over; an admin can leave.
  assert.equal((await app.inject({ method: "DELETE", url: `/groups/${slug}/organizers/${mikeId}`, headers: mike })).statusCode, 400);
  assert.equal((await app.inject({ method: "DELETE", url: `/groups/${slug}/organizers/${ownerId}`, headers: owner })).statusCode, 200);
  assert.equal((await app.inject({ url: `/groups/${slug}`, headers: owner })).json().viewer.isOrganizer, false);
});

test("insights: reliability from past games and who to invite when short", async () => {
  const org = { "x-dev-user": "ins-org" };
  const { slug, id } = (await app.inject({ method: "POST", url: "/groups", headers: org, payload: { name: "Ins Hoops", weekdays: [2], startTime: "19:00", timezone: "UTC", cap: 3 } })).json().group;
  const join = async (name: string) => (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name } })).json().member.id as string;
  const mike = await join("Mike");
  const raj = await join("Raj");
  await db.query(`UPDATE members SET created_at = now() - interval '60 days' WHERE group_id = $1`, [id]);

  // Two past games: both played, Raj dropped late in the second.
  for (const [weeksAgo, rajStatus, late] of [[2, "in", false], [1, "out", true]] as const) {
    const [s] = await db.query<{ id: string }>(`INSERT INTO sessions (group_id, starts_at) VALUES ($1, now() - interval '${weeksAgo} weeks') RETURNING id`, [id]);
    await db.query(`INSERT INTO rsvps (session_id, member_id, status, responded_at) VALUES ($1, $2, 'in', now() - interval '${weeksAgo} weeks' - interval '1 day')`, [s!.id, mike]);
    await db.query(`INSERT INTO rsvps (session_id, member_id, status, responded_at, late_drop) VALUES ($1, $2, $3, now() - interval '${weeksAgo} weeks' - interval '1 hour', $4)`, [s!.id, raj, rajStatus, late]);
  }

  const insights = (await app.inject({ url: `/groups/${slug}/insights`, headers: org })).json();
  assert.equal(insights.health.games, 2);
  const m = insights.players.find((p: { name: string }) => p.name === "Mike");
  assert.deepEqual([m.played, m.games, m.lateDrops], [2, 2, 0]);
  assert.equal(insights.players.find((p: { name: string }) => p.name === "Raj").lateDrops, 1);
  assert.deepEqual(insights.invite.map((i: { name: string }) => i.name), ["Mike", "Raj"]);

  const dash = (await app.inject({ url: "/me/dashboard", headers: org })).json();
  assert.equal(dash.groups[0].suggestions.invite[0].name, "Mike");
  assert.equal((await app.inject({ url: `/groups/${slug}/insights`, headers: { "x-dev-user": "someone" } })).statusCode, 403);
});

test("events, game history, metrics and the autopilot heads-up", async () => {
  const org = { "x-dev-user": "hist-org" };
  const { slug, id } = (await app.inject({ method: "POST", url: "/groups", headers: org, payload: { name: "Hist Hoops", weekdays: [2], startTime: "19:00", timezone: "UTC", cap: 4, feeCents: 1000 } })).json().group;
  const join = async (name: string) => (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name } })).json() as { member: { id: string }; token: string };
  const players = await Promise.all(["Ann", "Bo", "Cy", "Di", "Ed"].map(join));
  await db.query(`UPDATE members SET created_at = now() - interval '60 days' WHERE group_id = $1`, [id]);

  // This week: one in, one out → events recorded.
  await app.inject({ method: "PUT", url: `/groups/${slug}/rsvp`, headers: { "x-member-token": players[0]!.token }, payload: { status: "in" } });
  await app.inject({ method: "PUT", url: `/groups/${slug}/rsvp`, headers: { "x-member-token": players[1]!.token }, payload: { status: "out" } });
  assert.equal((await app.inject({ method: "POST", url: "/events", payload: { kind: "link_shared", slug, props: { via: "whatsapp" } } })).statusCode, 204);
  assert.equal((await app.inject({ method: "POST", url: "/events", payload: { kind: "made_up" } })).statusCode, 400);
  const kinds = (await db.query<{ kind: string }>(`SELECT kind FROM events WHERE group_id = $1 ORDER BY id`, [id])).map((e) => e.kind);
  assert.deepEqual(kinds, ["group_created", "player_joined", "player_joined", "player_joined", "player_joined", "player_joined", "rsvp_in", "rsvp_out", "link_shared"]);

  // Three past games: everyone but Ed plays; one paid; one cancelled week.
  for (const w of [1, 2, 3, 4]) {
    const [s] = await db.query<{ id: string }>(`INSERT INTO sessions (group_id, starts_at, cancelled) VALUES ($1, now() - interval '${w} weeks', $2) RETURNING id`, [id, w === 4]);
    for (const [i, p] of players.slice(0, 4).entries()) {
      await db.query(`INSERT INTO rsvps (session_id, member_id, status, responded_at, paid_at) VALUES ($1, $2, 'in', now() - interval '${w} weeks' - interval '1 day', $3)`, [s!.id, p.member.id, i === 0 ? new Date().toISOString() : null]);
    }
  }
  const games = (await app.inject({ url: `/groups/${slug}/history`, headers: org })).json().games;
  assert.equal(games.length, 4);
  assert.deepEqual([games[0].played, games[0].paid, games[0].collectedCents, games[0].expectedCents], [4, 1, 1000, 4000]);
  assert.equal(games[3].cancelled, true);
  assert.equal((await app.inject({ url: `/groups/${slug}/history`, headers: { "x-dev-user": "nosy" } })).statusCode, 403);

  // Metrics: admins only.
  assert.equal((await app.inject({ url: "/admin/metrics", headers: org })).statusCode, 404);
  process.env.ADMIN_EMAILS = "boss@example.com";
  await db.query(`UPDATE organizers SET email = 'boss@example.com' WHERE external_id = 'dev:hist-org'`);
  const metrics = (await app.inject({ url: "/admin/metrics", headers: org })).json();
  assert.ok(metrics.northStar.gamesRun >= 3);
  assert.ok(metrics.events.rsvp_in >= 1);
  assert.equal((await app.inject({ url: "/me/dashboard", headers: org })).json().organizer.isAdmin, true);

  // Autopilot: 1 of 4 in with the game 10 hours away → organizers get one heads-up.
  const { runForecastAlerts } = await import("./autopilot.ts");
  const [cur] = await db.query<{ starts_at: Date }>(`SELECT starts_at FROM sessions WHERE group_id = $1 ORDER BY starts_at DESC LIMIT 1`, [id]);
  const tenHoursBefore = new Date(new Date(cur!.starts_at).getTime() - 10 * 3_600_000);
  const first = await runForecastAlerts(db, tenHoursBefore);
  assert.ok(first.alerted >= 1);
  assert.equal((await runForecastAlerts(db, tenHoursBefore)).alerted, 0); // once per game
  const page = (await app.inject({ url: `/groups/${slug}`, headers: org })).json();
  assert.ok(page.organizer.forecast);
  delete process.env.ADMIN_EMAILS;
});

test("pricing test: asked after 3 games, answer recorded once, shown to admins", async () => {
  const org = { "x-dev-user": "price-org" };
  const { slug, id } = (await app.inject({ method: "POST", url: "/groups", headers: org, payload: { name: "Price Hoops", weekdays: [2], startTime: "19:00", timezone: "UTC", cap: 8 } })).json().group;
  assert.equal((await app.inject({ url: "/me/dashboard", headers: org })).json().organizer.askPricing, false);
  const a = (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name: "A" } })).json().member.id;
  const b = (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name: "B" } })).json().member.id;
  for (const w of [1, 2, 3]) {
    const [s] = await db.query<{ id: string }>(`INSERT INTO sessions (group_id, starts_at) VALUES ($1, now() - interval '${w} weeks') RETURNING id`, [id]);
    for (const m of [a, b]) await db.query(`INSERT INTO rsvps (session_id, member_id, status) VALUES ($1, $2, 'in')`, [s!.id, m]);
  }
  assert.equal((await app.inject({ url: "/me/dashboard", headers: org })).json().organizer.askPricing, true);
  assert.equal((await app.inject({ method: "POST", url: "/me/pricing", headers: org, payload: { answer: "sure" } })).statusCode, 400);
  assert.equal((await app.inject({ method: "POST", url: "/me/pricing", headers: org, payload: { answer: "yes", reason: "Saves me an hour a week", source: "dashboard" } })).statusCode, 200);
  assert.equal((await app.inject({ url: "/me/dashboard", headers: org })).json().organizer.askPricing, false);

  process.env.ADMIN_EMAILS = "price@example.com";
  await db.query(`UPDATE organizers SET email = 'price@example.com' WHERE external_id = 'dev:price-org'`);
  const metrics = (await app.inject({ url: "/admin/metrics", headers: org })).json();
  assert.equal(metrics.pricing[0].answer, "yes");
  assert.equal(metrics.pricing[0].reason, "Saves me an hour a week");
  delete process.env.ADMIN_EMAILS;
});

test("season groups: upfront fee split between members, season payments, subs, target players", async () => {
  const org = { "x-dev-user": "season-org" };
  const created = (await app.inject({
    method: "POST", url: "/groups", headers: org,
    payload: { name: "Fall Volleyball", weekdays: [1], startTime: "19:30", timezone: "UTC", cap: null, targetPlayers: 12, seasonFeeCents: 250000, feeCents: 1000, payNote: "e-Transfer to org@example.com",
      reminders: { dayBefore: true, hoursBefore: 2, first: "24h", nudgeAgain: true } },
  })).json().group;
  assert.equal(created.seasonFeeCents, 250000);
  assert.equal(created.targetPlayers, 12);
  assert.equal(created.reminders.first, "24h");
  const slug = created.slug;
  const join = async (name: string) => (await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name } })).json() as { member: { id: string }; token: string };
  const [a, b, sub] = [await join("Ann"), await join("Bo"), await join("Sub Sam")];

  // Two season members → $1,250 each; Ann has paid.
  await app.inject({ method: "PUT", url: `/groups/${slug}/members/${a.member.id}/season`, headers: org, payload: { member: true } });
  const page = (await app.inject({ method: "PUT", url: `/groups/${slug}/members/${b.member.id}/season`, headers: org, payload: { member: true } })).json();
  assert.deepEqual(page.season.memberIds.sort(), [a.member.id, b.member.id].sort());
  assert.equal(page.season.shareCents, 125000);
  await app.inject({ method: "PUT", url: `/groups/${slug}/members/${a.member.id}/season`, headers: org, payload: { paid: true } });
  const orgPage = (await app.inject({ url: `/groups/${slug}`, headers: org })).json();
  assert.deepEqual(orgPage.organizer.seasonPaid, [a.member.id]);
  // Players see their own status; subs aren't season members.
  assert.deepEqual((await app.inject({ url: `/groups/${slug}/me`, headers: { "x-member-token": a.token } })).json().season, { member: true, paid: true });
  assert.deepEqual((await app.inject({ url: `/groups/${slug}/me`, headers: { "x-member-token": sub.token } })).json().season, { member: false, paid: false });
  // Remind unpaid: Bo.
  const remind = (await app.inject({ method: "POST", url: `/groups/${slug}/season/remind`, headers: org, payload: {} })).json();
  assert.equal(remind.unpaid, 1);
  assert.match(remind.message, /\$1,250 each.*Still to pay: Bo/);
  // Without a cap, "need N more" counts toward the target.
  await app.inject({ method: "PUT", url: `/groups/${slug}/rsvp`, headers: { "x-member-token": a.token }, payload: { status: "in" } });
  const dash = (await app.inject({ url: "/me/dashboard", headers: org })).json();
  assert.equal(dash.groups.find((g: { group: { slug: string } }) => g.group.slug === slug).spotsLeft, 11);
});

test("organizer adds players up front; players claim their name on their phone", async () => {
  const org = { "x-dev-user": "roster-org" };
  const { slug } = (await app.inject({ method: "POST", url: "/groups", headers: org, payload: { name: "Roster Volley", weekdays: [3], startTime: "20:00", timezone: "UTC", cap: null, targetPlayers: 12, seasonFeeCents: 250000 } })).json().group;
  const added = (await app.inject({ method: "POST", url: `/groups/${slug}/members/add`, headers: org, payload: { players: [{ name: "Ann", email: "ann@example.com" }, { name: "Bo" }] } })).json();
  assert.deepEqual(added, { added: ["Ann", "Bo"], skipped: [] });
  assert.deepEqual((await app.inject({ method: "POST", url: `/groups/${slug}/members/add`, headers: org, payload: { players: [{ name: "bo" }] } })).json().skipped, ["bo"]);
  assert.equal((await app.inject({ method: "POST", url: `/groups/${slug}/members/add`, headers: { "x-dev-user": "nosy" }, payload: { players: [{ name: "X" }] } })).statusCode, 403);

  // Added players are season members, show up as unclaimed, and Ann already has email reminders.
  const page = (await app.inject({ url: `/groups/${slug}` })).json();
  assert.deepEqual(page.unclaimed.map((m: { name: string }) => m.name), ["Ann", "Bo"]);
  assert.equal(page.season.memberIds.length, 2);
  assert.equal(page.season.shareCents, 125000);
  const bo = page.unclaimed.find((m: { name: string }) => m.name === "Bo");

  // Bo taps his name: his phone becomes Bo, he can answer, and he's no longer claimable.
  const claimed = (await app.inject({ method: "POST", url: `/groups/${slug}/members/${bo.id}/claim`, payload: {} })).json();
  assert.equal(claimed.member.name, "Bo");
  assert.equal((await app.inject({ method: "PUT", url: `/groups/${slug}/rsvp`, headers: { "x-member-token": claimed.token }, payload: { status: "in" } })).statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url: `/groups/${slug}/members/${bo.id}/claim`, payload: {} })).statusCode, 409);
  assert.deepEqual((await app.inject({ url: `/groups/${slug}` })).json().unclaimed.map((m: { name: string }) => m.name), ["Ann"]);

  // Typing "Ann" offers the claim instead of a duplicate.
  const typed = await app.inject({ method: "POST", url: `/groups/${slug}/members`, payload: { name: "ann" } });
  assert.equal(typed.statusCode, 409);
  assert.equal(typed.json().existing.claimable, true);
  assert.equal(typed.json().existing.hasEmail, true);
});
