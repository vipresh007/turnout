// Scheduled job (Azure Container Apps Job, every 15 minutes): send any reminders that are due, and autopilot heads-ups.
import { createDb } from "../db/client.ts";
import { runForecastAlerts } from "../autopilot.ts";
import { runReminders } from "../reminders.ts";

const db = await createDb();
try {
  const result = await runReminders(db);
  console.info(`[reminders] checked ${result.groups} groups, sent ${result.sent}`);
  const forecast = await runForecastAlerts(db);
  console.info(`[autopilot] checked ${forecast.checked} games, alerted ${forecast.alerted}`);
} finally {
  await db.close();
}
