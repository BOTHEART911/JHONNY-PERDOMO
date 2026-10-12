/* ============================================================================
 * Service Worker — JHONNY PERDOMO (pública) · ENTRADA INSTANTÁNEA (12/10/2026)
 * ----------------------------------------------------------------------------
 * Cada versión publicada tiene SU caché (<prefijo><versión>).
 *
 *  1. Apertura con la versión vigente ya guardada → se pinta AL INSTANTE desde
 *     su caché (sin esperar la red). En paralelo se pregunta version.js a la
 *     red: si cambió, la app hace UNA sola recarga y entra la versión nueva
 *     (la app le avisa al SW con {tipo:'version', v}).
 *     Respaldo: si la app no alcanzó a avisar, la apertura siguiente ya entra
 *     con la nueva (el SW la deja anotada como "pendiente").
 *  2. Primera vez, caché vacía o versión pendiente → MODO FRESCO: se espera
 *     version.js de la red (tope 2,5 s) y se arma la caché de esa versión.
 *  3. js/version.js sin parámetros se sirve de la caché de la versión vigente
 *     (coincide con el código que corre); con ?t= o ?sw= siempre va a la red.
 *  Lo externo (backend, Firebase, Google, CDN de terceros) nunca pasa por aquí.
 * ============================================================================ */
try { importScripts('./js/marca.js'); } catch (e) {}
try { importScripts('./js/storage-ns.js'); } catch (e) {}
const NS_SW = (self.STORAGE_NS || 'jp');
const CACHE_PREFIJO = NS_SW + '-pub-';
const META = CACHE_PREFIJO + 'meta';
const T_VERSION = 2500;
const EXTERNO = /script\.google\.com|googleusercontent\.com|qrserver\.com|googleapis\.com|cloudinary\.com|gstatic\.com|firebaseio\.com|firebase|openstreetmap\.org|google\.com\/maps|firebase-messaging-sw\.js/;

let VIGENTE = null;     // versión que se sirve
let PENDIENTE = null;   // versión nueva vista en la red y aún no aplicada

async function leerMeta(k) {
  try { const r = await (await caches.open(META)).match('./__' + k); return r ? await r.text() : null; } catch (e) { return null; }
}
async function ponerMeta(k, v) {
  try { const c = await caches.open(META); if (v) await c.put('./__' + k, new Response(v)); else await c.delete('./__' + k); } catch (e) {}
}
async function versionGuardada() {
  if (VIGENTE) return VIGENTE;
  VIGENTE = await leerMeta('v');
  return VIGENTE || 'base';
}
async function pendienteGuardada() {
  if (PENDIENTE === null) PENDIENTE = (await leerMeta('p')) || '';
  return PENDIENTE;
}
async function fijarVersion(v, raw) {
  if (!v) return;
  PENDIENTE = ''; await ponerMeta('p', '');
  if (raw) { try { await (await caches.open(CACHE_PREFIJO + v)).put('./js/version.js', new Response(raw, { headers: { 'Content-Type': 'application/javascript' } })); } catch (e) {} }
  if (v === VIGENTE) return;
  VIGENTE = v;
  await ponerMeta('v', v);
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
    return m ? { v: String(m[1]).trim(), raw } : null;
  } catch (e) { return null; } finally { clearTimeout(t); }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  /* Limpia las cachés del esquema anterior (<prefijo>v1) */
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k === CACHE_PREFIJO + 'v1').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* La app avisa que vio una versión nueva → se aplica antes de su única recarga */
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.tipo !== 'version' || !d.v) return;
  const listo = () => { try { if (e.ports && e.ports[0]) e.ports[0].postMessage({ ok: true, v: VIGENTE }); } catch (x) {} };
  e.waitUntil(fijarVersion(String(d.v)).then(listo, listo));
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

async function navegar(e) {
  const req = e.request;
  const v = await versionGuardada();
  const pend = await pendienteGuardada();
  if (v !== 'base' && !pend) {
    const hit = await (await caches.open(CACHE_PREFIJO + v)).match(req, { ignoreSearch: true });
    if (hit) {
      /* Instantáneo: se pinta lo guardado y la red se consulta en paralelo */
      e.waitUntil(versionDeRed().then(n => { if (n && n.v !== VIGENTE) { PENDIENTE = n.v; return ponerMeta('p', n.v); } }).catch(() => {}));
      return hit;
    }
  }
  /* Modo fresco: primera vez, caché vacía o versión pendiente */
  const n = await versionDeRed();
  await fijarVersion(n ? n.v : (pend || v), n ? n.raw : null);
  return desdeVersion(req, VIGENTE || 'base');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (EXTERNO.test(req.url)) return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  if (/\/version\.js$/.test(u.pathname) && u.search) return;   // chequeos de versión: siempre a la red
  if (req.mode === 'navigate') { e.respondWith(navegar(e)); return; }
  e.respondWith((async () => desdeVersion(req, await versionGuardada()))());
});
