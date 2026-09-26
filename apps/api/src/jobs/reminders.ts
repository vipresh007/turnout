// Scheduled job (Azure Container Apps Job, every 15 minutes): send any reminders that are due.
import { createDb } from "../db/client.ts";
import { runReminders } from "../reminders.ts";

const db = await createDb();
try {
  const result = await runReminders(db);
  console.info(`[reminders] checked ${result.groups} groups, sent ${result.sent}`);
} finally {
  await db.close();
}
