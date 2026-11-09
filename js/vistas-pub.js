/* ============================================================================
 * vistas-pub.js — VISTAS ENCENDIBLES DE LA APP PÚBLICA (08/11/2026)
 * ----------------------------------------------------------------------------
 * Pieza sin DOM. Se carga después de publico.js y antes de app.js.
 *
 * Desde la app privada (Configuración → General → Vistas de la app pública)
 * el ADMIN o el DESARROLLADOR apaga las vistas que su municipio no usa. La
 * lista viaja DENTRO del paquete público (parte 'vistas'), así que no cuesta
 * ninguna llamada: al abrir se usa lo guardado en el teléfono (0 ms) y
 * PUB.refrescar la revalida de fondo como siempre.
 *
 *  · Apagada → no sale en el Inicio y, si alguien entra por enlace directo,
 *    la app vuelve al Inicio con un aviso corto (render() en app.js).
 *  · Al volver a la app (visibilitychange) se lee SOLO /publico/vistas de
 *    Firebase (unos bytes, sin Apps Script), máximo una vez por minuto.
 *  · Apagar no borra nada: solo esconde la puerta.
 *
 *  VISTAS.apagada(id)  → true si esa vista está apagada
 *  VISTAS.deRuta(ruta) → el id de vista que abre esa ruta ('' si ninguna)
 *  VISTAS.revisar()    → revalida /publico/vistas (con freno de 60 s)
 *
 * Los ids son los de MENU en app.js y los del catálogo del CORE
 * (Vistas_Pub.gs · PV_CATALOGO).
 * ============================================================================ */
(function (raiz) {
  'use strict';
  if (raiz.VISTAS) return;

  var CATALOGO = ['tarjeta', 'misdatos', 'solicitud', 'ideas', 'noticias', 'casa', 'emergencia', 'comercio', 'lideres'];
  /* ruta del hash → vista. 'datos' (editar mis datos) va con Mis Datos. */
  var RUTA = {
    tarjeta: 'tarjeta', datos: 'misdatos', solicitud: 'solicitud', ideas: 'ideas',
    noticias: 'noticias', casa: 'casa', emergencia: 'emergencia', comercio: 'comercio', lideres: 'lideres'
  };
  var FRENO_MS = 60000;
  var ultima = 0;

  function apagadas() {
    var v = raiz.PUB && raiz.PUB.dato('vistas');
    return (v && Array.isArray(v.apagadas)) ? v.apagadas : [];
  }
  function apagada(id) { return !!id && apagadas().indexOf(id) >= 0; }
  function deRuta(ruta) { return RUTA[String(ruta || '')] || ''; }
  function revisar() {
    if (!raiz.PUB || !raiz.PUB.parte) return;
    var t = Date.now();
    if (t - ultima < FRENO_MS) return;
    ultima = t;
    raiz.PUB.parte('vistas');
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function () { if (!document.hidden) revisar(); });
  }

  raiz.VISTAS = { CATALOGO: CATALOGO, apagada: apagada, apagadas: apagadas, deRuta: deRuta, revisar: revisar };
})(typeof self !== 'undefined' ? self : this);
