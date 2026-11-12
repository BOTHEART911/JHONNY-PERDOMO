/* ============================================================================
 * lr-traza.js — PERDOMO · MIS REFERIDOS → TRAZABILIDAD DE UN REFERIDO
 * (12/11/2026)
 * ----------------------------------------------------------------------------
 * La misma línea de tiempo de PRIV → Base de datos → Detalles
 * (js/trazabilidad.js): KPIs, filtro por tipo y los hitos con su estado.
 * Para el líder es de solo lectura (sin Editar/Inactivar/Eliminar ni la
 * pestaña Datos) y SOLO de personas de su grupo: el CORE lo valida con el
 * pase tkl (pub.liderTrazabilidad / pub.liderTrazabilidadLote).
 *
 *  · Cabecera antes que datos: al tocar el ícono (i) de la tarjeta se pinta
 *    YA lo que la tarjeta sabe (nombre, CC, residencia, intención, municipio)
 *    y la línea de tiempo llega en UN viaje… o ya está:
 *  · PRECARGA: las tarjetas que se ven (y una pantalla más abajo) piden su
 *    trazabilidad de fondo, de a 12 en UN viaje, por la cola de fondo de
 *    red.js (máx. 2 a la vez, se descarta al cambiar de vista). Si el lote de
 *    esa tarjeta va en camino, se espera ESE viaje. Tope 30 lotes por visita.
 *  · Caché de la sesión por persona (memoria): reabrir es instantáneo; si la
 *    copia tiene más de 2 min se revalida de fondo al abrir.
 *  · CORE sin la ruta: no precarga y la hoja avisa.
 *  · Medición: window.LTZ_TIEMPOS() en la consola.
 * Depende de app.js: api, apiSilencio, lrCtx, LR_COMO, LR_REFS, openSheet,
 *   esc, muniClase, refFoto, FOTO_DEFAULT, zoomImagen, RED, SINRED.
 * ============================================================================ */
