/* ============================================================
 * CAPA 11 · CONSULTAS — app PÚBLICA (28/07/2026)
 * ------------------------------------------------------------
 * QUÉ HACE
 *   Pone el mismo botón robot flotante de la app privada en DOS
 *   vistas de la Zona de líderes:
 *     · Mis referidos  → 10 consultas sobre el grupo del líder.
 *     · Mis servicios  → 12 consultas sobre las solicitudes del
 *                        profesional (esa vista es solo para quien
 *                        está en la hoja PROFESIONALES).
 *   Al tocarlo abre una hoja tipo chat SIN campo de texto: abajo
 *   hay botones fijos y cada uno responde con un informe, con
 *   efecto "escribiendo" y lectura en voz alta.
 *
 * DE DÓNDE SALEN LOS NÚMEROS (esto es lo importante)
 *   NO hay Gemini. Los informes se calculan AQUÍ, en el navegador,
 *   con las MISMAS listas que ya están pintadas: `LR_REFS` (lo que
 *   devolvió pub.liderReferidos) y `MS.data` (pub.liderServicios).
 *   Por eso salen al instante, no viaja ni un dato a terceros y
 *   siempre cuadran con lo que se ve en pantalla.
 *   Solo dos cosas no las puede saber el navegador y se piden al
 *   CORE una vez por sesión (pub.liderInsights):
 *     · los líderes a cargo (columna PADRINO de LIDERES),
 *     · las altas por mes (FECHA_REGISTRO, que pub.liderReferidos
 *       usa para ordenar y no devuelve).
 *   El panel de servicios NO pide nada al CORE.
 *
 * POR QUÉ ES UNA CAPA Y NO UN PARCHE A app.js
 *   Mismo motivo que capa-4, capa-5 y capa-7: app.js no se toca.
 *   OJO: ni "Mis referidos" ni "Mis servicios" son rutas con hash
 *   (son sub-vistas de #/lideres), así que el botón no puede
 *   montarse escuchando hashchange como en la privada: se vigila
 *   el DOM y se monta cuando aparece #lr-body o #ls-body.
 *
 * VOZ
 *   La misma de la privada (Inworld), por endpoints propios de la
 *   app pública (pub.vozEstado / pub.vozHablar), porque los priv.*
 *   exigen estar en la hoja USUARIOS y un líder no está.
 *   Se manda a leer SOLO el resumen en números: ni los nombres de
 *   las personas ni el texto de las solicitudes viajan al
 *   proveedor de voz.
 *
 * iPhone
 *   Safari solo deja sonar audio si hubo un gesto antes. El audio se
 *   desbloquea en el mismo toque que abre el panel y en cada toque
 *   de un botón.
 *
 * INSTALACIÓN (al final del <body>, DESPUÉS de app.js)
 *   <script src="capa-11-insights.js"></script>
 * PAREJA
 *   capa-11-insights.css (en el <head>, después de style.css).
 * ============================================================ */

