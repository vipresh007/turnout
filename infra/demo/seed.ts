// Demo data for one organizer on the test database. Re-running replaces the previous demo groups.
// Run with ./infra/seed-demo.sh <email>. Paths are inside the API image.
import { createDb } from "/app/apps/api/src/db/client.ts";
import { randomSlug } from "/app/apps/api/src/ids.ts";
import { atLocal, localDate, scheduledStarts } from "/app/apps/api/src/schedule.ts";

const EMAIL = process.env.SEED_EMAIL!;
const db = await createDb();
const [org] = await db.query<{ id: string }>(`SELECT id FROM organizers WHERE lower(email) = lower($1) ORDER BY created_at LIMIT 1`, [EMAIL]);
if (!org) throw new Error("No organizer with that email has signed in to test yet");
const removed = await db.query(`DELETE FROM groups WHERE organizer_id = $1 AND name LIKE '% (demo)' RETURNING id`, [org.id]);
console.log(`removed ${removed.length} old demo groups`);

let s = 42;
const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface Spec {
  name: string; activity: string; location: string; weekdays: number[]; startTime: string; cap: number;
  feeCents: number; feeSplit: boolean; payNote: string; players: [string, number][]; pastWeeks: number;
  cancelledWeek?: number; lateWeeks?: number[]; lateTime?: string; thisWeekIn: number; thisWeekOut: number;
}

async function seed(spec: Spec) {
  const tz = "America/Toronto";
  const startsOn = new Date(Date.now() - (spec.pastWeeks + 2) * 7 * DAY).toISOString().slice(0, 10);
  const slug = randomSlug();
  const [g] = await db.query<{ id: string }>(
    `INSERT INTO groups (slug, organizer_id, name, activity, location, weekday, weekdays, interval_weeks, starts_on, start_time, duration_minutes, timezone, cap, reminders, fee_cents, fee_split, pay_note, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, 90, $10, $11, $12, $13, $14, $15, $16) RETURNING id`,
    [slug, org!.id, spec.name, spec.activity, spec.location, spec.weekdays[0], spec.weekdays, startsOn, spec.startTime, tz, spec.cap,
     JSON.stringify({ dayBefore: true, hoursBefore: 2 }), spec.feeCents, spec.feeSplit, spec.payNote, new Date(Date.now() - (spec.pastWeeks + 2) * 7 * DAY).toISOString()],
  );
  const group = { weekdays: spec.weekdays, intervalWeeks: 1, startsOn, endsOn: null, startTime: spec.startTime, timezone: tz };
  const now = Date.now();
  const starts = scheduledStarts(group, new Date(now - (spec.pastWeeks + 1) * 7 * DAY), spec.pastWeeks + 3).filter((d) => d.getTime() < now + 7 * DAY);
  const past = starts.filter((d) => d.getTime() < now).slice(-spec.pastWeeks);
  const next = starts.find((d) => d.getTime() >= now)!;

  const members: { id: string; name: string; reliability: number }[] = [];
  for (const [i, [name, reliability]] of spec.players.entries()) {
    const joinedDaysAgo = i >= spec.players.length - 2 ? 20 : (spec.pastWeeks + 2) * 7;
    const [m] = await db.query<{ id: string }>(`INSERT INTO members (group_id, name, created_at) VALUES ($1, $2, $3) RETURNING id`, [g!.id, name, new Date(now - joinedDaysAgo * DAY).toISOString()]);
    members.push({ id: m!.id, name, reliability });
  }
  const joined = (i: number) => (i >= spec.players.length - 2 ? now - 20 * DAY : 0);

  for (const [w, scheduled] of past.entries()) {
    const weeksAgo = past.length - w;
    const cancelled = weeksAgo === spec.cancelledWeek;
    const late = spec.lateWeeks?.includes(weeksAgo) && spec.lateTime;
    const actual = late ? atLocal(localDate(scheduled, tz), spec.lateTime!, tz) : scheduled;
    const [session] = await db.query<{ id: string }>(
      `INSERT INTO sessions (group_id, starts_at, starts_at_override, cancelled, note) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [g!.id, scheduled.toISOString(), late ? actual.toISOString() : null, cancelled, cancelled ? "Gym closed for a tournament" : late ? "Later start this week" : null],
    );
    if (cancelled) continue;
    let ins = 0;
    for (const [i, m] of members.entries()) {
      if (joined(i) > actual.getTime()) continue;
      const r = rand();
      const penalty = late ? 0.65 : 1;
      if (r > m.reliability + 0.1 && rand() < 0.55) continue; // didn't answer
      const saysIn = r < m.reliability * penalty;
      const lateDrop = !saysIn && m.reliability > 0.5 && rand() < 0.35;
      const leadHours = lateDrop ? 1 + rand() * 10 : saysIn ? 4 + rand() * (ins < spec.cap ? 70 : 20) : 6 + rand() * 60;
      if (saysIn) ins++;
      await db.query(
        `INSERT INTO rsvps (session_id, member_id, status, responded_at, late_drop, paid_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [session!.id, m.id, saysIn ? "in" : "out", new Date(actual.getTime() - leadHours * HOUR).toISOString(), lateDrop,
         saysIn && rand() < 0.9 ? new Date(actual.getTime() + HOUR).toISOString() : null],
      );
    }
  }

  // This week: some in (a few already paid), a couple out, the rest haven't answered.
  const [cur] = await db.query<{ id: string }>(`INSERT INTO sessions (group_id, starts_at) VALUES ($1, $2) RETURNING id`, [g!.id, next.toISOString()]);
  const order = [...members].sort((a, b) => b.reliability - a.reliability);
  const inNow = [...order.slice(4, 4 + spec.thisWeekIn)];
  const outNow = order.slice(4 + spec.thisWeekIn, 4 + spec.thisWeekIn + spec.thisWeekOut);
  for (const [i, m] of inNow.entries()) {
    await db.query(`INSERT INTO rsvps (session_id, member_id, status, responded_at, paid_at) VALUES ($1, $2, 'in', $3, $4)`,
      [cur!.id, m.id, new Date(now - (30 - i * 2) * HOUR).toISOString(), i % 3 === 0 ? new Date(now - HOUR).toISOString() : null]);
  }
  for (const [i, m] of outNow.entries()) {
    await db.query(`INSERT INTO rsvps (session_id, member_id, status, responded_at) VALUES ($1, $2, 'out', $3)`, [cur!.id, m.id, new Date(now - (10 + i) * HOUR).toISOString()]);
  }
  console.log(`${spec.name}: /g/${slug} · ${members.length} players · ${past.length} past games`);
}

