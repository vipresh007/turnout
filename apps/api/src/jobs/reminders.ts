// Scheduled job (Azure Container Apps Job, every 15 minutes): send any reminders that are due, and autopilot heads-ups.
import { createDb } from "../db/client.ts";
import { runForecastAlerts } from "../autopilot.ts";
import { runWeeklyDigest } from "../digest.ts";
import { runReminders } from "../reminders.ts";

const db = await createDb();
try {
  const result = await runReminders(db);
  console.info(`[reminders] checked ${result.groups} groups, sent ${result.sent}`);
  const forecast = await runForecastAlerts(db);
  console.info(`[autopilot] checked ${forecast.checked} games, alerted ${forecast.alerted}`);
  // The digest is a weekly email to real organizers; test shares their addresses, so it only goes out from live.
  if (process.env.TURNOUT_ENV !== "test") {
    const digest = await runWeeklyDigest(db);
    if (digest.sent) console.info(`[digest] sent ${digest.sent}`);
  }
} finally {
  await db.close();
}