(function () {
  'use strict';

  var TIPOS = {
    alta:        { t: 'Base de datos', c: 'tz-c-base',  i: '<path d="M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Z"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>' },
    datos:       { t: 'Actualización', c: 'tz-c-base',  i: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>' },
    lider:       { t: 'Liderazgo',     c: 'tz-c-lider', i: '<path d="m12 2 3 6.5 7 .8-5.2 4.7 1.5 7L12 17.4 5.7 21l1.5-7L2 9.3l7-.8Z"/>' },
    servicio:    { t: 'Servicios',     c: 'tz-c-serv',  i: '<path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3Z"/><path d="m9 12-4-4V5l3 3h3"/>' },
    compromiso:  { t: 'Compromisos',   c: 'tz-c-comp',  i: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
    tarea:       { t: 'A su cargo',    c: 'tz-c-tarea', i: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/>' },
    evento:      { t: 'Eventos',       c: 'tz-c-ev',    i: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>' },
    idea:        { t: 'Ideas',         c: 'tz-c-idea',  i: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/>' },
    formulario:  { t: 'Formularios',   c: 'tz-c-form',  i: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>' },
    voto:        { t: 'Votación',      c: 'tz-c-voto',  i: '<path d="m9 12 2 2 4-4"/><path d="M5 7h14l-1 13H6Z"/><path d="M8 7V4h8v3"/>' },
    comercio:    { t: 'Comercios',     c: 'tz-c-com',   i: '<path d="M3 9 5 4h14l2 5"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>' },
    resena:      { t: 'Reseñas',       c: 'tz-c-res',   i: '<path d="m12 2 3 6.5 7 .8-5.2 4.7 1.5 7L12 17.4 5.7 21l1.5-7L2 9.3l7-.8Z"/>' },
    seguimiento: { t: 'Seguimiento',   c: 'tz-c-seg',   i: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>' },
    validacion:  { t: 'Validación',    c: 'tz-c-seg',   i: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m8 12 2.5 2.5L16 9"/>' }
  };
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function ico(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (TIPOS[k] || TIPOS.alta).i + '</svg>'; }
  function fecha(f) {
    var m = String(f || '').match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/);
    if (!m) return '';
    var t = (+m[3]) + ' ' + MESES[+m[2] - 1] + ' ' + m[1];
    if (m[4] && !(m[4] === '00' && m[5] === '00')) { var hh = +m[4]; t += ' · ' + (((hh + 11) % 12) + 1) + ':' + m[5] + ' ' + (hh < 12 ? 'a. m.' : 'p. m.'); }
    return t;
  }
  function estCls(x) {
    x = String(x || '');
    if (/CUMPLID|ATENDID|RESUELT|CERRAD|FINALIZ|ENTREGAD|ASISTI|VOT|VALIDAD/.test(x)) return 'tz-e-ok';
    if (/DESCART|RECHAZ|CANCEL|ANULAD/.test(x)) return 'tz-e-no';
    if (/ESPERA|PENDIENT|ASIGNAD|PROCESO|CURSO/.test(x)) return 'tz-e-pend';
    return '';
  }
  function normDoc(d) { return String(d == null ? '' : d).replace(/\D/g, ''); }

  /* ------------------------------------------------------ caché y medición */
  var CACHE = new Map();      // clave → { data, t }
  var VIEJA = 120000;
  function clave(d) { return ((typeof LR_COMO !== 'undefined' && LR_COMO) || 'yo') + ':' + d; }
  function guardar(d, data) { CACHE.set(clave(d), { data: data, t: Date.now() }); }
  function tomar(d) { return CACHE.get(clave(d)) || null; }
  var MED = [];
  function medir(n, t0, extra) {
    MED.push(Object.assign({ n: n, ms: Math.round(performance.now() - t0), t: Date.now() }, extra || {}));
    if (MED.length > 80) MED.shift();
  }
  window.LTZ_TIEMPOS = function () { return MED.slice(); };

  /* ======================================================== PRECARGA */
  var P = { pend: new Map(), cola: [], t: 0, off: false, io: null, mo: null, lotes: 0, enVista: 0, lista: null };
  var TOPE = 30;
  function puede() {
    if (P.off) return false;
    if (window.SINRED && SINRED.enLinea && !SINRED.enLinea()) return false;
    return !!(window.LRT && LRT.hay());     // la lista vino del CORE nuevo (con la pieza)
  }
  function pedir(d) {
    d = normDoc(d);
    if (!d || P.pend.has(d) || P.cola.indexOf(d) >= 0 || tomar(d)) return;
    P.cola.push(d);
    clearTimeout(P.t); P.t = setTimeout(vaciar, 200);
  }
  function vaciar() {
    if (!puede() || P.enVista >= TOPE) { P.cola = []; return; }
    while (P.cola.length && P.enVista < TOPE) {
      var docs = P.cola.splice(0, 12).filter(function (d) { return !P.pend.has(d) && !tomar(d); });
      if (docs.length) lote(docs);
    }
  }
  function lote(docs) {
    var t0 = performance.now(), listo;
    var prom = new Promise(function (r) { listo = r; });
    docs.forEach(function (d) { P.pend.set(d, prom); });
    P.lotes++; P.enVista++;
    var como = (typeof LR_COMO !== 'undefined' && LR_COMO) || '';
    apiSilencio('pub.liderTrazabilidadLote', lrCtx({ documento: (LIDER_USER() || {}).documento || '', docs: docs.join(',') }))
      .then(function (r) {
        if (((typeof LR_COMO !== 'undefined' && LR_COMO) || '') !== como) return;   // cambió de grupo mientras viajaba
        if (r && r.ok && r.mapa) Object.keys(r.mapa).forEach(function (d) { var x = r.mapa[d]; if (x && x.ok !== false) guardar(d, x); });
        medir('precarga', t0, { docs: docs.length, llegaron: r && r.mapa ? Object.keys(r.mapa).length : 0 });
      })
      .catch(function (e) { if (/no reconocida/i.test(String(e && e.message))) P.off = true; })
      .then(function () { docs.forEach(function (d) { if (P.pend.get(d) === prom) P.pend.delete(d); }); listo(); });
    return prom;
  }
  function LIDER_USER() { try { return (typeof LR_USER !== "undefined" && LR_USER) || null; } catch (e) { return null; } }

  /* Las tarjetas que se ven; cada tanda nueva de la lista se observa sola */
  function observar() {
    var lista = document.getElementById('lr-list');
    if (!lista || !('IntersectionObserver' in window)) return;
    if (P.lista !== lista) {
      soltar();
      P.lista = lista;
      P.io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { if (en.isIntersecting) { P.io.unobserve(en.target); pedir(en.target.dataset.doc); } });
      }, { rootMargin: '0px 0px 600px 0px' });
      P.mo = new MutationObserver(function () { marcar(); });
      P.mo.observe(lista, { childList: true });
    }
    marcar();
  }
  function marcar() {
    if (!P.lista || !P.io || P.off) return;
    var cs = P.lista.querySelectorAll('.rcard[data-doc]:not([data-tzp])');
    for (var i = 0; i < cs.length; i++) { cs[i].setAttribute('data-tzp', '1'); P.io.observe(cs[i]); }
  }
  function soltar() {
    if (P.io) P.io.disconnect(); if (P.mo) P.mo.disconnect();
    P.io = null; P.mo = null; P.lista = null; P.cola = []; clearTimeout(P.t); P.enVista = 0;
  }
  if (window.RED && RED.nuevaVista && !RED.nuevaVista.__ltz) {
    var nv = RED.nuevaVista;
    RED.nuevaVista = function () { soltar(); P.pend.clear(); return nv.apply(this, arguments); };
    RED.nuevaVista.__ltz = true;
  }

  /* ============================================================= la hoja */
  var TZ = null;
  async function abrir(rf) {
    var d = normDoc(rf && rf.documento);
    if (!d) return;
    var t0 = performance.now();
    TZ = { doc: d, rf: rf, data: null, filtro: 'todos' };
    var yo = TZ;
    var mun = String(rf.municipio || '').trim();
    var foto = (typeof refFoto === 'function') ? refFoto(rf) : '';
    var av = foto
      ? '<button class="rc-av has-photo ltz-av" id="ltz-foto" aria-label="Ver la foto"><img src="' + esc(foto) + '" alt="" /></button>'
      : '<div class="rc-av ltz-av"><img src="' + esc(FOTO_DEFAULT) + '" alt="" /></div>';
    openSheet('<div class="grip"></div>' +
      '<div class="ltz-head">' + av +
        '<div class="ltz-quien"><h2 class="h2">' + esc(rf.nombre || 'Referido') + '</h2>' +
        '<span class="muted small">CC ' + esc(d) + (rf.residencia ? ' · ' + esc(rf.residencia) : '') + (rf.intencion ? ' · ' + esc(rf.intencion) : '') + '</span></div>' +
        '<span class="rc-mun ' + (typeof muniClase === 'function' ? muniClase(mun) : '') + '">' + esc(mun || 'Sin consultar') + '</span>' +
      '</div>' +
      '<div class="ltz-sub"><b>Trazabilidad</b><button class="btn btn-ghost ltz-cerrar" data-close>Cerrar</button></div>' +
      '<div id="ltz-body"><div class="tz-kpis">' + Array(4).join('<div class="tz-skel"></div>') + '<div class="tz-skel"></div></div>' +
      '<div class="tz-line">' + Array(4).join('<div class="tz-item tz-skel-i"><i></i><div><b></b><span></span></div></div>') + '</div></div>', 'sheet-xl ltz-sheet');
    var fz = document.getElementById('ltz-foto'); if (fz && typeof zoomImagen === 'function') fz.onclick = function () { zoomImagen(foto); };

    var c = tomar(d);
    if (c) { yo.data = c.data; pintar(); medir('trazabilidad', t0, { cache: true }); if (Date.now() - c.t < VIEJA) return; }
    /* el lote de esta tarjeta va en camino: se espera ESE viaje (tope 6 s) */
    var enCamino = P.pend.get(d);
    if (!c && enCamino) {
      await Promise.race([enCamino, new Promise(function (r) { setTimeout(r, 6000); })]);
      if (TZ !== yo) return;
      c = tomar(d);
      if (c) { yo.data = c.data; pintar(); medir('trazabilidad', t0, { espero: true }); return; }
    }
    try {
      var llamar = c ? apiSilencio : api;   // con copia en pantalla, la revalidación no muestra indicador
      var r = await llamar('pub.liderTrazabilidad', lrCtx({ documento: (LIDER_USER() || {}).documento || '', refDoc: d }));
      if (TZ !== yo) return;
      if (!r || r.ok === false) { if (!yo.data) cuerpo('<p class="muted center ltz-msg">' + esc((r && r.msg) || 'No se pudo cargar.') + '</p>'); return; }
      guardar(d, r);
      var primera = !yo.data;
      yo.data = r; pintar();
      if (primera) medir('trazabilidad', t0, { cache: false });
    } catch (e) {
      if (TZ !== yo || yo.data) return;
      if (/no reconocida/i.test(String(e && e.message))) { P.off = true; return cuerpo('<p class="muted center ltz-msg">La trazabilidad todavía no está disponible. Intenta más tarde.</p>'); }
      cuerpo('<p class="muted center ltz-msg">' + (window.SINRED && SINRED.enLinea && !SINRED.enLinea() ? 'Sin conexión: la trazabilidad necesita señal.' : 'No se pudo cargar. Revisa tu conexión e intenta de nuevo.') + '</p>');
    }
  }
  function cuerpo(html) { var b = document.getElementById('ltz-body'); if (b) b.innerHTML = html; }

  function pintar() {
    var body = document.getElementById('ltz-body'); if (!body || !TZ || !TZ.data) return;
    var d = TZ.data, items = d.items || [], R = d.resumen || {};
    var kpis = [
      ['Servicios', R.servicios || 0, R.serviciosAtendidos ? R.serviciosAtendidos + ' atendido(s)' : ''],
      ['Compromisos', R.compromisos || 0, R.compromisosCumplidos ? R.compromisosCumplidos + ' cumplido(s)' : ''],
      ['Eventos', R.eventos || 0, ''],
      ['Formularios', R.formularios || 0, ''],
      ['Ideas', R.ideas || 0, ''],
      ['Comercios', R.comercios || 0, ''],
      ['A su cargo', R.tareas || 0, '']
    ].filter(function (k, i) { return k[1] || i < 4; });
    var tipos = []; items.forEach(function (x) { if (tipos.indexOf(x.k) < 0) tipos.push(x.k); });
    var lista = items.filter(function (x) { return TZ.filtro === 'todos' || x.k === TZ.filtro; });
    body.innerHTML =
      '<div class="tz-kpis">' + kpis.map(function (k) { return '<div><b>' + Number(k[1]).toLocaleString('es-CO') + '</b><span>' + k[0] + '</span>' + (k[2] ? '<i>' + esc(k[2]) + '</i>' : '') + '</div>'; }).join('') +
        (R.voto ? '<div class="tz-k-voto"><b>✓</b><span>Votó</span></div>' : '') + '</div>' +
      (tipos.length > 1 ? '<div class="bd-chips tz-chips">' + ['todos'].concat(tipos).map(function (k) {
        return '<button class="bd-chip ' + (TZ.filtro === k ? 'active' : '') + '" data-k="' + k + '">' + (k === 'todos' ? 'Todo' : esc((TIPOS[k] || {}).t || k)) + ' <i>' + (k === 'todos' ? items.length : items.filter(function (x) { return x.k === k; }).length) + '</i></button>';
      }).join('') + '</div>' : '') +
      (lista.length ? '<ol class="tz-line">' + lista.map(item).join('') + '</ol>'
        : '<p class="muted center" style="margin:18px 0;">' + (items.length ? 'Nada de este tipo.' : 'Todavía no hay gestiones registradas para esta persona.') + '</p>') +
      (d.total > items.length ? '<p class="muted small center">Se muestran los ' + items.length + ' hitos más recientes de ' + d.total + '.</p>' : '');
    body.querySelectorAll('.tz-chips .bd-chip').forEach(function (b) { b.onclick = function () { TZ.filtro = b.dataset.k; pintar(); }; });
  }
  function item(x) {
    var tp = TIPOS[x.k] || TIPOS.alta;
    return '<li class="tz-item ' + tp.c + '"><i class="tz-ico">' + ico(x.k) + '</i><div class="tz-c">' +
      '<div class="tz-r1"><b>' + esc(x.tit) + '</b>' + (x.est ? '<span class="tz-est ' + estCls(x.est) + '">' + esc(x.est.charAt(0) + x.est.slice(1).toLowerCase()) + '</span>' : '') + '</div>' +
      (x.det ? '<p>' + esc(x.det) + '</p>' : '') +
      '<span class="tz-f">' + esc(fecha(x.f) || (x.k === 'lider' ? 'Vigente' : '')) + ' · ' + esc(tp.t) + '</span></div></li>';
  }

  window.LTZ = {
    abrir: abrir,
    observar: observar,
    olvidar: function () { CACHE.clear(); },
    estado: function () { return { lotes: P.lotes, pendientes: P.pend.size, cola: P.cola.length, apagada: P.off, cache: CACHE.size }; }
  };
})();
