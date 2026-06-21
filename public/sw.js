const CACHE_NAME = 'app-static-v1';
const API_CACHE = 'api-posts-v1';
const API_BASE = 'https://backend-x5i6.onrender.com';

const STATIC_ASSETS = ['/', '/index.html', '/favicon.svg'];

// ── Installation : mise en cache des assets statiques ──────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ── Activation : suppression des vieux caches ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// ── Fetch : stratégie selon le type de requête ─────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // GET /api/posts → NetworkFirst
  if (request.method === 'GET' && url.origin === API_BASE) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets statiques → CacheFirst
  if (request.method === 'GET') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // POST/PUT/DELETE → on laisse passer, géré par la queue Dexie
});

// ── Stratégies ─────────────────────────────────────────────────────────────

async function networkFirst(request) {
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return (
      cached ??
      new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}
