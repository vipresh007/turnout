import { referralSource } from "@turnout/shared";
import { Platform } from "react-native";
import { trackEvent } from "./api";
import { storage } from "./storage";

// Where a new organizer came from: `?ref=<group>` on "Start your own group" links, or UTM tags on campaign links.
// First touch wins and stays on this device until their first group is created.

const KEY = "source";

/** On the web, read the landing URL once per page load and remember the first source we see. */
export async function captureSource(): Promise<void> {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const params = Object.fromEntries(new URLSearchParams(window.location.search).entries());
  const source = referralSource(params);
  if (!source) return;
  if (await storage.get(KEY)) return;
  await storage.set(KEY, source);
  trackEvent("landing_visit", undefined, { source });
}

export const readSource = () => storage.get(KEY);
export const clearSource = () => storage.remove(KEY);

/** Remember that the organizer has shared a link at least once (for the first-run checklist). */
export const markShared = () => storage.set("sharedOnce", "1");
export const hasShared = async () => (await storage.get("sharedOnce")) === "1";
