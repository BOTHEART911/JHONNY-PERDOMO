/* ============================================================================
 * gestiones.js — PERDOMO · "Solicitudes y Gestiones" (07/11/2026)
 * ----------------------------------------------------------------------------
 *  Reemplaza "Realiza tu solicitud". La persona ve TODO lo que tiene con la
 *  campaña con su estado (solicitudes de servicio, compromisos, inscripciones,
 *  eventos, ideas, beneficios) y puede pedir un servicio nuevo. Lo cerrado
 *  (servicio ATENDIDA, compromiso CUMPLIDO o DESCARTADO) se califica de 1 a 5
 *  estrellas con una reseña; la reseña llega a Análisis de procesos en PRIV.
 *
 *  Rendimiento:
 *   · La lista guardada en el teléfono se pinta al instante; pub.misGestiones
 *     (un viaje, sale del índice en caché del CORE) revalida de fondo.
 *   · Calificar: botón ocupado + escudo desde el primer toque, rid (red.js);
 *     al guardar se parcha la tarjeta en memoria y en el teléfono, sin
 *     recargar la lista.
 *   · Nueva solicitud: misma ruta de siempre (pub.solicitud); al terminar la
 *     tarjeta aparece arriba y la lista se revalida de fondo.
 * Depende de app.js (api, apiSilencio, app, backbar, go, esc, $, $$, toast,
 *   saving, confirmar, crow, crowBlock, celebrar, prefill, getServicios,
 *   field, selectEl, areaEl, val, openSheet, closeLayer, DEV_ID, nsKey, I).
 * ============================================================================ */
