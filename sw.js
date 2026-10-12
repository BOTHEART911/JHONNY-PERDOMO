/* ============================================================================
 * Service Worker — JHONNY PERDOMO (pública) · MODO FRESCO (12/10/2026 · Fase 1)
 * ----------------------------------------------------------------------------
 * Antes: "red primero" para TODO archivo → cada apertura esperaba la red,
 * archivo por archivo (lento con señal mala) y aun así podía servir lo
 * guardado por el caché HTTP de GitHub Pages (10 min).
 *
 * Ahora:
 *  1. Cada apertura (navegación) pregunta version.js a la RED, sin caché y con
 *     tiempo límite de 2,5 s. Si no responde, sigue con la última versión
 *     conocida (la app abre igual sin señal).
 *  2. Cada versión tiene SU caché (pub<versión>). Los archivos se sirven
 *     desde la caché de la versión vigente; lo que falte se trae de la red
 *     revalidando (cache:'no-cache') y se guarda ahí.
 *  3. Versión nueva = caché nueva y vacía → lo publicado se ve en la PRIMERA
 *     apertura, sin recargas dobles. Las cachés viejas de esta app se borran.
 *  Lo externo (backend, Firebase, Google, CDN de terceros) nunca pasa por aquí.
 * ============================================================================ */
try { importScripts('./js/marca.js'); } catch (e) {}
try { importScripts('./js/storage-ns.js'); } catch (e) {}
const NS_SW = (self.STORAGE_NS || 'jp');
const CACHE_PREFIJO = NS_SW + '-pub-';
const META = CACHE_PREFIJO + 'meta';
const T_VERSION = 2500;
const EXTERNO = /script\.google\.com|googleusercontent\.com|qrserver\.com|googleapis\.com|cloudinary\.com|gstatic\.com|firebaseio\.com|firebase|openstreetmap\.org|google\.com\/maps|firebase-messaging-sw\.js/;

let VIGENTE = null;   // versión en memoria del SW

async function versionGuardada() {
  if (VIGENTE) return VIGENTE;
  try { const r = await (await caches.open(META)).match('./__v'); if (r) VIGENTE = await r.text(); } catch (e) {}
  return VIGENTE || 'base';
}
async function fijarVersion(v) {
  if (!v || v === VIGENTE) return;
  VIGENTE = v;
  try { await (await caches.open(META)).put('./__v', new Response(v)); } catch (e) {}
  try {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k.indexOf(CACHE_PREFIJO) === 0 && k !== META && k !== CACHE_PREFIJO + v).map(k => caches.delete(k)));
  } catch (e) {}
}
async function versionDeRed() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), T_VERSION);
  try {
    const r = await fetch('./js/version.js?sw=' + Date.now(), { cache: 'no-store', signal: ctrl.signal });
    if (!r.ok) return null;
    const raw = await r.text();
    const m = raw.match(/version['"]?\s*[:=]\s*['"]([^'"]+)['"]/i) || raw.match(/(\d{4}\.\d{2}\.\d{2}\.\d+)/);
    return m ? String(m[1]).trim() : null;
  } catch (e) { return null; } finally { clearTimeout(t); }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  /* Limpia las cachés del esquema anterior (<prefijo>v1) */
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k === CACHE_PREFIJO + 'v1').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function desdeVersion(req, v) {
  const cache = await caches.open(CACHE_PREFIJO + v);
  const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
  if (hit) return hit;
  try {
    const resp = await fetch(req, { cache: 'no-cache' });
    if (resp && resp.ok && resp.type === 'basic') cache.put(req, resp.clone()).catch(() => {});
    return resp;
  } catch (err) {
    /* Sin red: cualquier copia de cualquier versión de esta app */
    const viejo = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (viejo) return viejo;
    if (req.mode === 'navigate') { const idx = await caches.match('./index.html'); if (idx) return idx; }
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (EXTERNO.test(req.url)) return;
  if (new URL(req.url).origin !== self.location.origin) return;
  if (/\/version\.js(\?|$)/.test(req.url)) return;          // siempre a la red (la app la lee sin caché)
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const v = (await versionDeRed()) || (await versionGuardada());
      await fijarVersion(v);
      return desdeVersion(req, v);
    })());
    return;
  }
  e.respondWith((async () => desdeVersion(req, await versionGuardada()))());
});
