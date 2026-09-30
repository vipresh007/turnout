import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Api } from "./api";
import { storage } from "./storage";

// Push notifications in the iOS/Android app: organizers (dropouts, autopilot heads-ups) and players who open
// their group in the app (game reminders). The website uses email and web push instead.

const TOKEN_KEY = "organizerPushToken";
export const pushAvailable = Platform.OS !== "web";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export async function pushPermission(): Promise<"granted" | "denied" | "undetermined"> {
  if (!pushAvailable) return "denied";
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/** Ask for permission (if needed) and get this phone's push token. Null when notifications aren't allowed. */
export async function devicePushToken(): Promise<string | null> {
  if (!pushAvailable) return null;
  const { granted } = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  if (!granted) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) throw new Error("Notifications aren't set up in this build yet.");
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

/** Register this phone for the signed-in organizer's pushes. */
export async function enablePush(api: Api): Promise<boolean> {
  const token = await devicePushToken();
  if (!token) return false;
  await api.setPushToken(token, Platform.OS === "ios" ? "ios" : "android");
  await storage.set(TOKEN_KEY, token);
  return true;
}

/** Stop pushes to this phone (on sign-out, or when turned off in Account). */
export async function disablePush(api: Api): Promise<void> {
  const token = await storage.get(TOKEN_KEY);
  if (!token) return;
  await api.removePushToken(token).catch(() => {});
  await storage.remove(TOKEN_KEY);
}

export const hasPushToken = async () => !!(await storage.get(TOKEN_KEY));
