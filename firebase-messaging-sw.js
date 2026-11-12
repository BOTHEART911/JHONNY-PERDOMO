/* ============================================================
 * firebase-messaging-sw.js — Módulo 7 · App PÚBLICA
 * ------------------------------------------------------------
 * Service worker DEDICADO a los avisos push (va aparte de sw.js,
 * que sigue encargado del caché y la instalación de la PWA).
 *
 * 12/11/2026 · TOCAR EL AVISO
 *   · Con enlace  → se abre ESE enlace (no la app).
 *   · Sin enlace  → se abre la app en "Ponte al día" (#/noticias).
 *     Si la app ya está abierta (pestaña o instalada) se REUTILIZA:
 *     se enfoca y se le pide que vaya a Ponte al día (postMessage,
 *     porque este SW no controla las páginas y navigate() no sirve).
 *   Los avisos los muestra ESTE archivo (no el SDK): antes salían dos
 *   (el del SDK y el de onBackgroundMessage) y el SDK se quedaba con
 *   el toque. Los oyentes van ANTES de iniciar el SDK y cortan la
 *   propagación; si el push no se entiende, lo maneja el SDK como antes.
 *   Avisos viejos que ya están en la bandeja (data.FCM_MSG o data.notifId)
 *   también pasan por aquí.
 *   Compatible con el CORE viejo (sin data.enlace → Ponte al día).
 *
 * Ojo: este archivo NO puede usar imports de módulos ES; el SDK
 * se trae con importScripts (versión compat), igual que en la app.
 * ============================================================ */
/* FASE 0 · prefijo de campaña: sin él, la notificación de una campaña
   reemplaza la de la otra en el mismo dispositivo (mismo origen). */
try { importScripts('./js/marca.js'); } catch (e) {}
try { importScripts('./js/storage-ns.js'); } catch (e) {}
try { importScripts('./js/version.js'); } catch (e) {}   /* al publicar versión, este SW también se renueva */
const NS_FB = (self.STORAGE_NS || 'jp');
const JP_ICON = 'img/logo.png';
const BASE = new URL('./', self.location.href).href;          // .../JHONNY-PERDOMO/
const RUTA_APP = BASE + 'index.html?aviso=1#/noticias';   // ?aviso=1 = medición de apertura en frío (la app lo limpia)

/* Solo http/https (nada de javascript: ni data:) */
function enlaceOk(u) {
  u = String(u || '').trim();
  return /^https?:\/\/[^\s"'<>]+\.[^\s"'<>]+/i.test(u) ? u : '';
}
const esDeLaApp = (u) => String(u || '').toLowerCase().indexOf(BASE.toLowerCase()) === 0;

/* Lee el destino de cualquier aviso: nuevo (data.enlace), del SDK (FCM_MSG) o viejo */
function destinoDe(datos) {
  const nd = datos || {};
  const fcm = nd.FCM_MSG || null;
  const d = (fcm && fcm.data) || nd;
  let enlace = enlaceOk(d.enlace);
  if (!enlace && fcm && fcm.fcmOptions && fcm.fcmOptions.link && !esDeLaApp(fcm.fcmOptions.link)) enlace = enlaceOk(fcm.fcmOptions.link);
  return { enlace, notifId: String(d.notifId || '') };
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/* ---------- PUSH: lo muestra este SW (app cerrada, en segundo plano o abierta) ---------- */
self.addEventListener('push', (e) => {
  let p = null;
  try { p = e.data ? e.data.json() : null; } catch (x) { p = null; }
  if (!p || !(p.notification || p.data)) return;          // no es nuestro formato: que lo maneje el SDK
  e.stopImmediatePropagation();
  const n = p.notification || {};
  const d = p.data || {};
  const notifId = String(d.notifId || '');
  const enlace = enlaceOk(d.enlace);
  e.waitUntil((async () => {
    /* Siempre se muestra (Safari retira el permiso si un push no muestra nada) */
    await self.registration.showNotification(n.title || ((self.MARCA && self.MARCA.CANDIDATO) || 'Jhonny Perdomo'), {
      body: n.body || '',
      icon: n.icon || JP_ICON,
      badge: n.badge || JP_ICON,
      tag: NS_FB + '-noticia-' + notifId,
      renotify: true,
      data: { v: 2, notifId, enlace }
    });
    /* La app abierta se entera al instante (refresca Ponte al día si está ahí) */
    try {
      const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      lista.filter(c => esDeLaApp(c.url)).forEach(c => { try { c.postMessage({ tipo: 'jp-push', notifId, enlace }); } catch (x) {} });
    } catch (x) {}
  })());
});

/* ---------- TOCAR EL AVISO ---------- */
self.addEventListener('notificationclick', (e) => {
  e.stopImmediatePropagation();
  e.notification.close();
  const { enlace, notifId } = destinoDe(e.notification.data);
  e.waitUntil((async () => {
    if (enlace) { if (self.clients.openWindow) return self.clients.openWindow(enlace); return; }
    const lista = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(c => esDeLaApp(c.url));
    const c = lista.find(x => x.focused) || lista.find(x => x.visibilityState === 'visible') || lista[0];
    if (c) {
      try { c.postMessage({ tipo: 'jp-push-abrir', ruta: 'noticias', notifId }); } catch (x) {}
      try { await c.focus(); } catch (x) {}
      return;
    }
    if (self.clients.openWindow) return self.clients.openWindow(RUTA_APP);
  })());
});

/* El SDK se inicia DESPUÉS: getToken lo necesita, y sus oyentes quedan detrás de los nuestros */
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  firebase.initializeApp((self.MARCA && self.MARCA.FIREBASE) || {});
  firebase.messaging();
} catch (e) {}
