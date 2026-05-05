/**
 * sw.js – Service Worker für Mülltonnen-Meldung 2.75 Pro
 * Strategie: Cache-First für App-Shell, Network-First für externe APIs
 */

const CACHE_NAME = 'tms-v2.78';

// App-Shell: diese Dateien werden beim Install sofort gecacht
const PRECACHE = [
  './',
  './index.html',
  './script.js',
  './styles.css'
];

// Diese Domains werden immer live abgerufen (kein Cache)
const NETWORK_ONLY = [
  'nominatim.openstreetmap.org',  // GPS-Reverse-Geocoding
  'fonts.googleapis.com',          // Google Fonts CSS
  'fonts.gstatic.com',             // Google Fonts Dateien
  'cdnjs.cloudflare.com',          // JSZip
  'cdn.jsdelivr.net'               // Tesseract.js
];

// ============================================================
//  INSTALL – App-Shell in Cache laden
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()) // Sofort aktivieren
  );
});

// ============================================================
//  ACTIVATE – Alte Caches aufräumen
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim()) // Sofort alle Tabs übernehmen
  );
});

// ============================================================
//  FETCH – Anfragen abfangen
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-Only für externe APIs (GPS, Fonts)
  if (NETWORK_ONLY.some(domain => url.hostname.includes(domain))) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Nur GET-Anfragen cachen
  if (event.request.method !== 'GET') return;

  // Cache-First: App-Shell aus Cache, Fallback auf Netzwerk
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) {
          // Im Hintergrund aktualisieren (Stale-While-Revalidate)
          const fetchPromise = fetch(event.request)
            .then(response => {
              if (response && response.status === 200 && response.type !== 'opaque') {
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
              }
              return response;
            })
            .catch(() => {});
          // Sofort gecachte Version zurückgeben
          return cached;
        }
        // Nicht im Cache: Netzwerk versuchen, bei Erfolg cachen
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200 || response.type === 'opaque') {
              return response;
            }
            const toCache = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
            return response;
          })
          .catch(() => {
            // Offline-Fallback für Navigation
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('Offline', { status: 503 });
          });
      })
  );
});