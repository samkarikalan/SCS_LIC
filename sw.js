const CACHE = 'scs-lic-v1';
const ASSETS = [
  '/SCS_LIC/',
  '/SCS_LIC/index.html',
  '/SCS_LIC/app.js',
  '/SCS_LIC/style.css',
  '/SCS_LIC/manifest.json',
  '/SCS_LIC/icon-192.png',
  '/SCS_LIC/icon-512.png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  // Network first for API calls, cache first for assets
  if (e.request.url.includes('workers.dev') || e.request.url.includes('supabase')) {
    return; // always network for API
  }
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request);
    })
  );
});
