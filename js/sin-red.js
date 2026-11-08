/* ============================================================================
 * sin-red.js — MODO SIN CONEXIÓN (08/11/2026) · pieza IDÉNTICA en PERDOMO y PRIV
 * ----------------------------------------------------------------------------
 * Sin DOM propio de la app: pinta en el contenedor que la app le presta.
 *
 *  1 · CONEXIÓN. Sonda a generate_204 de Google (sin cookies, sin datos): sin
 *      red / red lenta / con red. Solo sondea MIENTRAS no hay red (cada 12 s);
 *      con red no hay reloj. La app avisa los fallos de red con SINRED.fallo().
 *  2 · TIRA. Delgada, bajo el encabezado (.appbar) de cada vista:
 *      "Sin conexión · N pendientes"; al tocarla explica qué se puede hacer.
 *      Al volver la red: verde unos segundos "Volvió la conexión · revisa tus
 *      N pendientes". Nada se sube solo.
 *  3 · PENDIENTES. En localStorage, amarrados a un DUEÑO (la cédula del líder
 *      o del usuario del panel; 'anon' = Anotador sin sesión).
 *  4 · VALIDACIÓN LOCAL. Documento, nombre, teléfono OBLIGATORIO de 10
 *      dígitos, barrio de la lista oficial con sugerencia, duplicados dentro
 *      de los pendientes y contra lo ya guardado.
 *  5 · PEGADO. Bloques de 4 líneas (documento, nombre, barrio, teléfono)
 *      separados por línea en blanco, leídos POR CONTENIDO; o una línea por
 *      registro separada por comas / punto y coma / tabulador.
 *  6 · REVISIÓN Y SUBIDA. UNA consulta con todos los documentos → Listo /
 *      Por corregir / Ya existe (con qué líder; solo se avisa y se descarta) /
 *      Repetido. "Subir N" solo sin pendientes por corregir. Lotes de 50 con
 *      rid FIJO guardado (un reintento nunca duplica). Lo subido se borra.
 * ============================================================================ */
