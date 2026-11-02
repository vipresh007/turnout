// Sends a test push to every phone registered for one organizer, and prints what Expo says.
// Run with ./infra/push-test.sh <email> [test|live]. Paths are inside the API image.
import { createDb } from "/app/apps/api/src/db/client.ts";

const EMAIL = process.env.SEED_EMAIL!;
const db = await createDb();
const tokens = await db.query<{ token: string; platform: string | null; created: string }>(
  `SELECT t.token, t.platform, t.created_at::text AS created FROM organizer_push_tokens t JOIN organizers o ON o.id = t.organizer_id WHERE lower(o.email) = lower($1)`,
  [EMAIL],
);
console.log(`push tokens for ${EMAIL}: ${tokens.length}`);
for (const t of tokens) console.log(`  ${t.platform ?? "?"} registered ${t.created}`);
if (tokens.length) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(tokens.map((t) => ({ to: t.token, title: "Turnout test", body: "Push notifications are working on this phone.", sound: "default", data: { path: "/dashboard" } }))),
  });
  console.log("expo says:", JSON.stringify(await res.json()));
}
await db.close();
