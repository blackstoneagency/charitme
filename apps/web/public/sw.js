// CharitMe service worker — enables PWA install + offline fallback.
//
// ⚠️ THE CACHE IS ALLOWLISTED, AND THAT IS A SECURITY BOUNDARY, NOT A PREFERENCE.
//
// v2 cached EVERY same-origin GET that was not `mode: 'navigate'`. Next's
// client-side navigations and prefetches are `mode: 'cors'`, so that rule
// swallowed the RSC payloads (`?_rsc=…`, `text/x-component`) for whole pages —
// measured: 102 cache entries after one browse of `/`, 80 of them RSC, the
// largest 45 KB of `/campaigns`.
//
// Every page on this site responds `Cache-Control: private, no-cache, no-store`
// and its `Vary` list does NOT include `Cookie`. The Cache API ignores
// Cache-Control, so those payloads were stored anyway, and two different
// sessions on one device produce the SAME cache key. Whoever loaded a route
// first won forever: a signed-in user's `/dashboard` payload could be served to
// the next person on that device, and nothing ever revalidated it. A poison test
// confirmed the serving half — a hand-edited cached `/campaigns` body rendered
// in the live DOM after restart, with no network revalidation.
//
// So: cache-first is reserved for CONTENT-HASHED, user-independent assets. HTML,
// RSC and anything marked `no-store`/`private` are never stored. Adding a new
// cache branch means proving the response cannot vary by user.
//
// The corollary — an offline cold launch shows /offline rather than a cached app
// shell — is deliberate. The shell is `private, no-store` and carries the signed-in
// header, so caching it to make offline nicer would reintroduce exactly the leak
// above. A worse offline experience is the correct trade.
//
// v3 (2026-08-09): allowlist + no-store guard (above). The bump also EVICTS the
// v2 caches, which is how already-poisoned installs get cleaned up on activate.
// v2 (2026-07-23): the sitewide logo was re-encoded 292KB -> 6.7KB (commit
// 175ec23) and the hero PNG -> WebP, but `/logo.png` and friends are NOT
// content-hashed, so the cache-first rule below kept serving the old heavy
// copies to every returning visitor. Bumping the version drops those caches.
// That class of bug is now handled without a hand-edit: unhashed assets are
// stale-while-revalidate, so they self-correct on the next visit.
const CACHE_VERSION = 'v3';
const CACHE_NAME = `charitme-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

/** Content-hashed by the build: safe to serve forever, identical for every user. */
function isImmutable(url) {
  return url.pathname.startsWith('/_next/static/');
}

/** Unhashed static files under /public. Safe to share, but they can change. */
function isRevalidatable(url) {
  return /\.(png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|mp4|webm)$/i.test(url.pathname);
}

/**
 * A response is storable only if the server did not forbid it. Cache-Control is
 * advisory to the Cache API — nothing enforces it but this check.
 */
function mayStore(response) {
  if (!response || !response.ok || response.type === 'opaque') return false;
  const cc = (response.headers.get('Cache-Control') || '').toLowerCase();
  if (cc.includes('no-store') || cc.includes('private')) return false;
  // RSC payloads are per-user page content, never an asset.
  const type = (response.headers.get('Content-Type') || '').toLowerCase();
  return !type.includes('text/x-component') && !type.includes('text/html');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all([
        cache.addAll(PRECACHE_URLS),
        // ⚠️ `credentials: 'omit'` is load-bearing. `cache.addAll` fetches with
        // same-origin credentials, and /offline renders the global header — which
        // shows the signed-in user's name. Precaching it with cookies would store
        // ONE user's header and serve it to everyone on the device, the same leak
        // the allowlist above closes. Omitting credentials pins the signed-out shell.
        fetch(new Request(OFFLINE_URL, { credentials: 'omit' }))
          .then((response) => (response.ok ? cache.put(OFFLINE_URL, response) : undefined))
          .catch(() => undefined),
      ]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ))
      // Refresh the offline shell on every activate, so a redeploy does not leave
      // it pointing at retired /_next/static chunks (it would render unstyled).
      .then(() => caches.open(CACHE_NAME).then((cache) => fetch(
        new Request(OFFLINE_URL, { credentials: 'omit' }),
      )
        .then((response) => (response.ok ? cache.put(OFFLINE_URL, response) : undefined))
        .catch(() => undefined)))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API calls — always hit the network so data stays fresh.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network-first, fall back to the cached offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then(
        (cached) => cached || new Response('', { status: 504, statusText: 'Offline' }),
      )),
    );
    return;
  }

  // Page content in any form — RSC navigation/prefetch payloads and HTML
  // sub-requests — goes to the network and is never stored. Checked before the
  // asset branches because `?_rsc=` can hang off any pathname.
  if (url.searchParams.has('_rsc') || request.destination === 'document') return;
  const accept = (request.headers.get('Accept') || '').toLowerCase();
  if (accept.includes('text/x-component')) return;

  if (isImmutable(url)) {
    // Content-hashed: a hit is always correct, so serve it and skip the network.
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (mayStore(response)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })),
    );
    return;
  }

  if (isRevalidatable(url)) {
    // Stale-while-revalidate: instant from cache, corrected in the background.
    // This is what makes a re-encoded logo fix itself without a version bump.
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (mayStore(response)) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached || new Response('', { status: 504, statusText: 'Offline' }));
        return cached || network;
      }),
    );
    return;
  }

  // Anything else: let the network handle it, uncached.
});

// ─── Push ────────────────────────────────────────────────────────────────────
//
// Delivered by lib/push-server.ts, which builds the payload from the SAME
// NotificationDraft as the in-app notification row, so the two cannot describe
// one event differently.
//
// ⚠️ `showNotification` is not optional. A browser that receives a push and
// shows nothing is treated as abusing the permission, and Chrome revokes push
// for the origin after repeated silent pushes. So every branch below — including
// a malformed payload — ends in a visible notification.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'CharitMe';
  const options = {
    body: payload.body || 'You have a new update.',
    icon: '/icons/icon-192.png',
    // Android shows this monochrome in the status bar.
    badge: '/icons/icon-192.png',
    // Collapses repeats: five gifts in a minute replace one another rather than
    // stacking five banners.
    tag: payload.tag || 'charitme',
    renotify: true,
    data: { url: payload.url || '/dashboard/notifications' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ⚠️ Focus an EXISTING tab rather than always opening a new one. Tapping three
// donation alerts should not leave three copies of the dashboard open.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // ⚠️ Same rule as lib/push-core.ts safeNotificationPath. The origin check
  // below is about WHICH WINDOW to focus; it does not constrain WHERE that
  // window is sent. Without this, an absolute url in the payload would navigate
  // a CharitMe window to another site from a CharitMe-branded notification.
  const raw = (event.notification.data && event.notification.data.url) || '/dashboard/notifications';
  const target = (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\'))
    ? raw
    : '/dashboard/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        // Same-origin check: `client.url` is whatever page is open, and
        // navigating a cross-origin window is neither possible nor desirable.
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
