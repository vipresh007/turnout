// Turnout service worker: shows reminder notifications and opens the group page when tapped.
// "I'm in" / "I'm out" buttons open the page with ?rsvp=in|out, and the page applies it with the
// member token stored on this device (the worker itself never sees it).

self.addEventListener("push", (event) => {
  const m = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(m.title || "Turnout", {
      body: m.body || "",
      icon: "/icon.png",
      badge: "/icon.png",
      tag: m.url || "turnout",
      data: { url: m.url || "/" },
      actions: m.rsvpActions
        ? [
            { action: "in", title: "I'm in" },
            { action: "out", title: "I'm out" },
          ]
        : [],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const base = (event.notification.data && event.notification.data.url) || "/";
  const url = event.action ? `${base}?rsvp=${event.action}` : base;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(base) && "focus" in w) return w.navigate(url).then((c) => (c || w).focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});
