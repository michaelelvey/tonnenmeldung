/**
 * sw.js – Service Worker für Tonnenmeldesystem (TMS)
 *
 * Versionsnummer wird automatisch aus der Registrierungs-URL gelesen.
 * → Nur APP_VERSION in script.js / js/config.js ändern – hier nichts anpassen!
 *
 * Strategie: Network-First für App-Dateien
 * → Fahrer laden beim Öffnen immer die neueste Version vom Server.
 * → Ist kein Internet vorhanden, springt die App auf den lokalen Cache.
 */

// Version aus URL-Parameter lesen (gesetzt beim register('sw.js?v=...'))
const APP_VERSION = new URL(self.location.href).searchParams.get('v') || '0';
const CACHE_NAME = 'tms-cache-' + APP_VERSION;

// App-Dateien, die gecacht werden (Offline-Fallback)
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './sw.js',
  // Modulare Version
  './js/config.js',
  './js/db.js',
  './js/utils.js',
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
      .then(() => self.skipWaiting())  // Sofort aktivieren, nicht auf Tab-Schließen warten
  );
});

// ============================================================
//  ACTIVATE – Alle alten Caches löschen
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('tms-cache-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // Alle offenen Tabs sofort übernehmen
  );
});

// ============================================================
//  FETCH – Network-First Strategie
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Externe Dienste immer live abrufen
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
        // Erfolgreiche Antwort in Cache speichern
        if (response && response.status === 200 && response.type !== 'opaque') {
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() => {
        // Kein Internet → Cache nutzen
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
