/* ============================================================================
 * lr-validar.js — PERDOMO · MIS REFERIDOS: VALIDACIÓN DE REGISTROS (12/11/2026)
 * ----------------------------------------------------------------------------
 * Todo lo que hacía la app JHONNY-POSTCONSULTA, ahora dentro de Mis referidos.
 * Solo aparece si el líder tiene registros en POR CONFIRMAR (los suyos y los
 * de los líderes que apadrina, decisión A del 09/11); si no tiene, la vista
 * queda exactamente como antes.
 *
 *   · Documento correcto / No falleció → pub.pcVisto      (A LA ESPERA)
 *   · Corregir documento o nombre      → pub.pcEditar     (SIN CONSULTAR, propaga)
 *   · Confirmar fallecimiento          → pub.pcFallecido  (solo el motivo con
 *                                        la acción de fallecimiento → INACTIVO)
 *   Mismas reglas, mismos motivos (los de PRIV → Configuración → Avanzado),
 *   misma confirmación con responsabilidad y la misma trazabilidad en el CORE
 *   (VALIDACIONES, hito 'validacion'): las rutas son las mismas de antes.
 *
 * Rendimiento:
 *   · Cero viajes extra: la lista POR CONFIRMAR viaja DENTRO de
 *     pub.liderReferidos (pc=1 → r.pc). Con un CORE que todavía no la manda,
 *     y solo si en la lista hay alguien POR CONFIRMAR, se pide pub.pcLista de
 *     fondo (nunca bloquea la lista). Front y CORE se suben en cualquier orden.
 *   · Guardar: botón ocupado + escudo desde el primer toque, rid por RED
 *     (reintento solo con el mismo rid). La tarjeta del referido se parcha en
 *     memoria (lrTrasParche) y sale del panel: sin recargar la lista.
 *   · dev en las escrituras: la señal EN VIVO de mi propio guardado no vuelve
 *     a pedir la lista.
 * Depende de app.js: api, apiSilencio, openSheet, closeLayer, toast, esc, layer,
 *   LR_REFS, LR_COMO, lrListaMem, lrClaveCache, lrTrasParche, lrParchar,
 *   lrAnotarPropio, lrMedir, RAP, SINRED.
 * ============================================================================ */
