/* ============================================================================
 * CAPA 7 · ONDA AL TOCAR (ripple)  (parte JS)
 * ----------------------------------------------------------------------------
 * QUÉ HACE
 *   En cada `pointerdown` crea la onda en el punto tocado y la borra sola al
 *   terminar. Funciona con dedo, ratón y lápiz.
 *
 * INSTALACIÓN (una sola línea, al final del <body>, DESPUÉS de app.js)
 *   <script src="capa-7-ripple.js"></script>
 *
 * PAREJA
 *   capa-7-ripple.css  (obligatoria)
 *
 * CONTROLES ALCANZADOS (clases reales de esta app)
 *   .btn  .tile  .chip  .icon-btn  .pin-key  .rc-btn  .opt-row  .login-tab
 *   .nt-nueva
 *   Se usa closest(): si tocas un botón dentro de una tarjeta, la onda sale
 *   solo en el botón, nunca dos ondas a la vez.
 *
 * NOTAS
 *   · No toca index.html, app.js ni style.css. Se quita borrando la línea.
 *   · Escucha en captura sobre document, así que también cubre lo que se pinta
 *     después (hojas de #layer, listas recargadas, etc.). No usa MutationObserver.
 *   · Nunca llama a preventDefault ni a stopPropagation: los onclick de la app
 *     siguen funcionando exactamente igual.
 *   · Botones deshabilitados (mientras `saving()` guarda) no hacen onda.
 * ========================================================================== */
(function () {
  'use strict';

  if (window.__nt7Ripple) return;
  window.__nt7Ripple = true;

  var SEL = '.btn, .tile, .chip, .icon-btn, .pin-key, .rc-btn, .opt-row, .login-tab, .nt-nueva';
  var MAX_MS = 700;

  var reduce = false;
  try {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduce = mq.matches;
    if (mq.addEventListener) mq.addEventListener('change', function (e) { reduce = e.matches; });
  } catch (e) { /* navegador viejo */ }

  document.addEventListener('pointerdown', function (e) {
    if (reduce) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;   // solo clic izquierdo

    var t = e.target;
    if (!t || !t.closest) return;
    var host = t.closest(SEL);
    if (!host || host.disabled) return;

    var caja = host.getBoundingClientRect();
    if (!caja.width || !caja.height) return;

    // El contenedor debe poder posicionar la onda; solo se fuerza si hace falta.
    var pos = getComputedStyle(host).position;
    if (pos === 'static') host.style.position = 'relative';

    var d = Math.max(caja.width, caja.height) * 2.2;
    var onda = document.createElement('span');
    onda.className = 'nt-ripple';
    onda.style.width = onda.style.height = d + 'px';
    onda.style.left = (e.clientX - caja.left - d / 2) + 'px';
    onda.style.top = (e.clientY - caja.top - d / 2) + 'px';
    host.appendChild(onda);

    var fuera = false;
    function quitar() {
      if (fuera) return;
      fuera = true;
      if (onda.parentNode) onda.parentNode.removeChild(onda);
    }
    onda.addEventListener('animationend', quitar);
    setTimeout(quitar, MAX_MS);   // red de seguridad si la animación no dispara
  }, true);
})();
