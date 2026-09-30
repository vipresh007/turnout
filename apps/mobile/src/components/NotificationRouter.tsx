import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";

/** App only: tapping a push opens the screen it's about (the API sends `data.path`, e.g. "/g/abc123"). */
export function NotificationRouter() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const path = response?.notification.request.content.data?.path;
    if (typeof path === "string" && path.startsWith("/")) router.push(path as never);
  }, [response]);
  return null;
}
