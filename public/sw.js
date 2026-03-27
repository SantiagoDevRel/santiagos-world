const CACHE_NAME = 'santiagos-world-v2';
const MAX_CACHE_SIZE = 100;

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// Patterns that should never be cached
function shouldSkipCache(url) {
  const parsed = new URL(url);
  // Never cache API routes
  if (parsed.pathname.startsWith('/api/')) return true;
  // Never cache chrome-extension or non-http(s) schemes
  if (!parsed.protocol.startsWith('http')) return true;
  return false;
}

// Only cache static assets and pages (not external APIs, etc.)
function isCacheable(url) {
  const parsed = new URL(url);
  // Only cache same-origin resources
  if (parsed.origin !== self.location.origin) return false;
  return true;
}

async function trimCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxSize) {
    // Remove oldest entries (FIFO)
    const toDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (shouldSkipCache(event.request.url)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (isCacheable(event.request.url) && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
            trimCache(CACHE_NAME, MAX_CACHE_SIZE);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
