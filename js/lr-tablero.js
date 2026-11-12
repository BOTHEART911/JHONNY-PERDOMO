/* ============================================================================
 * lr-tablero.js — PERDOMO · MIS REFERIDOS: CRECIMIENTO POR MES + FILTROS DE
 * ACTIVIDAD (12/11/2026)
 * ----------------------------------------------------------------------------
 * Las mismas piezas de PRIV → Base de datos (js/bd-tablero.js y
 * js/bd-actividad.js): misma franja (Total · mes en curso · vs. el mes
 * anterior al mismo día · barras · Ampliar), misma hoja ampliada y la misma
 * fila Servicios · Compromisos · Eventos · Formularios con su 2.ª fila.
 * Mismas clases CSS (bdt-*, bd-chip-act*), aquí sobre la lista del líder.
 *
 *  · Cero viajes: todo sale de LR_REFS (la lista ya en memoria; cada referido
 *    trae fr = fecha de registro) y de LR_ACT (la pieza de actividad que viaja
 *    CON la lista: pub.liderReferidos act=1 → solo su grupo).
 *  · Mismas reglas que la lista (lrPasaQ / lrPasaMun en app.js): los números
 *    cuadran con las tarjetas que se ven.
 *      - Pastillas de actividad: respetan búsqueda y municipio.
 *      - Tendencia: lo que se ve en la lista (todos los filtros).
 *  · CORE sin act/fr: la fila de actividad y la franja no se muestran.
 *  · EN VIVO: además de meta/bd_rev (app.js), escucha los canales de la
 *    pieza (compromisos, analisis, eventos, formularios, inscripciones): si
 *    alguno trae una hora posterior a la de la lista, se renueva de fondo.
 *  · Medición: window.LRT_TIEMPOS() en la consola.
 * Depende de app.js: LR_REFS, LR_ACT, LR_MUN, lrPasaQ, lrPasaMun, lrAplicar,
 *   openSheet, esc, ntLoadFirebase, lrVivoTocar, lrVivoVivo.
 * ============================================================================ */
