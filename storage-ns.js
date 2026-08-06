/* ============================================================
   storage-ns.js — AISLAMIENTO DE ALMACENAMIENTO POR CAMPAÑA
   ------------------------------------------------------------
   Las 7 apps se sirven del MISMO origen (botheart911.github.io),
   así que comparten localStorage, sessionStorage y Cache Storage.
   Sin un prefijo propio, dos campañas se pisan sesiones, PIN,
   token de notificaciones y caché.

   AL REPLICAR LA CAMPAÑA no se toca nada de aquí: el prefijo se
   define en marca.js (MARCA.STORAGE_NS), que es el único archivo
   que se edita. Este archivo solo pone la maquinaria.

   Migración silenciosa: la primera vez que arranca con un prefijo
   nuevo, copia el valor de la clave vieja a la nueva. Nadie se
   desloguea. La clave vieja NO se borra (permite volver atrás).
   ============================================================ */
(function (raiz) {
  'use strict';

  /* El prefijo lo define marca.js. En la página marca.js va antes que
     este archivo; en el service worker lo trae importScripts. El 'jp'
     de respaldo solo actúa si marca.js no cargó (campaña original). */
  var STORAGE_NS = (raiz.MARCA && raiz.MARCA.STORAGE_NS) || 'jp';
  var CACHE_SLUG = 'pub';        /* identifica esta app dentro de la campaña */

  /* claves que ya existían en dispositivos de usuarios reales */
  var HEREDADAS_LOCAL  = ['jp_sessions', 'jp_active', 'jp_lider_clave', 'jp_noticias_leidas', 'jp_fcm_token', 'jp_ponteAlDia_gate', 'jp_tema'];
  var HEREDADAS_SESION = ['continuedWeb'];

  raiz.STORAGE_NS  = STORAGE_NS;
  raiz.CACHE_SLUG  = CACHE_SLUG;

  /* clave con prefijo de campaña */
  function nsKey(base) { return STORAGE_NS + ':' + base; }
  raiz.nsKey = nsKey;

  /* nombre de caché de ESTA app: <ns>-<slug>-<version> */
  raiz.nsCachePrefijo = function () { return STORAGE_NS + '-' + CACHE_SLUG + '-'; };
  raiz.nsCache = function (v) { return STORAGE_NS + '-' + CACHE_SLUG + '-' + (v || 'v1'); };

  /* ¿es una caché de esta app? (para no borrar la de las apps hermanas) */
  raiz.nsCacheMia = function (nombre) {
    return typeof nombre === 'string' && nombre.indexOf(raiz.nsCachePrefijo()) === 0;
  };

  function migrar(store, bases) {
    if (!store) return;
    for (var i = 0; i < bases.length; i++) {
      var b = bases[i];
      try {
        if (store.getItem(nsKey(b)) === null) {
          var v = store.getItem(b);
          if (v !== null) store.setItem(nsKey(b), v);
        }
      } catch (e) { /* storage lleno o bloqueado: se sigue */ }
    }
  }

  /* solo en la página; en el service worker no hay localStorage */
  if (typeof window !== 'undefined' && raiz === window) {
    try { migrar(window.localStorage,   HEREDADAS_LOCAL);  } catch (e) {}
    try { migrar(window.sessionStorage, HEREDADAS_SESION); } catch (e) {}
  }
})(typeof self !== 'undefined' ? self : this);
