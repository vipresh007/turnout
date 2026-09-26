import { Platform } from "react-native";

/** Browser push needs a service worker and the Push API; iPhone also needs the app on the Home Screen. */
export function pushSupport(): "supported" | "ios-needs-home-screen" | "unsupported" {
  if (Platform.OS !== "web" || typeof window === "undefined") return "unsupported";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "ios-needs-home-screen";
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window ? "supported" : "unsupported";
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Asks permission and subscribes this browser. Throws with a message people can act on. */
export async function subscribeBrowser(publicKey: string): Promise<PushSubscriptionJSON> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow them for this site in your browser settings.");
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const sub = existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
  return sub.toJSON();
}

export async function unsubscribeBrowser(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  await (await registration?.pushManager.getSubscription())?.unsubscribe();
}

/** True if this browser already has a live subscription (the server may still have an old one). */
export async function browserSubscribed(): Promise<boolean> {
  if (pushSupport() !== "supported") return false;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  return !!(await registration?.pushManager.getSubscription()) && Notification.permission === "granted";
}
