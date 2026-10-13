/* ============================================================================
 * publico.js — DATOS PÚBLICOS AL INSTANTE (12/10/2026 · Fase 4)
 * ----------------------------------------------------------------------------
 * Pieza sin DOM. Se carga después de red.js y antes de app.js.
 *
 * Lo que la app pública muestra igual a todos (config, inicio, noticias, casa
 * social, emergencia, comercios, residencias, servicios) llega en UN paquete:
 *
 *   1. Al abrir: lo que quedó guardado en el teléfono se usa de una (0 ms).
 *   2. En segundo plano: Firebase /publico.json (lectura directa, ~150 ms).
 *   3. Firebase /meta.json dice la hora del último cambio de cada canal. Si el
 *      paquete es más viejo que algún canal (o no hay paquete en Firebase, o
 *      tiene más de 12 h), se pide pub.paquete al CORE en segundo plano: el
 *      CORE lo arma y lo vuelve a publicar en Firebase para todos.
 *   Si Firebase no responde o niega la lectura, todo sale por el CORE (un solo
 *   viaje en vez de uno por vista). Nunca bloquea la navegación.
 *
 *  PUB.dato(k)          → la parte k del paquete (o undefined)
 *  PUB.listo(k)         → Promise con la parte k (espera solo si no hay nada)
 *  PUB.refrescar(forzar)→ revalida (una vez por sesión, o siempre si forzar)
 *  PUB.alCambiar(fn)    → fn(partesQueCambiaron) tras una revalidación
 *  PUB.pedidor(fn)      → la app entrega su lector silencioso del CORE
 * ============================================================================ */
(function (raiz) {
  'use strict';
  if (raiz.PUB) return;

  var M = raiz.MARCA || {};
  var NS = (raiz.STORAGE_NS || M.STORAGE_NS || 'jp');
  var LS = NS + ':pub:v1';
  var FB = String((M.FIREBASE && M.FIREBASE.databaseURL) || M.FB_RTDB || '').replace(/\/+$/, '');
  var CANALES = ['config', 'notificaciones', 'analisis', 'lideres'];
  var PARTES = ['marca', 'config', 'inicio', 'noticias', 'casa', 'emergencia', 'comercios', 'residencias', 'servicios'];
  var VIEJO_MS = 12 * 3600 * 1000;

  var paq = null;            // {ts, rv, ...partes}
  var pedidor = null;        // (accion, params) => Promise<data>
  var enCurso = null;
  var hecho = false;
  var subs = [];
  var esperas = [];          // resolvedores de PUB.listo mientras no hay paquete
  var medidas = [];

  try { paq = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { paq = null; }
  if (paq && typeof paq !== 'object') paq = null;

  function ahora() { return Date.now(); }
  function anotar(fuente, ms, kb) { medidas.push({ f: fuente, ms: Math.round(ms), kb: Math.round(kb * 10) / 10, t: ahora() }); if (medidas.length > 50) medidas.shift(); }

  function conTiempo(prom, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error('tiempo')); }, ms);
      prom.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  async function leerFb(ruta) {
    if (!FB || typeof fetch !== 'function') throw new Error('sin firebase');
    var t0 = ahora();
    var r = await conTiempo(fetch(FB + '/' + ruta + '.json', { cache: 'no-store' }), 5000);
    if (!r.ok) throw new Error('fb ' + r.status);
    var txt = await r.text();
    anotar('fb:' + ruta, ahora() - t0, txt.length / 1024);
    return JSON.parse(txt);
  }

  function valido(p) { return p && typeof p === 'object' && p.ts && p.config !== undefined; }

  /* Aplica un paquete nuevo si es más reciente. Devuelve las partes que cambiaron. */
  function aplicar(nuevo) {
    if (!valido(nuevo)) return [];
    if (paq && paq.ts && nuevo.ts < paq.ts) return [];
    var cambios = PARTES.filter(function (k) {
      return !paq || JSON.stringify(paq[k]) !== JSON.stringify(nuevo[k]);
    });
    paq = nuevo;
    try { localStorage.setItem(LS, JSON.stringify(nuevo)); } catch (e) {}
    if (esperas.length) { var w = esperas; esperas = []; w.forEach(function (f) { f(); }); }
    if (cambios.length) subs.forEach(function (fn) { try { fn(cambios); } catch (e) {} });
    return cambios;
  }

  /* ¿El paquete quedó atrás de algún canal? */
  function atrasado(p, meta) {
    if (!valido(p)) return true;
    if (ahora() - p.ts > VIEJO_MS) return true;
    if (!meta) return false;
    var rv = p.rv || {};
    return CANALES.some(function (c) {
      var m = meta[c + '_rev'];
      return m && Number(m.ts || 0) > Number(rv[c] || 0);
    });
  }

  async function delCore() {
    if (!pedidor) throw new Error('sin pedidor');
    var t0 = ahora();
    var d = await pedidor('pub.paquete', { fb: '1' });
    anotar('core:pub.paquete', ahora() - t0, JSON.stringify(d || {}).length / 1024);
    return d;
  }

  async function revalidar() {
    var fb = null, meta = null;
    /* Firebase: paquete y señal en paralelo */
    var res = await Promise.all([
      leerFb('publico').catch(function () { return null; }),
      leerFb('meta').catch(function () { return null; })
    ]);
    fb = res[0]; meta = res[1];
    if (valido(fb)) aplicar(fb);
    if (atrasado(paq, meta) || !valido(fb)) {
      try { aplicar(await delCore()); } catch (e) { /* sin red: se queda lo guardado */ }
    }
  }

  function refrescar(forzar) {
    if (enCurso) return enCurso;
    if (hecho && !forzar) return Promise.resolve();
    hecho = true;
    enCurso = revalidar().catch(function () {}).then(function () { enCurso = null; });
    return enCurso;
  }

  function dato(k) { return paq ? paq[k] : undefined; }

  /* Espera solo si no hay nada guardado de esa parte. */
  function listo(k) {
    if (paq && paq[k] !== undefined && paq[k] !== null) return Promise.resolve(paq[k]);
    refrescar(false);
    return new Promise(function (res) {
      var hecha = false;
      var fin = function () { if (hecha) return; hecha = true; res(paq ? paq[k] : undefined); };
      esperas.push(fin);
      if (enCurso) enCurso.then(fin); else fin();
    });
  }

  /* Parte con respaldo: del paquete (guardado o revalidado) y, si no llega,
     de su ruta propia en el CORE UNA vez por sesión (CORE sin pub.paquete). */
  var memo = {};
  async function o(k, respaldo) {
    var v = dato(k);
    if (v !== undefined && v !== null) return v;
    if (memo[k] !== undefined) return memo[k];
    v = await listo(k);
    if (v !== undefined && v !== null) return v;
    if (!respaldo) return v;
    var r = await respaldo();
    if (r !== undefined && r !== null) memo[k] = r;
    return r;
  }

  raiz.PUB = {
    dato: dato,
    listo: listo,
    o: o,
    refrescar: refrescar,
    alCambiar: function (fn) { subs.push(fn); },
    pedidor: function (fn) { pedidor = fn; },
    medidas: function () { return medidas.slice(); },
    get ts() { return paq ? paq.ts : 0; },
    /* pruebas */
    _aplicar: aplicar,
    _atrasado: atrasado
  };
})(typeof self !== 'undefined' ? self : this);
