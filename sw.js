const CACHE_NAME = 'bloom-pwa-v24';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=23',
  './app.js?v=24',
  './manifest.webmanifest',
  './assets/pwa/bloom-icon-192.png',
  './assets/pwa/bloom-icon-512.png',
  './assets/pwa/apple-touch-icon.png',
  './assets/icons/footbath.png',
  './assets/icons/medicine.png',
  './assets/icons/meditation.png',
  './assets/icons/nutrition.png',
  './assets/icons/oral-care.png',
  './assets/icons/reading.png',
  './assets/icons/reminder.png',
  './assets/icons/sleep.png',
  './assets/icons/sprout.png',
  './assets/icons/study.png',
  './assets/icons/wake.png',
  './assets/icons/walk.png',
  './assets/icons/water.png',
  './assets/icons/weight.png',
  './assets/icons/workout.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => (
      cached || fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
    ))
  );
});
