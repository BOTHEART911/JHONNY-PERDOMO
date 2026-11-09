/* ============================================================================
 * pendientes.js — MODO SIN CONEXIÓN de la ZONA DE LÍDERES (08/11/2026)
 * ----------------------------------------------------------------------------
 * Pegamento de PERDOMO con la pieza común js/sin-red.js (idéntica en PRIV).
 * Se carga DESPUÉS de app.js y usa sus utilidades (api, LIDER, openSheet…).
 *
 *  · Tira de conexión bajo el encabezado de cada vista.
 *  · Pendientes por subir: amarrados a la cédula del líder (o 'anon' para el
 *    Anotador sin sesión, que pasan a su zona al entrar con la contraseña).
 *  · Prepararme para salir sin señal: baja su lista y los barrios.
 *  · Revisar (UNA consulta) y subir por lotes con rid fijo (pub.liderNuevoLote).
 * ============================================================================ */
(function () {
  'use strict';
  if (!window.SINRED) return;
  const SR = window.SINRED;
  const OFF_REF = (doc) => nsKey('jp_off_ref:' + doc);
  const OFF_RESI = nsKey('jp_off_resi');

  /* ---------- copia del teléfono (lista de referidos y barrios) ---------- */
  function offRefGuardar(doc, crudo, n) {
    try { localStorage.setItem(OFF_REF(doc), JSON.stringify({ t: Date.now(), n: n || 0, c: crudo })); } catch (e) {}
  }
  function offRefInfo(doc) { try { return JSON.parse(localStorage.getItem(OFF_REF(doc)) || 'null'); } catch (e) { return null; } }
  async function offRefLeer(doc) {
    const o = offRefInfo(doc);
    if (!o || !o.c) return null;
    try { return await RAP.abrir(o.c); } catch (e) { return null; }
  }
  function offResiGuardar(l) { try { localStorage.setItem(OFF_RESI, JSON.stringify(l || [])); } catch (e) {} }
  async function barrios() {
    /* 08/11/2026 · sin señal no se espera a la red (reintentos): la copia del teléfono de una vez */
    if (SR.enLinea()) try { const l = await getResidencias(); if (l && l.length) { offResiGuardar(l); return l; } } catch (e) {}
    try { return JSON.parse(localStorage.getItem(OFF_RESI) || '[]'); } catch (e) { return []; }
  }

  /* Documentos ya guardados en Mis referidos (para no anotar repetidos) */
  let GUARD = null;
  function guardadosSet() {
    const s = new Set();
    try { (lrListaMem() || []).forEach(x => s.add(String(x.documento))); } catch (e) {}
    (GUARD || []).forEach(d => s.add(String(d)));
    return s;
  }
  async function cargarGuardadosOff(doc) {
    const d = await offRefLeer(doc);
    GUARD = (d && Array.isArray(d.referidos)) ? d.referidos.map(x => String(x.documento)) : null;
  }

  /* ---------- montaje de la tira ---------- */
  function dueno() { return (typeof LIDER !== 'undefined' && LIDER && LIDER.documento) || 'anon'; }
  /* 08/11/2026 · la lista de barrios queda en el teléfono desde que se abre
     con señal (una vez al día, de fondo): así el anotador sirve sin red aunque
     nunca se haya abierto antes. */
  setTimeout(function () {
    try {
      const t = Number(localStorage.getItem(OFF_RESI + ':t') || 0);
      if (!SR.enLinea() || !getActive() || Date.now() - t < 864e5) return;
      barrios().then(l => { if (l && l.length) try { localStorage.setItem(OFF_RESI + ':t', String(Date.now())); } catch (e) {} });
    } catch (e) {}
  }, 4000);
  SR.montar({
    dueno: dueno,
    textoSin: 'Sin conexión',
    explicar: function () {
      const n = SR.contar();
      openSheet(`<div class="grip"></div><h2 class="h2" style="margin-bottom:6px;">Estás sin conexión</h2>
        <div class="sr-ayuda">
          <p><b>Puedes seguir trabajando:</b></p>
          <ul>
            <li>Anotar referidos nuevos. Quedan en <b>Pendientes por subir</b> en este teléfono.</li>
            <li>Ver la lista que guardaste con <b>Prepararme para salir sin señal</b>.</li>
            <li>Pegar varios registros que tengas en WhatsApp o en notas.</li>
          </ul>
          <p><b>Necesita señal:</b> revisar si un documento ya existe, subir, marcar asistencia o intención, compromisos y solicitudes.</p>
          <p class="muted small">Cuando vuelva la conexión no se sube nada solo: entra a Pendientes, revisa y toca <b>Subir</b>.</p>
        </div>
        ${n ? `<p class="small" style="margin-top:8px;">Tienes <b>${n}</b> pendiente${n === 1 ? '' : 's'} guardado${n === 1 ? '' : 's'} en este teléfono.</p>` : ''}
        <button class="btn btn-primary btn-block" data-close style="margin-top:12px;">Entendido</button>`);
    },
    abrirPendientes: function () {
      const u = getActive();
      if (u && typeof LIDER !== 'undefined' && LIDER && LIDER.documento === u.documento) liderPendientes(u);
    }
  });
  /* El conteo de las baldosas se repinta con cualquier cambio de pendientes o de red */
  SR.al(function () {
    $$('[data-pend-n]').forEach(el => { const n = SR.contar(); el.textContent = n ? String(n) : ''; el.hidden = !n; });
    $$('[data-red]').forEach(el => el.classList.toggle('sr-apagado', !SR.enLinea()));
  });

  /* ---------- formulario de anotar (zona y Anotador) ---------- */
  /* modoAnotador: nunca muestra datos de nadie; solo cuenta lo anotado. */
  async function anotar(cfg) {
    const lista = await barrios();
    const sh = openSheet(`<div class="grip"></div>
      <h2 class="h2" style="margin-bottom:4px;">${esc(cfg.titulo || 'Anotar referido')}</h2>
      <p class="muted small">${SR.enLinea() ? 'Queda en Pendientes por subir; lo revisas y lo subes cuando quieras.' : 'Sin señal: queda guardado en este teléfono en Pendientes por subir.'}</p>
      <div class="stack" style="margin-top:10px;">
        ${field('Documento', inputEl('pa-doc', 'inputmode="numeric" maxlength="10" placeholder="Número de documento"'))}
        ${field('Nombre completo', inputEl('pa-nom', 'placeholder="Nombres y apellidos"'))}
        ${field('WhatsApp', inputEl('pa-tel', 'inputmode="numeric" maxlength="10" placeholder="10 dígitos"'))}
        ${field('Barrio', comboboxHtml('pa-resi', 'Escribe para buscar'))}
        <div class="sr-sugs" id="pa-sugs"></div>
        <p class="small" id="pa-msg" style="color:#B42318;min-height:1em;margin:0;"></p>
        <button class="btn btn-primary btn-block" id="pa-ok">Guardar en pendientes</button>
        <button class="btn btn-quiet btn-block" data-close>${cfg.modoAnotador ? 'Terminar' : 'Cancelar'}</button>
        <p class="center small muted" id="pa-cuenta"></p>
      </div>`);
    onlyDigits($('#pa-doc')); onlyDigits($('#pa-tel')); onlyLetters($('#pa-nom'));
    bindCombobox('pa-resi', lista);
    const sugs = $('#pa-sugs'), msg = $('#pa-msg'), resi = $('#pa-resi');
    const pintarSug = () => {
      const r = SR.barrio(resi.value, lista);
      sugs.innerHTML = r.ok ? '' : r.sug.map(s => `<button type="button" class="sr-sug" data-v="${esc(s)}">${esc(s)}</button>`).join('');
      sugs.querySelectorAll('.sr-sug').forEach(b => b.onclick = () => { resi.value = b.dataset.v; sugs.innerHTML = ''; });
    };
    resi.addEventListener('input', pintarSug);
    resi.addEventListener('blur', () => setTimeout(pintarSug, 150));
    const cuenta = () => { const n = SR.contar(cfg.dueno); $('#pa-cuenta').textContent = n ? `${n} anotado${n === 1 ? '' : 's'} en este teléfono` : ''; };
    cuenta();
    $('#pa-ok').onclick = () => {
      msg.textContent = '';
      const it = { d: onlyDig(val('pa-doc')), n: val('pa-nom'), t: onlyDig(val('pa-tel')), b: val('pa-resi') };
      const v = SR.validar(it, { barrios: lista, docMin: 6 });
      if (v.errores.length) { msg.textContent = 'Falta: ' + v.errores.join(' · '); if (!v.barrio.ok) pintarSug(); return; }
      it.b = v.barrio.b;
      if (SR.lista(cfg.dueno).some(x => x.d === it.d)) { msg.textContent = 'Ese documento ya está en tus pendientes.'; return; }
      if (!cfg.modoAnotador && cfg.guardados && cfg.guardados().has(it.d)) { msg.textContent = 'Esa persona ya está en tu lista de referidos.'; return; }
      SR.agregar(Object.assign(it, { src: cfg.modoAnotador ? 'anotador' : 'form' }), cfg.dueno);
      toast('Guardado en pendientes', 'ok');
      ['pa-doc', 'pa-nom', 'pa-tel', 'pa-resi'].forEach(id => { const i = $('#' + id); if (i) i.value = ''; });
      sugs.innerHTML = '';
      cuenta();
      $('#pa-doc').focus();
      if (cfg.alGuardar) cfg.alGuardar();
    };
    return sh;
  }

  /* ---------- PENDIENTES POR SUBIR (zona de líderes) ---------- */
  async function liderPendientes(user) {
    RED.nuevaVista();
    const mov = SR.mover('anon', user.documento);
    app.innerHTML = `${backLider('Pendientes por subir')}<div class="pad stack" id="pd-body">${loadingBox('Abriendo tus pendientes…')}</div>`;
    app.hidden = false; hideSplash(); bindBackLider(user); appWide(true);
    SR.pintarTira();
    if (mov) toast(`${mov} anotado${mov === 1 ? '' : 's'} sin sesión pasaron a tus pendientes`, 'ok');
    if (!lrListaMem()) await cargarGuardadosOff(user.documento);
    ensureConfig().catch(() => {});
    const rev = new SR.Revision({
      el: $('#pd-body'),
      dueno: user.documento,
      docMin: 6,
      barrios: barrios,
      guardados: guardadosSet,
      hoja: (html) => openSheet('<div class="grip"></div>' + html),
      cerrarHoja: closeLayer,
      aviso: toast,
      anotar: (luego) => anotar({ dueno: user.documento, guardados: guardadosSet, alGuardar: luego }),
      revisar: async (docs) => {
        const r = await api('pub.liderPendRevisar', lrCtx({ documento: user.documento, docs: docs.join(',') }));
        if (r && r.ok === false) throw new Error(r.msg || 'No se pudo revisar');
        return r;
      },
      destino: () => {
        const lp = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.liderPrincipal) || null;
        if (!lp) return '';
        return `<label class="check-row"><input type="checkbox" id="pd-principal" ${rev.principal ? 'checked' : ''}/> <span>Subir todo al <b>Líder Principal</b> (N° 1 · ${esc(lp.nombre)}) — para cargas grandes</span></label>
          <p class="small muted" style="margin:2px 0 0;">Así no quedan en tu grupo. Úsalo solo si te lo pidieron.</p>`;
      },
      destinoValor: () => { const c = $('#pd-principal'); rev.principal = !!(c && c.checked); return { principal: rev.principal }; },
      subir: async (filas, rid, dv) => {
        const t0 = performance.now();
        const r = await apiRid('pub.liderNuevoLote', lrCtx({ documento: user.documento, filas: filas, principal: !!(dv && dv.principal) }), rid);
        lrMedir('lote', t0, { filas: filas.length, viajes: 1 });
        return r;
      },
      alSubir: (resps, subidos, malos) => {
        /* Mis referidos se parcha en memoria con las filas que devolvió el CORE */
        const mem = lrListaMem();
        let ultima = null;
        resps.forEach(r => { (r && r.filas || []).forEach(f => { if (mem) lrAplicarFila(mem, f); }); if (r) ultima = r; });
        if (mem) RAP.tocar(lrClaveCache());
        if (ultima) lrAnotarPropio(ultima);
        const fuera = resps.some(r => r && r.fuera);
        toast(subidos ? `${subidos} subido${subidos === 1 ? '' : 's'}${fuera ? ' al Líder Principal' : ''}${malos ? ` · ${malos} por revisar` : ''}` : (malos ? `${malos} quedaron por revisar` : 'Nada para subir'), subidos ? 'ok' : 'err');
      },
      conteo: () => {}
    });
    rev.abrir();
    SR.al(function (st, antes, tipo) { if (!tipo && $('#pd-body') && st !== antes) rev.pintar(); if (!tipo && st === 'en' && antes === 'sin' && $('#pd-body')) rev.revisarServidor(true); });
  }

  /* Escritura con rid FIJO (lo pone la Revisión): un reintento nunca duplica */
  async function apiRid(action, body, rid) {
    [, body] = conPase(action, {}, body, 'POST');
    loaderOn();
    let json;
    try { json = await RED.pedir(API_URL, action, {}, { metodo: 'POST', cuerpo: body, rid: rid }); }
    catch (e) { loaderOff(); throw e; }
    loaderOff();
    if (!json.ok) { if (json.error === 'SESION_LIDER_VENCIDA') liderVencida(); throw new Error(json.error || 'Error del servidor'); }
    if (json.data && json.data.ok === false) throw new Error(json.data.msg || 'No se pudo subir');
    return json.data;
  }

  /* ---------- PREPARARME PARA SALIR SIN SEÑAL ---------- */
  async function liderPreparar(user, btn) {
    if (!SR.enLinea()) return toast('Necesitas señal para prepararte', 'err');
    if (btn) saving(btn, true);
    try {
      const r = await api('pub.liderReferidos', lrCtx(Object.assign({ documento: user.documento }, RAP.params())));
      const d = await RAP.abrir(r);
      if (!d || !d.ok) throw new Error((d && d.msg) || 'No se pudo bajar tu lista');
      RAP.guardar(lrClaveCache(), d, (r && r.fmt === 2) ? r : null);
      offRefGuardar(user.documento, r, (d.referidos || []).length);
      const l = await getResidencias(); offResiGuardar(l);
      if (btn) saving(btn, false);
      openSheet(`<div class="grip"></div><div class="center stack">
        <div style="font-size:2.4rem;">✅</div>
        <h2 class="h2">Listo para trabajar sin conexión ✓</h2>
        <p class="muted">Guardamos en este teléfono tu lista (${(d.referidos || []).length} referidos) y los ${l.length} barrios. Sin señal podrás ver tu lista y anotar nuevos; se suben cuando vuelvas.</p>
        <p class="small muted">Tu sesión queda abierta en este teléfono hasta que la cierres.</p>
        <button class="btn btn-primary btn-block" data-close>Entendido</button></div>`);
      liderPanel(user);
    } catch (e) { if (btn) saving(btn, false); SR.fallo(e); toast(e.message || 'No se pudo preparar', 'err'); }
  }

  /* ---------- ANOTADOR SIN CONEXIÓN (Inicio, fuera de la zona) ---------- */
  function viewAnotador() {
    anotar({ dueno: 'anon', modoAnotador: true, titulo: 'Anotador sin conexión' });
  }

  /* ---------- CERRAR SESIÓN EN ESTE TELÉFONO ---------- */
  async function liderCerrarAqui(user) {
    const n = SR.contar(user.documento);
    const ok = await confirmar('Cerrar sesión en este teléfono',
      crow('Qué pasa', 'Para volver a entrar a la zona te pedirá la contraseña') +
      (n ? crow('Tus pendientes', `${n} siguen guardados con tu documento`) : ''));
    if (!ok) return;
    LIDER = null; liderSesBorrar();
    try { localStorage.setItem(nsKey('jp_lider_recordar'), '0'); } catch (e) {}
    toast('Sesión cerrada en este teléfono', 'ok');
    go('home');
  }

  window.PEND = {
    liderPendientes, liderPreparar, liderCerrarAqui, viewAnotador, anotar,
    offRefGuardar, offRefInfo, offRefLeer, barrios, guardadosSet, cargarGuardadosOff
  };
  window.liderPendientes = liderPendientes;
})();
