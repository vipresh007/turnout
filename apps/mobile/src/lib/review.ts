import type { OrganizerStats } from "@turnout/shared";
import * as StoreReview from "expo-store-review";
import { Platform } from "react-native";
import { storage } from "./storage";

// Asks organizers for an App Store rating at a good moment: once Turnout has run a few real games for them.
// Apple decides whether the prompt actually shows (at most three times a year); we ask at most every 4 months.

const KEY = "reviewAskedAt";
const GAP_MS = 120 * 86_400_000;

export async function maybeAskForReview(stats: OrganizerStats): Promise<void> {
  if (Platform.OS === "web") return;
  const gamesRun = stats.weeks.slice(0, -1).filter((w) => w.players >= 2).length; // past weeks with a real game
  if (gamesRun < 3) return;
  const last = Number((await storage.get(KEY)) ?? 0);
  if (Date.now() - last < GAP_MS) return;
  if (!(await StoreReview.isAvailableAsync())) return;
  await storage.set(KEY, String(Date.now()));
  // A short pause so the prompt doesn't land on top of the screen appearing.
  setTimeout(() => void StoreReview.requestReview().catch(() => {}), 2500);
}
