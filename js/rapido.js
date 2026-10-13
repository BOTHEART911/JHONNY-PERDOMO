/* ============================================================================
 * rapido.js — CARGA ÚNICA POR SESIÓN (13/10/2026 · Fase 2 · patrón BD Predial)
 * ----------------------------------------------------------------------------
 * Pieza sin DOM. Se carga después de red.js y antes de app.js.
 *
 *  · RAP.abrir(data)  → abre lo que manda el CORE con fmt=2/gz=1: descomprime
 *    (DecompressionStream) y rehidrata la lista compacta a objetos. Si la
 *    respuesta no viene compacta, la devuelve tal cual.
 *  · RAP.params()     → {fmt:'2', gz:'1'} (o solo fmt si el navegador no sabe
 *    descomprimir).
 *  · Caché de sesión por ruta: en memoria (lo que se pinta) y en
 *    sessionStorage (la respuesta compacta, para sobrevivir a una recarga).
 *    Cada entrada lleva rv: la hora de los canales EN VIVO con que se armó.
 *    Una vista vuelve a pedir SOLO si Firebase (/meta) trae una hora posterior.
 *  · Todo va atado al usuario: otra sesión nunca ve la caché de la anterior.
 * ============================================================================ */
(function (raiz) {
  'use strict';
  if (raiz.RAP) return;

  var NS = (raiz.STORAGE_NS || (raiz.MARCA && raiz.MARCA.STORAGE_NS) || 'jp') + ':rap:';
  var mem = {};                 // accion → {data, rv, u}
  var usuario = '';
  var gzOk = typeof raiz.DecompressionStream === 'function' && typeof raiz.Blob === 'function' && typeof raiz.Response === 'function';
  var lectorMeta = null;        // () => Promise<{canal:{ts}}>

  function rehidratar(o) {
    var dic = o.dic || {}, b = {}, campos = o.campos || [], filas = o.filas || [];
    (o.bool || []).forEach(function (c) { b[c] = 1; });
    var n = campos.length, out = new Array(filas.length);
    for (var i = 0; i < filas.length; i++) {
      var f = filas[i], it = {};
      for (var j = 0; j < n; j++) {
        var c = campos[j], v = f[j];
        if (dic[c]) v = dic[c][v];
        else if (b[c]) v = !!v;
        else if (v === null) v = undefined;
        if (v !== undefined) it[c] = v;
      }
      out[i] = it;
    }
    var res = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && ['fmt', 'lista', 'campos', 'dic', 'bool', 'filas'].indexOf(k) === -1) res[k] = o[k];
    res[o.lista] = out;
    return res;
  }

  async function descomprimir(b64) {
    var bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    var flujo = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(flujo).text());
  }

  async function abrir(data) {
    if (!data || data.fmt !== 2) return data;
    var o = data.gz ? await descomprimir(data.gz) : data;
    return (o && o.fmt === 2 && o.filas) ? rehidratar(o) : o;
  }

  /* ---- caché ---- */
  function clave(accion) { return NS + usuario + ':' + accion; }
  /* Versión del CORE que vio esta pestaña (la anota red.js). Una copia local
     armada con otro CORE se descarta: su forma puede ser distinta (p. ej. la
     lista de antes de desplegar no traía foto). */
  var LS_V = (raiz.STORAGE_NS || (raiz.MARCA && raiz.MARCA.STORAGE_NS) || 'jp') + ':coreV';
  function coreV() { try { return sessionStorage.getItem(LS_V) || ''; } catch (e) { return ''; } }
  function setUsuario(doc) {
    doc = String(doc || '');
    if (doc === usuario) return;
    mem = {};
    usuario = doc;
  }
  function guardar(accion, data, crudo) {
    mem[accion] = { data: data, rv: Object.assign({}, (data && data.rv) || {}), u: usuario, v: coreV() };
    if (crudo) { try { sessionStorage.setItem(clave(accion), JSON.stringify({ rv: mem[accion].rv, v: mem[accion].v, c: crudo })); } catch (e) {} }
  }
  function tomar(accion) {
    var e = mem[accion];
    if (e && e.v && coreV() && e.v !== coreV()) { delete mem[accion]; return null; }
    return (e && e.u === usuario) ? e : null;
  }
  /* Desde sessionStorage (tras recargar la página) */
  async function revivir(accion) {
    if (tomar(accion)) return tomar(accion);
    var s = null;
    try { s = JSON.parse(sessionStorage.getItem(clave(accion)) || 'null'); } catch (e) { s = null; }
    if (!s || !s.c) return null;
    if (!s.v || (coreV() && s.v !== coreV())) { try { sessionStorage.removeItem(clave(accion)); } catch (x) {} return null; }
    try {
      var data = await abrir(s.c);
      if (!data) return null;
      mem[accion] = { data: data, rv: s.rv || {}, u: usuario };
      return mem[accion];
    } catch (e) { return null; }
  }
  /* Un cambio EN VIVO ya aplicado en memoria: se adelanta su hora y se borra
     la copia local (que ya no coincide con lo que hay en pantalla). */
  function tocar(accion, canal, ts) {
    var e = tomar(accion);
    if (e && canal && ts) e.rv[canal] = Math.max(e.rv[canal] || 0, ts);
    try { sessionStorage.removeItem(clave(accion)); } catch (x) {}
  }
  function olvidar(accion) {
    if (accion) { delete mem[accion]; try { sessionStorage.removeItem(clave(accion)); } catch (x) {} return; }
    mem = {};
    try {
      for (var i = sessionStorage.length - 1; i >= 0; i--) {
        var k = sessionStorage.key(i);
        if (k && k.indexOf(NS) === 0) sessionStorage.removeItem(k);
      }
    } catch (x) {}
  }

  /* ¿Hay algún canal con una hora posterior a la de la caché?
     Devuelve true (vencida), false (vigente) o null (no se sabe). */
  async function vencida(accion) {
    var e = tomar(accion);
    if (!e) return true;
    if (!e.rv || !Object.keys(e.rv).length) return null;   // sin sello (CORE anterior): no se sabe
    if (!lectorMeta) return null;
    var meta;
    try { meta = await lectorMeta(); } catch (x) { return null; }
    if (!meta) return null;
    var rv = e.rv || {};
    return Object.keys(rv).some(function (c) { return meta[c] && Number(meta[c].ts || 0) > Number(rv[c] || 0); });
  }

  raiz.RAP = {
    abrir: abrir,
    rehidratar: rehidratar,
    params: function () { return gzOk ? { fmt: '2', gz: '1' } : { fmt: '2' }; },
    setUsuario: setUsuario,
    guardar: guardar,
    tomar: tomar,
    revivir: revivir,
    tocar: tocar,
    olvidar: olvidar,
    vencida: vencida,
    lectorMeta: function (fn) { lectorMeta = fn; },
    get gzOk() { return gzOk; }
  };
})(typeof self !== 'undefined' ? self : this);
