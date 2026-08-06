/* Service Worker — Jhonny Perdomo App Pública
   Estrategia network-first (última versión con red) + shell de respaldo.
   Las actualizaciones las dispara version.js (limpia caches y recarga). */
/* El nombre de la caché lleva el prefijo de campaña: lo define marca.js
   y lo aplica storage-ns.js. Si no cargan, cae al prefijo 'jp' original. */
try { importScripts('./marca.js'); } catch (e) {}
try { importScripts('./storage-ns.js'); } catch (e) {}
const NS_SW = (self.STORAGE_NS || 'jp');
const CACHE_PREFIJO = NS_SW + '-pub-';
const JP_CACHE = CACHE_PREFIJO + 'v1';

const SHELL = ['./', './index.html', './style.css', './marca.js', './storage-ns.js', './marca-vivo.js', './app.js', './manifest.json'];

self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(JP_CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.indexOf(CACHE_PREFIJO) === 0 && k !== JP_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Módulo 7: el SDK de Firebase (gstatic) y el endpoint de FCM van SIEMPRE a la red.
  if (/script\.google\.com|qrserver\.com|googleapis\.com|cloudinary\.com|gstatic\.com|firebaseio\.com|firebase-messaging-sw\.js/.test(req.url)) return;
  e.respondWith(fetch(req).then((resp) => { const copy = resp.clone(); caches.open(JP_CACHE).then((c) => c.put(req, copy)).catch(() => {}); return resp; }).catch(() => caches.open(JP_CACHE).then((c) => c.match(req).then((r) => r || c.match('./index.html')))));
});
