/**
 * sw.js – Service Worker für Fahrermeldesystem (FMS)
 *
 * Strategie: Network-First für App-Dateien
 * → Fahrer laden beim Öffnen immer die neueste Version vom Server.
 * → Ist kein Internet vorhanden, springt die App auf den lokalen Cache.
 */

const CACHE_NAME = 'fms-cache-v1';

// App-Dateien, die gecacht werden (Offline-Fallback)
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './js/config.js',
  './js/utils.js',
  './js/db.js',
  './js/photo.js',
  './js/gps.js',
  './js/form.js',
  './js/history.js',
  './js/share.js',
  './js/export.js',
  './js/settings.js',
  './js/admin.js',
  './js/app.js',
];

// Diese Domains werden IMMER live abgerufen (niemals cachen)
const NETWORK_ONLY = [
  'nominatim.openstreetmap.org',  // GPS-Reverse-Geocoding
  'cdnjs.cloudflare.com'          // JSZip (extern)
];

// ============================================================
//  INSTALL – App-Shell in Cache laden
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ============================================================
//  ACTIVATE – Alte Caches löschen
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ============================================================
//  FETCH – Network-First Strategie
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (NETWORK_ONLY.some(domain => url.hostname.includes(domain))) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