(function () {
  'use strict';

  var K_BIEN = (typeof nsKey === 'function') ? nsKey('lrv_bienvenida_v1') : 'lrv_bienvenida_v1';
  var K_ABRE = (typeof nsKey === 'function') ? nsKey('lrv_abierto') : 'lrv_abierto';
  var P = null;            // pieza pc del CORE ({ok, n, items, grupos, motivos}) · null = CORE sin pc
  var VIA = '';            // 'pc' (con la lista) | 'respaldo' (pub.pcLista de fondo)
  var S = { filtro: 'todos', grupo: '', q: '' };
  var pidiendo = false, pedidoPara = '', guardando = false, felicitar = false;
  var MED = [];
  window.LRV_TIEMPOS = function () { return MED.slice(); };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function e(s) { return esc(s); }
  function soloDig(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function docFmt(d) { return soloDig(d).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function iniciales(n) { var p = String(n || '').trim().split(/\s+/).filter(Boolean); return ((p[0] || '?')[0] + (p.length > 2 ? p[2][0] : (p[1] || '')[0] || '')).toUpperCase(); }
  function pNombre(n) { var s = String(n || '').trim().split(/\s+/)[0] || ''; return s.charAt(0) + s.slice(1).toLowerCase(); }
  function abierto() { try { return sessionStorage.getItem(K_ABRE) === '1'; } catch (x) { return false; } }
  function setAbierto(v) { try { sessionStorage.setItem(K_ABRE, v ? '1' : '0'); } catch (x) {} }
  function medir(n, t0, extra) { MED.push(Object.assign({ n: n, ms: Math.round(performance.now() - t0), t: Date.now() }, extra || {})); if (MED.length > 60) MED.shift(); }

  /* ------------------------------------------------------------- íconos */
  var I = {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    lapiz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    cruz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 8h10"/></svg>',
    censo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M15 10h3M15 14h3M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2"/></svg>',
    derechos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6Z"/><path d="m9 9 6 6M15 9l-6 6"/></svg>',
    urna: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16v8H4Z"/><path d="M8 12V5h8v7"/><path d="M10 8h4"/><path d="M3 3l18 18"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    ayuda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01"/></svg>',
    recargar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/></svg>',
    escudo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/></svg>',
    trofeo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
    abajo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
  };

  /* ------------------------------------------------------------- motivos
     Los de la configuración de PRIV (llegan con la lista). Si no llegan,
     quedan los 4 de fábrica (los mismos de POSTCONSULTA). */
  var MOT_DEF = [
    { id: 'censo', v: 'NO APARECE EN CENSO', t: 'No aparece en censo', ic: 'censo', on: true, alias: [], l: 'Al consultarlo en la Registraduría no salió. Casi siempre es un número mal escrito: compáralo con la cédula.' },
    { id: 'muerte', v: 'MUERTE', t: 'Posible fallecimiento', ic: 'cruz', muerte: true, on: true, alias: [], l: 'La Registraduría lo reporta como fallecido. Confírmalo con su familia o corrige el número si está mal escrito.' },
    { id: 'derechos', v: 'VIGENTE CON PERDIDA O SUSPENSION DE LOS DERECHOS POLITICOS', t: 'Derechos políticos perdidos o suspendidos', ic: 'derechos', on: true, alias: [], l: 'La cédula está vigente, pero la Registraduría la reporta con los derechos políticos perdidos o suspendidos: no puede votar. Revisa que el número esté bien escrito.' },
    { id: 'habilitado', v: 'NO SE ENCUENTRA HABILITADO PARA VOTAR', t: 'No habilitado para votar', ic: 'urna', on: true, alias: [], l: 'La Registraduría lo reporta como no habilitado para votar. Revisa que el número esté bien escrito; si está bien, confírmalo.' }
  ];
  var MOT_OTRO = { id: 'otro', t: 'Por confirmar', d: 'El equipo lo marcó para que revises si el documento está bien escrito. Compáralo con la cédula.', ic: 'info', cls: '', muerte: false };
  function motClave(v) { var x = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toUpperCase(); return x.normalize ? x.normalize('NFD').replace(/[̀-ͯ]/g, '') : x; }
  function motivos() { var l = P && P.motivos; return (Array.isArray(l) && l.length) ? l : MOT_DEF; }
  var memo = { de: null, mapa: null };
  function motMapa() {
    var l = motivos(); if (memo.de === l) return memo.mapa;
    var m = {};
    l.forEach(function (x) {
      var o = { id: x.id, t: x.t || x.v, d: x.l || x.d || '', ic: I[x.ic] ? x.ic : 'info', cls: x.muerte ? 'muerte' : '', muerte: !!x.muerte, on: x.on !== false };
      [x.v].concat(x.alias || []).forEach(function (k) { if (k) m[motClave(k)] = o; });
    });
    memo = { de: l, mapa: m };
    return m;
  }
  function motivoDe(m) { return motMapa()[motClave(m)] || MOT_OTRO; }
  function filtroDe(m) { return motivoDe(m).id; }

  /* ------------------------------------------------------------- datos */
  function todos() { return (P && Array.isArray(P.items)) ? P.items : []; }
  /* En modo padrino se ve solo lo del grupo que se gestiona */
  function items() {
    var it = todos();
    return LR_COMO ? it.filter(function (x) { return String(x.g) === String(LR_COMO); }) : it;
  }
  function item(doc) { var it = todos(); for (var i = 0; i < it.length; i++) if (String(it[i].d) === String(doc)) return it[i]; return null; }
  function grupo(g) { var gs = (P && P.grupos) || []; for (var i = 0; i < gs.length; i++) if (String(gs[i].codigo) === String(g)) return gs[i]; return null; }
  function firma(pc) { return (pc && Array.isArray(pc.items)) ? pc.items.map(function (x) { return x.d + '|' + x.m + '|' + x.g + '|' + x.n; }).join('~') + '#' + JSON.stringify(pc.motivos || '') : String(pc && pc.n); }

  /* r.pc de pub.liderReferidos (undefined = CORE que todavía no la manda) */
  function dato(pc) {
    if (pc && typeof pc === 'object' && pc.ok !== false) {
      if (!Array.isArray(pc.items)) pc.items = [];
      P = pc; VIA = 'pc';
    } else if (VIA !== 'respaldo') { P = null; VIA = ''; }
    memo.de = null;
  }

  /* Respaldo con un CORE sin pc: solo si en la lista hay POR CONFIRMAR */
  function respaldo() {
    if (VIA === 'pc' || pidiendo) return;
    if (window.SINRED && !SINRED.enLinea()) return;
    var hay = (LR_REFS || []).some(function (x) { return String(x.municipio || '').trim().toUpperCase() === 'POR CONFIRMAR'; });
    if (!hay) return;
    var para = String(LR_COMO || 'yo');
    if (VIA === 'respaldo' && pedidoPara === para && P) return;
    pidiendo = true; pedidoPara = para;
    var t0 = performance.now();
    apiSilencio('pub.pcLista', {}).then(function (d) {
      if (d && d.ok !== false && Array.isArray(d.items)) { P = d; VIA = 'respaldo'; memo.de = null; medir('respaldo-pcLista', t0, { n: d.items.length }); repintar(); }
    }).catch(function () {}).then(function () { pidiendo = false; });
  }

  /* ------------------------------------------------------------- pintar */
  function pintar() {
    var cont = $('#lr-val');
    if (!cont) return;
    var t0 = performance.now();
    if (!P) respaldo();
    var lista = items();
    if (!lista.length) {
      if (felicitar && P) { cont.hidden = false; cont.innerHTML = vacioHtml(); enganchar(cont); }
      else { cont.hidden = true; cont.innerHTML = ''; }
      return;
    }
    felicitar = false;
    cont.hidden = false;
    cont.innerHTML = bannerHtml(lista) + (abierto() ? panelHtml(lista) : '');
    enganchar(cont);
    medir('pintar', t0, { n: lista.length });
  }
  function repintar() { pintar(); repintarSellos(); }

  function conteos(lista) {
    var c = { todos: lista.length, otro: 0 };
    motivos().forEach(function (m) { c[m.id] = 0; });
    lista.forEach(function (x) { var f = filtroDe(x.m); c[f] = (c[f] || 0) + 1; });
    return c;
  }

  function bannerHtml(lista) {
    var n = lista.length, ab = abierto();
    var c = conteos(lista);
    var pills = motivos().map(function (m) { return c[m.id] ? '<span class="lrv-pill ' + (m.muerte ? 'muerte' : '') + '">' + e(m.t || m.v) + ' · ' + c[m.id] + '</span>' : ''; }).join('') +
      (c.otro ? '<span class="lrv-pill">Por confirmar · ' + c.otro + '</span>' : '');
    return '<div class="lrv-banner' + (ab ? ' abierto' : '') + '">' +
      '<div class="lrv-ico">' + I.escudo + '</div>' +
      '<div class="lrv-txt"><b>' + n + (n === 1 ? ' documento por validar' : ' documentos por validar') + '</b>' +
        '<span>Revisa con la persona que su cédula esté bien escrita.</span>' +
        '<div class="lrv-pills">' + pills + '</div></div>' +
      '<button class="btn ' + (ab ? 'btn-quiet' : 'btn-primary') + ' lrv-toggle" data-v="toggle">' + (ab ? 'Ocultar' : 'Validar ahora') + '</button>' +
    '</div>';
  }

  function panelHtml(lista) {
    var c = conteos(lista);
    var chips = [['todos', 'Todos', c.todos]].concat(motivos().map(function (m) { return [m.id, m.t || m.v, c[m.id] || 0]; }), [['otro', 'Por confirmar', c.otro]])
      .filter(function (x) { return x[0] === 'todos' || x[2] > 0; })
      .map(function (x) { return '<button class="bd-chip ' + (S.filtro === x[0] ? 'active' : '') + '" data-f="' + x[0] + '">' + e(x[1]) + ' <span class="lrv-n">' + x[2] + '</span></button>'; });
    if (!LR_COMO) {
      var porG = {}; lista.forEach(function (x) { porG[x.g] = (porG[x.g] || 0) + 1; });
      if (Object.keys(porG).length > 1) {   // solo si hay registros de más de un grupo
        ((P && P.grupos) || []).forEach(function (g) {
          if (!porG[g.codigo]) return;
          chips.push('<button class="bd-chip ' + (S.grupo === String(g.codigo) ? 'active' : '') + '" data-g="' + e(g.codigo) + '">' + (g.propio ? 'Mi grupo' : 'De #' + e(g.codigo) + ' ' + e(pNombre(g.nombre))) + ' <span class="lrv-n">' + porG[g.codigo] + '</span></button>');
        });
      }
    }
    var vis = filtrados(lista);
    return '<div class="lrv-panel">' +
      '<div class="lrv-acts">' +
        '<button class="btn btn-quiet" data-v="actualizar">' + I.recargar + ' Actualizar</button>' +
        '<button class="btn btn-quiet" data-v="motivos">' + I.info + ' ¿Qué significa cada motivo?</button>' +
        '<button class="btn btn-quiet" data-v="ayuda">' + I.ayuda + ' ¿Cómo funciona?</button>' +
      '</div>' +
      '<div class="bd-chips lrv-chips">' + chips.join('') + '</div>' +
      (lista.length > 6 ? '<div class="lrv-buscar"><input class="input" id="lrv-q" placeholder="Buscar por nombre o documento" value="' + e(S.q) + '" autocomplete="off" /></div>' : '') +
      '<div class="lrv-lista" id="lrv-lista">' + (vis.length ? vis.map(tarjetaHtml).join('') : '<p class="muted center small">No hay registros con ese filtro.</p>') + '</div>' +
    '</div>';
  }

  function filtrados(lista) {
    var q = S.q.trim().toUpperCase(), qd = soloDig(S.q);
    return lista.filter(function (x) {
      if (S.filtro !== 'todos' && filtroDe(x.m) !== S.filtro) return false;
      if (S.grupo && String(x.g) !== S.grupo) return false;
      if (q && String(x.n).toUpperCase().indexOf(q) < 0 && !(qd && soloDig(x.d).indexOf(qd) >= 0)) return false;
      return true;
    });
  }

  function accionesHtml(x) {
    return motivoDe(x.m).muerte
      ? '<button class="btn lrv-ok" data-a="visto">' + I.ok + ' No falleció</button><button class="btn btn-quiet" data-a="fallecido">' + I.cruz + ' Confirmar fallecimiento</button><button class="btn btn-quiet lrv-ancho" data-a="editar">' + I.lapiz + ' Corregir documento o nombre</button>'
      : '<button class="btn lrv-ok" data-a="visto">' + I.ok + ' Documento correcto</button><button class="btn btn-quiet" data-a="editar">' + I.lapiz + ' Corregir</button>';
  }
  function selloHtml(mo) { return '<div class="lrv-sello">' + I[mo.ic] + '<span><b>' + e(mo.t) + '</b>' + e(mo.d) + '</span></div>'; }

  function tarjetaHtml(x) {
    var mo = motivoDe(x.m), g = grupo(x.g), tel = soloDig(x.t);
    return '<article class="lrv-card ' + mo.cls + '" data-doc="' + e(x.d) + '">' +
      '<div class="lrv-top"><div class="lrv-av">' + e(iniciales(x.n)) + '</div>' +
        '<div class="lrv-nom"><b>' + e(x.n || 'Sin nombre') + '</b><span><small>CC</small> ' + e(docFmt(x.d)) + '</span></div></div>' +
      selloHtml(mo) +
      '<div class="lrv-meta">' +
        (x.r ? '<span>' + e(x.r) + '</span>' : '') +
        (g && !g.propio ? '<span>Grupo de #' + e(g.codigo) + ' ' + e(g.nombre) + '</span>' : '') +
        (tel.length === 10 ? '<a href="https://wa.me/57' + tel + '" target="_blank" rel="noopener">WhatsApp ' + e(tel) + '</a>' : '') +
      '</div>' +
      '<div class="lrv-btns">' + accionesHtml(x) + '</div>' +
    '</article>';
  }

  function vacioHtml() {
    var nom = pNombre((P && P.nombre) || (window.LIDER && LIDER.nombre));
    return '<div class="lrv-vacio"><div class="lrv-medalla">' + I.trofeo + '</div>' +
      '<b>¡Excelente trabajo' + (nom ? ', ' + e(nom) : '') + '!</b>' +
      '<p class="muted small">No tienes documentos por validar. Gracias por cuidar los datos de tu grupo: cada documento correcto es una persona que podemos acompañar el día de la elección.</p>' +
      '<button class="btn btn-quiet" data-v="cerrarVacio">Cerrar</button></div>';
  }

  function enganchar(cont) {
    $$('[data-v]', cont).forEach(function (b) {
      b.onclick = function () {
        var v = b.dataset.v;
        if (v === 'toggle') {
          var ab = !abierto(); setAbierto(ab);
          pintar();
          if (ab && !leerBien()) bienvenida(true);
          return;
        }
        if (v === 'actualizar') return actualizar(b);
        if (v === 'motivos') return motivosHoja();
        if (v === 'ayuda') return bienvenida(false);
        if (v === 'cerrarVacio') { felicitar = false; pintar(); }
      };
    });
    $$('[data-f]', cont).forEach(function (b) { b.onclick = function () { S.filtro = b.dataset.f; pintar(); }; });
    $$('[data-g]', cont).forEach(function (b) { b.onclick = function () { S.grupo = (S.grupo === b.dataset.g) ? '' : b.dataset.g; pintar(); }; });
    var q = $('#lrv-q', cont);
    if (q) q.oninput = function () { S.q = q.value; var l = $('#lrv-lista'); if (l) { var vis = filtrados(items()); l.innerHTML = vis.length ? vis.map(tarjetaHtml).join('') : '<p class="muted center small">No hay registros con ese filtro.</p>'; } };
    var lista = $('#lrv-lista', cont);
    if (lista) lista.onclick = function (ev) {
      var b = ev.target.closest('[data-a]'); if (!b) return;
      var card = b.closest('.lrv-card'); var x = card && item(card.dataset.doc);
      if (x) accion(b.dataset.a, x);
    };
  }

  /* --------------------------------------------- en la tarjeta del referido
     Sello del motivo + botón «Validar» en las tarjetas POR CONFIRMAR. */
  function sello(rf) {
    if (!rf || String(rf.municipio || '').trim().toUpperCase() !== 'POR CONFIRMAR') return '';
    var x = item(rf.documento); if (!x) return '';
    var mo = motivoDe(x.m);
    return '<div class="lrv-rc ' + mo.cls + '">' + I[mo.ic] + '<span>' + e(mo.t) + '</span><button class="lrv-rc-btn" data-act="validar">Validar</button></div>';
  }
  function repintarSellos() {
    $$('#lr-list .rcard.muni-confirmar').forEach(function (c) {
      var rf = (LR_REFS || []).find(function (z) { return String(z.documento) === String(c.dataset.doc); });
      var viejo = c.querySelector('.lrv-rc'), html = sello(rf);
      if (viejo) viejo.remove();
      if (html) { var top = c.querySelector('.rcard-top'); if (top) top.insertAdjacentHTML('afterend', html); }
    });
  }
  /* Tocar «Validar» en la tarjeta: las mismas opciones del panel */
  function validar(rf) {
    var x = item(rf.documento); if (!x) return toast('Este registro ya no está por validar', '');
    var mo = motivoDe(x.m);
    var sh = openSheet('<div class="grip"></div><h2 class="h2">Validar documento</h2>' +
      '<p class="muted small" style="margin:4px 0 10px">' + e(x.n) + ' · CC ' + e(docFmt(x.d)) + '</p>' +
      selloHtml(mo) + '<div class="lrv-btns" style="margin-top:12px">' + accionesHtml(x) + '</div>', 'lrv-hoja');
    $$('[data-a]', sh).forEach(function (b) { b.onclick = function () { accion(b.dataset.a, x); }; });
  }

  /* ------------------------------------------------------------- acciones */
  var TXT = {
    visto: function (x) {
      var muerte = motivoDe(x.m).muerte;
      return {
        tit: muerte ? 'Confirmar que NO falleció' : 'Confirmar documento correcto',
        sub: muerte ? 'La persona está viva y su documento está bien escrito.' : 'El número que ves es exactamente el de su cédula.',
        resp: 'Al confirmar, este registro vuelve a la consulta de la Registraduría con <b>tu nombre como responsable de la validación</b>. Si el documento está mal, la persona no podrá ubicarse en su puesto de votación.',
        btn: muerte ? 'Sí, no falleció' : 'Sí, el documento es correcto', cls: 'lrv-ok', accion: 'pub.pcVisto',
        ok: muerte ? 'Gracias. Quedó registrado que no falleció.' : '¡Listo! Documento validado.'
      };
    },
    fallecido: function () {
      return {
        tit: 'Confirmar fallecimiento', sub: 'Hazlo solo si lo confirmaste con la familia o una fuente segura.',
        resp: 'El registro se <b>inactiva</b> y queda a tu nombre que confirmaste el fallecimiento. Si te equivocas, avisa al equipo para reactivarlo.',
        btn: 'Confirmar fallecimiento', cls: 'lrv-bad', accion: 'pub.pcFallecido', ok: 'Registro inactivado. Lamentamos la pérdida.'
      };
    }
  };

  function hoja(html) {
    var sh = openSheet('<div class="grip"></div>' + html, 'lrv-hoja');
    var bd = layer.querySelector('.backdrop');
    if (bd) bd.onclick = function () { if (!guardando) closeLayer(); };   // con el guardado en vuelo no se cierra
    return sh;
  }

  function accion(tipo, x) {
    if (guardando) return;
    if (tipo === 'editar') return hojaEditar(x);
    var t = TXT[tipo](x);
    var sh = hoja(
      '<h2 class="h2">' + e(t.tit) + '</h2><p class="muted small" style="margin:4px 0 0">' + e(t.sub) + '</p>' +
      '<div class="lrv-cambio uno"><span>' + e(x.n) + '<b>CC ' + e(docFmt(x.d)) + '</b></span></div>' +
      '<div class="lrv-resp">' + t.resp + '</div>' +
      '<label class="lrv-check"><input type="checkbox" id="lrv-chk" /><span><b>Confirmo que revisé el documento</b><br><span class="small muted">Asumo la responsabilidad de esta validación.</span></span></label>' +
      '<p class="lrv-err" id="lrv-err"></p>' +
      '<div class="lrv-hacts"><button class="btn ' + t.cls + ' btn-block" id="lrv-si" disabled>' + e(t.btn) + '</button><button class="btn btn-quiet btn-block" id="lrv-no">Cancelar</button></div>'
    );
    var chk = $('#lrv-chk', sh), ok = $('#lrv-si', sh);
    chk.onchange = function () { ok.disabled = !chk.checked; };
    $('#lrv-no', sh).onclick = function () { if (!guardando) closeLayer(); };
    ok.onclick = function () { guardar(t.accion, { refDoc: x.d }, ok, x, t.ok); };
  }

  function hojaEditar(x) {
    var sh = hoja(
      '<h2 class="h2">Corregir datos</h2><p class="muted small" style="margin:4px 0 10px">Escribe el documento <b>tal como aparece en la cédula</b> y el nombre completo.</p>' +
      '<label class="lrv-field"><span>Número de documento</span><input class="input" id="lrv-doc" inputmode="numeric" maxlength="10" value="' + e(soloDig(x.d)) + '" /></label>' +
      '<label class="lrv-field"><span>Nombre completo</span><input class="input" id="lrv-nom" value="' + e(x.n) + '" autocapitalize="characters" /></label>' +
      '<div class="lrv-cambio" id="lrv-cmp"></div>' +
      '<div class="lrv-resp">Al guardar, el registro vuelve a <b>SIN CONSULTAR</b> para que el equipo lo consulte de nuevo, y el cambio se lleva a todo lo que tenga esa persona (servicios, formularios, asistencias…). Queda a tu nombre como responsable.</div>' +
      '<label class="lrv-check"><input type="checkbox" id="lrv-chk" /><span><b>Confirmo que revisé el documento</b><br><span class="small muted">Lo comparé con la cédula de la persona.</span></span></label>' +
      '<p class="lrv-err" id="lrv-err"></p>' +
      '<div class="lrv-hacts"><button class="btn btn-primary btn-block" id="lrv-si" disabled>Guardar corrección</button><button class="btn btn-quiet btn-block" id="lrv-no">Cancelar</button></div>'
    );
    var doc = $('#lrv-doc', sh), nom = $('#lrv-nom', sh), chk = $('#lrv-chk', sh), ok = $('#lrv-si', sh), err = $('#lrv-err', sh);
    function revisar() {
      doc.value = soloDig(doc.value);
      var d = doc.value, n = nom.value.replace(/\s+/g, ' ').trim().toUpperCase();
      var cDoc = d !== soloDig(x.d), cNom = n !== String(x.n).toUpperCase();
      $('#lrv-cmp', sh).innerHTML = cDoc || cNom
        ? '<span>Antes<b>' + e(docFmt(x.d)) + '</b>' + (cNom ? e(x.n) : '') + '</span><span class="flecha">→</span><span>Ahora<b>' + e(docFmt(d) || '—') + '</b>' + (cNom ? e(n) : '') + '</span>'
        : '<span class="muted" style="grid-column:1/-1">Cambia el número o el nombre para poder guardar.</span>';
      var msg = '';
      if (d && (d.length < 5 || d.length > 10)) msg = 'El documento debe tener de 5 a 10 dígitos.';
      else if (n && n.split(' ').length < 2) msg = 'Escribe nombre y apellido.';
      err.textContent = msg;
      ok.disabled = !(chk.checked && !msg && d && n && (cDoc || cNom));
    }
    doc.oninput = revisar; nom.oninput = revisar; chk.onchange = revisar; revisar();
    $('#lrv-no', sh).onclick = function () { if (!guardando) closeLayer(); };
    ok.onclick = function () {
      guardar('pub.pcEditar', { refDoc: x.d, nuevoDoc: doc.value, nombre: nom.value.replace(/\s+/g, ' ').trim() }, ok, x, 'Corrección guardada. El equipo lo consultará de nuevo.');
    };
  }

  /* Escudo desde el primer toque: botón ocupado, la hoja no se cierra sola y
     RED pone el rid (un reintento por red caída repite el MISMO rid). */
  async function guardar(accionApi, datos, btn, x, msgOk) {
    if (guardando) return;
    guardando = true;
    if (btn) { btn.disabled = true; btn.classList.add('busy'); btn.dataset.txt = btn.textContent; btn.textContent = 'Guardando…'; }
    var err = $('#lrv-err'); if (err) err.textContent = '';
    var t0 = performance.now();
    try {
      var d = await api(accionApi, {}, 'POST', datos);
      if (d && d.ok) {
        closeLayer();
        aplicar(accionApi, x, d, datos);
        toast(msgOk, 'ok');
        if (d.avisos && d.avisos.length) setTimeout(function () { toast(d.avisos[0], ''); }, 3300);
        medir(accionApi, t0, { viajes: 1 });
        if (typeof lrMedir === 'function') lrMedir(accionApi, t0, { viajes: 1 });
        return;
      }
      if (d && d.yaNo) { closeLayer(); quitarItem(x.d); repintar(); toast(d.msg || 'Este registro ya fue validado', ''); actualizar(null, true); return; }
      if (err) err.textContent = (d && d.msg) || 'No se pudo guardar.';
    } catch (ex) {
      if (err) err.textContent = (ex && ex.red) ? 'Sin conexión: esto necesita señal. No se guardó nada.' : 'Sin conexión o el servidor no respondió. No se guardó nada: intenta de nuevo.';
    } finally {
      guardando = false;
      if (btn && btn.isConnected) { btn.disabled = false; btn.classList.remove('busy'); btn.textContent = btn.dataset.txt || btn.textContent; }
    }
  }

  function quitarItem(doc) {
    if (!P || !Array.isArray(P.items)) return;
    var antes = items().length;
    P.items = P.items.filter(function (it) { return String(it.d) !== String(doc); });
    P.n = P.items.length;
    if (antes && !items().length) felicitar = true;
  }

  /* Parche en memoria: el panel y la tarjeta del referido, sin recargar */
  function aplicar(accionApi, x, d, datos) {
    var viejo = String(x.d);
    var card = $('.lrv-card[data-doc="' + viejo.replace(/"/g, '') + '"]');
    if (card) card.classList.add('sale');
    quitarItem(viejo);
    if (typeof lrAnotarPropio === 'function') lrAnotarPropio(d);
    if (accionApi === 'pub.pcFallecido') {
      if ((LR_REFS || []).some(function (z) { return String(z.documento) === viejo; })) { lrParchar(null, viejo); lrTrasParche(viejo, null); }
      else RAP.tocar(lrClaveCache());
    } else if (accionApi === 'pub.pcEditar') {
      cambiarRef(viejo, { documento: String(d.nuevo || datos.nuevoDoc), nombre: String(datos.nombre || x.n).toUpperCase(), municipio: d.municipio || 'SIN CONSULTAR' });
    } else {
      cambiarRef(viejo, { municipio: d.municipio || 'A LA ESPERA' });
    }
    setTimeout(pintar, card ? 260 : 0);
  }
  function cambiarRef(viejo, cambios) {
    var rf = null, mem = (typeof lrListaMem === 'function') ? lrListaMem() : null;
    var arrs = [LR_REFS]; if (mem && mem !== LR_REFS) arrs.push(mem);
    arrs.forEach(function (a) {
      if (!a) return;
      var o = a.find(function (z) { return String(z.documento) === viejo; });
      if (o) { Object.assign(o, cambios); if (a === LR_REFS) rf = o; }
    });
    RAP.tocar(lrClaveCache());
    if (rf) lrTrasParche(viejo, rf);
  }

  /* «Actualizar»: la lista POR CONFIRMAR sola, de fondo (un viaje pequeño) */
  async function actualizar(btn, silencio) {
    if (pidiendo) return;
    pidiendo = true;
    if (btn) { btn.disabled = true; btn.classList.add('busy'); }
    var t0 = performance.now();
    try {
      var d = await apiSilencio('pub.pcLista', {});
      if (d && d.ok !== false && Array.isArray(d.items)) {
        var antes = items().length;
        P = Object.assign(P || {}, d); P.n = d.items.length; memo.de = null;
        if (antes && !items().length) felicitar = true;
        repintar();
        medir('actualizar', t0, { n: d.items.length });
        if (!silencio) toast('Lista actualizada', 'ok');
      } else if (!silencio) toast((d && d.msg) || 'No se pudo actualizar', 'err');
    } catch (ex) { if (!silencio) toast('Sin conexión. Te mostramos lo último guardado.', 'err'); }
    finally { pidiendo = false; if (btn && btn.isConnected) { btn.disabled = false; btn.classList.remove('busy'); } }
  }

  /* ------------------------------------------------------------- hojas */
  function leerBien() { try { return !!localStorage.getItem(K_BIEN); } catch (x) { return true; } }
  function lsBien() { try { localStorage.setItem(K_BIEN, '1'); } catch (x) {} }
  function bienvenida(primera) {
    var sh = openSheet('<div class="grip"></div><h2 class="h2">Validación de registros</h2><p class="muted small" style="margin:4px 0 0">Tres pasos para entender tu tarea.</p>' +
      '<div class="lrv-pasos">' +
        '<div class="lrv-paso"><span class="n">1</span><div><b>¿Qué es?</b><p>Cuando el equipo consulta en la Registraduría, algunos documentos de tus referidos no salen bien. Aquí ves solo los de tu grupo, porque tú conoces a esas personas.</p></div></div>' +
        '<div class="lrv-paso"><span class="n">2</span><div><b>¿Por qué importa?</b><p>Un documento mal escrito es una persona que no podemos ubicar en su puesto de votación ni acompañar el día de la elección. Tu revisión hace que cada apoyo cuente.</p></div></div>' +
        '<div class="lrv-paso"><span class="n">3</span><div><b>¿Qué hacer?</b><p>Llama o escribe a la persona y compara su cédula. Luego elige: <b>Documento correcto</b>, <b>Corregir</b> o, si es el caso, <b>Confirmar fallecimiento</b>.</p></div></div>' +
      '</div>' +
      '<div class="lrv-resp">Cada validación queda registrada <b>a tu nombre</b>. Revisa con cuidado antes de confirmar.</div>' +
      '<button class="btn btn-primary btn-block" id="lrv-entendido">' + (primera ? 'Entendido, empezar' : 'Entendido') + '</button>', 'lrv-hoja');
    $('#lrv-entendido', sh).onclick = function () { lsBien(); closeLayer(); };
  }
  function motivosHoja() {
    var c = conteos(items());
    var lista = motivos().filter(function (x) { return x.on !== false || c[x.id]; }).map(function (x) { return motivoDe(x.v); }).concat([MOT_OTRO]);
    var sh = openSheet('<div class="grip"></div><h2 class="h2">¿Qué significa cada motivo?</h2><div class="lrv-motivos">' +
      lista.map(function (m) { return '<div class="lrv-sello ' + (m.muerte ? 'muerte' : '') + '">' + I[m.ic] + '<span><b>' + e(m.t) + '</b>' + e(m.d) + '</span></div>'; }).join('') +
      '</div><button class="btn btn-primary btn-block" data-close style="margin-top:14px">Entendido</button>', 'lrv-hoja');
    $$('[data-close]', sh).forEach(function (b) { b.onclick = closeLayer; });
  }

  /* Al entrar a la vista (o cambiar de grupo) arranca sin filtros */
  function reiniciar() { S = { filtro: 'todos', grupo: '', q: '' }; felicitar = false; if (VIA === 'respaldo' && pedidoPara !== String(LR_COMO || 'yo')) { P = null; VIA = ''; } }

  window.LRVAL = {
    dato: dato,
    pintar: pintar,
    repintar: repintar,
    reiniciar: reiniciar,
    sello: sello,
    validar: validar,
    firma: firma,
    hay: function () { return items().length; },
    estado: function () { return { via: VIA, n: items().length, total: todos().length, abierto: abierto() }; }
  };
})();
