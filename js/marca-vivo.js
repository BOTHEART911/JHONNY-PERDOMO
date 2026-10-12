/* ============================================================
   marca-vivo.js — MARCA EN CALIENTE (Fase 3)
   ------------------------------------------------------------
   AL REPLICAR LA CAMPAÑA NO SE TOCA NADA DE AQUÍ.
   Lo que cambia de un candidato a otro vive en marca.js (respaldo)
   y en la hoja CONFIG del CORE (valor real, endpoint app.marca).

   Qué hace, en orden:
     1) Pinta YA, sin esperar a la red: lee la marca cacheada en
        localStorage (bajo el prefijo de campaña de storage-ns.js).
        Si no hay caché, usa el respaldo de marca.js. Por eso no
        hay parpadeo en el primer pintado.
     2) En segundo plano pregunta al CORE (app.marca). Si algo
        cambió, guarda la caché nueva, vuelve a aplicar los colores
        y avisa con el evento 'marca:actualizada'.

   ORDEN DE CARGA (importa):
     marca.js  →  storage-ns.js  →  <link> del CSS  →  marca-vivo.js
   Va DESPUÉS del CSS a propósito: el bloque de color que inyecta
   tiene que ganarle a style.css. Y va antes del <body>, así que
   sigue siendo antes del primer pintado.

   MODO OSCURO: el bloque inyectado usa el selector :root. El modo
   oscuro usa html.oscuro, que pesa más, así que el oscuro sigue
   mandando. No cambiar :root por html ni ponerlo como estilo
   en línea: eso rompería el tema oscuro.
   ============================================================ */
