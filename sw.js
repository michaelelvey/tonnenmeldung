/**
 * sw.js – Service Worker für Mülltonnen-Meldung (TMS)
 *
 * Strategie: Network-First für App-Dateien
 * → Fahrer laden beim Öffnen immer die neueste Version vom Server.
 * → Ist kein Internet vorhanden, springt die App auf den lokalen Cache.
 */

const CACHE_NAME = 'tms-cache-v1';

// App-Dateien, die gecacht werden (Offline-Fallback)
const PRECACHE = [
  './',
  './index.html',
  './script.js',
  './styles.css'
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
//  Neue Version auf dem Server → Fahrer bekommen sie sofort.
//  Kein Internet → App läuft aus dem Cache (offline-fähig).
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Externe APIs immer live abrufen
  if (NETWORK_ONLY.some(domain => url.hostname.includes(domain))) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // Nur GET cachen
  if (event.request.method !== 'GET') return;

  // Network-First: zuerst Server versuchen, bei Fehler Cache nutzen
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Gültige Antwort → in Cache speichern und zurückgeben
        if (response && response.status === 200 && response.type !== 'opaque') {
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() => {
        // Offline → aus Cache bedienen
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Navigations-Fallback auf index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
