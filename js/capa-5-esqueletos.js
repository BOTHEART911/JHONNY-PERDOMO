/* ============================================================================
 * CAPA 5 · ESQUELETOS DE CARGA  (parte JS)
 * ----------------------------------------------------------------------------
 * QUÉ HACE
 *   Sustituye el girador de las LISTAS por siluetas grises con brillo, con la
 *   forma real de lo que está por llegar en cada pantalla.
 *
 * INSTALACIÓN (una sola línea, al final del <body>, DESPUÉS de app.js)
 *   <script src="capa-5-esqueletos.js"></script>
 *
 * PAREJA
 *   capa-5-esqueletos.css  (obligatoria)
 *
 * CÓMO SE ENGANCHA
 *   En esta app todas las listas pintan su carga con `loadingBox(texto)`, que
 *   devuelve `<div class="loadbox">…`. Esa clase la genera SOLO esa función
 *   (comprobado en app.js), así que sirve de marca inequívoca: cuando aparece
 *   un .loadbox dentro de #app, esta capa lo cambia por el esqueleto que toca,
 *   elegido por el id del contenedor real donde cayó.
 *   No se envuelve loadingBox() porque devuelve el HTML ANTES de saber en qué
 *   pantalla va a caer, y dos vistas usan el mismo texto ("Cargando…").
 *   Observando el contenedor la forma sale siempre exacta.
 *
 * PANTALLAS MAPEADAS (ids reales de esta app)
 *   #lr-body    Mis referidos   → tarjeta de persona
 *   #ls-body    Mis servicios   → tarjeta de persona con texto
 *   #lc-body    Mis compromisos → tarjeta de texto
 *   #com-list   Comercio        → tarjeta con imagen
 *   #nt-body    Noticias        → tarjeta de noticia
 *   #casa-body  Casa social     → tarjeta con imagen
 *   #em-body    Emergencia      → tarjeta de contacto
 *   (cualquier otra lista futura cae en un esqueleto de texto genérico)
 *
 * LO QUE NO TOCA
 *   · #ios-loader (girador global de guardar / cobrar / login): está fuera de
 *     #app y no es un .loadbox.
 *   · El spinner que `saving(btn, true)` mete dentro de los botones.
 *
 * NOTAS
 *   · No toca index.html, app.js ni style.css. Se quita borrando la línea.
 *   · Con "reducir movimiento" el esqueleto se sigue mostrando, pero sin brillo
 *     (lo apaga el CSS de la pareja).
 * ========================================================================== */
(function () {
  'use strict';

  if (window.__nt5Esqueletos) return;
  window.__nt5Esqueletos = true;

  var app = document.getElementById('app');
  if (!app) return;

  /* ---- Piezas ----------------------------------------------------------- */
  function linea(w, tit) {
    return '<span class="nt-sk nt-sk-l' + (tit ? ' tit' : '') + ' nt-sk-w' + w + '"></span>';
  }
  function card(inner) { return '<div class="nt-sk-card">' + inner + '</div>'; }

  var cabezaPersona =
    '<div class="nt-sk-top">' +
      '<span class="nt-sk nt-sk-av"></span>' +
      '<span class="nt-sk-id">' + linea(60, true) + linea(45) + '</span>' +
    '</div>';

  /* ---- Formas ----------------------------------------------------------- */
  var FORMAS = {
    persona: function () {
      return card(
        cabezaPersona +
        '<div class="nt-sk-badges"><span class="nt-sk nt-sk-badge"></span><span class="nt-sk nt-sk-badge"></span></div>' +
        '<div class="nt-sk-acts"><span class="nt-sk nt-sk-btn"></span><span class="nt-sk nt-sk-btn"></span><span class="nt-sk nt-sk-btn"></span></div>'
      );
    },
    personaTexto: function () {
      return card(
        cabezaPersona +
        '<div class="nt-sk-rows">' + linea(90) + linea(75) + '</div>' +
        '<div class="nt-sk-badges"><span class="nt-sk nt-sk-badge"></span></div>'
      );
    },
    texto: function () {
      return card(
        '<div class="nt-sk-top">' + linea(30, true) + '<span style="flex:1"></span><span class="nt-sk nt-sk-badge" style="width:88px"></span></div>' +
        '<div class="nt-sk-rows">' + linea(90) + linea(75) + linea(45) + '</div>'
      );
    },
    noticia: function () {
      return card(
        linea(75, true) +
        '<div class="nt-sk-rows">' + linea(30) + linea(90) + linea(90) + linea(60) + '</div>'
      );
    },
    media: function () {
      return card(
        linea(60, true) +
        '<div class="nt-sk-rows">' + linea(45) + '</div>' +
        '<span class="nt-sk nt-sk-media"></span>' +
        '<div class="nt-sk-rows">' + linea(90) + linea(75) + '</div>' +
        '<div class="nt-sk-acts"><span class="nt-sk nt-sk-ico"></span><span class="nt-sk nt-sk-ico"></span><span class="nt-sk nt-sk-ico"></span></div>'
      );
    },
    contacto: function () {
      return card(
        '<div class="nt-sk-badges" style="margin-top:0"><span class="nt-sk nt-sk-badge" style="width:74px"></span></div>' +
        '<div class="nt-sk-rows">' + linea(60, true) + linea(30) + '</div>' +
        '<div class="nt-sk-acts"><span class="nt-sk nt-sk-btn"></span><span class="nt-sk nt-sk-btn"></span></div>'
      );
    }
  };

  /* id del contenedor real → [forma, cuántas tarjetas] */
  var MAPA = {
    'lr-body':   ['persona', 4],
    'ls-body':   ['personaTexto', 4],
    'lc-body':   ['texto', 4],
    'com-list':  ['media', 3],
    'nt-body':   ['noticia', 3],
    'casa-body': ['media', 3],
    'em-body':   ['contacto', 5]
  };
  var POR_DEFECTO = ['texto', 3];

  function esqueletoPara(box) {
    var cont = box.closest('[id]');
    var def = (cont && MAPA[cont.id]) || POR_DEFECTO;
    var forma = FORMAS[def[0]] || FORMAS.texto;
    var html = '';
    for (var i = 0; i < def[1]; i++) html += forma();
    return '<div class="nt-sk-wrap" aria-busy="true" aria-label="Cargando">' + html + '</div>';
  }

  function sustituir(box) {
    if (!box || box.__nt5) return;
    box.__nt5 = true;
    var envoltura = document.createElement('div');
    envoltura.innerHTML = esqueletoPara(box);
    var nuevo = envoltura.firstChild;
    if (box.parentNode) box.parentNode.replaceChild(nuevo, box);
  }

  function barrer(raiz) {
    if (raiz.nodeType !== 1) return;
    if (raiz.classList && raiz.classList.contains('loadbox')) return sustituir(raiz);
    var lista = raiz.querySelectorAll ? raiz.querySelectorAll('.loadbox') : [];
    for (var i = 0; i < lista.length; i++) sustituir(lista[i]);
  }

  /* Por si ya hay uno pintado cuando arranca esta capa */
  barrer(app);

  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var añadidos = muts[i].addedNodes;
      for (var j = 0; j < añadidos.length; j++) barrer(añadidos[j]);
    }
  }).observe(app, { childList: true, subtree: true });
})();