(function () {
  'use strict';
  const GS_TIPO = {
    servicio:   { t: 'Solicitud de servicio', c: 'gs-c-serv' },
    compromiso: { t: 'Compromiso',            c: 'gs-c-comp' },
    formulario: { t: 'Inscripción',           c: 'gs-c-form' },
    evento:     { t: 'Evento',                c: 'gs-c-ev' },
    idea:       { t: 'Idea',                  c: 'gs-c-idea' },
    comercio:   { t: 'Beneficio',             c: 'gs-c-com' }
  };
  const GS_MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const ESTRELLA = '<svg viewBox="0 0 24 24"><path d="m12 2.6 2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5-4.9-4.6 6.6-.8Z"/></svg>';
  let GS = null;   // { doc, data, filtro }

  function gsKey(doc) { return nsKey('jp_gest_' + doc); }
  function gsLeer(doc) { try { return JSON.parse(localStorage.getItem(gsKey(doc)) || 'null'); } catch (e) { return null; } }
  function gsGuardar(doc, d) { try { localStorage.setItem(gsKey(doc), JSON.stringify(d)); } catch (e) {} }
  function gsFecha(f) { const m = String(f || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]} ${GS_MESES[+m[2] - 1]} ${m[1]}` : ''; }
  function gsEstCls(e) {
    e = String(e || '');
    if (/ATENDID|CUMPLID|ASISTI|VALIDAD|INSCRITO/.test(e)) return 'gs-e-ok';
    if (/DESCART|RECHAZ/.test(e)) return 'gs-e-no';
    if (/PENDIENT|INGRESAD|SEGUIMIENT|ASIGNAD|ESPERA|RECURRENT/.test(e)) return 'gs-e-pend';
    return '';
  }
  function gsEstTx(e) { e = String(e || ''); return e ? e.charAt(0) + e.slice(1).toLowerCase() : ''; }
  function estrellas(n, cls) { return `<span class="gs-stars ${cls || ''}" aria-label="${n} de 5 estrellas">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}">${ESTRELLA}</i>`).join('')}</span>`; }

  async function viewGestiones(user) {
    const doc = String(user.documento);
    GS = { doc, user, data: gsLeer(doc), filtro: 'todos' };
    const yo = GS;
    app.innerHTML = `${backbar('Solicitudes y Gestiones')}
      <div class="pad stack">
        <div class="card pad gs-top">
          <div><b>Pide o consulta un servicio</b><span class="small muted">Aquí ves tus solicitudes, compromisos y demás gestiones con su estado. Cuando algo se cierra, califícalo.</span></div>
          <button class="btn btn-primary" id="gs-nueva">${I.help || ''} Nueva solicitud</button>
        </div>
        <div id="gs-body">${GS.data ? '' : '<div class="gs-skel"></div><div class="gs-skel"></div><div class="gs-skel"></div>'}</div>
      </div>`;
    app.hidden = false; hideSplash(); $('#backbtn').onclick = () => go('home');
    $('#gs-nueva').onclick = () => gsNueva(user);
    $('#gs-body').addEventListener('click', gsClic);
    if (GS.data) gsPintar();
    try {
      const r = await api('pub.misGestiones', { documento: doc, dev: DEV_ID });
      if (GS !== yo || !$('#gs-body')) return;
      if (!r || r.ok === false) { if (!yo.data) $('#gs-body').innerHTML = `<p class="muted center">${esc((r && r.msg) || 'No pudimos cargar tus gestiones.')}</p>`; return; }
      yo.data = r; gsGuardar(doc, r); gsPintar();
    } catch (e) {
      if (GS !== yo) return;
      if (!yo.data && $('#gs-body')) $('#gs-body').innerHTML = /no reconocida/i.test(String(e && e.message))
        ? `<p class="muted center">Muy pronto verás aquí tus gestiones. Mientras tanto puedes pedir un servicio con "Nueva solicitud".</p>`
        : `<p class="muted center">No hay conexión. Intenta de nuevo.</p>`;
    }
  }
  window.viewGestiones = viewGestiones;

  function gsPintar() {
    const body = $('#gs-body'); if (!body || !GS || !GS.data) return;
    const d = GS.data, items = d.items || [], R = d.resumen || {};
    const tipos = [...new Set(items.map(x => x.k))];
    const lista = items.filter(x => GS.filtro === 'todos' || (GS.filtro === 'calificar' ? (x.cerrado && !x.resena) : x.k === GS.filtro));
    body.innerHTML = `
      ${R.porCalificar ? `<button class="gs-aviso" data-f="calificar">${ESTRELLA}<span><b>Tienes ${R.porCalificar} gestión${R.porCalificar === 1 ? '' : 'es'} por calificar</b><small>Tu opinión nos ayuda a mejorar.</small></span></button>` : ''}
      ${tipos.length > 1 ? `<div class="gs-chips">${['todos'].concat(tipos).map(k => `<button class="gs-chip ${GS.filtro === k ? 'on' : ''}" data-f="${k}">${k === 'todos' ? 'Todo' : esc((GS_TIPO[k] || {}).t || k)}</button>`).join('')}</div>` : ''}
      ${lista.length ? `<div class="gs-grid">${lista.map(gsCard).join('')}</div>`
        : `<div class="card pad center gs-vacio"><b>${items.length ? 'Nada en este filtro' : 'Aún no tienes gestiones'}</b><span class="small muted">${items.length ? '' : 'Pide tu primer servicio con "Nueva solicitud".'}</span></div>`}`;
  }
  function gsCard(x) {
    const tp = GS_TIPO[x.k] || { t: x.k, c: '' };
    let pie = '';
    if (x.ref && x.cerrado) {
      pie = x.resena
        ? `<div class="gs-res">${estrellas(x.resena.e)}${x.resena.t ? `<p>“${esc(x.resena.t)}”</p>` : ''}<button class="gs-link" data-cal="${esc(x.ref)}">Cambiar mi calificación</button></div>`
        : `<button class="btn gs-calif" data-cal="${esc(x.ref)}">${estrellas(0, 'gs-st-mini')} Calificar</button>`;
    } else if (x.ref) pie = `<span class="small muted">Podrás calificarla cuando se cierre.</span>`;
    return `<article class="card gs-card ${tp.c}">
      <div class="gs-r1"><span class="gs-tipo">${esc(tp.t)}</span>${x.est ? `<span class="gs-est ${gsEstCls(x.est)}">${esc(gsEstTx(x.est))}</span>` : ''}</div>
      <b class="gs-tit">${esc(x.tit)}</b>
      ${x.det ? `<p class="gs-det">${esc(x.det)}</p>` : ''}
      <span class="gs-f">${esc(gsFecha(x.f))}</span>
      ${pie}
    </article>`;
  }
  function gsClic(ev) {
    const f = ev.target.closest('[data-f]');
    if (f) { GS.filtro = GS.filtro === f.dataset.f && f.dataset.f === 'calificar' ? 'todos' : f.dataset.f; return gsPintar(); }
    const c = ev.target.closest('[data-cal]');
    if (c) return gsCalificar(c.dataset.cal);
  }

  /* -------------------------------------------------------- calificar */
  function gsCalificar(ref) {
    const it = ((GS && GS.data && GS.data.items) || []).find(x => x.ref === ref); if (!it) return;
    let n = it.resena ? it.resena.e : 0;
    const tx = ['', 'Muy mal', 'Mal', 'Regular', 'Bien', '¡Excelente!'];
    openSheet(`<div class="grip"></div>
      <h2 class="h2" style="margin-bottom:2px;">Califica esta gestión</h2>
      <p class="small muted" style="margin:0 0 12px;">${esc((GS_TIPO[it.k] || {}).t || '')} · ${esc(it.tit)}</p>
      <div class="gs-pick" id="gs-pick" role="radiogroup" aria-label="Estrellas">${[1, 2, 3, 4, 5].map(i => `<button type="button" role="radio" aria-label="${i} estrella${i === 1 ? '' : 's'}" data-n="${i}" class="${i <= n ? 'on' : ''}">${ESTRELLA}</button>`).join('')}</div>
      <p class="center gs-pick-tx" id="gs-pick-tx">${n ? tx[n] : 'Toca las estrellas'}</p>
      ${field('Cuéntanos más (opcional)', `<textarea class="input area" id="gs-txt" rows="3" maxlength="500" placeholder="¿Qué te gustó? ¿Qué podemos mejorar?">${esc(it.resena ? it.resena.t : '')}</textarea>`)}
      <button class="btn btn-primary btn-block" id="gs-ok" ${n ? '' : 'disabled'} style="margin-top:12px;">Enviar calificación</button>
      <button class="btn btn-quiet btn-block" data-close style="margin-top:8px;">Cancelar</button>`);
    const pintar = () => { $$('#gs-pick button').forEach(b => b.classList.toggle('on', +b.dataset.n <= n)); $('#gs-pick-tx').textContent = n ? tx[n] : 'Toca las estrellas'; $('#gs-ok').disabled = !n; };
    $$('#gs-pick button').forEach(b => b.onclick = () => { n = +b.dataset.n; pintar(); });
    $('#gs-ok').onclick = async () => {
      const btn = $('#gs-ok'); if (btn.dataset.ocupado) return;
      btn.dataset.ocupado = '1'; saving(btn, true);
      const yo = GS;
      try {
        const r = await api('pub.gestionResenar', {}, 'POST', { documento: yo.doc, ref, estrellas: n, texto: val('gs-txt'), dev: DEV_ID });
        if (!r || r.ok === false) { toast((r && r.msg) || 'No se pudo guardar', 'err'); return; }
        /* Parche en memoria y en el teléfono: sin recargar la lista */
        it.resena = r.resena;
        if (yo.data && yo.data.resumen) yo.data.resumen.porCalificar = (yo.data.items || []).filter(x => x.cerrado && !x.resena).length;
        gsGuardar(yo.doc, yo.data);
        closeLayer();
        if (GS === yo) gsPintar();
        toast('¡Gracias por calificar! Tu opinión llega directo al equipo.', 'ok');   /* celebrar() lleva al Inicio: aquí se queda en la lista */
      } catch (e) { toast('Sin conexión. Intenta de nuevo.', 'err'); }
      finally { if (btn.isConnected) { saving(btn, false); delete btn.dataset.ocupado; } }
    };
  }

  /* --------------------------------------------- nueva solicitud */
  async function gsNueva(user) {
    openSheet(`<div class="grip"></div>
      <h2 class="h2">Nueva solicitud</h2>
      <div class="stack" style="margin-top:8px;">
        ${field('Servicio', '<div id="s-serv-wrap">' + selectEl('s-servicio', [], 'Cargando…') + '</div>')}
        ${field('Tu solicitud', areaEl('s-solicitud', 'Describe brevemente lo que necesitas', 4))}
        <p class="small muted" id="s-quien">Cargando tus datos…</p>
        <button class="btn btn-primary btn-block" id="s-save">Enviar solicitud</button>
        <button class="btn btn-quiet btn-block" data-close>Cancelar</button>
      </div>`);
    getServicios().then(l => { const w = $('#s-serv-wrap'); if (w) w.innerHTML = selectEl('s-servicio', l, 'Selecciona un servicio'); }).catch(() => {});
    const p = await prefill(user);
    const q = $('#s-quien'); if (q) q.innerHTML = `Se enviará a nombre de <b>${esc(p.nombre)}</b>`;
    const s = $('#s-save'); if (!s) return;
    s.onclick = async () => {
      const body = { documento: user.documento, nombre: p.nombre, telefono: p.telefono, residencia: p.residencia, servicio: val('s-servicio'), solicitud: val('s-solicitud') };
      if (!body.servicio) return toast('Selecciona un servicio', 'err');
      if (!body.solicitud) return toast('Describe tu solicitud', 'err');
      const btn = $('#s-save'); if (btn.dataset.ocupado) return;
      btn.dataset.ocupado = '1'; saving(btn, true);
      try {
        const r = await api('pub.solicitud', {}, 'POST', body);
        if (!r.success) { toast(r.message || 'No se pudo enviar', 'err'); return; }
        closeLayer();
        const hoy = new Date(), pd = n => String(n).padStart(2, '0');
        if (GS && GS.data) {
          GS.data.items = [{ k: 'servicio', f: `${hoy.getFullYear()}-${pd(hoy.getMonth() + 1)}-${pd(hoy.getDate())} ${pd(hoy.getHours())}:${pd(hoy.getMinutes())}`, tit: body.servicio, det: body.solicitud, est: 'PENDIENTE' }].concat(GS.data.items || []);
          gsGuardar(GS.doc, GS.data); gsPintar();
        }
        toast('¡Solicitud recibida! Aquí mismo verás cómo avanza.', 'ok');
        setTimeout(() => { if (GS) apiSilencio('pub.misGestiones', { documento: GS.doc, dev: DEV_ID }).then(d => { if (GS && d && d.ok !== false) { GS.data = d; gsGuardar(GS.doc, d); gsPintar(); } }).catch(() => {}); }, 2500);
      } catch (e) { toast('Error de conexión', 'err'); }
      finally { if (btn.isConnected) { saving(btn, false); delete btn.dataset.ocupado; } }
    };
  }
})();
