// Service Worker for Proyecto AI PWA & Notifications
const CACHE_NAME = "proyecto-ai-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push notifications (when app is closed)
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "🔔 Recordatorio", body: event.data.text() };
    }
  }

  const entryId =
    data.entry_id ||
    (data.tag && data.tag.startsWith("entry-reminder-")
      ? data.tag.replace(/^entry-reminder-/, "")
      : null);

  const title = data.title || "🔔 Recordatorio de Proyecto AI";
  const tag = data.tag || "agenda-reminder";
  const options = {
    body: data.body || "Tienes un evento o tarea programada.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    sound: "default",
    vibrate: [200, 100, 200],
    tag: tag,
    renotify: true,
    data: {
      url: data.url || "/",
      entryId: entryId,
    },
  };

  const broadcastPromise = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        client.postMessage({
          type: "PUSH_DELIVERED",
          tag: tag,
          entryId: entryId,
        });
      }
    })
    .catch(() => {});

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      broadcastPromise,
    ]),
  );
});

// Handle clicking on a notification
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});

// Handle messages from the app frontend (show notification via SW registration)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, body, tag } = event.data;
    const options = {
      body: body || "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      sound: "default",
      vibrate: [200, 100, 200],
      tag: tag || "agenda-reminder",
      renotify: true,
    };
    self.registration.showNotification(title || "🔔 Recordatorio", options);
  }
});
