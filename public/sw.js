/* No financial pages or API responses are cached by this worker. */
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
      data: { url: "/dashboard?add=expense" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
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
