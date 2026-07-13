/* Service Worker — Jhonny Perdomo App Pública
   Estrategia network-first (última versión con red) + shell de respaldo.
   Las actualizaciones las dispara version.js (limpia caches y recarga). */
const JP_CACHE = 'jp-pub-v1';
const SHELL = ['./', './index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(JP_CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== JP_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (/script\.google\.com|qrserver\.com|googleapis\.com|cloudinary\.com/.test(req.url)) return;
  e.respondWith(fetch(req).then((resp) => { const copy = resp.clone(); caches.open(JP_CACHE).then((c) => c.put(req, copy)).catch(() => {}); return resp; }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))));
});