(function (raiz) {
  'use strict';

  var M = raiz.MARCA || {};

  /* ---------- respaldo: marca.js, y si tampoco está, los valores
       de la campaña original (para que nunca se pinte "vacío") ---------- */
  var RESPALDO = {
    candidato:    M.CANDIDATO    || 'Jhonny Perdomo',
    pnCandidato:  M.PN_CANDIDATO || 'Jhonny',
    municipio:    M.MUNICIPIO    || 'Flandes',
    departamento: M.DEPARTAMENTO || 'Tolima',
    lugar:        M.LUGAR        || '',
    lema:         M.LEMA         || 'Soy de Flandes',
    equipo:       M.EQUIPO       || 'Equipo del Hacer',
    color:        M.COLOR        || '#007BFF',
    color700:     M.COLOR_700    || '#0056B3',
    color900:     M.COLOR_900    || '',
    color050:     M.COLOR_050    || '',
    imgBase:      M.IMG_BASE     || '',
    icono:        M.APP_ICON     || '',
    banner:       M.APP_BANNER   || '',
    credBase:     ''
  };
  if (!RESPALDO.lugar) {
    RESPALDO.lugar = RESPALDO.municipio + (RESPALDO.departamento ? ', ' + RESPALDO.departamento : '');
  }

  var CAMPOS = ['candidato', 'pnCandidato', 'municipio', 'departamento', 'lugar', 'lema',
                'equipo', 'color', 'color700', 'color900', 'color050', 'imgBase',
                'icono', 'banner', 'credBase'];

  /* ---------- utilidades ---------- */
  function txt(v) { return (typeof v === 'string') ? v.trim() : ''; }

  function norm(v) {
    var s = txt(v).toUpperCase();
    return s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
  }

  /* ---------- imágenes (30/07/2026) ----------
     EL RESOLVEDOR. Mismo criterio que marcaImg_() del CORE:
       - ya es absoluta (http://, https://, //, /, data:, blob:) → intacta.
       - es un nombre suelto ('logo.png') → se le pega imgBase delante.
       - sin imgBase → intacta. NUNCA se inventa un host.
     Por eso activar esto no cambia nada mientras las llaves sigan
     guardando URLs completas: todas caen en el primer caso. */
  function img(v, base) {
    var s = txt(v);
    if (!s) return '';
    if (/^(https?:)?\/\//i.test(s)) return s;
    if (/^(data|blob):/i.test(s))     return s;
    if (s.charAt(0) === '/')          return s;
    var b = txt(base === undefined ? MV.imgBase : base);
    if (!b) return s;
    return b.replace(/\/+$/, '') + '/' + s.replace(/^\.?\//, '');
  }

  /* mezcla lo recibido con el respaldo: un campo vacío nunca borra al respaldo */
  function completar(datos) {
    var o = {}, i, k;
    for (i = 0; i < CAMPOS.length; i++) {
      k = CAMPOS[i];
      o[k] = txt(datos && datos[k]) || RESPALDO[k];
    }
    /* El logo y el banner se guardan resueltos: quien los pinta hace
       <img src="${MV.icono}"> sin saber si en CONFIG hay una URL entera o
       solo 'logo.png'. El CORE ya los manda resueltos; esto cubre el
       respaldo de marca.js y la caché vieja. */
    o.icono  = img(o.icono,  o.imgBase);
    o.banner = img(o.banner, o.imgBase);
    return o;
  }

  /* ---------- color ---------- */
  function hexRgb(hex) {
    var h = txt(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbTxt(hex) { var r = hexRgb(hex); return r ? r.join(',') : ''; }

  function rgbHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2, d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = ((b - r) / d + 2);
      else                h = ((r - g) / d + 4);
      h *= 60;
    }
    return [h, s, l];
  }
  function hslHex(h, s, l) {
    function f(n) {
      var k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
      var v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
      return Math.round(v * 255);
    }
    function dos(x) { var t = x.toString(16); return t.length === 1 ? '0' + t : t; }
    return '#' + dos(f(0)) + dos(f(8)) + dos(f(4));
  }

  /* tinta oscura (fondos de hero/toast y texto de títulos) y tinte claro
     (fondo de pastillas), derivados del color principal. Los valores
     escogidos a mano de la campaña original se reproducen casi exactos:
     #007BFF → #0A2643 (real #0A2540) y #E6F1FF (real #E7F1FF). */
  function derivar900(hex) {
    var r = hexRgb(hex); if (!r) return '';
    var p = rgbHsl(r[0], r[1], r[2]);
    return hslHex(p[0], Math.min(p[1], 0.75), 0.15);
  }
  function derivar050(hex) {
    var r = hexRgb(hex); if (!r) return '';
    var p = rgbHsl(r[0], r[1], r[2]);
    return hslHex(p[0], p[1], 0.95);
  }

  var ID_ESTILO = 'marca-viva-css';

  /* true en las apps cuyo modo oscuro va por preferencia del sistema
     (CRED). En las que tienen botón (.oscuro) se queda en false. */
  var OSCURO_POR_SISTEMA = !!M.OSCURO_POR_SISTEMA;

  /* Paleta completa a partir del color principal. Pública para poder
     probarla y para quien necesite los tokens sin tocar el CSS. */
  function paleta(color, color700, c900, c050) {
    var p900 = txt(c900) || derivar900(color);
    var p050 = txt(c050) || derivar050(color);
    return {
      brand: color, brand700: color700, brand900: p900, brand050: p050,
      brandRgb: rgbTxt(color), brand700Rgb: rgbTxt(color700), brand900Rgb: rgbTxt(p900)
    };
  }

  function aplicarColor(m) {
    /* Si el color es el mismo con el que se escribió el CSS, no se toca
       nada: la campaña original conserva su paleta exacta, escogida a
       mano, incluida la tinta #0A2540 que no sale de ninguna fórmula. */
    if (norm(m.color) === norm(RESPALDO.color)) {
      /* volvió al color original: se retira el bloque si estaba puesto */
      try {
        var viejo = document.getElementById(ID_ESTILO);
        if (viejo && viejo.parentNode) viejo.parentNode.removeChild(viejo);
      } catch (e) {}
      return false;
    }

    var p = paleta(m.color, m.color700, m.color900, m.color050);

    /* --brand-900 y --brand-050 son los dos tokens que el modo oscuro
       le da la vuelta. Donde el oscuro se activa con la clase .oscuro
       (botón), esa clase pesa más que :root y gana sola. Pero donde el
       oscuro va por preferencia del sistema (CRED), el override también
       es :root y perdería contra este bloque por ir después: ahí estos
       dos tokens se limitan al esquema claro. Lo dice marca.js. */
    var tinta = (p.brand900 ? '--brand-900:' + p.brand900 + ';' : '') +
                (p.brand050 ? '--brand-050:' + p.brand050 + ';' : '') +
                (p.brand900 ? '--brand-900-rgb:' + p.brand900Rgb + ';' : '');

    var css = ':root{' +
      '--brand:' + p.brand + ';' +
      '--brand-700:' + p.brand700 + ';' +
      '--brand-rgb:' + p.brandRgb + ';' +
      '--brand-700-rgb:' + p.brand700Rgb + ';' +
      (OSCURO_POR_SISTEMA ? '' : tinta) +
      '}' +
      (OSCURO_POR_SISTEMA && tinta ? '@media (prefers-color-scheme: light){:root{' + tinta + '}}' : '');

    try {
      var el = document.getElementById(ID_ESTILO);
      if (!el) {
        el = document.createElement('style');
        el.id = ID_ESTILO;
        (document.head || document.documentElement).appendChild(el);
      }
      if (el.textContent !== css) el.textContent = css;
      return true;
    } catch (e) { return false; }
  }

  /* ---------- caché bajo el prefijo de campaña ---------- */
  var CLAVE = (typeof raiz.nsKey === 'function') ? raiz.nsKey('marca') : 'jp:marca';
  var FRESCO_MS = 10 * 60 * 1000;   /* cada cuánto se vuelve a preguntar */

  function leerCache() {
    try {
      var crudo = raiz.localStorage && raiz.localStorage.getItem(CLAVE);
      if (!crudo) return null;
      var o = JSON.parse(crudo);
      return (o && o.datos) ? o : null;
    } catch (e) { return null; }
  }
  function guardarCache(datos) {
    try { raiz.localStorage.setItem(CLAVE, JSON.stringify({ ts: Date.now(), datos: datos })); }
    catch (e) { /* almacenamiento lleno o bloqueado: se sigue igual */ }
  }

  /* ---------- estado público ---------- */
  var cache = leerCache();
  var MV = completar(cache && cache.datos);

  MV.esMunicipio = function (v) {
    var a = norm(v), b = norm(MV.municipio);
    return !!a && !!b && a === b;
  };
  MV.fueraOpcion = function () { return 'Fuera de ' + MV.municipio; };
  /* Opción A: se aceptan las filas históricas con CUALQUIER municipio
     ('Fuera de Flandes' guardado hace meses sigue siendo "fuera"). */
  MV.esFuera = function (v) { return norm(v).indexOf('FUERA DE ') === 0; };
  MV.norm = norm;
  /* Resuelve una imagen COMPARTIDA de la campaña contra imgBase.
     Las imágenes propias de cada app (las de su carpeta img/) NO pasan por
     aquí: se escriben relativas y las sirve el mismo repo. */
  MV.img = function (v, base) { return img(v, base); };
  MV.paleta = function (color, color700, c900, c050) {
    return paleta(txt(color) || MV.color, txt(color700) || MV.color700, c900, c050);
  };

  raiz.MARCA_VIVA = MV;
  raiz.MV = MV;

  /* pintar el color con lo que ya se tiene, antes de cualquier red */
  if (typeof document !== 'undefined') aplicarColor(MV);

  /* ---------- revalidación en segundo plano (nunca bloquea) ---------- */
  function cambio(a, b) {
    for (var i = 0; i < CAMPOS.length; i++) if (a[CAMPOS[i]] !== b[CAMPOS[i]]) return true;
    return false;
  }

  MV.refrescar = function (forzar) {
    if (!M.API_URL || typeof fetch !== 'function') return;
    if (!forzar && cache && (Date.now() - (cache.ts || 0)) < FRESCO_MS) return;
    fetch(M.API_URL + '?action=app.marca')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok || !j.data) return;
        var nuevo = completar(j.data);
        guardarCache(j.data);
        cache = { ts: Date.now(), datos: j.data };
        if (!cambio(MV, nuevo)) return;
        for (var i = 0; i < CAMPOS.length; i++) MV[CAMPOS[i]] = nuevo[CAMPOS[i]];
        aplicarColor(MV);
        try { document.dispatchEvent(new CustomEvent('marca:actualizada', { detail: MV })); } catch (e) {}
      })
      .catch(function () { /* sin red: se sigue con la caché o el respaldo */ });
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { MV.refrescar(false); });
    } else { MV.refrescar(false); }
  }

})(typeof self !== 'undefined' ? self : this);