(function (raiz) {
  'use strict';
  if (raiz.SINRED) return;

  var NS = (raiz.STORAGE_NS || (raiz.MARCA && raiz.MARCA.STORAGE_NS) || 'jp');
  var SONDA = 'https://www.gstatic.com/generate_204';
  var LOTE = 50;

  /* ------------------------------------------------------------ utilidades */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dig(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function llave(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function palabras(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean); }
  function ahora() { return Date.now(); }
  function nid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nrid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function lev(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 3) return 9;
    var v0 = [], v1 = [], i, j;
    for (i = 0; i <= b.length; i++) v0[i] = i;
    for (i = 0; i < a.length; i++) {
      v1[0] = i + 1;
      for (j = 0; j < b.length; j++) v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + (a[i] === b[j] ? 0 : 1));
      for (j = 0; j <= b.length; j++) v0[j] = v1[j];
    }
    return v0[b.length];
  }

  /* ============================================================ 1 · CONEXIÓN */
  var estado = (typeof navigator !== 'undefined' && navigator.onLine === false) ? 'sin' : 'en';
  var oyentes = [];
  var relojSonda = null, verdeHasta = 0, verdeTmr = null;

  function sonda(ms) {
    ms = ms || 4500;
    if (typeof fetch !== 'function') return Promise.resolve('en');
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var t0 = ahora();
    var tmr = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    return fetch(SONDA + '?t=' + t0, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ctrl ? ctrl.signal : undefined })
      .then(function () { clearTimeout(tmr); return (ahora() - t0) > 2500 ? 'lenta' : 'en'; })
      .catch(function () { clearTimeout(tmr); return 'sin'; });
  }
  function poner(nuevo) {
    var antes = estado;
    if (nuevo === 'lenta') nuevo = 'en';            // lenta cuenta como con red (se avisa aparte)
    estado = nuevo;
    if (antes === 'sin' && nuevo === 'en') {
      verdeHasta = ahora() + 6000;
      clearTimeout(verdeTmr);
      verdeTmr = setTimeout(pintarTira, 6100);
    }
    if (nuevo === 'sin') vigilar(); else parar();
    pintarTira();
    if (antes !== nuevo) oyentes.forEach(function (f) { try { f(nuevo, antes); } catch (e) {} });
  }
  function vigilar() {
    if (relojSonda) return;
    relojSonda = setInterval(function () { sonda().then(function (s) { if (s !== 'sin') poner(s); }); }, 12000);
  }
  function parar() { if (relojSonda) { clearInterval(relojSonda); relojSonda = null; } }
  function revisarAhora() { return sonda().then(function (s) { poner(s); return s; }); }

  if (typeof window !== 'undefined') {
    window.addEventListener('offline', function () { poner('sin'); });
    window.addEventListener('online', function () { revisarAhora(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && estado === 'sin') revisarAhora(); });
  }

  /* ============================================================ 3 · PENDIENTES */
  var duenoFn = function () { return ''; };
  function clave(d) { return NS + ':pend:' + (d || duenoFn() || 'anon'); }
  function lista(d) { try { var a = JSON.parse(localStorage.getItem(clave(d)) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function guardar(arr, d) {
    try {
      if (arr && arr.length) localStorage.setItem(clave(d), JSON.stringify(arr));
      else localStorage.removeItem(clave(d));
    } catch (e) {}
    pintarTira();
    oyentes.forEach(function (f) { try { f(estado, estado, 'pend'); } catch (e) {} });
  }
  function contar(d) { return lista(d).length; }
  function agregar(item, d) {
    var arr = lista(d);
    var it = { id: nid(), d: dig(item.d), n: String(item.n || '').trim().replace(/\s+/g, ' ').toUpperCase(), b: String(item.b || '').trim(), t: dig(item.t), at: ahora(), src: item.src || 'form', st: 'nuevo' };
    arr.push(it);
    guardar(arr, d);
    return it;
  }
  function mover(desde, hacia) {
    var a = lista(desde);
    if (!a.length) return 0;
    var b = lista(hacia), docs = {};
    b.forEach(function (x) { docs[x.d] = 1; });
    var n = 0;
    a.forEach(function (x) { if (!docs[x.d]) { x.st = 'nuevo'; b.push(x); n++; } });
    guardar(b, hacia);
    guardar([], desde);
    return n;
  }
  function borrar(d) { guardar([], d); }

  /* ============================================================ 4 · VALIDACIÓN */
  /* Barrio: {ok, b} exacto (sin tildes/espacios/mayúsculas) | {sug:[...]} */
  function barrio(valor, oficiales) {
    var k = llave(valor);
    oficiales = oficiales || [];
    if (!k) return { ok: false, sug: [] };
    for (var i = 0; i < oficiales.length; i++) if (llave(oficiales[i]) === k) return { ok: true, b: oficiales[i] };
    var ws = palabras(valor).filter(function (w) { return w.length >= 3; });
    var pt = [];
    oficiales.forEach(function (o) {
      var ko = llave(o), wo = palabras(o), p = 0;
      if (ws.length && ws.every(function (w) { return wo.some(function (x) { return x.indexOf(w) === 0 || lev(x, w) <= 1; }); })) p = 3;
      else if (ko.indexOf(k) >= 0 || (k.length >= 4 && k.indexOf(ko) >= 0)) p = 2;
      else if (lev(ko, k) <= Math.max(1, Math.floor(k.length / 5))) p = 2;
      if (p) pt.push({ o: o, p: p, d: lev(ko, k) });
    });
    pt.sort(function (a, b) { return b.p - a.p || a.d - b.d; });
    return { ok: false, sug: pt.slice(0, 8).map(function (x) { return x.o; }) };
  }
  /* Errores de un registro (lo que se puede saber sin servidor) */
  function validar(it, ctx) {
    ctx = ctx || {};
    var e = [], min = ctx.docMin || 6;
    if (!new RegExp('^\\d{' + min + ',10}$').test(it.d || '')) e.push('Documento de ' + min + ' a 10 dígitos');
    if (String(it.n || '').trim().split(/\s+/).filter(Boolean).length < 2) e.push('Nombre y apellido');
    if (!/^\d{10}$/.test(it.t || '')) e.push('WhatsApp de 10 dígitos');
    var b = barrio(it.b, ctx.barrios);
    if (!b.ok) e.push(b.sug.length ? 'Elige el barrio de la lista' : 'Barrio de la lista oficial');
    return { errores: e, barrio: b };
  }

  /* ============================================================ 5 · PEGADO */
  var ETIQ = /^\s*(c\.?\s*c\.?|cc|c[eé]dula|documento|doc|nombres?|nombre completo|barrio|residencia|direcci[oó]n|sector|vereda|tel[eé]fono|tel|cel(ular)?|whats?app|wpp|wsp|celular)\s*[:.\-=]\s*/i;
  function campos(bloque) {
    var lineas = bloque.split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (lineas.length === 1) return lineas[0].split(/[,;\t|]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (lineas.length < 4 && lineas.some(function (l) { return /[,;\t|]/.test(l); }))
      return lineas.join(',').split(/[,;\t|]/).map(function (s) { return s.trim(); }).filter(Boolean);
    return lineas;
  }
  function clasificar(fs, oficiales) {
    var r = { d: '', n: '', b: '', t: '', raw: fs.join(' · ') };
    var textos = [];
    fs.forEach(function (f) {
      var et = (f.match(ETIQ) || [''])[0].toLowerCase();
      var v = f.replace(ETIQ, '').trim();
      var dd = dig(v);
      var soloNum = dd && /^[\d\s.\-+()]+$/.test(v);
      if (et) {
        if (/c\.?c|c[eé]dula|doc/.test(et)) { r.d = r.d || dd; return; }
        if (/nombre/.test(et)) { r.n = r.n || v; return; }
        if (/barrio|residencia|direcci|sector|vereda/.test(et)) { r.b = r.b || v; return; }
        if (/tel|cel|wha|wpp|wsp/.test(et)) { r.t = r.t || dd.replace(/^57(?=\d{10}$)/, ''); return; }
      }
      if (soloNum) {
        var tel = dd.replace(/^57(?=3\d{9}$)/, '');
        if (/^3\d{9}$/.test(tel) && !r.t) { r.t = tel; return; }
        if (!r.d) { r.d = dd; return; }
        if (!r.t) { r.t = tel; return; }
        return;
      }
      textos.push(v);
    });
    /* Textos: el que está en la lista de barrios es el barrio; el otro, el nombre */
    var yaB = !!r.b;
    textos.forEach(function (tx) {
      if (!yaB && barrio(tx, oficiales).ok && !(r.n === '' && textos.length === 1)) { r.b = tx; yaB = true; return; }
      if (!r.n) { r.n = tx; return; }
      if (!r.b) { r.b = tx; yaB = true; }
    });
    if (!r.b && textos.length === 1 && barrio(textos[0], oficiales).ok && r.n === textos[0]) { /* un solo texto que es barrio: queda como nombre (se corrige) */ }
    return r;
  }
  function leer(texto, oficiales) {
    var t = String(texto || '').replace(/\r/g, '').replace(/\u00a0/g, ' ');
    var crudos = t.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var bloques = [];
    var nSep = function (l) { return (l.match(/[,;\t|]/g) || []).length; };
    crudos.forEach(function (bq) {
      var ls = bq.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      /* Una línea con 2 o más separadores es un registro completo por sí sola */
      var resto = [];
      var cerrar = function () {
        if (!resto.length) return;
        if (resto.length > 4 && resto.length % 4 === 0) for (var i = 0; i < resto.length; i += 4) bloques.push(resto.slice(i, i + 4).join('\n'));
        else bloques.push(resto.join('\n'));
        resto = [];
      };
      ls.forEach(function (l) {
        if (nSep(l) >= 2) { cerrar(); bloques.push(l); }
        else resto.push(l);
      });
      cerrar();
    });
    return bloques.map(function (b) { return clasificar(campos(b), oficiales); })
      .filter(function (r) { return r.d || r.n || r.t; });
  }

  /* ============================================================ 2 · TIRA */
  var cfgTira = { textoSin: 'Sin conexión', ayuda: '' };
  var tiraObs = null;
  function htmlTira() {
    var n = contar();
    if (estado === 'sin') {
      return '<button type="button" class="sr-tira sr-tira--sin" data-sr="tira"><span class="sr-pt"></span><b>' + esc(cfgTira.textoSin) + '</b>' +
        (n ? '<span class="sr-sep">·</span><span>' + n + ' pendiente' + (n === 1 ? '' : 's') + '</span>' : '') +
        '<span class="sr-mas">¿Qué puedo hacer?</span></button>';
    }
    if (verdeHasta > ahora()) {
      return '<button type="button" class="sr-tira sr-tira--ok" data-sr="volvio"><span class="sr-pt"></span><b>Volvió la conexión</b>' +
        (n ? '<span class="sr-sep">·</span><span>revisa tus ' + n + ' pendiente' + (n === 1 ? '' : 's') + '</span>' : '') + '</button>';
    }
    return '';
  }
  function pintarTira() {
    if (typeof document === 'undefined') return;
    document.body && document.body.classList.toggle('sr-off', estado === 'sin');
    var app = document.getElementById('app');
    if (!app) return;
    var html = htmlTira();
    var actual = app.querySelector(':scope > .sr-tira-wrap');
    if (!html) { if (actual) actual.remove(); return; }
    var bar = app.querySelector(':scope > .appbar');
    if (!actual) {
      actual = document.createElement('div');
      actual.className = 'sr-tira-wrap';
      if (bar) bar.insertAdjacentElement('afterend', actual); else app.insertBefore(actual, app.firstChild);
    } else if (bar && actual.previousElementSibling !== bar) bar.insertAdjacentElement('afterend', actual);
    if (actual.__h !== html) { actual.innerHTML = html; actual.__h = html; }   /* sin reescribir si no cambió (la tira no parpadea) */
    var b = actual.firstElementChild;
    if (b) b.onclick = function () {
      if (b.dataset.sr === 'volvio') { verdeHasta = 0; pintarTira(); if (cfgTira.abrirPendientes) cfgTira.abrirPendientes(); return; }
      explicar();
    };
  }
  function explicar() {
    if (cfgTira.explicar) return cfgTira.explicar(cfgTira.ayuda || '');
  }
  function montar(opts) {
    opts = opts || {};
    Object.keys(opts).forEach(function (k) { cfgTira[k] = opts[k]; });
    if (opts.dueno) duenoFn = opts.dueno;
    var app = document.getElementById('app');
    if (app && !tiraObs && typeof MutationObserver === 'function') {
      /* Cada vista repinta #app: la tira vuelve a su sitio sin tocar las vistas */
      tiraObs = new MutationObserver(function () {
        if (!htmlTira()) return;
        var w = app.querySelector(':scope > .sr-tira-wrap'), bar = app.querySelector(':scope > .appbar');
        if (!w || (bar && w.previousElementSibling !== bar)) pintarTira();
      });
      tiraObs.observe(app, { childList: true });
    }
    pintarTira();
    if (estado === 'sin') { vigilar(); revisarAhora(); }
  }

  /* ============================================================ 6 · REVISIÓN */
  /* cfg = {
       el, dueno, docMin, barrios(): Promise<[]>, guardados(): Set de documentos ya en la lista,
       revisar(docs): Promise<{res:[{d,e,n,r,l,mio}]}>,
       subir(filas, rid, extra): Promise<{res:[{d,ok,m,ya}], subidos, ...}>,
       destino(): '' | html (bloque de destino: Líder principal / Líder destino),
       destinoValor(): {..} | null (null = falta elegir), alSubir(resp, n), conteo(n)
     } */
  function Revision(cfg) {
    this.cfg = cfg;
    this.barrios = [];
    this.vista = 'lista';
    this.ocupado = false;
    this.revisadoEn = 0;
  }
  Revision.prototype.items = function () { return lista(this.cfg.dueno); };
  Revision.prototype.guardar = function (arr) { guardar(arr, this.cfg.dueno); };

  /* Marca local de cada registro: corregir / repetido (sin servidor) */
  Revision.prototype.marcarLocal = function (arr) {
    var self = this, vistos = {}, guard = (this.cfg.guardados && this.cfg.guardados()) || null;
    arr.forEach(function (it) {
      if (it.st === 'existe') return;
      var v = validar(it, { barrios: self.barrios, docMin: self.cfg.docMin });
      if (v.barrio.ok && v.barrio.b !== it.b) it.b = v.barrio.b;
      it.err = v.errores;
      it.sug = v.barrio.ok ? [] : v.barrio.sug;
      if (vistos[it.d]) { it.st = 'repetido'; it.mot = 'Repetido: ya está más arriba en esta lista'; return; }
      vistos[it.d] = 1;
      if (guard && guard.has && guard.has(it.d)) { it.st = 'repetido'; it.mot = self.cfg.textoGuardado || 'Ya está en tu lista guardada'; return; }
      if (it.err.length) { it.st = 'corregir'; it.mot = it.err.join(' · '); return; }
      if (it.st === 'corregir' || it.st === 'repetido' || !it.st) it.st = 'nuevo';
      if (it.st === 'nuevo') it.mot = '';
    });
    return arr;
  };

  Revision.prototype.abrir = async function () {
    var self = this;
    try { this.barrios = (await this.cfg.barrios()) || []; } catch (e) { this.barrios = this.barrios || []; }
    this.pintar();
    if (estado !== 'sin' && this.items().some(function (x) { return x.st === 'nuevo'; })) this.revisarServidor(true);
  };

  Revision.prototype.cuentas = function (arr) {
    var c = { total: arr.length, listo: 0, corregir: 0, existe: 0, repetido: 0, nuevo: 0, fuera: 0 };
    arr.forEach(function (x) { if (x.fuera) c.fuera++; else c[x.st] = (c[x.st] || 0) + 1; });
    return c;
  };

  Revision.prototype.pintar = function () {
    var self = this, el = this.cfg.el;
    if (!el || !el.isConnected) return;
    var arr = this.marcarLocal(this.items());
    this.guardar(arr);
    var c = this.cuentas(arr);
    var sinRed = estado === 'sin';
    var subibles = arr.filter(function (x) { return !x.fuera && x.st === 'listo'; }).length;
    var bloqueo = sinRed ? 'Sin conexión: se revisa y se sube cuando vuelva la señal.'
      : c.corregir ? 'Corrige ' + c.corregir + ' registro' + (c.corregir === 1 ? '' : 's') + ' antes de subir.'
      : c.nuevo ? 'Falta revisar ' + c.nuevo + ' con el servidor.' : '';
    var puedeSubir = !sinRed && subibles > 0 && !c.corregir && !c.nuevo && !this.ocupado;
    var dest = this.cfg.destino ? this.cfg.destino() : '';
    if (this.cfg.conteo) this.cfg.conteo(arr.length);

    el.innerHTML =
      '<div class="sr-rev">' +
        '<div class="sr-res">' +
          pill('Listos', c.listo, 'ok') + pill('Por corregir', c.corregir, 'cor') + pill('Ya existen', c.existe, 'ex') +
          pill('Repetidos', c.repetido, 'rep') + (c.nuevo ? pill('Sin revisar', c.nuevo, 'nu') : '') + (c.fuera ? pill('Fuera de esta carga', c.fuera, 'fu') : '') +
        '</div>' +
        '<div class="sr-acc">' +
          '<button type="button" class="btn btn-primary" data-a="anotar">+ Anotar</button>' +
          '<button type="button" class="btn btn-ghost" data-a="pegar">Pegar varios</button>' +
          '<button type="button" class="btn btn-ghost" data-a="revisar"' + (sinRed || !arr.length ? ' disabled' : '') + '>Revisar con el servidor</button>' +
        '</div>' +
        (sinRed ? '<p class="sr-nota">Sin señal puedes anotar, pegar y corregir. La revisión y la subida esperan a que vuelva la conexión.</p>' : '') +
        (arr.length ? '' : '<div class="card pad center muted sr-vacio">No tienes pendientes. Anota o pega registros para subirlos después.</div>') +
        '<div class="sr-lista">' + arr.map(function (x) { return self.tarjeta(x); }).join('') + '</div>' +
        (arr.length ? (
          '<div class="sr-pie">' + (dest ? '<div class="sr-dest">' + dest + '</div>' : '') +
            (bloqueo ? '<p class="sr-bloq">' + esc(bloqueo) + '</p>' : '') +
            '<button type="button" class="btn btn-primary btn-block" data-a="subir"' + (puedeSubir ? '' : ' disabled') + '>Subir ' + subibles + '</button>' +
          '</div>') : '') +
      '</div>';
    el.onclick = function (ev) { self.clic(ev); };
    el.oninput = function (ev) { self.entrada(ev); };
  };
  function pill(t, n, k) { return '<span class="sr-pill sr-pill--' + k + (n ? '' : ' sr-pill--0') + '"><b>' + n + '</b> ' + esc(t) + '</span>'; }

  Revision.prototype.tarjeta = function (x) {
    var et = {
      listo: ['Listo', 'ok'], corregir: ['Por corregir', 'cor'], existe: ['Ya existe', 'ex'],
      repetido: ['Repetido', 'rep'], nuevo: ['Sin revisar', 'nu']
    }[x.st] || ['Sin revisar', 'nu'];
    if (x.fuera) et = ['Fuera de esta carga', 'fu'];
    var abierta = this.editando === x.id || (x.st === 'corregir' && this.editando == null && this.primeraCorregir === x.id);
    var acc;
    if (x.st === 'existe' || x.st === 'repetido') {
      acc = '<button type="button" class="btn btn-quiet sr-mini" data-a="descartar" data-id="' + x.id + '">Descartar</button>';
    } else {
      acc = '<button type="button" class="btn btn-quiet sr-mini" data-a="editar" data-id="' + x.id + '">' + (abierta ? 'Cerrar' : 'Editar') + '</button>' +
        '<button type="button" class="btn btn-quiet sr-mini" data-a="fuera" data-id="' + x.id + '">' + (x.fuera ? 'Volver a esta carga' : 'Quitar de esta carga') + '</button>' +
        '<button type="button" class="btn btn-quiet sr-mini sr-rojo" data-a="borrar" data-id="' + x.id + '">Borrar</button>';
    }
    return '<div class="sr-card sr-card--' + et[1] + '" data-id="' + x.id + '">' +
      '<div class="sr-card-top"><div class="sr-card-id"><b>' + esc(x.n || 'SIN NOMBRE') + '</b><span>CC ' + esc(x.d || '—') + '</span></div>' +
        '<span class="sr-chip sr-chip--' + et[1] + '">' + et[0] + '</span></div>' +
      '<div class="sr-card-dat"><span>📍 ' + esc(x.b || 'Sin barrio') + '</span><span>📱 ' + esc(x.t || 'Sin WhatsApp') + '</span></div>' +
      (x.mot ? '<p class="sr-mot">' + esc(x.mot) + '</p>' : '') +
      (x.sug && x.sug.length && !abierta ? '<div class="sr-sugs"><span>¿Quisiste decir?</span>' + x.sug.map(function (s) { return '<button type="button" class="sr-sug" data-a="sug" data-id="' + x.id + '" data-v="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' : '') +
      (abierta ? this.formEdicion(x) : '') +
      '<div class="sr-card-acc">' + acc + '</div></div>';
  };

  Revision.prototype.formEdicion = function (x) {
    return '<div class="sr-edit" data-id="' + x.id + '">' +
      campo('Documento', '<input class="input" data-f="d" inputmode="numeric" maxlength="10" value="' + esc(x.d) + '">') +
      campo('Nombre completo', '<input class="input" data-f="n" value="' + esc(x.n) + '">') +
      campo('WhatsApp', '<input class="input" data-f="t" inputmode="numeric" maxlength="10" value="' + esc(x.t) + '">') +
      campo('Barrio', '<input class="input" data-f="b" list="sr-barrios" autocomplete="off" value="' + esc(x.b) + '">') +
      datalist(this.barrios) +
      '<div class="sr-sugs" data-sugs="' + x.id + '">' + (x.sug || []).map(function (s) { return '<button type="button" class="sr-sug" data-a="sug" data-id="' + x.id + '" data-v="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
      '<button type="button" class="btn btn-primary btn-block" data-a="guardarEd" data-id="' + x.id + '">Guardar cambios</button></div>';
  };
  function campo(t, inner) { return '<label class="field"><span>' + esc(t) + '</span>' + inner + '</label>'; }
  function datalist(bs) {
    if (typeof document !== 'undefined' && document.getElementById('sr-barrios')) return '';
    return '<datalist id="sr-barrios">' + (bs || []).map(function (b) { return '<option value="' + esc(b) + '">'; }).join('') + '</datalist>';
  }

  Revision.prototype.entrada = function (ev) {
    var t = ev.target;
    if (!t || t.dataset.f !== 'b') return;
    var box = t.closest('.sr-edit'), sugs = box && box.querySelector('[data-sugs]');
    if (!sugs) return;
    var r = barrio(t.value, this.barrios), id = box.dataset.id;
    sugs.innerHTML = r.ok ? '<span class="sr-okb">✓ ' + esc(r.b) + '</span>' : r.sug.map(function (s) { return '<button type="button" class="sr-sug" data-a="sug" data-id="' + id + '" data-v="' + esc(s) + '">' + esc(s) + '</button>'; }).join('');
  };

  Revision.prototype.cambiar = function (id, fn) {
    var arr = this.items(), it = arr.find(function (x) { return x.id === id; });
    if (!it) return;
    fn(it, arr);
    this.guardar(arr.filter(function (x) { return !x.__borrar; }));
  };

  Revision.prototype.clic = function (ev) {
    var b = ev.target.closest('[data-a]');
    if (!b || b.disabled) return;
    var a = b.dataset.a, id = b.dataset.id, self = this;
    if (a === 'anotar') return this.cfg.anotar && this.cfg.anotar(function () { self.pintar(); if (estado !== 'sin') self.revisarServidor(true); });
    if (a === 'pegar') return this.pegar();
    if (a === 'revisar') return this.revisarServidor(false);
    if (a === 'subir') return this.subir(b);
    if (a === 'editar') { this.editando = this.editando === id ? undefined : id; this.primeraCorregir = null; return this.pintar(); }
    if (a === 'fuera') { this.cambiar(id, function (it) { it.fuera = !it.fuera; }); return this.pintar(); }
    if (a === 'descartar' || a === 'borrar') {
      if (a === 'borrar' && !raiz.confirm('¿Borrar este registro de tus pendientes?')) return;
      this.cambiar(id, function (it) { it.__borrar = true; });
      return this.pintar();
    }
    if (a === 'sug') {
      var input = this.cfg.el.querySelector('.sr-edit[data-id="' + id + '"] [data-f="b"]');
      if (input) { input.value = b.dataset.v; this.entrada({ target: input }); return; }
      this.cambiar(id, function (it) { it.b = b.dataset.v; it.st = 'nuevo'; });
      this.pintar();
      if (estado !== 'sin') this.revisarServidor(true);
      return;
    }
    if (a === 'guardarEd') {
      var box = this.cfg.el.querySelector('.sr-edit[data-id="' + id + '"]');
      var v = function (f) { var i = box.querySelector('[data-f="' + f + '"]'); return i ? i.value : ''; };
      var nuevo = { d: dig(v('d')), n: String(v('n')).trim().replace(/\s+/g, ' ').toUpperCase(), t: dig(v('t')).replace(/^57(?=\d{10}$)/, ''), b: String(v('b')).trim() };
      var vb = barrio(nuevo.b, this.barrios);
      if (vb.ok) nuevo.b = vb.b;
      this.cambiar(id, function (it) { Object.assign(it, nuevo); it.st = 'nuevo'; it.mot = ''; });
      this.editando = undefined;
      this.pintar();
      if (estado !== 'sin') this.revisarServidor(true);
    }
  };

  /* Pegar varios: hoja con el texto, vista previa y "Agregar N a pendientes" */
  Revision.prototype.pegar = function () {
    var self = this;
    if (!this.cfg.hoja) return;
    var h = this.cfg.hoja(
      '<h2 class="h2" style="margin-bottom:6px;">Pegar varios registros</h2>' +
      '<p class="muted small">Pega lo que anotaste en WhatsApp o en notas. Cada persona en un bloque de 4 líneas —documento, nombre, barrio, WhatsApp— separados por una línea en blanco. También sirve una línea por persona separada por comas.</p>' +
      '<textarea class="input area" id="sr-pegado" rows="8" placeholder="1110456789\nMARÍA PÉREZ\nSan Luis\n3101234567\n\n1110987654, JUAN GÓMEZ, Centro, 3207654321"></textarea>' +
      '<div id="sr-previa" class="sr-previa"></div>' +
      '<div class="stack" style="margin-top:12px;"><button type="button" class="btn btn-primary btn-block" id="sr-pegar-ok" disabled>Agregar a pendientes</button>' +
      '<button type="button" class="btn btn-quiet btn-block" id="sr-pegar-no">Cancelar</button></div>'
    );
    if (!h || !h.querySelector) h = document.querySelector('#layer .sheet') || document.body;   /* la app no devolvió la hoja */
    var ta = h.querySelector('#sr-pegado'), pv = h.querySelector('#sr-previa'), ok = h.querySelector('#sr-pegar-ok');
    var leidos = [];
    var prev = function () {
      leidos = leer(ta.value, self.barrios);
      ok.disabled = !leidos.length;
      ok.textContent = leidos.length ? 'Agregar ' + leidos.length + ' a pendientes' : 'Agregar a pendientes';
      pv.innerHTML = leidos.length ? '<p class="small muted">Así lo leímos (luego puedes corregir cada uno):</p>' + leidos.slice(0, 30).map(function (r) {
        var v = validar(r, { barrios: self.barrios, docMin: self.cfg.docMin });
        return '<div class="sr-pv' + (v.errores.length ? ' sr-pv--cor' : '') + '"><b>' + esc(r.n || '¿nombre?') + '</b> · CC ' + esc(r.d || '¿?') + ' · ' + esc(r.b || '¿barrio?') + ' · ' + esc(r.t || '¿WhatsApp?') +
          (v.errores.length ? '<span>' + esc(v.errores.join(' · ')) + '</span>' : '') + '</div>';
      }).join('') + (leidos.length > 30 ? '<p class="small muted">… y ' + (leidos.length - 30) + ' más</p>' : '') : '';
    };
    ta.oninput = prev;
    h.querySelector('#sr-pegar-no').onclick = function () { self.cfg.cerrarHoja(); };
    ok.onclick = function () {
      leidos.forEach(function (r) { var vb = barrio(r.b, self.barrios); agregar({ d: r.d, n: r.n, b: vb.ok ? vb.b : r.b, t: r.t, src: 'pegado' }, self.cfg.dueno); });
      self.cfg.cerrarHoja();
      self.pintar();
      if (estado !== 'sin') self.revisarServidor(true);
    };
    setTimeout(function () { ta.focus(); }, 60);
  };

  /* UNA consulta con todos los documentos sin revisar (o todos si se pide) */
  Revision.prototype.revisarServidor = async function (soloNuevos) {
    if (this.revisando || estado === 'sin') return;
    var arr = this.marcarLocal(this.items());
    var objetivo = arr.filter(function (x) { return x.d && x.st !== 'repetido' && (!soloNuevos || x.st === 'nuevo' || x.st === 'corregir'); });
    if (!objetivo.length) { this.guardar(arr); return this.pintar(); }
    this.revisando = true;
    var btn = this.cfg.el && this.cfg.el.querySelector('[data-a="revisar"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Revisando…'; }
    try {
      var docs = objetivo.map(function (x) { return x.d; });
      var r = await this.cfg.revisar(docs);
      var mapa = {};
      ((r && r.res) || []).forEach(function (x) { mapa[x.d] = x; });
      arr = this.items();
      arr.forEach(function (it) {
        var s = mapa[it.d];
        if (!s) return;
        if (s.e) {
          it.st = 'existe';
          it.mot = s.mio ? 'Ya está en tu grupo' : (s.l ? 'Ya existe con el líder ' + s.l + (s.r ? ' (N° ' + s.r + ')' : '') : (s.r ? 'Ya existe con el líder N° ' + s.r : 'Ya está registrada sin líder'));
          it.ex = { n: s.n || '', l: s.l || '', r: s.r || '' };
        } else if (it.st === 'nuevo') { it.st = 'listo'; it.mot = ''; }
      });
      this.revisadoEn = ahora();
      this.guardar(this.marcarLocal(arr).map(function (it) { if (it.st === 'nuevo' && mapa[it.d] && !mapa[it.d].e) it.st = 'listo'; return it; }));
    } catch (e) {
      if (!(e && e.cortado)) { fallo(e); if (this.cfg.aviso) this.cfg.aviso(estado === 'sin' ? 'Sin conexión: revisa cuando vuelva la señal' : 'No se pudo revisar. Intenta de nuevo.', 'err'); }
    } finally { this.revisando = false; }
    this.pintar();
  };

  /* Subida por lotes de 50 con rid FIJO por lote (guardado en los registros) */
  Revision.prototype.subir = async function (btn) {
    if (this.ocupado || estado === 'sin') return;
    var dv = this.cfg.destinoValor ? this.cfg.destinoValor() : {};
    if (dv === null) { if (this.cfg.aviso) this.cfg.aviso('Elige a dónde se suben antes de continuar', 'err'); return; }
    var arr = this.marcarLocal(this.items());
    if (arr.some(function (x) { return !x.fuera && (x.st === 'corregir' || x.st === 'nuevo'); })) return this.pintar();
    var listos = arr.filter(function (x) { return !x.fuera && x.st === 'listo'; });
    if (!listos.length) return;
    this.ocupado = true;
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Subiendo…'; }
    var subidos = 0, malos = 0, resps = [];
    var firmaDest = JSON.stringify(dv || {});
    try {
      for (var i = 0; i < listos.length; i += LOTE) {
        var tanda = listos.slice(i, i + LOTE);
        /* rid fijo: si la red se cae a mitad y se reintenta, el CORE devuelve
           la misma respuesta sin volver a escribir. Cambia si cambia la tanda. */
        var firma = tanda.map(function (x) { return x.id; }).join(',') + '|' + firmaDest;
        var rid = (tanda[0].rid && tanda[0].ridF === firma) ? tanda[0].rid : nrid();
        var todos = this.items();
        todos.forEach(function (it) { if (tanda.some(function (t) { return t.id === it.id; })) { it.rid = rid; it.ridF = firma; } });
        this.guardar(todos);
        var filas = tanda.map(function (x) { return { d: x.d, n: x.n, t: x.t, b: x.b }; });
        var r = await this.cfg.subir(filas, rid, dv);
        resps.push(r);
        var res = (r && r.res) || [];
        var porDoc = {};
        res.forEach(function (x) { porDoc[x.d] = x; });
        todos = this.items();
        todos.forEach(function (it) {
          if (!tanda.some(function (t) { return t.id === it.id; })) return;
          var s = porDoc[it.d];
          if (!s) return;
          if (s.ok) { it.__borrar = true; subidos++; return; }
          malos++;
          delete it.rid; delete it.ridF;
          if (s.ya) { it.st = 'existe'; it.mot = 'Ya estaba registrada (alguien la subió antes)'; }
          else { it.st = 'corregir'; it.mot = s.m || 'Revisa este registro'; }
        });
        this.guardar(todos.filter(function (x) { return !x.__borrar; }));
      }
      if (this.cfg.alSubir) this.cfg.alSubir(resps, subidos, malos);
    } catch (e) {
      if (!(e && e.cortado)) {
        fallo(e);
        if (this.cfg.aviso) this.cfg.aviso(estado === 'sin' ? 'Se fue la señal. Tus pendientes siguen guardados; vuelve a subir cuando regrese.' : ((e && e.message) || 'No se pudo subir. Intenta de nuevo.'), 'err');
      }
    } finally { this.ocupado = false; }
    this.pintar();
  };

  /* La app avisa que una llamada falló por red: se confirma con la sonda */
  function fallo(err) {
    if (err && (err.red || err.tiempo || /conexi[oó]n|network|fetch/i.test(String(err.message || '')))) revisarAhora();
  }

  raiz.SINRED = {
    get estado() { return estado; },
    enLinea: function () { return estado !== 'sin'; },
    al: function (fn) { oyentes.push(fn); },
    revisarAhora: revisarAhora,
    fallo: fallo,
    montar: montar,
    pintarTira: pintarTira,
    lista: lista, contar: contar, agregar: agregar, mover: mover, borrar: borrar, guardar: guardar,
    barrio: barrio, validar: validar, leer: leer, llave: llave,
    Revision: Revision
  };
})(typeof self !== 'undefined' ? self : this);
