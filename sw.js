const CACHE = 'scs-lic-v20261109-subscription';
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
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  const req = e.request;
  const url = new URL(req.url);

  // SCS worker/API must always be live network data.
  if (url.hostname.includes('workers.dev') || url.hostname.includes('supabase')) return;

  // Avoid an old installed PWA hiding new dashboard/app code.
  if (req.mode === 'navigate' || /\/(index\.html|app\.js|style\.css)$/.test(url.pathname)) {
    e.respondWith(fetch(req).then(function(res) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(function() { return caches.match(req); }));
    return;
  }

  e.respondWith(caches.match(req).then(function(cached) { return cached || fetch(req); }));
});
