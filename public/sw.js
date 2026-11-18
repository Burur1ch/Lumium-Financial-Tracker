const OFFLINE_CACHE = "lumium-offline-v1";
let offline = !self.navigator.onLine;
async function prepareOfflinePage() {
  const cache = await caches.open(OFFLINE_CACHE);
  const response = await fetch("/offline", { cache: "reload" });
  if (!response.ok) throw new Error("Offline page unavailable");
  const html = await response.clone().text();
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'<>\s\\]+/g) || [])];
  await cache.addAll(assets);
  await cache.put("/offline", response);
}
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await prepareOfflinePage();
    await self.skipWaiting();
  })());
});
self.addEventListener("message", (event) => {
  if (event.data === "prepare-offline") event.waitUntil(prepareOfflinePage());
  if (event.data?.type === "network-status") offline = !event.data.online;
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("lumium-offline-") && key !== OFFLINE_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    const fallback = async () => await caches.match("/offline") || Response.error();
    event.respondWith(offline || !self.navigator.onLine ? fallback() : fetch(event.request, { cache: "no-store" }).catch(fallback));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});
self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data.json();
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Lumium", {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "lumium-reminder",
      renotify: false,
      actions: data.actions || [],
      data: { url: "/dashboard?add=expense", timezone: data.timezone || "Europe/Minsk" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      if (event.action === "done" || event.action === "snooze") {
        try {
          const response = await fetch("/api/reminders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: event.action, timezone: event.notification.data.timezone }),
          });
          if (response.ok) return;
        } catch { /* Open the app when the reminder action needs a connection. */ }
      }
      const target = new URL("/dashboard?add=expense", self.location.origin)
        .href;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (
          new URL(client.url).origin === self.location.origin &&
          "navigate" in client
        ) {
          await client.navigate(target);
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
