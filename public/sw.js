// Haven Ring service worker.
//
// Deliberately minimal. We do NOT cache any response bodies that could contain
// user content, and we never intercept /seal/* or API calls to Supabase.
// The only purpose of this SW is:
//   1. Make the PWA installable (needs a registered SW in some browsers).
//   2. Provide an offline fallback for the shell, so the user can still open
//      the input screen without network — moments simply can't be saved.

const SHELL_CACHE = "haven-shell-v2";
const SHELL_ASSETS = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GETs. Never touch writes.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache or intercept:
  //   - the NFC seal route (must always hit the server)
  //   - any cross-origin request (Supabase, fonts, etc.)
  //   - the service worker file itself
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/seal/") ||
    url.pathname === "/sw.js" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    return;
  }

  // Network-first for the app shell, falling back to cache when offline.
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok && req.destination === "document") {
          const cache = await caches.open(SHELL_CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        return caches.match("/");
      }
    })()
  );
});
