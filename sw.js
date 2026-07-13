/* Service Worker — Jhonny Perdomo App Pública
   👉 IMPORTANTE: sube SW_VERSION en CADA despliegue.
   Al cambiar este número, el archivo sw.js cambia y el navegador
   detecta el nuevo service worker, borra el caché viejo y actualiza la app.
   (Mantenlo igual al APP_VERSION de version.js). */
const SW_VERSION = '1.0.0';

const CACHE = 'jp-pub-' + SW_VERSION;
const SHELL = [
  './', './index.html', './style.css', './app.js', './version.js', './manifest.json'
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
    return;
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