(function () {
  'use strict';

  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var CAT = [
    { k: 's', t: 'Servicios', sub: true },
    { k: 'c', t: 'Compromisos', sub: false },
    { k: 'e', t: 'Eventos', sub: true },
    { k: 'f', t: 'Formularios', sub: true }
  ];
  var A = null, SEL = '', ITEM = -1, ULT = null;
  var MED = [];

  function n(x) { return Number(x || 0).toLocaleString('es-CO'); }
  function e(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s); }
  function doc(c) { return String(c && c.documento != null ? c.documento : '').replace(/\D/g, ''); }
  function mapa(o) { var m = new Map(); if (o) Object.keys(o).forEach(function (k) { m.set(k, o[k]); }); return m; }
  function medir(nombre, t0) {
    MED.push({ n: nombre, ms: Math.round((performance.now() - t0) * 10) / 10, t: Date.now() });
    if (MED.length > 80) MED.shift();
  }
  window.LRT_TIEMPOS = function () { return MED.slice(); };

  /* ======================================================== ACTIVIDAD: dato */
  function dato(act) {
    if (!act || typeof act !== 'object' || !act.c) { A = null; SEL = ''; ITEM = -1; return; }
    A = {
      s: { n: ((act.s && act.s.n) || []).map(function (t) { return { t: String(t) }; }), d: mapa(act.s && act.s.d) },
      c: { d: mapa(act.c && act.c.d) },
      e: { n: ((act.e && act.e.n) || []).map(function (x) { return { id: x[0], t: x[1], f: x[2] || '' }; }), d: mapa(act.e && act.e.d) },
      f: { n: ((act.f && act.f.n) || []).map(function (x) { return { id: x[0], t: x[1] }; }), d: mapa(act.f && act.f.d) }
    };
    if (SEL && ITEM >= 0 && A[SEL].n && ITEM >= A[SEL].n.length) ITEM = -1;
  }
  function pasaAct(c) {
    if (!A || !SEL) return true;
    var v = A[SEL].d.get(doc(c));
    if (v == null) return false;
    if (ITEM < 0 || SEL === 'c') return true;
    return v.indexOf(ITEM) !== -1;
  }
  function actTxt() {
    if (!A || !SEL) return '';
    var cat = CAT.filter(function (x) { return x.k === SEL; })[0];
    var it = (ITEM >= 0 && A[SEL].n) ? A[SEL].n[ITEM] : null;
    return cat.t + (it ? ': ' + it.t : '');
  }

  /* ============================================== cálculo (una pasada) */
  function mesDe(c) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String((c && c.fr) || '').trim());
    return m ? { k: m[3] + '-' + m[2], d: +m[1] } : null;
  }
  function kDe(f) { return f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0'); }
  function kSig(k) { var y = +k.slice(0, 4), m = +k.slice(5, 7); m++; if (m > 12) { m = 1; y++; } return y + '-' + String(m).padStart(2, '0'); }
  function kCorto(k) { return MES[+k.slice(5, 7) - 1] + ' ' + k.slice(2, 4); }
  function kLargo(k) { return MES_L[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4); }

  function calcular() {
    var lista = (typeof LR_REFS !== 'undefined' && LR_REFS) || [];
    var q = lrQ();
    var cat = { s: 0, c: 0, e: 0, f: 0 }, sub = (A && SEL && A[SEL].n) ? A[SEL].n.map(function () { return 0; }) : null;
    var visibles = [], hayFr = false;
    for (var i = 0; i < lista.length; i++) {
      var c = lista[i];
      if (c.fr) hayFr = true;
      if (!lrPasaQ(c, q) || !lrPasaMun(c)) continue;
      if (A) {
        var d = doc(c);
        if (A.s.d.has(d)) cat.s++;
        if (A.c.d.has(d)) cat.c++;
        if (A.e.d.has(d)) cat.e++;
        if (A.f.d.has(d)) cat.f++;
        if (sub) { var v = A[SEL].d.get(d); if (v) for (var j = 0; j < v.length; j++) sub[v[j]]++; }
      }
      if (pasaAct(c)) visibles.push(c);
    }
    return { cat: cat, sub: sub, tend: hayFr ? tendencia(visibles) : null, n: visibles.length };
  }

  function tendencia(lista) {
    var hoy = new Date(), kHoy = kDe(hoy), diaHoy = hoy.getDate();
    var por = {}, corte = {}, sinFecha = 0, kMin = null;
    lista.forEach(function (c) {
      var m = mesDe(c);
      if (!m) { sinFecha++; return; }
      por[m.k] = (por[m.k] || 0) + 1;
      if (m.d <= diaHoy) corte[m.k] = (corte[m.k] || 0) + 1;
      if (!kMin || m.k < kMin) kMin = m.k;
    });
    var meses = [], acum = 0;
    if (kMin) {
      var kFin = kHoy;
      Object.keys(por).forEach(function (k) { if (k > kFin) kFin = k; });
      for (var k = kMin, guard = 0; k <= kFin && guard < 600; k = kSig(k), guard++) {
        var nuevos = por[k] || 0; acum += nuevos;
        var prev = meses.length ? meses[meses.length - 1].nuevos : null;
        meses.push({ k: k, nuevos: nuevos, acum: acum, prev: prev, enCurso: k === kHoy });
      }
    }
    var actual = meses.length ? meses[meses.length - 1] : null;
    var anterior = meses.length > 1 ? meses[meses.length - 2] : null;
    return { total: lista.length, sinFecha: sinFecha, meses: meses, kHoy: kHoy, diaHoy: diaHoy, actual: actual, anterior: anterior, anteriorAlCorte: anterior ? (corte[anterior.k] || 0) : 0 };
  }

  function variacion(act, ant) {
    if (ant == null) return { cls: 'eq', txt: '—' };
    var d = act - ant;
    if (d === 0) return { cls: 'eq', txt: '= 0' };
    var pct = ant > 0 ? n(Math.round(Math.abs(d) * 100 / ant)) + ' %' : 'nuevo';
    return { cls: d > 0 ? 'up' : 'down', txt: (d > 0 ? '▲ +' : '▼ ') + n(d) + ' (' + pct + ')' };
  }

  /* ================================================== franja compacta */
  function barrasMini(meses) {
    var ult = meses.slice(-12); if (!ult.length) return '';
    var max = Math.max.apply(null, ult.map(function (m) { return m.nuevos; })) || 1;
    var W = 120, H = 34, bw = 7, x0 = W - ult.length * 10;
    return '<svg class="bdt-mini" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      ult.map(function (m, i) {
        var hh = Math.max(m.nuevos ? 2 : 1, Math.round(m.nuevos * (H - 2) / max));
        return '<rect x="' + (x0 + i * 10) + '" y="' + (H - hh) + '" width="' + bw + '" height="' + hh + '" rx="1.5" class="' + (m.enCurso ? 'cur' : '') + '"><title>' + e(kLargo(m.k)) + ': ' + n(m.nuevos) + '</title></rect>';
      }).join('') + '</svg>';
  }
  function pintarFranja(t) {
    var box = document.getElementById('lr-tend'); if (!box) return;
    if (!t || !t.meses.length) { box.hidden = true; box.innerHTML = ''; box.__html = ''; return; }
    var a = t.actual, ant = t.anterior, v, vLbl;
    if (a.enCurso && ant) { v = variacion(a.nuevos, t.anteriorAlCorte); vLbl = 'vs. ' + MES[+ant.k.slice(5, 7) - 1] + ' al día ' + t.diaHoy; }
    else { v = variacion(a.nuevos, ant ? ant.nuevos : null); vLbl = ant ? 'vs. ' + kCorto(ant.k) : 'mes anterior'; }
    var html = '<button type="button" class="bdt-strip" id="lrt-open" title="Ver el crecimiento completo">' +
      '<span class="bdt-k"><span class="bdt-lbl">Total</span><b>' + n(t.total) + '</b></span>' +
      '<span class="bdt-k"><span class="bdt-lbl">' + e(kCorto(a.k)) + (a.enCurso ? ' · en curso' : '') + '</span><b>+' + n(a.nuevos) + '</b></span>' +
      '<span class="bdt-k bdt-v ' + v.cls + '"><span class="bdt-lbl">' + e(vLbl) + '</span><b>' + e(v.txt) + '</b></span>' +
      barrasMini(t.meses) + '<span class="bdt-mas">Ampliar</span></button>';
    if (box.__html !== html) { box.innerHTML = html; box.__html = html; var b = document.getElementById('lrt-open'); if (b) b.onclick = abrir; }
    box.hidden = false;
  }

  /* ===================================================== hoja ampliada */
  function filtrosTxt() {
    var p = [];
    if (typeof LR_MUN !== 'undefined' && LR_MUN) p.push(LR_MUN);
    if (actTxt()) p.push('Con ' + actTxt());
    var q = lrQ(); if (q) p.push('Búsqueda: "' + q + '"');
    return p.length ? p.join(' · ') : 'Todos tus referidos';
  }
  function grafica(meses) {
    if (!meses.length) return '';
    var W = Math.max(320, meses.length * 46), H = 190, pl = 34, pr = 40, pt = 14, pb = 28;
    var cw = W - pl - pr, ch = H - pt - pb, paso = cw / meses.length, bw = Math.min(22, paso * .62);
    var maxN = Math.max.apply(null, meses.map(function (m) { return m.nuevos; })) || 1;
    var maxA = meses[meses.length - 1].acum || 1;
    var y = function (v, max) { return pt + ch - v * ch / max; };
    var barras = meses.map(function (m, i) {
      var x = pl + i * paso + (paso - bw) / 2, yy = y(m.nuevos, maxN);
      return '<rect class="bdt-bar' + (m.enCurso ? ' cur' : '') + '" x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (pt + ch - yy).toFixed(1) + '" rx="3"><title>' + e(kLargo(m.k)) + ': +' + n(m.nuevos) + ' · acumulado ' + n(m.acum) + '</title></rect>' +
        (m.nuevos ? '<text class="bdt-bv" x="' + (x + bw / 2).toFixed(1) + '" y="' + (yy - 3).toFixed(1) + '">' + n(m.nuevos) + '</text>' : '') +
        '<text class="bdt-x" x="' + (pl + i * paso + paso / 2).toFixed(1) + '" y="' + (H - 9) + '">' + e(kCorto(m.k)) + '</text>';
    }).join('');
    var linea = meses.map(function (m, i) { return (i ? 'L' : 'M') + (pl + i * paso + paso / 2).toFixed(1) + ' ' + y(m.acum, maxA).toFixed(1); }).join(' ');
    var puntos = meses.map(function (m, i) { return '<circle class="bdt-pt" cx="' + (pl + i * paso + paso / 2).toFixed(1) + '" cy="' + y(m.acum, maxA).toFixed(1) + '" r="2.6"><title>' + e(kLargo(m.k)) + ': acumulado ' + n(m.acum) + '</title></circle>'; }).join('');
    return '<div class="bdt-graf"><svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Referidos nuevos por mes y acumulado">' +
      '<line class="bdt-eje" x1="' + pl + '" y1="' + (pt + ch) + '" x2="' + (W - pr) + '" y2="' + (pt + ch) + '"/>' +
      '<text class="bdt-yl" x="' + (pl - 6) + '" y="' + (pt + 4) + '">' + n(maxN) + '</text>' +
      '<text class="bdt-yr" x="' + (W - pr + 6) + '" y="' + (pt + 4) + '">' + n(maxA) + '</text>' +
      barras + '<path class="bdt-acum" d="' + linea + '"/>' + puntos + '</svg></div>';
  }
  function cuerpoHoja(t) {
    var filas = t.meses.slice().reverse().map(function (m) {
      var v = variacion(m.nuevos, m.prev);
      return '<div class="bdt-fila"><span class="bdt-mes">' + e(kLargo(m.k)) + (m.enCurso ? ' <i>en curso</i>' : '') + '</span>' +
        '<span class="bdt-num">+' + n(m.nuevos) + '</span><span class="bdt-num bdt-ac">' + n(m.acum) + '</span>' +
        '<span class="bdt-var ' + v.cls + '">' + e(v.txt) + '</span></div>';
    }).join('');
    var nota = t.actual && t.actual.enCurso && t.anterior
      ? '<p class="muted small bdt-nota">El mes en curso va en +' + n(t.actual.nuevos) + '; al día ' + t.diaHoy + ' de ' + e(kLargo(t.anterior.k).toLowerCase()) + ' iban +' + n(t.anteriorAlCorte) + '.</p>' : '';
    return '<p class="muted small bdt-filtros">' + e(filtrosTxt()) + ' · ' + n(t.total) + ' referido(s)</p>' +
      '<div class="bdt-ley"><span><i class="bdt-sw-bar"></i>Nuevos del mes</span><span><i class="bdt-sw-lin"></i>Acumulado</span></div>' +
      grafica(t.meses) + nota +
      '<div class="bdt-tabla"><div class="bdt-fila bdt-cab"><span>Mes</span><span class="bdt-num">Nuevos</span><span class="bdt-num">Acumulado</span><span>Vs. mes anterior</span></div>' + filas + '</div>' +
      (t.sinFecha ? '<p class="muted small">Sin fecha de registro: ' + n(t.sinFecha) + ' (no entran en la tendencia).</p>' : '');
  }
  function abrir() {
    if (!ULT || !ULT.tend) return;
    openSheet('<div class="grip"></div><div class="bdt-head"><h2 class="h2">Crecimiento de mis referidos</h2><button class="btn btn-ghost" data-close>Cerrar</button></div><div id="lrt-hoja">' + cuerpoHoja(ULT.tend) + '</div>', 'bdt-sheet');
    var g = document.querySelector('#lrt-hoja .bdt-graf'); if (g) g.scrollLeft = g.scrollWidth;
  }

  /* ======================================================= actividad: pintar */
  var MES_C = MES;
  function fechaCorta(f) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ''); return m ? (+m[3]) + ' ' + MES_C[+m[2] - 1] + ' ' + m[1].slice(2) : ''; }
  function fila1(r) {
    return '<span class="bd-chips-lbl">Actividad:</span>' + CAT.map(function (x) {
      var v = r.cat[x.k];
      return '<button type="button" class="bd-chip bd-chip-act' + (SEL === x.k ? ' active' : '') + (!v && SEL !== x.k ? ' bd-chip-cero' : '') +
        '" data-act="' + x.k + '" aria-pressed="' + (SEL === x.k) + '">' + x.t + ' <span class="bd-chip-n">' + n(v) + '</span>' +
        (x.sub ? '<i class="bda-car" aria-hidden="true"></i>' : '') + '</button>';
    }).join('');
  }
  function fila2(r) {
    var lista = A[SEL].n || [];
    /* En la app del líder solo se listan los que tienen al menos uno de sus
       referidos (o el elegido): un catálogo largo en cero no le sirve. */
    var idx = lista.map(function (_, i) { return i; }).filter(function (i) { return r.sub[i] || ITEM === i; });
    if (!idx.length) return '<span class="bd-chips-lbl">' + e(CAT.filter(function (x) { return x.k === SEL; })[0].t) + ':</span><span class="muted small bda-vacio">Ninguno de tus referidos tiene ' + (SEL === 'e' ? 'eventos' : SEL === 'f' ? 'formularios' : 'servicios') + ' todavía.</span>';
    return idx.map(function (i) {
      var it = lista[i], v = r.sub[i], tip = it.t + (it.f ? ' · ' + it.f : '');
      return '<button type="button" class="bd-chip bd-chip-act2' + (ITEM === i ? ' active' : '') + (!v && ITEM !== i ? ' bd-chip-cero' : '') +
        '" data-i="' + i + '" title="' + e(tip) + '"><span class="bda-t">' + e(it.t) + '</span>' +
        (it.f ? '<span class="bda-f">' + e(fechaCorta(it.f)) + '</span>' : '') + ' <span class="bd-chip-n">' + n(v) + '</span></button>';
    }).join('');
  }
  function cablear() {
    var c1 = document.getElementById('lr-act'), c2 = document.getElementById('lr-act2');
    if (!c1 || c1.__ok) return;
    c1.__ok = true;
    c1.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]'); if (!b) return;
      var k = b.dataset.act;
      if (SEL === k) { SEL = ''; ITEM = -1; } else { SEL = k; ITEM = -1; }
      if (c2) c2.scrollLeft = 0;
      lrAplicar();
    });
    if (c2) c2.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-i]'); if (!b) return;
      var i = +b.dataset.i;
      ITEM = (ITEM === i) ? -1 : i;
      lrAplicar();
    });
  }
  function pintarAct(r) {
    var c1 = document.getElementById('lr-act'), c2 = document.getElementById('lr-act2');
    if (!c1 || !c2) return;
    cablear();
    if (!A) { c1.hidden = true; c2.hidden = true; c1.innerHTML = ''; c2.innerHTML = ''; c1.__h = ''; c2.__h = ''; return; }
    var h1 = fila1(r);
    if (c1.__h !== h1) { c1.innerHTML = h1; c1.__h = h1; }
    c1.hidden = false;
    var sub = SEL && CAT.filter(function (x) { return x.k === SEL; })[0].sub;
    if (sub) {
      var h2 = fila2(r);
      if (c2.__h !== h2) { var sl = c2.scrollLeft; c2.innerHTML = h2; c2.__h = h2; c2.scrollLeft = sl; }
      c2.hidden = false;
    } else { c2.hidden = true; c2.innerHTML = ''; c2.__h = ''; }
  }

  /* ========================================================= entrada */
  function pintar() {
    if (!document.getElementById('lr-list') && !document.getElementById('lr-tend')) return;
    var t0 = performance.now();
    try {
      ULT = calcular();
      pintarAct(ULT);
      pintarFranja(ULT.tend);
      var hoja = document.getElementById('lrt-hoja');
      if (hoja && ULT.tend) { var g0 = hoja.querySelector('.bdt-graf'), sl = g0 ? g0.scrollLeft : null; hoja.innerHTML = cuerpoHoja(ULT.tend); var g = hoja.querySelector('.bdt-graf'); if (g && sl != null) g.scrollLeft = sl; }
    } catch (err) { try { console.warn('LRT', err); } catch (x) {} }
    medir('lr.tablero', t0);
  }

  /* ============================================ EN VIVO de la pieza */
  var CANALES = ['compromisos', 'analisis', 'eventos', 'formularios', 'inscripciones'];
  var VIVO = { refs: [], rv: {} };
  function vivoParar() {
    VIVO.refs.forEach(function (x) { try { x.ref.off('value', x.cb); } catch (er) {} });
    VIVO.refs = [];
  }
  function vivo(rv) {
    vivoParar();
    VIVO.rv = Object.assign({}, rv || {});
    if (!A || !rv || rv.compromisos == null) return;     // CORE sin la pieza: nada que escuchar
    if (typeof ntLoadFirebase !== 'function') return;
    ntLoadFirebase(false).then(function (fb) {
      if (typeof lrVivoVivo === 'function' && !lrVivoVivo()) return;
      CANALES.forEach(function (c) {
        var ref = fb.database().ref('meta/' + c + '_rev');
        var cb = ref.on('value', function (snap) {
          var v = (snap && snap.val && snap.val()) || {};
          var ts = Number(v.ts || 0);
          if (ts && ts > Number(VIVO.rv[c] || 0)) {
            VIVO.rv[c] = ts;
            if (typeof lrVivoVivo === 'function' && lrVivoVivo() && typeof lrVivoTocar === 'function') lrVivoTocar();
          }
        }, function () {});
        VIVO.refs.push({ ref: ref, cb: cb });
      });
    }).catch(function () {});
  }

  window.LRT = {
    dato: dato,
    pasa: pasaAct,
    pintar: pintar,
    vivo: vivo,
    vivoParar: vivoParar,
    reiniciar: function () { SEL = ''; ITEM = -1; },
    hay: function () { return !!A; },
    estado: function () { return { sel: SEL, item: ITEM, hay: !!A, ult: ULT }; },
    firma: function (act) { try { return JSON.stringify(act || null); } catch (er) { return ''; } }
  };
})();
