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
  const { otpEmailHtml, otpEmailText } = await import("./authEvents.ts");
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
