/* Service Worker — Jhonny Perdomo App Pública */
importScripts('version.js');

const CACHE = 'jp-pub-' + (self.APP_VERSION || '1');
const SHELL = [
  './', './index.html', './style.css', './app.js', './version.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // no cachear POST (login, escrituras)
  const url = new URL(req.url);

  // Datos del backend y QR: siempre a la red (no cachear datos vivos)
  if (url.href.includes('/exec') || url.hostname.includes('qrserver') || url.hostname.includes('google.com')) {
    return; // deja pasar a la red normal
  }

  // App shell: cache-first con actualización en segundo plano
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.status === 200 && url.origin === location.origin) {
          const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
