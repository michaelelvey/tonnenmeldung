const CACHE_NAME = 'muelltonnen-pro-v2-6'; // Version erhöht auf v2-6, um das Update der Mail-Logik zu erzwingen
const ASSETS = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'
];

// Installation: Caches öffnen und Assets speichern
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Neuer Cache erstellt:', CACHE_NAME);
      return cache.addAll(ASSETS);
    })
  );
  // Zwingt den Service Worker, sofort aktiv zu werden
  self.skipWaiting();
});

// Aktivierung: Alte Caches löschen, um Speicherplatz zu sparen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Lösche veralteten Cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Nimmt sofort die Kontrolle über alle offenen Tabs über
  self.clients.claim();
});

// Fetch: Cache-First Strategie (schnelles Laden offline)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Wenn Datei im Cache ist, gib sie zurück, ansonsten versuche Netzwerk
      return response || fetch(event.request).catch(() => {
        // Fallback: Wenn offline und Datei nicht im Cache, zeige index.html
        return caches.match('/index.html');
      });
    })
  );
});
