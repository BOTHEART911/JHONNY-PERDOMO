/* ============================================================
 * firebase-messaging-sw.js — Módulo 7 · App PÚBLICA
 * ------------------------------------------------------------
 * Service worker DEDICADO a los avisos push (va aparte de sw.js,
 * que sigue encargado del caché y la instalación de la PWA).
 * Es el que muestra la notificación cuando la app está CERRADA.
 *
 * Ojo: este archivo NO puede usar imports de módulos ES; el SDK
 * se trae con importScripts (versión compat), igual que en la app.
 * ============================================================ */
/* FASE 0 · prefijo de campaña: sin él, la notificación de una campaña
   reemplaza la de la otra en el mismo dispositivo (mismo origen). */
try { importScripts('./marca.js'); } catch (e) {}
try { importScripts('./storage-ns.js'); } catch (e) {}
const NS_FB = (self.STORAGE_NS || 'jp');

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp((self.MARCA && self.MARCA.FIREBASE) || {});

const JP_ICON = 'img/logo.png';
const messaging = firebase.messaging();

/* Push con la app cerrada / en segundo plano.
   El CORE manda notification + data, así que en la mayoría de navegadores
   la notificación la pinta el SDK solo. Este handler cubre el resto y deja
   el deep-link listo en data.notifId. */
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const d = payload.data || {};
  self.registration.showNotification(n.title || ((self.MARCA && self.MARCA.CANDIDATO) || 'Jhonny Perdomo'), {
    body: n.body || '',
    icon: JP_ICON,
    badge: JP_ICON,
    tag: NS_FB + '-noticia-' + (d.notifId || ''),
    renotify: true,
    data: { notifId: d.notifId || '' }
  });
});

/* Tocar el aviso abre la app en "Ponte al día" (si ya está abierta, la enfoca) */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  // Este SW vive en un scope propio (no controla las páginas), así que la
  // ventana de la app se busca por su URL base, no por registration.scope.
  const base = new URL('./', self.location.href).href;
  const destino = base + 'index.html#/noticias';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if (c.url.indexOf(base) === 0 && 'focus' in c) {
          c.navigate(destino).catch(() => {});
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino);
    })
  );
});
