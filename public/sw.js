const SHELL_CACHE = "velora-ai-shell-v1";
const SHELL_FILES = ["/", "/manifest.webmanifest", "/pwa-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) =>
        key.startsWith("ai-assistant-shell-") ||
        (key.startsWith("velora-ai-shell-") && key !== SHELL_CACHE)
      )
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy));
        }
        return response;
      }).catch(async () => (await caches.match("/")) || Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fresh = fetch(request).then((response) => {
          if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        });
        return cached || fresh;
      }),
    );
  }
});
