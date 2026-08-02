// Deliberately minimal — this is a money-handling app, and a service worker
// that caches anything dynamic (API responses, account pages, HTML) risks
// showing a member or teller a stale balance, a stale "Pending" transaction
// that already confirmed, or a stale approval queue. This SW exists only to
// satisfy PWA installability and speed up STATIC, content-hashed assets
// (Next's /_next/static/* build output, the app icons) — nothing else is
// ever cached. Every navigation and every /api/* call always goes straight
// to the network, exactly as if no service worker were installed at all.

const STATIC_CACHE = "nexcgen-static-v1";
const PRECACHE_URLS = ["/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch API calls or same-origin navigations/pages — those must
  // always reflect the real, current server state.
  const isImmutableStaticAsset = url.pathname.startsWith("/_next/static/");
  const isPrecachedAsset = PRECACHE_URLS.includes(url.pathname);
  if (!isImmutableStaticAsset && !isPrecachedAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      });
    })
  );
});