(function () {
  'use strict';

  if (window.__jp11Consultas) return;
  window.__jp11Consultas = true;

  /* ---------------- iconos (mismos de la privada) ---------------- */
  var ROBOT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="4" y="8" width="16" height="11" rx="3.5"/><path d="M12 8V4.5"/><circle cx="12" cy="3.2" r="1.3"/>' +
    '<path d="M1.8 12.5v3M22.2 12.5v3"/><circle cx="9" cy="13" r="1.15" fill="currentColor" stroke="none"/>' +
    '<circle cx="15" cy="13" r="1.15" fill="currentColor" stroke="none"/><path d="M9.5 16.3h5"/></svg>';
  var CERRAR = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var WA = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.74.46 3.42 1.32 4.9L2 22l5.4-1.42a9.8 9.8 0 0 0 4.64 1.18h.01c5.43 0 9.84-4.4 9.84-9.84C21.89 6.4 17.48 2 12.04 2zm0 17.96h-.01a8.2 8.2 0 0 1-4.16-1.14l-.3-.18-3.09.81.82-3.01-.2-.31a8.14 8.14 0 0 1-1.25-4.35c0-4.51 3.67-8.18 8.19-8.18 2.19 0 4.24.85 5.79 2.4a8.13 8.13 0 0 1 2.4 5.79c0 4.51-3.68 8.17-8.19 8.17z"/></svg>';
  var BOCINA = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9.5h3l4-3v11l-4-3H5z"/><path d="M16 9.2a4 4 0 0 1 0 5.6"/><path d="M18.6 6.8a7.5 7.5 0 0 1 0 10.4"/></svg>';
  var STOP = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>';

  /* WAV mudo: solo sirve para dejar el <audio> "activado" dentro del
     gesto del usuario, que es lo que exige Safari en iPhone. */
  var SILENCIO = 'data:audio/wav;base64,UklGRqQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

  /* ---------------- estado de la capa ---------------- */
  var fab = null;
  var abierta = false;
  var cerrarHoja = null;
  var vozCfg = null, pidiendoVoz = null;
  var infoCache = null, pidiendoInfo = null, infoDoc = '';

  /* ---------------- utilidades ---------------- */
  function yo() {
    try { var u = getActive(); return u ? String(u.documento || '') : ''; } catch (e) { return ''; }
  }
  function limpio(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nodo(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  }
  function reducido() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function avisar(msg, tipo) {
    try { if (typeof toast === 'function') toast(msg, tipo || ''); } catch (e) {}
  }
  function fmt(n) {
    try { return Number(n || 0).toLocaleString('es-CO'); } catch (e) { return String(n || 0); }
  }
  function pct(a, b) { return b ? Math.round(a * 100 / b) : 0; }
  function plural(n, uno, varios) { return n === 1 ? uno : varios; }
  /* Mayúsculas, sin tildes: para comparar nombres escritos a mano. */
  function llano(s) {
    var t = String(s == null ? '' : s).trim().toUpperCase();
    try { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { return t; }
  }

  /* Texto plano → HTML mínimo (párrafos, viñetas y **negrita**). */
  function aHtml(txt) {
    var lineas = String(txt || '').split(/\r?\n/);
    var out = [], lista = [];
    function cerrarLista() { if (lista.length) { out.push('<ul>' + lista.join('') + '</ul>'); lista = []; } }
    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i].trim();
      if (!l) { cerrarLista(); continue; }
      var m = /^[-*•]\s+(.*)$/.exec(l);
      if (m) { lista.push('<li>' + negrita(limpio(m[1])) + '</li>'); continue; }
      cerrarLista();
      out.push('<p>' + negrita(limpio(l.replace(/^#{1,6}\s*/, ''))) + '</p>');
    }
    cerrarLista();
    return out.join('') || '<p class="iq-muted">Sin datos.</p>';
  }
  function negrita(s) { return s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }

  /* La lista de referidos que están viendo las tarjetas AHORA MISMO.
     Es la misma variable que alimenta la barra de fidelización: si el
     refresco en vivo la cambia, el informe siguiente sale con lo nuevo. */
  function datos() {
    try { return (typeof LR_REFS !== 'undefined' && LR_REFS) ? LR_REFS : []; } catch (e) { return []; }
  }
  /* Ítems reales de cada columna (los manda el CORE con la lista). */
  function opciones(campo) {
    var def = campo === 'intencion'
      ? ['Firme con el voto', 'No vota con nosotros', 'No está seguro(a)', 'No sabe votar', 'No contactado']
      : ['No contactado', 'Confirmada', 'No puede', 'No filial'];
    try {
      var o = (typeof LIDER !== 'undefined' && LIDER && LIDER.opciones) ? LIDER.opciones[campo] : null;
      return (o && o.length) ? o.slice() : def;
    } catch (e) { return def; }
  }
  function nombreMunicipio() {
    try { return (typeof MV !== 'undefined' && MV && MV.municipio) ? MV.municipio : 'Flandes'; } catch (e) { return 'Flandes'; }
  }
  /* Los cinco grupos de la columna MUNICIPIO, iguales a los de las
     tarjetas (muniClase de app.js). 'aqui' = vota en el municipio de
     la campaña; 'otro' = vota en otro municipio de verdad. */
  function grupoMun(m) {
    var v = String(m || '').trim().toUpperCase();
    if (!v) return 'sin';
    try { if (typeof MV !== 'undefined' && MV.esMunicipio && MV.esMunicipio(v)) return 'aqui'; }
    catch (e) { if (v === 'FLANDES') return 'aqui'; }
    if (v === 'SIN CONSULTAR') return 'sinconsultar';
    if (v === 'A LA ESPERA') return 'espera';
    if (v === 'POR CONFIRMAR') return 'confirmar';
    return 'otro';
  }
  function sinConfirmar(g) { return g === 'sin' || g === 'sinconsultar' || g === 'espera' || g === 'confirmar'; }

  function cuenta(lista, fn) {
    var m = {}, orden = [];
    for (var i = 0; i < lista.length; i++) {
      var k = fn(lista[i]);
      if (k == null) continue;
      if (!(k in m)) { m[k] = 0; orden.push(k); }
      m[k]++;
    }
    return orden.map(function (k) { return { k: k, n: m[k] }; })
      .sort(function (a, b) { return b.n - a.n || (a.k < b.k ? -1 : 1); });
  }
  /* "A, B, C y 4 más" — para no volcar 400 nombres en una burbuja. */
  function nombres(lista, tope) {
    var t = tope || 8;
    var ns = lista.slice(0, t).map(function (x) { return String(x.nombre || '').trim(); });
    var resto = lista.length - ns.length;
    return ns.join(', ') + (resto > 0 ? ' y ' + fmt(resto) + ' más' : '');
  }
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function mesTxt(k) {
    var p = String(k || '').split('-');
    var m = parseInt(p[1], 10);
    return (MESES[m - 1] || '') + ' ' + p[0];
  }
  function hoyMes() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
  }
  function mesAntes(k) {
    var p = String(k || '').split('-');
    var y = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1;
    if (m === 0) { m = 12; y--; }
    return y + '-' + ('0' + m).slice(-2);
  }

  /* ============================================================
     LLAMADAS AL CORE (solo el panel de referidos las usa)
     ============================================================ */
  function post(action, cuerpo) {
    var url = API_URL + '?' + new URLSearchParams({ action: action }).toString();
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo || {})
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || 'Error del servidor');
        return j.data;
      });
  }

  /* Ahijados + altas por mes. Una vez por sesión y por documento. */
  function pedirInfo() {
    var doc = yo();
    if (infoCache && infoDoc === doc) return Promise.resolve(infoCache);
    if (pidiendoInfo) return pidiendoInfo;
    infoDoc = doc;
    pidiendoInfo = apiSilencio('pub.liderInsights', { documento: doc })
      .then(function (r) { infoCache = (r && r.ok !== false) ? r : { error: true }; return infoCache; })
      .catch(function () { infoCache = { error: true }; return infoCache; })
      .then(function (v) { pidiendoInfo = null; return v; });
    return pidiendoInfo;
  }

  function pedirVoz() {
    if (vozCfg) return Promise.resolve(vozCfg);
    if (pidiendoVoz) return pidiendoVoz;
    pidiendoVoz = apiSilencio('pub.vozEstado', { documento: yo() })
      .then(function (r) { vozCfg = (r && r.ok !== false) ? r : { configurada: false }; return vozCfg; })
      .catch(function () { vozCfg = { configurada: false, error: true }; return vozCfg; })
      .then(function (v) { pidiendoVoz = null; mostrarBotonesVoz(); return v; });
    return pidiendoVoz;
  }
  function mostrarBotonesVoz() {
    var hay = !!(vozCfg && vozCfg.configurada);
    var bs = document.querySelectorAll('.iq-voz');
    for (var k = 0; k < bs.length; k++) bs[k].style.display = hay ? '' : 'none';
  }

  /* ============================================================
     REPRODUCTOR — trocea el texto y encadena los MP3
     (mismo diseño que la privada: Apps Script no hace streaming)
     ============================================================ */
  var Repro = (function () {
    var audio = null, cola = [], i = 0, sig = null, activo = false, dueno = null;

    function el() {
      if (!audio) {
        audio = document.createElement('audio');
        audio.setAttribute('playsinline', '');
        audio.preload = 'auto';
        audio.style.display = 'none';
        document.body.appendChild(audio);
      }
      return audio;
    }
    function desbloquear() {
      var a = el();
      try {
        if (!a.dataset.libre) {
          a.src = SILENCIO;
          var p = a.play();
          if (p && p.then) p.then(function () { a.dataset.libre = '1'; }).catch(function () {});
          else a.dataset.libre = '1';
        }
      } catch (e) {}
    }
    /* Sin lookbehind a propósito: Safari < 16.4 lanza SyntaxError al
       cargar y eso tumbaría la capa entera, no solo la voz. */
    function frasear(t) {
      var out = [], act = '';
      for (var k = 0; k < t.length; k++) {
        var c = t.charAt(k);
        act += c;
        if ('.!?\u2026:;\n'.indexOf(c) >= 0) {
          while (k + 1 < t.length && /[\s"\u201d\u00bb)]/.test(t.charAt(k + 1))) { act += t.charAt(++k); }
          out.push(act); act = '';
        }
      }
      if (act.trim()) out.push(act);
      return out.length ? out : [t];
    }
    function trocear(txt) {
      var t = String(txt || '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/^\s*#{1,6}\s*/gm, '')
        .replace(/^\s*[-*•]\s+/gm, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
      if (!t) return [];
      var frases = frasear(t), out = [], act = '';
      for (var k = 0; k < frases.length; k++) {
        var f = frases[k].trim();
        if (!f) continue;
        while (f.length > 900) { out.push(f.slice(0, 900)); f = f.slice(900); }
        if ((act + ' ' + f).trim().length > 420 && act) { out.push(act.trim()); act = f; }
        else { act = (act ? act + ' ' : '') + f; }
      }
      if (act.trim()) out.push(act.trim());
      return out;
    }
    function pedir(txt) {
      return post('pub.vozHablar', { documento: yo(), texto: txt }).then(function (r) {
        if (!r || r.ok === false) throw new Error((r && r.msg) || 'No se pudo generar la voz.');
        return 'data:' + (r.mime || 'audio/mpeg') + ';base64,' + r.base64;
      });
    }
    function siguiente() {
      if (!activo) return;
      if (i >= cola.length) return parar();
      var p = sig || pedir(cola[i]);
      sig = null;
      p.then(function (src) {
        if (!activo) return;
        var a = el();
        a.src = src;
        var pl = a.play();
        if (pl && pl.catch) pl.catch(function () { parar(); });
        if (i + 1 < cola.length) sig = pedir(cola[i + 1]).catch(function () { return null; });
        i++;
      }).catch(function (err) {
        parar();
        avisar((err && err.message) || 'No se pudo generar la voz.', 'err');
      });
    }
    function hablar(txt, quien) {
      parar();
      cola = trocear(txt);
      if (!cola.length) return;
      i = 0; sig = null; activo = true; dueno = quien || null;
      var a = el();
      a.onended = function () { if (activo) siguiente(); };
      a.onerror = function () { parar(); };
      siguiente();
      repintar();
    }
    function parar() {
      activo = false; cola = []; i = 0; sig = null;
      try { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } } catch (e) {}
      dueno = null;
      repintar();
    }
    function repintar() {
      var bs = document.querySelectorAll('.iq-voz');
      for (var k = 0; k < bs.length; k++) {
        var on = activo && bs[k] === dueno;
        bs[k].classList.toggle('on', on);
        bs[k].innerHTML = on ? (STOP + ' Detener') : (BOCINA + ' Escuchar');
        bs[k].setAttribute('aria-label', on ? 'Detener la lectura' : 'Escuchar la respuesta');
      }
    }
    return {
      desbloquear: desbloquear, hablar: hablar, parar: parar, trocear: trocear,
      suena: function () { return activo; }, dueno: function () { return dueno; }
    };
  })();

  /* ============================================================
     LOS INFORMES
     ------------------------------------------------------------
     Cada uno devuelve { titulo, texto, voz, lista }:
       texto → lo que se pinta y se copia (con nombres)
       voz   → lo que se manda a leer: SOLO números, sin nombres y
               sin el texto de las solicitudes, para no mandar a un
               tercero ni la gente del líder ni lo que la gente pide.
       lista → personas con botón de WhatsApp bajo la respuesta
     ============================================================ */
  var BOTONES = [
    { id: 'resumen',   etiqueta: 'Mi resumen',              icono: '📊' },
    { id: 'votacion',  etiqueta: 'Distribución de votación', icono: '🗳' },
    { id: 'intencion', etiqueta: 'Intención del mes',        icono: '🎯' },
    { id: 'asistencia',etiqueta: 'Asistencia a evento',      icono: '🏷' },
    { id: 'ahijados',  etiqueta: 'Mis ahijados(as)',         icono: '👥' },
    { id: 'crecer',    etiqueta: 'Mi crecimiento del mes',   icono: '📈' },
    { id: 'pendientes',etiqueta: 'Pendientes por trabajar',  icono: '📞' },
    { id: 'sinpuesto', etiqueta: 'Sin puesto confirmado',    icono: '❓' },
    { id: 'puestos',   etiqueta: 'Dónde vota mi gente',      icono: '📍' },
    { id: 'barrios',   etiqueta: 'Mi gente por barrio',      icono: '🏘' }
  ];

  var BOTONES_SRV = [
    { id: 'bandeja',      etiqueta: 'Mi bandeja',        icono: '📥' },
    { id: 'estados',      etiqueta: 'Por estados',       icono: '📊' },
    { id: 'sinduenio',    etiqueta: 'Sin dueño',         icono: '🆓' },
    { id: 'represadas',   etiqueta: 'Represadas',        icono: '⏰' },
    { id: 'ingresadas',   etiqueta: 'Mis ingresadas',    icono: '📨' },
    { id: 'pendientes',   etiqueta: 'Mis pendientes',    icono: '⏳' },
    { id: 'seguimientos', etiqueta: 'Mis seguimientos',  icono: '🔄' },
    { id: 'recurrencias', etiqueta: 'Mis recurrencias',  icono: '🔁' },
    { id: 'mimes',        etiqueta: 'Mi mes',            icono: '📈' },
    { id: 'repetidos',    etiqueta: 'Casos repetidos',   icono: '👤' },
    { id: 'barrios',      etiqueta: 'Por barrio',        icono: '🏘' },
    { id: 'medio',        etiqueta: 'Por medio',         icono: '📱' }
  ];

  var PANELES = {
    referidos: { ancla: 'lr-body', titulo: 'Consultas de mi grupo',    sub: 'Mis referidos', botones: BOTONES },
    servicios: { ancla: 'ls-body', titulo: 'Consultas de mis servicios', sub: 'Mis servicios', botones: BOTONES_SRV }
  };

  function informe(panel, id) {
    if (panel === 'servicios') return Promise.resolve(armarSrv(id, datosSrv(), profSrv()));
    if (id === 'ahijados' || id === 'crecer' || id === 'resumen') {
      return pedirInfo().then(function (info) { return armar(id, datos(), info); });
    }
    return Promise.resolve(armar(id, datos(), null));
  }

  function armar(id, refs, info) {
    switch (id) {
      case 'resumen':    return repResumen(refs, info);
      case 'votacion':   return repVotacion(refs);
      case 'intencion':  return repCampo(refs, 'intencion', 'Intención del mes', 'la intención');
      case 'asistencia': return repCampo(refs, 'asistencia', 'Asistencia a evento', 'la asistencia');
      case 'ahijados':   return repAhijados(info);
      case 'crecer':     return repCrecer(info);
      case 'pendientes': return repPendientes(refs);
      case 'sinpuesto':  return repSinPuesto(refs);
      case 'puestos':    return repPuestos(refs);
      case 'barrios':    return repBarrios(refs);
    }
    return { titulo: '', texto: 'No conozco esa consulta.', voz: '', lista: [] };
  }

  function vacio(titulo) {
    return {
      titulo: titulo,
      texto: 'Todavía no tienes referidos en tu grupo.\nUsa **+ Nuevo referido** para sumar a los tuyos y vuelve a consultar.',
      voz: 'Todavía no tienes referidos en tu grupo.',
      lista: []
    };
  }

  /* ---- 1. Mi resumen ---- */
  function repResumen(refs, info) {
    if (!refs.length) return vacio('Mi resumen');
    var trab = refs.filter(function (r) { return String(r.intencion || '').trim() !== ''; }).length;
    var p = pct(trab, refs.length);
    var falta = refs.length - trab;
    var sinC = refs.filter(function (r) { return sinConfirmar(grupoMun(r.municipio)); }).length;
    var fuera = refs.filter(function (r) { return grupoMun(r.municipio) === 'otro'; }).length;
    var mes = (info && info.altas) ? mesActual(info) : null;
    var ahij = (info && info.ahijados) ? info.ahijados.length : 0;

    var l = [];
    l.push('Tienes **' + fmt(refs.length) + '** referidos activos en tu grupo.');
    l.push('- Fidelización del mes: **' + p + '%** (' + fmt(trab) + ' con intención, ' + fmt(falta) + ' sin registrar)');
    l.push('- Sin puesto de votación confirmado: **' + fmt(sinC) + '**');
    l.push('- Votan fuera de ' + nombreMunicipio() + ': **' + fmt(fuera) + '**');
    if (mes !== null) l.push('- Nuevos este mes: **' + fmt(mes) + '**');
    if (ahij) l.push('- Líderes a tu cargo: **' + fmt(ahij) + '**');
    l.push('');
    l.push(falta ? 'Lo que más te suma ahora: registrar la intención de esos ' + fmt(falta) + '. Toca **Pendientes por trabajar**.'
                 : '¡Vas al día! Todo tu grupo tiene intención registrada este mes.');

    var voz = 'Tienes ' + fmt(refs.length) + ' referidos activos. Fidelización del mes: ' + p + ' por ciento. ' +
      'Sin puesto confirmado: ' + fmt(sinC) + '. ' + (mes !== null ? 'Nuevos este mes: ' + fmt(mes) + '. ' : '') +
      (falta ? 'Te faltan ' + fmt(falta) + ' por trabajar.' : 'No te falta nadie por trabajar.');
    return { titulo: 'Mi resumen', texto: l.join('\n'), voz: voz, lista: [] };
  }

  function mesActual(info) {
    if (!info || !info.altas || !info.altas.meses) return null;
    var m = info.altas.meses[0];
    return m ? m.n : 0;
  }

  /* ---- 2. Distribución de votación ---- */
  function repVotacion(refs) {
    if (!refs.length) return vacio('Distribución de votación');
    var g = { aqui: [], sinconsultar: [], espera: [], confirmar: [], otro: [], sin: [] };
    refs.forEach(function (r) { g[grupoMun(r.municipio)].push(r); });

    var muni = nombreMunicipio();
    var l = [];
    l.push('Así está repartido tu grupo por municipio de votación (**' + fmt(refs.length) + '** en total):');
    l.push('- Votan en ' + muni + ': **' + fmt(g.aqui.length) + '** (' + pct(g.aqui.length, refs.length) + '%)');
    l.push('- Sin consultar: **' + fmt(g.sinconsultar.length) + '**');
    l.push('- A la espera: **' + fmt(g.espera.length) + '**');
    l.push('- Por confirmar: **' + fmt(g.confirmar.length) + '**');
    if (g.sin.length) l.push('- Sin dato de municipio: **' + fmt(g.sin.length) + '**');
    l.push('- Votan en otro municipio: **' + fmt(g.otro.length) + '**');

    if (g.otro.length) {
      l.push('');
      l.push('Otros municipios:');
      cuenta(g.otro, function (r) { return String(r.municipio || '').trim(); }).forEach(function (x) {
        l.push('- ' + x.k + ': ' + fmt(x.n));
      });
    }
    var pend = g.sinconsultar.length + g.espera.length + g.confirmar.length + g.sin.length;
    if (pend) {
      l.push('');
      l.push('**' + fmt(pend) + '** todavía no tienen puesto confirmado: hasta que no aparezcan votando en ' + muni +
             ', el escáner del día de la votación no los deja registrar.');
    }
    var voz = 'De tus ' + fmt(refs.length) + ' referidos, ' + fmt(g.aqui.length) + ' votan en ' + muni + ', ' +
      fmt(pend) + ' están sin puesto confirmado y ' + fmt(g.otro.length) + ' votan en otro municipio.';
    return { titulo: 'Distribución de votación', texto: l.join('\n'), voz: voz, lista: [] };
  }

  /* ---- 3 y 4. Intención / Asistencia (según ítem) ---- */
  function repCampo(refs, campo, titulo, quees) {
    if (!refs.length) return vacio(titulo);
    var items = opciones(campo);
    var con = refs.filter(function (r) { return String(r[campo] || '').trim() !== ''; });
    var sin = refs.filter(function (r) { return String(r[campo] || '').trim() === ''; });

    var l = [];
    l.push('De tus **' + fmt(refs.length) + '** referidos, **' + fmt(con.length) + '** ya tienen ' + quees +
           ' registrada (' + pct(con.length, refs.length) + '%) y **' + fmt(sin.length) + '** no.');
    l.push('');
    l.push('Por ítem:');
    var vistos = {};
    items.forEach(function (it) {
      var g = con.filter(function (r) { return String(r[campo] || '').trim() === it; });
      vistos[it] = true;
      l.push('- ' + it + ': **' + fmt(g.length) + '**' + (g.length ? ' — ' + nombres(g, 6) : ''));
    });
    /* Valores heredados que ya no están en la lista de ítems (p. ej.
       "Fuera de ..." de otra campaña): se muestran igual, no se ocultan. */
    cuenta(con, function (r) { return String(r[campo] || '').trim(); }).forEach(function (x) {
      if (vistos[x.k]) return;
      l.push('- ' + x.k + ' (histórico): **' + fmt(x.n) + '**');
    });
    if (sin.length) {
      l.push('');
      l.push('Sin registrar (**' + fmt(sin.length) + '**): ' + nombres(sin, 12));
    }
    var voz = 'De tus ' + fmt(refs.length) + ' referidos, ' + fmt(con.length) + ' ya tienen ' + quees +
      ' registrada y ' + fmt(sin.length) + ' no.';
    return { titulo: titulo, texto: l.join('\n'), voz: voz, lista: sin.slice(0, 15) };
  }

  /* ---- 5. Mis ahijados(as) ---- */
  function repAhijados(info) {
    if (!info || info.error) {
      return { titulo: 'Mis ahijados(as)', texto: 'No pude consultar tus líderes a cargo. Revisa la conexión y vuelve a intentarlo.', voz: 'No pude consultar tus líderes a cargo.', lista: [] };
    }
    var a = info.ahijados || [];
    if (!a.length) {
      return {
        titulo: 'Mis ahijados(as)',
        texto: 'No tienes líderes a tu cargo.\nCuando en la base de datos alguien quede con tu nombre como padrino, aparecerá aquí con sus referidos.',
        voz: 'No tienes líderes a tu cargo.', lista: []
      };
    }
    var total = a.reduce(function (s, x) { return s + x.referidos; }, 0);
    var trab = a.reduce(function (s, x) { return s + x.trabajadas; }, 0);
    var l = [];
    l.push('Tienes **' + fmt(a.length) + '** líder' + (a.length === 1 ? '' : 'es') + ' a tu cargo, con **' + fmt(total) + '** referidos entre todos:');
    a.forEach(function (x) {
      l.push('- ' + x.nombre + ' (N° ' + x.codigo + '): **' + fmt(x.referidos) + '** referidos · ' + x.pct + '% trabajado');
    });
    var cero = a.filter(function (x) { return x.referidos === 0; });
    if (cero.length) {
      l.push('');
      l.push('Sin un solo referido todavía: ' + nombres(cero.map(function (x) { return { nombre: x.nombre }; }), 8) + '.');
    }
    var voz = 'Tienes ' + fmt(a.length) + ' líderes a tu cargo, con ' + fmt(total) + ' referidos entre todos y ' +
      pct(trab, total) + ' por ciento trabajado.';
    return { titulo: 'Mis ahijados(as)', texto: l.join('\n'), voz: voz, lista: [] };
  }

  /* ---- 6. Mi crecimiento del mes ---- */
  function repCrecer(info) {
    if (!info || info.error || !info.altas) {
      return { titulo: 'Mi crecimiento del mes', texto: 'No pude consultar las fechas de registro. Revisa la conexión y vuelve a intentarlo.', voz: 'No pude consultar las fechas de registro.', lista: [] };
    }
    var meses = info.altas.meses || [];
    var esteMes = meses[0] ? meses[0].n : 0;
    var mesPasado = meses[1] ? meses[1].n : 0;
    var l = [];
    l.push('En ' + mesTxt(info.altas.mes) + ' llevas **' + fmt(esteMes) + '** registro' + (esteMes === 1 ? '' : 's') + ' nuevo' + (esteMes === 1 ? '' : 's') + '.');
    if (mesPasado || esteMes) {
      var dif = esteMes - mesPasado;
      l.push(dif === 0 ? '- Igual que el mes pasado (' + fmt(mesPasado) + ').'
        : dif > 0 ? '- **' + fmt(dif) + ' más** que el mes pasado (' + fmt(mesPasado) + ').'
                  : '- **' + fmt(-dif) + ' menos** que el mes pasado (' + fmt(mesPasado) + ').');
    }
    var ult = meses.slice(0, 6).filter(function (m) { return m.n > 0; });
    if (ult.length) {
      l.push('');
      l.push('Últimos meses:');
      meses.slice(0, 6).forEach(function (m) { l.push('- ' + mesTxt(m.mes) + ': **' + fmt(m.n) + '**'); });
    }
    l.push('');
    l.push('En total tu grupo suma **' + fmt(info.altas.total || 0) + '** referidos activos' +
           (info.altas.sinFecha ? ' (' + fmt(info.altas.sinFecha) + ' sin fecha de registro legible).' : '.'));
    var voz = 'En ' + mesTxt(info.altas.mes) + ' llevas ' + fmt(esteMes) + ' registros nuevos. El mes pasado fueron ' + fmt(mesPasado) + '.';
    return { titulo: 'Mi crecimiento del mes', texto: l.join('\n'), voz: voz, lista: [] };
  }

  /* ---- 7. Pendientes por trabajar ---- */
  function repPendientes(refs) {
    if (!refs.length) return vacio('Pendientes por trabajar');
    var sin = refs.filter(function (r) { return String(r.intencion || '').trim() === ''; });
    if (!sin.length) {
      return {
        titulo: 'Pendientes por trabajar',
        texto: '¡No te falta nadie! Los **' + fmt(refs.length) + '** referidos de tu grupo tienen la intención registrada este mes.',
        voz: 'No te falta nadie: todo tu grupo tiene la intención registrada este mes.', lista: []
      };
    }
    var l = [];
    l.push('Te faltan **' + fmt(sin.length) + '** de **' + fmt(refs.length) + '** por registrar la intención (' +
           pct(sin.length, refs.length) + '% del grupo).');
    l.push('Cada uno que registres sube tu barra de fidelización del mes.');
    l.push('');
    l.push('Empieza por estos:');
    sin.slice(0, 15).forEach(function (r) {
      l.push('- ' + String(r.nombre || '').trim() + (r.residencia ? ' · ' + r.residencia : ''));
    });
    if (sin.length > 15) l.push('- …y ' + fmt(sin.length - 15) + ' más en la lista.');
    var voz = 'Te faltan ' + fmt(sin.length) + ' de ' + fmt(refs.length) + ' por registrar la intención este mes.';
    return { titulo: 'Pendientes por trabajar', texto: l.join('\n'), voz: voz, lista: sin.slice(0, 15) };
  }

  /* ---- 8. Sin puesto confirmado ---- */
  function repSinPuesto(refs) {
    if (!refs.length) return vacio('Sin puesto confirmado');
    var lista = refs.filter(function (r) { return sinConfirmar(grupoMun(r.municipio)); });
    var muni = nombreMunicipio();
    if (!lista.length) {
      return {
        titulo: 'Sin puesto confirmado',
        texto: 'Todos tus referidos tienen el puesto de votación resuelto. Nada pendiente por aquí.',
        voz: 'Todos tus referidos tienen el puesto de votación resuelto.', lista: []
      };
    }
    var g = { sinconsultar: 0, espera: 0, confirmar: 0, sin: 0 };
    lista.forEach(function (r) { g[grupoMun(r.municipio)]++; });
    var l = [];
    l.push('**' + fmt(lista.length) + '** de tus **' + fmt(refs.length) + '** referidos no tienen puesto de votación confirmado:');
    l.push('- Sin consultar: **' + fmt(g.sinconsultar) + '** — nadie ha buscado su puesto todavía');
    l.push('- A la espera: **' + fmt(g.espera) + '** — aún no aparecen en el censo de la Registraduría');
    l.push('- Por confirmar: **' + fmt(g.confirmar) + '** — hay que validar contigo si el documento está bien');
    if (g.sin) l.push('- Sin dato: **' + fmt(g.sin) + '**');
    l.push('');
    l.push('Ojo: mientras no queden votando en ' + muni + ', el escáner del día de la votación **no los deja registrar**.');
    l.push('');
    l.push('Los primeros de la lista:');
    lista.slice(0, 15).forEach(function (r) {
      l.push('- ' + String(r.nombre || '').trim() + ' · CC ' + r.documento + ' · ' + (String(r.municipio || '').trim() || 'sin dato'));
    });
    if (lista.length > 15) l.push('- …y ' + fmt(lista.length - 15) + ' más.');
    var voz = fmt(lista.length) + ' de tus ' + fmt(refs.length) + ' referidos no tienen puesto de votación confirmado.';
    return { titulo: 'Sin puesto confirmado', texto: l.join('\n'), voz: voz, lista: lista.slice(0, 15) };
  }

  /* ---- 9. Dónde vota mi gente ---- */
  function repPuestos(refs) {
    if (!refs.length) return vacio('Dónde vota mi gente');
    var con = refs.filter(function (r) { return String(r.puesto || '').trim() !== ''; });
    var sin = refs.length - con.length;
    if (!con.length) {
      return {
        titulo: 'Dónde vota mi gente',
        texto: 'Ninguno de tus referidos tiene puesto de votación cargado todavía.',
        voz: 'Ninguno de tus referidos tiene puesto de votación cargado todavía.', lista: []
      };
    }
    var l = [];
    l.push('**' + fmt(con.length) + '** de tus **' + fmt(refs.length) + '** referidos ya tienen puesto asignado:');
    cuenta(con, function (r) { return String(r.puesto || '').trim(); }).forEach(function (x) {
      var enEse = con.filter(function (r) { return String(r.puesto || '').trim() === x.k; });
      var mesas = cuenta(enEse, function (r) { return String(r.mesa || '').trim() || null; });
      var top = mesas.slice(0, 4).map(function (m) { return 'mesa ' + m.k + ' (' + m.n + ')'; }).join(', ');
      l.push('- ' + x.k + ': **' + fmt(x.n) + '**' + (top ? ' — ' + top + (mesas.length > 4 ? '…' : '') : ''));
    });
    if (sin) {
      l.push('');
      l.push('**' + fmt(sin) + '** todavía sin puesto asignado.');
    }
    var voz = fmt(con.length) + ' de tus ' + fmt(refs.length) + ' referidos ya tienen puesto de votación asignado.';
    return { titulo: 'Dónde vota mi gente', texto: l.join('\n'), voz: voz, lista: [] };
  }

  /* ---- 10. Mi gente por barrio ---- */
  function repBarrios(refs) {
    if (!refs.length) return vacio('Mi gente por barrio');
    var c = cuenta(refs, function (r) { return String(r.residencia || '').trim() || 'Sin barrio'; });
    var l = [];
    l.push('Tu grupo está repartido en **' + fmt(c.length) + '** barrio' + (c.length === 1 ? '' : 's') + ':');
    c.slice(0, 12).forEach(function (x) {
      l.push('- ' + x.k + ': **' + fmt(x.n) + '** (' + pct(x.n, refs.length) + '%)');
    });
    if (c.length > 12) {
      var resto = c.slice(12).reduce(function (s, x) { return s + x.n; }, 0);
      l.push('- …y ' + fmt(c.length - 12) + ' barrios más con ' + fmt(resto) + ' personas.');
    }
    if (c[0]) {
      l.push('');
      l.push('Donde más fuerza tienes es **' + c[0].k + '** con ' + fmt(c[0].n) + '.');
    }
    var voz = 'Tu grupo está repartido en ' + fmt(c.length) + ' barrios' + (c[0] ? '. Donde más fuerza tienes es ' + c[0].k + ' con ' + fmt(c[0].n) + '.' : '.');
    return { titulo: 'Mi gente por barrio', texto: l.join('\n'), voz: voz, lista: [] };
  }

  /* ============================================================
     INFORMES DE MIS SERVICIOS (el profesional)
     ------------------------------------------------------------
     Todo sale de MS.data, que es lo que ya está pintado en pantalla.
     La lista incluye LAS MÍAS (responsable = yo) y las de mi mismo
     servicio que nadie ha tomado: por eso casi todos los informes
     separan "mías" de "sin dueño".
     El texto de la SOLICITUD nunca se muestra ni se lee: es campo
     libre y ahí la gente escribe datos de terceros.
     ============================================================ */
  var EST_DEF = ['INGRESADA', 'PENDIENTE', 'SEGUIMIENTO', 'ATENDIDA', 'RECURRENTE'];

  function datosSrv() {
    try { return (typeof MS !== 'undefined' && MS && MS.data && MS.data.servicios) ? MS.data.servicios : []; }
    catch (e) { return []; }
  }
  function profSrv() {
    try { return (typeof MS !== 'undefined' && MS && MS.data && MS.data.profesional) ? MS.data.profesional : null; }
    catch (e) { return null; }
  }
  function estadosSrv() {
    try {
      var e = (typeof MS !== 'undefined' && MS && MS.data) ? MS.data.estados : null;
      return (e && e.length) ? e.slice() : EST_DEF.slice();
    } catch (x) { return EST_DEF.slice(); }
  }
  function estadoDe(s) { return String(s.estado || 'INGRESADA').toUpperCase().trim() || 'INGRESADA'; }
  function abiertaSrv(s) { return estadoDe(s) !== 'ATENDIDA'; }
  function sinDuenio(s) { return String(s.responsable || '').trim() === ''; }
  function esMia(s, prof) {
    var mio = prof ? llano(prof.nombre) : '';
    return !!mio && llano(s.responsable) === mio;
  }

  /* Días de espera desde la fecha de ingreso (llega dd/MM/yyyy).
     Devuelve null si la fecha no es fiable: en la hoja hay filas con
     18/07/1905, que es lo que sale cuando alguien escribe un número
     en la celda en vez de una fecha. */
  function diasDe(f) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(f || '').trim());
    if (!m) return null;
    var y = +m[3];
    if (y < 2000) return null;
    var d = new Date(y, +m[2] - 1, +m[1]);
    if (isNaN(d.getTime())) return null;
    var hoy = new Date();
    hoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    var n = Math.round((hoy - d) / 86400000);
    return n < 0 ? 0 : n;
  }
  function mesDeFecha(f) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(f || '').trim());
    if (!m || +m[3] < 2000) return '';
    return m[3] + '-' + ('0' + parseInt(m[2], 10)).slice(-2);
  }
  function espera(s) {
    var d = diasDe(s.fecha);
    return d === null ? 'sin fecha fiable' : (d === 0 ? 'hoy' : 'hace ' + fmt(d) + ' ' + plural(d, 'día', 'días'));
  }
  /* Más antiguas primero; las de fecha rota van al final para no
     ensuciar el orden con un 1905. */
  function porAntiguedad(lista) {
    return lista.slice().sort(function (a, b) {
      var da = diasDe(a.fecha), db = diasDe(b.fecha);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return db - da;
    });
  }
  function lineaSol(s) {
    return '- ' + String(s.nombre || '').trim() +
      (s.residencia ? ' · ' + String(s.residencia).trim() : '') +
      ' · ' + estadoDe(s).toLowerCase() + ' · ' + espera(s);
  }

  function armarSrv(id, lista, prof) {
    switch (id) {
      case 'bandeja':      return srvBandeja(lista, prof);
      case 'estados':      return srvEstados(lista, prof);
      case 'sinduenio':    return srvSinDuenio(lista, prof);
      case 'represadas':   return srvRepresadas(lista);
      case 'ingresadas':   return srvPorEstado(lista, prof, 'INGRESADA', 'Mis ingresadas');
      case 'pendientes':   return srvPorEstado(lista, prof, 'PENDIENTE', 'Mis pendientes');
      case 'seguimientos': return srvPorEstado(lista, prof, 'SEGUIMIENTO', 'Mis seguimientos');
      case 'recurrencias': return srvPorEstado(lista, prof, 'RECURRENTE', 'Mis recurrencias');
      case 'mimes':        return srvMiMes(lista);
      case 'repetidos':    return srvRepetidos(lista);
      case 'barrios':      return srvBarrios(lista);
      case 'medio':        return srvMedio(lista);
    }
    return { titulo: '', texto: 'No conozco esa consulta.', voz: '', lista: [] };
  }

  function vacioSrv(titulo) {
    return {
      titulo: titulo,
      texto: 'Tu bandeja está vacía: no tienes solicitudes asignadas ni hay solicitudes de tu servicio esperando dueño.',
      voz: 'Tu bandeja está vacía.',
      lista: []
    };
  }

  /* ---- S1. Mi bandeja (portada) ---- */
  function srvBandeja(lista, prof) {
    if (!lista.length) return vacioSrv('Mi bandeja');
    var mias = lista.filter(function (s) { return esMia(s, prof); });
    var libres = lista.filter(sinDuenio);
    var abiertas = lista.filter(abiertaSrv);
    var atendidas = lista.length - abiertas.length;
    var viejas = abiertas.filter(function (s) { var d = diasDe(s.fecha); return d !== null && d > 30; });
    var rotas = lista.filter(function (s) { return diasDe(s.fecha) === null; });
    var orden = porAntiguedad(abiertas);
    var mayor = orden.length ? diasDe(orden[0].fecha) : null;

    var l = [];
    l.push('Tienes **' + fmt(lista.length) + '** solicitud' + plural(lista.length, '', 'es') + ' en pantalla' +
           (prof && prof.servicio ? ' de **' + prof.servicio + '**' : '') + '.');
    l.push('- Tuyas: **' + fmt(mias.length) + '** · sin dueño: **' + fmt(libres.length) + '**');
    l.push('- Abiertas: **' + fmt(abiertas.length) + '** · atendidas: **' + fmt(atendidas) + '** (' + pct(atendidas, lista.length) + '%)');
    var porEst = cuenta(abiertas, estadoDe);
    if (porEst.length) l.push('- Abiertas por estado: ' + porEst.map(function (x) { return x.k.toLowerCase() + ' ' + fmt(x.n); }).join(' · '));
    if (mayor !== null) l.push('- La más antigua sin cerrar lleva **' + fmt(mayor) + ' ' + plural(mayor, 'día', 'días') + '** esperando.');
    if (viejas.length) l.push('- Con más de 30 días: **' + fmt(viejas.length) + '**');
    if (rotas.length) l.push('- Con fecha no fiable (hay que corregirla en la hoja): **' + fmt(rotas.length) + '**');
    l.push('');
    l.push(libres.length ? 'Lo primero: hay **' + fmt(libres.length) + '** sin dueño esperando que alguien las tome. Toca **Sin dueño**.'
      : abiertas.length ? 'Lo primero: las más represadas. Toca **Represadas**.'
        : '¡Al día! No te queda ninguna solicitud abierta.');

    var voz = 'Tienes ' + fmt(lista.length) + ' solicitudes en pantalla: ' + fmt(abiertas.length) + ' abiertas y ' +
      fmt(atendidas) + ' atendidas. ' + (libres.length ? fmt(libres.length) + ' están sin dueño. ' : '') +
      (mayor !== null ? 'La más antigua lleva ' + fmt(mayor) + ' días.' : '');
    return { titulo: 'Mi bandeja', texto: l.join('\n'), voz: voz, lista: [] };
  }

  /* ---- S2. Por estados ---- */
  function srvEstados(lista, prof) {
    if (!lista.length) return vacioSrv('Por estados');
    var ests = estadosSrv();
    var l = [];
    l.push('Tus **' + fmt(lista.length) + '** solicitudes por estado:');
    var vistos = {};
    ests.forEach(function (e) {
      var g = lista.filter(function (s) { return estadoDe(s) === String(e).toUpperCase(); });
      vistos[String(e).toUpperCase()] = true;
      var mias = g.filter(function (s) { return esMia(s, prof); }).length;
      var libres = g.filter(sinDuenio).length;
      l.push('- ' + e + ': **' + fmt(g.length) + '** (' + pct(g.length, lista.length) + '%)' +
             (g.length ? ' — tuyas ' + fmt(mias) + ', sin dueño ' + fmt(libres) : ''));
    });
    cuenta(lista, estadoDe).forEach(function (x) {
      if (vistos[x.k]) return;
      l.push('- ' + x.k + ' (fuera del catálogo): **' + fmt(x.n) + '**');
    });
    var abiertas = lista.filter(abiertaSrv).length;
    l.push('');
    l.push('En total te quedan **' + fmt(abiertas) + '** sin cerrar.');
    var voz = 'De tus ' + fmt(lista.length) + ' solicitudes, ' + fmt(abiertas) + ' siguen abiertas y ' +
      fmt(lista.length - abiertas) + ' están atendidas.';
    return { titulo: 'Por estados', texto: l.join('\n'), voz: voz, lista: [] };
  }

  /* ---- S3. Sin dueño ---- */
  function srvSinDuenio(lista, prof) {
    if (!lista.length) return vacioSrv('Sin dueño');
    var libres = porAntiguedad(lista.filter(sinDuenio));
    if (!libres.length) {
      return {
        titulo: 'Sin dueño',
        texto: 'No hay solicitudes sueltas: todas las de tu servicio ya tienen responsable.',
        voz: 'No hay solicitudes sin dueño.', lista: []
      };
    }
    var l = [];
    l.push('Hay **' + fmt(libres.length) + '** solicitud' + plural(libres.length, '' , 'es') +
           ' de ' + (prof && prof.servicio ? '**' + prof.servicio + '**' : 'tu servicio') +
           ' que nadie ha tomado. Al responder cualquiera de estas, quedas tú como responsable.');
    l.push('');
    l.push('De la más vieja a la más nueva:');
    libres.slice(0, 15).forEach(function (s) { l.push(lineaSol(s)); });
    if (libres.length > 15) l.push('- …y ' + fmt(libres.length - 15) + ' más.');
    var voz = 'Hay ' + fmt(libres.length) + ' solicitudes de tu servicio sin dueño.';
    return { titulo: 'Sin dueño', texto: l.join('\n'), voz: voz, lista: libres.slice(0, 15) };
  }

  /* ---- S4. Represadas ---- */
  function srvRepresadas(lista) {
    if (!lista.length) return vacioSrv('Represadas');
    var abiertas = porAntiguedad(lista.filter(abiertaSrv));
    if (!abiertas.length) {
      return {
        titulo: 'Represadas',
        texto: '¡Nada represado! Las **' + fmt(lista.length) + '** solicitudes de tu bandeja están atendidas.',
        voz: 'No tienes solicitudes represadas.', lista: []
      };
    }
    var m30 = abiertas.filter(function (s) { var d = diasDe(s.fecha); return d !== null && d > 30; });
    var rotas = abiertas.filter(function (s) { return diasDe(s.fecha) === null; });
    var l = [];
    l.push('Tienes **' + fmt(abiertas.length) + '** solicitud' + plural(abiertas.length, '', 'es') + ' sin cerrar.');
    if (m30.length) l.push('- Con más de 30 días esperando: **' + fmt(m30.length) + '**');
    if (rotas.length) l.push('- Con la fecha mal escrita en la hoja: **' + fmt(rotas.length) + '** (no se les puede contar el tiempo)');
    l.push('');
    l.push('Las más viejas primero:');
    abiertas.slice(0, 15).forEach(function (s) { l.push(lineaSol(s)); });
    if (abiertas.length > 15) l.push('- …y ' + fmt(abiertas.length - 15) + ' más.');
    var voz = 'Tienes ' + fmt(abiertas.length) + ' solicitudes sin cerrar' +
      (m30.length ? ', ' + fmt(m30.length) + ' de ellas con más de 30 días' : '') + '.';
    return { titulo: 'Represadas', texto: l.join('\n'), voz: voz, lista: abiertas.slice(0, 15) };
  }

  /* ---- S5 a S8. Un estado concreto ---- */
  function srvPorEstado(lista, prof, estado, titulo) {
    if (!lista.length) return vacioSrv(titulo);
    var g = porAntiguedad(lista.filter(function (s) { return estadoDe(s) === estado; }));
    if (!g.length) {
      return {
        titulo: titulo,
        texto: 'No tienes ninguna solicitud en estado **' + estado.toLowerCase() + '**.',
        voz: 'No tienes solicitudes en estado ' + estado.toLowerCase() + '.', lista: []
      };
    }
    var mias = g.filter(function (s) { return esMia(s, prof); }).length;
    var libres = g.filter(sinDuenio).length;
    var l = [];
    l.push('Tienes **' + fmt(g.length) + '** solicitud' + plural(g.length, '', 'es') + ' en **' + estado.toLowerCase() +
           '** (' + pct(g.length, lista.length) + '% de tu bandeja).');
    l.push('- Tuyas: **' + fmt(mias) + '** · sin dueño: **' + fmt(libres) + '**');
    l.push('');
    l.push('De la más vieja a la más nueva:');
    g.slice(0, 15).forEach(function (s) { l.push(lineaSol(s)); });
    if (g.length > 15) l.push('- …y ' + fmt(g.length - 15) + ' más.');
    var voz = 'Tienes ' + fmt(g.length) + ' solicitudes en estado ' + estado.toLowerCase() + '.';
    return { titulo: titulo, texto: l.join('\n'), voz: voz, lista: g.slice(0, 15) };
  }

  /* ---- S9. Mi mes ---- */
  function srvMiMes(lista) {
    if (!lista.length) return vacioSrv('Mi mes');
    var mes = hoyMes(), antes = mesAntes(mes);
    var deEste = lista.filter(function (s) { return mesDeFecha(s.fecha) === mes; });
    var dePasado = lista.filter(function (s) { return mesDeFecha(s.fecha) === antes; });
    var cerradasEste = deEste.filter(function (s) { return !abiertaSrv(s); }).length;
    var dif = deEste.length - dePasado.length;

    var l = [];
    l.push('En ' + mesTxt(mes) + ' entraron **' + fmt(deEste.length) + '** solicitud' + plural(deEste.length, '', 'es') + ' a tu bandeja.');
    l.push(dif === 0 ? '- Igual que en ' + mesTxt(antes) + ' (' + fmt(dePasado.length) + ').'
      : dif > 0 ? '- **' + fmt(dif) + ' más** que en ' + mesTxt(antes) + ' (' + fmt(dePasado.length) + ').'
                : '- **' + fmt(-dif) + ' menos** que en ' + mesTxt(antes) + ' (' + fmt(dePasado.length) + ').');
    if (deEste.length) l.push('- De las de este mes ya cerraste **' + fmt(cerradasEste) + '** (' + pct(cerradasEste, deEste.length) + '%).');
    var meses = cuenta(lista, function (s) { return mesDeFecha(s.fecha) || null; });
    if (meses.length > 1) {
      l.push('');
      l.push('Cómo viene entrando el trabajo:');
      meses.slice(0, 6).forEach(function (x) { l.push('- ' + mesTxt(x.k) + ': **' + fmt(x.n) + '**'); });
    }
    l.push('');
    l.push('Ojo: la hoja guarda la fecha de INGRESO, no la de respuesta, así que aquí no se puede medir cuánto te demoras en cerrar una solicitud, solo cuánto lleva esperando.');
    var voz = 'En ' + mesTxt(mes) + ' entraron ' + fmt(deEste.length) + ' solicitudes; en ' + mesTxt(antes) + ' fueron ' + fmt(dePasado.length) + '.';
    return { titulo: 'Mi mes', texto: l.join('\n'), voz: voz, lista: [] };
  }

  /* ---- S10. Casos repetidos ---- */
  function srvRepetidos(lista) {
    if (!lista.length) return vacioSrv('Casos repetidos');
    var mapa = {}, orden = [];
    lista.forEach(function (s) {
      var k = String(s.documento || '').trim() || llano(s.nombre);
      if (!k) return;
      if (!mapa[k]) { mapa[k] = { nombre: String(s.nombre || '').trim(), contacto: s.contacto, n: 0, estados: [] }; orden.push(k); }
      mapa[k].n++;
      mapa[k].estados.push(estadoDe(s).toLowerCase());
    });
    var reps = orden.map(function (k) { return mapa[k]; })
      .filter(function (x) { return x.n > 1; })
      .sort(function (a, b) { return b.n - a.n || (a.nombre < b.nombre ? -1 : 1); });

    if (!reps.length) {
      return {
        titulo: 'Casos repetidos',
        texto: 'Nadie de tu bandeja ha pedido ayuda más de una vez.',
        voz: 'No hay casos repetidos en tu bandeja.', lista: []
      };
    }
    var total = reps.reduce(function (s, x) { return s + x.n; }, 0);
    var l = [];
    l.push('**' + fmt(reps.length) + '** persona' + plural(reps.length, '', 's') + ' de tu bandeja ' +
           plural(reps.length, 'ha pedido', 'han pedido') + ' ayuda más de una vez (**' + fmt(total) + '** solicitudes en total).');
    l.push('');
    reps.slice(0, 12).forEach(function (x) {
      l.push('- ' + x.nombre + ': **' + fmt(x.n) + '** solicitudes — ' + x.estados.join(', '));
    });
    if (reps.length > 12) l.push('- …y ' + fmt(reps.length - 12) + ' más.');
    var voz = fmt(reps.length) + ' personas de tu bandeja han pedido ayuda más de una vez, con ' + fmt(total) + ' solicitudes en total.';
    return { titulo: 'Casos repetidos', texto: l.join('\n'), voz: voz, lista: reps.slice(0, 12) };
  }

  /* ---- S11. Por barrio ---- */
  function srvBarrios(lista) {
    if (!lista.length) return vacioSrv('Por barrio');
    var c = cuenta(lista, function (s) { return String(s.residencia || '').trim() || 'Sin barrio'; });
    var l = [];
    l.push('Tus solicitudes vienen de **' + fmt(c.length) + '** barrio' + plural(c.length, '', 's') + ':');
    c.slice(0, 12).forEach(function (x) {
      var ab = lista.filter(function (s) { return (String(s.residencia || '').trim() || 'Sin barrio') === x.k && abiertaSrv(s); }).length;
      l.push('- ' + x.k + ': **' + fmt(x.n) + '** (' + pct(x.n, lista.length) + '%)' + (ab ? ' · ' + fmt(ab) + ' sin cerrar' : ''));
    });
    if (c.length > 12) {
      var resto = c.slice(12).reduce(function (s, x) { return s + x.n; }, 0);
      l.push('- …y ' + fmt(c.length - 12) + ' barrios más con ' + fmt(resto) + ' solicitudes.');
    }
    if (c[0]) {
      l.push('');
      l.push('De donde más te llega es **' + c[0].k + '** con ' + fmt(c[0].n) + '.');
    }
    var voz = 'Tus solicitudes vienen de ' + fmt(c.length) + ' barrios' + (c[0] ? '. De donde más te llega es ' + c[0].k + ' con ' + fmt(c[0].n) + '.' : '.');
    return { titulo: 'Por barrio', texto: l.join('\n'), voz: voz, lista: [] };
  }

  /* ---- S12. Por medio ---- */
  function srvMedio(lista) {
    if (!lista.length) return vacioSrv('Por medio');
    var c = cuenta(lista, function (s) { return String(s.medio || '').trim().toUpperCase() || 'SIN DATO'; });
    var l = [];
    l.push('Por dónde te llegan las **' + fmt(lista.length) + '** solicitudes:');
    c.forEach(function (x) {
      var ab = lista.filter(function (s) { return (String(s.medio || '').trim().toUpperCase() || 'SIN DATO') === x.k && abiertaSrv(s); }).length;
      l.push('- ' + x.k.charAt(0) + x.k.slice(1).toLowerCase() + ': **' + fmt(x.n) + '** (' + pct(x.n, lista.length) + '%)' +
             (ab ? ' · ' + fmt(ab) + ' sin cerrar' : ''));
    });
    var app = c.filter(function (x) { return x.k === 'APP'; })[0];
    if (app) {
      l.push('');
      l.push('La app te trae el **' + pct(app.n, lista.length) + '%** del trabajo; el resto llega presencial o por otro canal.');
    }
    var voz = 'De tus ' + fmt(lista.length) + ' solicitudes, ' + c.map(function (x) { return fmt(x.n) + ' por ' + x.k.toLowerCase(); }).join(' y ') + '.';
    return { titulo: 'Por medio', texto: l.join('\n'), voz: voz, lista: [] };
  }

  /* ============================================================
     BOTÓN FLOTANTE
     ------------------------------------------------------------
     Ni "Mis referidos" ni "Mis servicios" son rutas con hash, así
     que el disparador es el DOM: se monta cuando existe el ancla de
     la vista y se quita cuando desaparece (cambio de vista, atrás,
     logout…).
     ============================================================ */
  function panelDe() {
    if (document.getElementById(PANELES.referidos.ancla)) return 'referidos';
    if (document.getElementById(PANELES.servicios.ancla)) return 'servicios';
    return '';
  }

  function montar() {
    var p = panelDe();
    if (!p || !yo()) return quitar();
    if (fab) {
      if (fab.dataset.panel !== p) {          /* saltó de una vista a la otra */
        fab.dataset.panel = p;
        if (abierta && cerrarHoja) cerrarHoja();
      }
      return;
    }
    fab = nodo(
      '<button class="iq-fab" type="button" aria-label="Consultas" title="Tócalo para consultar. Mantenlo pulsado para moverlo.">' +
      '<span class="iq-fab-ring" aria-hidden="true"></span>' +
      '<span class="iq-fab-ic">' + ROBOT + '</span>' +
      '<span class="iq-fab-tx">Consultar</span>' +
      '</button>'
    );
    fab.dataset.panel = p;
    if (reducido()) fab.classList.add('iq-sin-motor');
    fab.addEventListener('click', function (ev) {
      if (fab.dataset.arrastro === '1') { fab.dataset.arrastro = ''; ev.preventDefault(); return; }
      Repro.desbloquear();
      abrir(fab.dataset.panel);
    });
    arrastrable(fab);
    document.body.appendChild(fab);
  }

  function quitar() {
    if (fab) { fab.remove(); fab = null; }
    if (abierta && cerrarHoja) cerrarHoja();
  }

  /* Clic sostenido para mover. No se guarda la posición: al salir de la
     vista el nodo se destruye y el siguiente nace en su esquina. */
  function arrastrable(el) {
    var ESPERA = 420, TOLERA = 10;
    var temp = null, listo = false, x0 = 0, y0 = 0, dx = 0, dy = 0, pid = null;

    function fijar(izq, arr) {
      var w = el.offsetWidth, h = el.offsetHeight, m = 8;
      izq = Math.max(m, Math.min(izq, window.innerWidth - w - m));
      arr = Math.max(m, Math.min(arr, window.innerHeight - h - m));
      el.style.left = izq + 'px'; el.style.top = arr + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto';
    }
    function soltar() {
      clearTimeout(temp); temp = null;
      if (listo) { el.classList.remove('iq-fab-mov'); try { el.releasePointerCapture(pid); } catch (e) {} }
      listo = false; pid = null;
    }
    el.addEventListener('pointerdown', function (ev) {
      if (ev.button != null && ev.button > 0) return;
      pid = ev.pointerId; x0 = ev.clientX; y0 = ev.clientY; el.dataset.arrastro = '';
      temp = setTimeout(function () {
        var c = el.getBoundingClientRect();
        dx = x0 - c.left; dy = y0 - c.top; listo = true;
        el.classList.add('iq-fab-mov');
        try { el.setPointerCapture(pid); } catch (e) {}
        try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
        fijar(c.left, c.top);
      }, ESPERA);
    });
    el.addEventListener('pointermove', function (ev) {
      if (!listo) {
        if (temp && (Math.abs(ev.clientX - x0) > TOLERA || Math.abs(ev.clientY - y0) > TOLERA)) { clearTimeout(temp); temp = null; }
        return;
      }
      ev.preventDefault();
      el.dataset.arrastro = '1';
      fijar(ev.clientX - dx, ev.clientY - dy);
    });
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', function () { el.dataset.arrastro = ''; soltar(); });
    el.__fijar = fijar;
  }

  /* Un solo listener global: el FAB se crea y se destruye a cada rato y
     uno por FAB sería una fuga silenciosa. */
  window.addEventListener('resize', function () {
    if (!fab || !fab.parentNode || !fab.__fijar || !fab.style.left) return;
    fab.__fijar(parseFloat(fab.style.left) || 0, parseFloat(fab.style.top) || 0);
  });

  /* ============================================================
     HOJA DE CONSULTAS
     ============================================================ */
  function abrir(panel) {
    if (abierta) return;
    var cfg = PANELES[panel];
    if (!cfg) return;
    abierta = true;

    var capa = document.getElementById('layer') || document.body;
    var hoja = nodo(
      '<div class="iq-wrap" role="dialog" aria-modal="true" aria-label="' + limpio(cfg.titulo) + '">' +
      '  <div class="iq-fondo"></div>' +
      '  <section class="iq-hoja" data-panel="' + limpio(panel) + '">' +
      '    <header class="iq-h">' +
      '      <span class="iq-h-ic">' + ROBOT + '</span>' +
      '      <div class="iq-h-tx"><b>' + limpio(cfg.titulo) + '</b><small>' + limpio(cfg.sub) + '</small></div>' +
      '      <button class="iq-x" type="button" aria-label="Cerrar">' + CERRAR + '</button>' +
      '    </header>' +
      '    <div class="iq-body" id="iq-body"></div>' +
      '    <div class="iq-pie" id="iq-pie" role="group" aria-label="Consultas disponibles"></div>' +
      '  </section>' +
      '</div>'
    );
    capa.appendChild(hoja);
    requestAnimationFrame(function () { hoja.classList.add('iq-on'); });

    var body = hoja.querySelector('#iq-body');
    var pie = hoja.querySelector('#iq-pie');

    function cerrar() {
      abierta = false; cerrarHoja = null;
      Repro.parar();
      hoja.classList.remove('iq-on');
      setTimeout(function () { hoja.remove(); }, reducido() ? 0 : 220);
      document.removeEventListener('keydown', esc);
    }
    cerrarHoja = cerrar;
    function esc(ev) { if (ev.key === 'Escape') cerrar(); }
    document.addEventListener('keydown', esc);
    hoja.querySelector('.iq-x').addEventListener('click', cerrar);
    hoja.querySelector('.iq-fondo').addEventListener('click', cerrar);

    cfg.botones.forEach(function (b) {
      var el = nodo('<button class="iq-chip" type="button" data-id="' + b.id + '"><span aria-hidden="true">' + b.icono + '</span> ' + limpio(b.etiqueta) + '</button>');
      el.addEventListener('click', function () {
        Repro.desbloquear();
        lanzar(body, panel, b);
      });
      pie.appendChild(el);
    });

    pedirVoz();
    pintarAviso(body, panel === 'servicios'
      ? 'Toca una consulta abajo. Los números salen de las solicitudes que tienes en pantalla, tal como están en este momento.'
      : 'Toca una consulta abajo. Los números salen de tus referidos, tal como están en este momento.');
    lanzar(body, panel, cfg.botones[0]);      /* portada */
  }

  function irAbajo(body) { body.scrollTop = body.scrollHeight; }

  function pintarAviso(body, txt) {
    var el = nodo('<div class="iq-hint"></div>');
    el.textContent = txt;
    body.appendChild(el);
    return el;
  }

  function lanzar(body, panel, boton) {
    Repro.parar();
    /* Burbuja de la "pregunta", como en un chat de verdad */
    var mio = nodo('<div class="iq-msg iq-yo"></div>');
    mio.textContent = boton.etiqueta;
    body.appendChild(mio);
    irAbajo(body);

    var cargando = nodo(
      '<div class="iq-msg iq-bot iq-cargando">' +
      '<span class="iq-pts"><i></i><i></i><i></i></span>' +
      '<span class="iq-carga-tx">Escribiendo…</span>' +
      '</div>'
    );
    body.appendChild(cargando);
    irAbajo(body);

    var t0 = Date.now();
    informe(panel, boton.id).then(function (rep) {
      /* Que el "escribiendo" se vea aunque el cálculo sea instantáneo */
      var espera = Math.max(0, 420 - (Date.now() - t0));
      setTimeout(function () {
        if (!cargando.parentNode) return;      /* cerraron la hoja */
        cargando.remove();
        pintar(body, rep);
      }, espera);
    }).catch(function (err) {
      if (cargando.parentNode) cargando.remove();
      var e = nodo('<div class="iq-msg iq-err"></div>');
      e.textContent = (err && err.message) || 'No se pudo armar la consulta.';
      body.appendChild(e);
      irAbajo(body);
    });
  }

  function pintar(body, rep) {
    var el = nodo('<div class="iq-msg iq-bot"></div>');
    var caja = nodo('<div class="iq-tx"></div>');
    el.appendChild(caja);
    body.appendChild(el);
    irAbajo(body);

    escribiendo(caja, rep.texto, function () {
      if (rep.lista && rep.lista.length) el.appendChild(listaPersonas(rep.lista));
      el.appendChild(botonera(rep));
      irAbajo(body);
      leerSiToca(el, rep.voz || rep.texto);
    }, function () { irAbajo(body); });
    return el;
  }

  /* Efecto "escribiendo": se revela el texto plano y al terminar se
     cambia por el HTML con negritas y viñetas. Un toque lo salta. */
  function escribiendo(caja, texto, fin, tick) {
    var t = String(texto || '');
    function acabar() {
      caja.innerHTML = aHtml(t);
      caja.classList.remove('iq-escribiendo');
      caja.onclick = null;
      if (fin) fin();
    }
    if (reducido() || t.length < 2) { acabar(); return; }

    caja.classList.add('iq-escribiendo');
    var i = 0;
    var paso = Math.max(2, Math.ceil(t.length / 70));      /* ~1,4 s pase lo que pase */
    var timer = setInterval(function () {
      if (!caja.isConnected) { clearInterval(timer); return; }
      i += paso;
      caja.textContent = t.slice(0, i);
      if (tick) tick();
      if (i >= t.length) { clearInterval(timer); acabar(); }
    }, 20);
    caja.onclick = function () { clearInterval(timer); acabar(); };
  }

  /* Personas con WhatsApp directo: el mismo enlace de las tarjetas. */
  function listaPersonas(lista) {
    var caja = nodo('<div class="iq-personas"></div>');
    lista.forEach(function (r) {
      var num = '';
      try { num = (typeof onlyDig === 'function') ? onlyDig(r.contacto) : String(r.contacto || '').replace(/\D/g, ''); } catch (e) {}
      var fila = nodo('<div class="iq-per"><span class="iq-per-n"></span></div>');
      fila.querySelector('.iq-per-n').textContent = String(r.nombre || '').trim();
      if (num) {
        var b = nodo('<button class="iq-per-wa" type="button" aria-label="Escribir por WhatsApp">' + WA + '</button>');
        b.addEventListener('click', function () { window.open('https://wa.me/57' + num, '_blank'); });
        fila.appendChild(b);
      }
      caja.appendChild(fila);
    });
    return caja;
  }

  function botonera(rep) {
    var caja = nodo('<div class="iq-acts"></div>');

    var voz = nodo('<button class="iq-act iq-voz" type="button" aria-label="Escuchar la respuesta">' + BOCINA + ' Escuchar</button>');
    if (!(vozCfg && vozCfg.configurada)) voz.style.display = 'none';
    voz.addEventListener('click', function () {
      if (Repro.suena() && Repro.dueno() === voz) return Repro.parar();
      Repro.desbloquear();
      Repro.hablar(rep.voz || rep.texto, voz);
    });
    caja.appendChild(voz);

    var cop = nodo('<button class="iq-act" type="button">Copiar</button>');
    cop.addEventListener('click', function () {
      var txt = (rep.titulo ? rep.titulo + '\n\n' : '') + rep.texto;
      try {
        navigator.clipboard.writeText(txt);
        cop.textContent = 'Copiado';
        setTimeout(function () { cop.textContent = 'Copiar'; }, 1600);
      } catch (e) { avisar('No se pudo copiar.', 'err'); }
    });
    caja.appendChild(cop);

    var wa = nodo('<button class="iq-act" type="button">' + WA + ' WhatsApp</button>');
    wa.addEventListener('click', function () { compartir(rep); });
    caja.appendChild(wa);

    return caja;
  }

  /* WhatsApp sin número: abre el selector de contactos. Se recorta
     porque una URL gigante no la abre ni el móvil ni el web. */
  function compartir(rep) {
    var cab = (rep.titulo ? rep.titulo + '\n\n' : '');
    var cuerpo = String(rep.texto || '').replace(/\*\*/g, '*');
    var TOPE = 1500;
    if (cab.length + cuerpo.length > TOPE) {
      cuerpo = cuerpo.slice(0, TOPE - cab.length - 20).replace(/\s+\S*$/, '') + '…';
    }
    var t = encodeURIComponent(cab + cuerpo);
    var movil = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    window.open((movil ? 'whatsapp://send?text=' : 'https://api.whatsapp.com/send?text=') + t, '_blank');
  }

  /* Lectura automática: solo si el CORE dice que hay clave y el
     interruptor de Configuración está en SÍ. */
  function leerSiToca(burbuja, texto) {
    pedirVoz().then(function (v) {
      if (!v || !v.configurada || !v.auto) return;
      if (!burbuja || !burbuja.parentNode) return;
      Repro.hablar(texto, burbuja.querySelector('.iq-voz'));
    });
  }

  /* ============================================================
     ARRANQUE — vigilar el DOM sin castigarlo
     ------------------------------------------------------------
     El refresco en vivo de Mis referidos repinta la lista cada vez
     que alguien toca la hoja PRINCIPAL, así que las mutaciones son
     muchas: se amortiguan y la comprobación son dos getElementById.
     ============================================================ */
  var pendiente = null;
  function revisar() {
    if (pendiente) return;
    pendiente = setTimeout(function () {
      pendiente = null;
      if (panelDe() && yo()) montar(); else quitar();
    }, 120);
  }

  function arrancar() {
    var raiz = document.getElementById('app') || document.body;
    try { new MutationObserver(revisar).observe(raiz, { childList: true, subtree: true }); }
    catch (e) { setInterval(revisar, 1200); }        /* respaldo bobo, por si acaso */
    window.addEventListener('hashchange', revisar);
    revisar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  /* Puerta trasera para las pruebas (no la usa la app) */
  window.__jp11 = {
    armar: armar, armarSrv: armarSrv, grupoMun: grupoMun, aHtml: aHtml, nombres: nombres,
    trocear: Repro.trocear, BOTONES: BOTONES, BOTONES_SRV: BOTONES_SRV, PANELES: PANELES,
    mesTxt: mesTxt, diasDe: diasDe, mesDeFecha: mesDeFecha, esMia: esMia
  };
})();
