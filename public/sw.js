// Haven Ring service worker.
//
// Deliberately minimal. We do NOT cache any response bodies that could contain
// user content, and we never intercept /seal/* or API calls to Supabase.
// The only purpose of this SW is:
//   1. Make the PWA installable (needs a registered SW in some browsers).
//   2. Provide an offline fallback for the shell, so the user can still open
//      the input screen without network — moments simply can't be saved.

const SHELL_CACHE = "haven-shell-v21";
const NETWORK_TIMEOUT_MS = 12_000;
const SHELL_ASSETS = ["/"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => caches.open(SHELL_CACHE))
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => caches.open(SHELL_CACHE))
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined))
      .then(() => self.clients.claim())
  );
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
  // Never intercept auth / NFC entry — ring taps must not hang behind SW network-first.
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/seal/") ||
    url.pathname.startsWith("/start") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/app") ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/sw.js" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    return;
  }

  async function fetchWithTimeout(request) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
    try {
      return await fetch(request, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  // Network-first for other shell routes; time out so Safari does not spin forever.
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetchWithTimeout(req);
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
