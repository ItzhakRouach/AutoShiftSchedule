// Minimal app-shell service worker for the מִשְׁמֶרֶת PWA.
// Network-first for navigations AND Next.js RSC payloads (so a freshly published
// schedule is never served stale), cache-first for content-hashed build assets,
// stale-while-revalidate for other static files. /api/* is never cached.
// Only OK responses are cached.
const VERSION = 'v4';
const SHELL_CACHE = `mishmeret-shell-${VERSION}`;
const PAGES_CACHE = `mishmeret-pages-${VERSION}`;
const RSC_CACHE = `mishmeret-rsc-${VERSION}`;
const STATIC_CACHE = `mishmeret-static-${VERSION}`;
const CACHES = [SHELL_CACHE, PAGES_CACHE, RSC_CACHE, STATIC_CACHE];
const APP_SHELL = ['/'];
// Offline copies of live data are a fallback only — keep them bounded.
const MAX_PAGES = 20;
const MAX_RSC = 60;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !CACHES.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Store a copy, then evict oldest entries beyond `max` (keys() is insertion-ordered).
function putBounded(cacheName, request, response, max) {
  return caches.open(cacheName).then((cache) =>
    cache
      .delete(request) // re-insert so a revisited URL counts as newest
      .then(() => cache.put(request, response))
      .then(() => cache.keys())
      .then((keys) => Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k))))
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API routes (schedule image, cron, auth callback) carry live or private
  // data and set their own cache headers — leave them to the network.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // Navigation requests: network-first; cache only successful, non-redirected
  // HTML (per URL) so we never persist auth redirects. Offline, serve the last
  // copy of that same page, else the precached app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            event.waitUntil(putBounded(PAGES_CACHE, request, response.clone(), MAX_PAGES));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Next.js App Router client-side navigations/prefetches are NOT mode:'navigate'
  // — they're `fetch('/path?_rsc=<hash>')` (mode:'cors'). These carry LIVE data
  // (schedules, dashboard, requests), so they must be network-first: cache-first
  // here served a pre-publish schedule in the installed phone PWA. The _rsc URL
  // is stable per build, so a cache-first entry would never self-invalidate.
  const isRSC =
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-Prefetch') === '1' ||
    url.searchParams.has('_rsc');
  if (isRSC) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            event.waitUntil(putBounded(RSC_CACHE, request, response.clone(), MAX_RSC));
          }
          return response;
        })
        .catch(() => caches.match(request)) // offline: fall back to last-seen
    );
    return;
  }

  // Content-hashed build assets never change: cache-first, store only OK.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)));
          }
          return response;
        });
      })
    );
    return;
  }

  // Other static files (icons, manifest, public images) keep stable URLs across
  // deploys: serve the cached copy at once and refresh it in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)));
        }
        return response;
      });
      if (!cached) return refresh;
      event.waitUntil(refresh.catch(() => undefined));
      return cached;
    })
  );
});

// --- Web Push: show incoming notifications and focus the app on click. ---
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'מִשְׁמֶרֶת';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'he',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(target) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
