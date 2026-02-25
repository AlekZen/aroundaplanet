/// <reference lib="webworker" />

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  clientsClaim: true,
  skipWaiting: true,
  precacheEntries: self.__SW_MANIFEST,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request }) => request.destination === "image",
      handler: new CacheFirst({
        cacheName: "images-cache",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 86400 * 7,
          }),
        ],
      }),
    },
    {
      matcher: ({ request }) =>
        ["script", "style", "font"].includes(request.destination),
      handler: new StaleWhileRevalidate({
        cacheName: "static-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 86400 * 30,
          }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();

// === FCM Background Message Handler (placeholder) ===
// Firebase Cloud Messaging will be configured in Story 6.1a
// onBackgroundMessage will be registered here
// IMPORTANT: Only use NEXT_PUBLIC_* variables in this file (compiled at build time)

// === Notification Click Handler (placeholder) ===
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  const data = event.notification.data as Record<string, string> | undefined;
  const urlToOpen = data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && "focus" in client) {
            return (client as WindowClient).focus();
          }
        }
        return self.clients.openWindow(urlToOpen);
      })
  );
});
