import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Api } from "./api";
import { storage } from "./storage";

// Push notifications for organizers in the iOS/Android app (dropouts, autopilot heads-ups). The website uses
// email for organizers and web push for players, so everything here is app-only.

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

/** Ask for permission (if needed), get this phone's push token and register it for the signed-in organizer. */
export async function enablePush(api: Api): Promise<boolean> {
  if (!pushAvailable) return false;
  const { granted } = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  if (!granted) return false;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) throw new Error("Notifications aren't set up in this build yet.");
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
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