await seed({
  name: "Tuesday Basketball (demo)", activity: "basketball", location: "Riverside Community Centre", weekdays: [2], startTime: "19:30", cap: 12,
  feeCents: 15000, feeSplit: true, payNote: "e-Transfer to the organizer before tip-off",
  players: [["Mike", 0.95], ["Raj", 0.92], ["Sam", 0.88], ["John", 0.85], ["Priya", 0.82], ["Leo", 0.78], ["Ana", 0.75], ["Chris", 0.72], ["Dev", 0.7], ["Omar", 0.66],
    ["Tariq", 0.62], ["Jess", 0.58], ["Kevin", 0.55], ["Maya", 0.5], ["Luis", 0.42], ["Nina", 0.35], ["Ben", 0.3], ["Zoe", 0.6]],
  pastWeeks: 12, cancelledWeek: 7, lateWeeks: [3, 6, 10], lateTime: "21:00", thisWeekIn: 8, thisWeekOut: 2,
});
await seed({
  name: "Sunday Soccer (demo)", activity: "soccer", location: "Lakeshore Field 2", weekdays: [0], startTime: "10:00", cap: 16,
  feeCents: 800, feeSplit: false, payNote: "Cash or e-Transfer, $8 covers the field",
  players: [["Carlos", 0.95], ["Ahmed", 0.9], ["Tom", 0.88], ["Sofia", 0.86], ["Ivan", 0.84], ["Ravi", 0.82], ["Emma", 0.8], ["Diego", 0.78], ["Kwame", 0.76], ["Lena", 0.74],
    ["Arjun", 0.72], ["Marco", 0.7], ["Hana", 0.68], ["Pete", 0.66], ["Yusuf", 0.64], ["Grace", 0.6], ["Olu", 0.55], ["Sven", 0.5], ["Ali", 0.45], ["Rosa", 0.7]],
  pastWeeks: 10, thisWeekIn: 13, thisWeekOut: 1,
});
await db.close();
