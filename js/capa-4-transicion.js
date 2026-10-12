/* ============================================================================
 * CAPA 4 · TRANSICIÓN LATERAL ENTRE PANTALLAS — estilo iOS  (parte JS)
 * ----------------------------------------------------------------------------
 * QUÉ HACE
 *   Detecta cada cambio de pantalla y decide la dirección: adelante (entra por
 *   la derecha) o atrás (entra por la izquierda). El deslizamiento lo pinta el
 *   CSS de la pareja.
 *
 * INSTALACIÓN (una sola línea, al final del <body>, DESPUÉS de app.js)
 *   <script src="capa-4-transicion.js"></script>
 *
 * PAREJA
 *   capa-4-transicion.css  (obligatoria)
 *
 * POR QUÉ NO SE ENVUELVE render()
 *   En esta app el router hace `window.addEventListener('hashchange', render)`.
 *   Ese listener se quedó con la referencia ORIGINAL de render, así que
 *   reemplazar window.render NO interceptaría la navegación. Además varias
 *   pantallas se pintan sin cambiar el hash (por ejemplo el botón atrás de la
 *   zona de líderes llama a liderPanel(user) directamente).
 *   Por eso el enganche es por observación del repintado de #app: funciona en
 *   los dos casos y no obliga a tocar una sola línea de app.js.
 *
 * CÓMO SE DETECTA "ATRÁS"
 *   1) Toque en los controles reales de retroceso de esta app: #backbtn
 *      (backbar) y #backLiderBtn (backLider).
 *   2) Botón atrás del navegador / del teléfono: se lleva una pila de hashes;
 *      si el hash nuevo es el anterior de la pila, es atrás.
 *
 * NOTAS
 *   · No toca index.html, app.js ni style.css. Se quita borrando la línea.
 *   · Solo observa los hijos DIRECTOS de #app (los cambios de vista). El
 *     repintado interno de una lista (#lr-body, #com-list, …) no dispara nada.
 *   · Si la vista se pinta con #app todavía oculto (arranque tras el splash),
 *     la animación espera a que se muestre.
 *   · Marca <html class="nt-tx"> para que la CAPA 1 no anime también la
 *     aparición de pantalla. Si la capa 1 no está, no pasa nada.
 * ========================================================================== */
(function () {
  'use strict';

  if (window.__nt4Transicion) return;      // no instalar dos veces
  window.__nt4Transicion = true;

  var app = document.getElementById('app');
  if (!app) return;                        // sin #app no hay nada que animar

  var raiz = document.documentElement;
  raiz.classList.add('nt-tx');             // avisa a la capa 1 que cede el paso

  var reduce = false;
  try {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduce = mq.matches;
    if (mq.addEventListener) mq.addEventListener('change', function (e) { reduce = e.matches; });
  } catch (e) { /* navegador viejo: seguimos con animación */ }

  var VENTANA_ATRAS = 1500;   // ms que vale un toque en "atrás"
  var atrasHasta = 0;
  var ultimaAnim = 0;

  /* ---- 1. Toque en los botones de retroceso reales ---------------------- */
  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#backbtn, #backLiderBtn')) atrasHasta = Date.now() + VENTANA_ATRAS;
  }, true);

  /* ---- 2. Botón atrás del navegador: pila de hashes --------------------- */
  var pila = [location.hash || ''];
  window.addEventListener('hashchange', function () {
    var h = location.hash || '';
    if (pila.length >= 2 && pila[pila.length - 2] === h) {
      pila.pop();
      atrasHasta = Date.now() + VENTANA_ATRAS;
    } else {
      pila.push(h);
      if (pila.length > 30) pila.shift();
    }
  });

  /* ---- 3. Animación ----------------------------------------------------- */
  function animar() {
    if (reduce) return;
    var ahora = Date.now();
    if (ahora - ultimaAnim < 90) return;   // repintados en ráfaga: una sola vez
    ultimaAnim = ahora;

    var atras = ahora <= atrasHasta;
    atrasHasta = 0;

    app.classList.remove('nt-view-in', 'nt-view-back');
    void app.offsetWidth;                  // reinicia la animación
    raiz.classList.add('nt-tx-anim');
    app.classList.add(atras ? 'nt-view-back' : 'nt-view-in');
  }

  function limpiar(e) {
    if (e.target !== app) return;
    app.classList.remove('nt-view-in', 'nt-view-back');
    raiz.classList.remove('nt-tx-anim');
  }
  app.addEventListener('animationend', limpiar);
  app.addEventListener('animationcancel', limpiar);

  /* ---- 4. Enganche: repintado de #app ----------------------------------- */
  var pendiente = false;

  function alRepintar() {
    if (app.hidden) { pendiente = true; return; }   // aún con splash: espera
    pendiente = false;
    animar();
  }

  new MutationObserver(function (muts) {
    var cambioHijos = false;
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === 'childList' && m.addedNodes.length) cambioHijos = true;
      if (m.type === 'attributes' && m.attributeName === 'hidden' && !app.hidden && pendiente) {
        pendiente = false;
        animar();
      }
    }
    if (cambioHijos) alRepintar();
  }).observe(app, { childList: true, subtree: false, attributes: true, attributeFilter: ['hidden'] });
})();
