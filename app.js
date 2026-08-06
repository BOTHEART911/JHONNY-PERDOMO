/* ============================================================
   JHONNY PERDOMO — App Pública · app.js
   Login/instalar/versión replicando el patrón de SEP-GROUP.
   ============================================================ */

/* URL del Web App del backend JHONNY CORE (/exec) */
/* Marca de la campaña: todo esto vive en marca.js, que se carga antes
   que este archivo. Al replicar NO se toca nada de aquí. */
const API_URL    = MARCA.API_URL;
const APP_ICON   = MARCA.APP_ICON;
const APP_BANNER = MARCA.APP_BANNER;

/* ---------- Utilidades ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const app = $('#app');
const layer = $('#layer');
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const iniciales = (n) => { const p = String(n || '').trim().split(/\s+/); return ((p[0]||' ')[0] + (p[1]||'')[0] || '').toUpperCase() || 'JP'; };
const val = id => (($('#' + id) || {}).value || '').trim();
const onlyDig = s => String(s || '').replace(/\D/g, '');

function toast(msg, kind = '') { const t = h(`<div class="toast ${kind}">${esc(msg)}</div>`); layer.appendChild(t); setTimeout(() => t.remove(), 3200); }

/* Pantalla de agradecimiento/confirmación especial (unos segundos) */
function celebrar(emoji, titulo, texto, ms) {
  const ov = h(`<div class="celebrate"><div class="celebrate-card">
    <div class="celebrate-emoji">${esc(emoji || '✅')}</div>
    <h2 class="h2">${esc(titulo || '¡Listo!')}</h2>
    <p class="muted">${esc(texto || '')}</p>
  </div></div>`);
  layer.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  setTimeout(() => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 350); go('home'); }, ms || 2600);
}

/* Visor de imagen a pantalla completa con zoom (pinch en móvil, rueda en desktop) */
function zoomImagen(src) {
  if (!src) return;
  const ov = h(`<div class="imgzoom"><button class="imgzoom-close" aria-label="Cerrar">${I.x}</button><img src="${esc(src)}" alt="" draggable="false"/></div>`);
  layer.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  const img = ov.querySelector('img');
  let scale = 1, tx = 0, ty = 0, startX = 0, startY = 0, dragging = false, lastDist = 0;
  const apply = () => { img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; };
  const close = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 250); };
  ov.querySelector('.imgzoom-close').onclick = close;
  ov.onclick = e => { if (e.target === ov) close(); };
  img.ondblclick = () => { scale = scale > 1 ? 1 : 2.5; if (scale === 1) { tx = 0; ty = 0; } apply(); };
  ov.onwheel = e => { e.preventDefault(); scale = Math.min(5, Math.max(1, scale + (e.deltaY < 0 ? 0.2 : -0.2))); if (scale === 1) { tx = 0; ty = 0; } apply(); };
  img.onpointerdown = e => { if (scale === 1) return; dragging = true; startX = e.clientX - tx; startY = e.clientY - ty; try { img.setPointerCapture(e.pointerId); } catch {} };
  img.onpointermove = e => { if (!dragging) return; tx = e.clientX - startX; ty = e.clientY - startY; apply(); };
  img.onpointerup = () => { dragging = false; };
  ov.ontouchmove = e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (lastDist) { scale = Math.min(5, Math.max(1, scale + (d - lastDist) / 200)); if (scale === 1) { tx = 0; ty = 0; } apply(); }
      lastDist = d;
    }
  };
  ov.ontouchend = () => { lastDist = 0; };
}

/* ---------- Cliente API ---------- */
let _apiActivas = 0;
function loaderOn() { _apiActivas++; const b = document.getElementById('ios-loader'); if (b) b.classList.add('active'); }
function loaderOff() { _apiActivas = Math.max(0, _apiActivas - 1); if (_apiActivas === 0) { const b = document.getElementById('ios-loader'); if (b) b.classList.remove('active'); } }
async function api(action, params = {}, method = 'GET', body = null) {
  if (API_URL.startsWith('PEGA_AQUI')) { toast('Falta configurar la URL del backend', 'err'); throw new Error('API_URL sin configurar'); }
  const qs = new URLSearchParams(Object.assign({ action }, params)).toString();
  const opts = { method };
  if (method === 'POST') { opts.headers = { 'Content-Type': 'text/plain;charset=utf-8' }; opts.body = JSON.stringify(body || {}); }
  loaderOn();
  try {
    const res = await fetch(`${API_URL}?${qs}`, opts);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error del servidor');
    return json.data;
  } finally { loaderOff(); }
}

/* Igual que api(), pero SIN el loader de pantalla. Es para el refresco EN
   VIVO: el canal 'bd' suena cada vez que alguien toca la hoja PRINCIPAL, y
   si el spinner parpadeara en cada aviso la vista se sentiría rota.
   22/07/2026 */
async function apiSilencio(action, params = {}) {
  const qs = new URLSearchParams(Object.assign({ action }, params)).toString();
  const res = await fetch(`${API_URL}?${qs}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error del servidor');
  return json.data;
}

/* ---------- Sesiones en el dispositivo ---------- */
const SS_KEY = nsKey('jp_sessions'), ACT_KEY = nsKey('jp_active');
const LIDER_REMEMBER_KEY = nsKey('jp_lider_clave');
let LIDER = null; // sesión de zona de líder (se limpia en logout)
const getSessions = () => { try { return JSON.parse(localStorage.getItem(SS_KEY)) || []; } catch { return []; } };
function saveSession(u) { const list = getSessions().filter(x => x.documento !== u.documento); list.unshift(u); localStorage.setItem(SS_KEY, JSON.stringify(list.slice(0, 6))); localStorage.setItem(ACT_KEY, u.documento); }
const getActive = () => { const d = localStorage.getItem(ACT_KEY); return getSessions().find(x => x.documento === d) || null; };
const setActive = (doc) => localStorage.setItem(ACT_KEY, doc);
/* Quita una cuenta guardada del dispositivo y devuelve las que quedan (22/07) */
function removeSession(doc) { const list = getSessions().filter(x => String(x.documento) !== String(doc)); localStorage.setItem(SS_KEY, JSON.stringify(list)); return list; }
function logout() { LIDER = null; try { localStorage.removeItem(LIDER_REMEMBER_KEY); } catch {} localStorage.removeItem(ACT_KEY); go('login'); }

/* ============================================================
   PWA: INSTALACIÓN  (patrón SEP-GROUP)
   ============================================================ */
let deferredPrompt = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: installed)').matches || window.navigator.standalone === true;
const isIOS = () => /(iphone|ipad|ipod)/i.test(navigator.userAgent || '');
const esMovil = () => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
/* OJO: aquí VIVÍA pwaInstalledFlag en localStorage. Se quitó a propósito.
   Marcaba el navegador como "ya instalada" PARA SIEMPRE al instalar la PWA una
   vez, y por eso la vista Instalar no volvía a aparecer nunca más. Ahora la
   primera pantalla es SIEMPRE Instalar cuando se entra desde el navegador; lo
   único que la salta es que la app ya venga corriendo instalada (standalone). */
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if (location.hash === '#/instalar') updateInstallSection(); });
window.addEventListener('appinstalled', () => { justInstalled = true; deferredPrompt = null; toast('¡App instalada!', 'ok'); updateInstallSection(false); });

/* 23/07/2026 · AVISO DE INSTALACION (3 casos, pliego del usuario)
   1) No hay opcion de instalar (iPhone, o la app ya esta instalada):
      iPhone  -> "busca la opcion Compartir y posteriormente Agregar al inicio"
      PC/Andr -> "busca la App en el escritorio de tu dispositivo"
      Se muestra SOLO la linea del dispositivo detectado.
   2) Recien instalada en PC      -> "Actualiza esta vista Ctrl + R"
   3) Recien instalada en Android -> "buscala en el escritorio de tu movil"
   "Recien instalada" solo es detectable en la MISMA sesion, via el evento
   appinstalled; tras recargar no hay senal fiable y se cae al caso 1, que es
   exactamente lo pedido. */
let justInstalled = false;
const isAndroid = () => /android/i.test(navigator.userAgent || '');

function avisoInstalarTxt() {
  if (justInstalled && !isIOS()) {
    return isAndroid()
      ? 'La App se instaló en tu dispositivo, búscala en el escritorio de tu móvil.'
      : 'La App se instaló en tu dispositivo, Actualiza esta vista Ctrl + R';
  }
  return isIOS()
    ? 'Si estás desde iPhone, busca la opción Compartir y posteriormente Agregar al inicio'
    : 'Si estás desde PC o Android, busca la App en el escritorio de tu dispositivo';
}

function updateInstallSection(esperar) {
  const box = $('#install-aviso'), tx = $('#install-aviso-txt'), b = $('#btn-install');
  if (!box || !tx) return;
  const puedeInstalar = !!deferredPrompt && !justInstalled;
  if (b) b.style.display = puedeInstalar ? '' : 'none';
  if (puedeInstalar) { box.classList.add('hidden'); return; }
  /* Chrome puede tardar unos ms en disparar beforeinstallprompt: no anunciamos
     "no hay instalacion" antes de tiempo o el aviso parpadea. */
  if (esperar && !isIOS() && !justInstalled) {
    box.classList.add('hidden');
    setTimeout(() => { if (location.hash === '#/instalar') updateInstallSection(false); }, 1200);
    return;
  }
  tx.textContent = avisoInstalarTxt();
  box.classList.remove('hidden');
}

/* ============================================================
   VERSIÓN + AUTO-UPDATE  (lee version.js por texto — SEP-GROUP)
   ============================================================ */
let APP_VERSION_LOADED = '', __verInFlight = false;
function paintVersion(v) { $$('.app-version-line').forEach(el => el.textContent = 'Versión ' + v); }
async function checkVersion() {
  if (__verInFlight) return; __verInFlight = true;
  try {
    const r = await fetch('./version.js?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const raw = await r.text();
    const m = raw.match(/version['"]?\s*[:=]\s*['"]([^'"]+)['"]/i) || raw.match(/(\d{4}\.\d{2}\.\d{2}\.\d+|\d+\.\d+(?:\.\d+)?)/);
    const v = m ? String(m[1]).trim() : '';
    if (!v) return;
    if (!APP_VERSION_LOADED) { APP_VERSION_LOADED = v; paintVersion(v); return; }
    if (v !== APP_VERSION_LOADED) { try { const ks = await caches.keys(); await Promise.all(ks.filter(nsCacheMia).map(k => caches.delete(k))); } catch {} location.reload(); }
  } finally { __verInFlight = false; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });

/* ---------- Plan Premium / Estándar ---------- */
function planUser(user) { const m = (user.municipio || '').trim().toUpperCase(); return (MV.esMunicipio(m) || m === 'A LA ESPERA') ? { premium: true, label: '⭐ Usuario Premium' } : { premium: false, label: 'Usuario Estándar' }; }

/* ---------- Filtros de entrada ---------- */
function onlyDigits(input) { if (input) input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); }); }
function onlyLetters(input) { if (input) input.addEventListener('input', () => { input.value = input.value.replace(/[^A-Za-zÁÉÍÓÚÜáéíóúüÑñ\s]/g, ''); }); }

/* ---------- Combobox con búsqueda (residencia) ---------- */
function comboboxHtml(id, ph) { return `<div class="combo" id="${id}-combo"><input class="input" id="${id}" placeholder="${esc(ph || 'Escribe para buscar…')}" autocomplete="off" /><div class="combo-list" id="${id}-list" hidden></div></div>`; }
function bindCombobox(id, options) {
  const input = $('#' + id), list = $('#' + id + '-list');
  const paint = (q) => {
    const f = (options || []).filter(o => String(o).toLowerCase().includes(String(q || '').toLowerCase())).slice(0, 60);
    list.innerHTML = f.length ? f.map(o => `<button type="button" class="combo-opt" data-v="${esc(o)}">${esc(o)}</button>`).join('') : `<div class="combo-empty">Sin resultados</div>`;
    list.querySelectorAll('.combo-opt').forEach(b => b.onclick = () => { input.value = b.dataset.v; list.hidden = true; });
  };
  input.onfocus = () => { paint(input.value); list.hidden = false; };
  input.oninput = () => { paint(input.value); list.hidden = false; };
}
document.addEventListener('click', (e) => { $$('.combo-list').forEach(l => { const c = l.closest('.combo'); if (c && !c.contains(e.target)) l.hidden = true; }); });

/* ---------- Referido opcional (check) ---------- */
function referidoBlock(pfx) { return `<div class="ref-toggle"><label class="check"><input type="checkbox" id="${pfx}-refchk" /><span>Me refirió un líder</span></label><div id="${pfx}-refwrap" hidden style="margin-top:10px;">${field('N° de Referido', inputEl(pfx + '-ref', 'inputmode="numeric" placeholder="Código de quien te invitó"'))}</div></div>`; }
function bindReferido(pfx) { const chk = $('#' + pfx + '-refchk'), wrap = $('#' + pfx + '-refwrap'), inp = $('#' + pfx + '-ref'); onlyDigits(inp); chk.onchange = () => { wrap.hidden = !chk.checked; if (!chk.checked && inp) inp.value = ''; }; }
function refValue(pfx) { const chk = $('#' + pfx + '-refchk'); return (chk && chk.checked) ? val(pfx + '-ref').replace(/\D/g, '') : ''; }

/* ---------- Constructores de campos ---------- */
function loadingBox(text) { return `<div class="loadbox"><span class="spinner spinner-brand"></span><span class="small muted">${esc(text || 'Cargando…')}</span></div>`; }
function backbar(title) { return `<div class="appbar"><button class="icon-btn" id="backbtn">${I.back}</button><div class="who"><b>${esc(title)}</b><span>${esc(MV.candidato)}</span></div></div>`; }
function field(label, inner) { return `<label class="field"><span>${esc(label)}</span>${inner}</label>`; }
function inputEl(id, attrs = '') { return `<input class="input" id="${id}" autocomplete="off" ${attrs} />`; }
function areaEl(id, ph, rows = 3) { return `<textarea class="input area" id="${id}" rows="${rows}" placeholder="${esc(ph || '')}"></textarea>`; }
function selectEl(id, options, ph) { return `<select class="input" id="${id}"><option value="">${esc(ph || 'Selecciona')}</option>${(options || []).map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`; }
function footBrand() { return `<img class="brand-banner" src="${APP_BANNER}" alt="" onerror="this.style.display='none'" /><p class="app-version-line">Versión —</p>`; }


/* Catálogos (con caché) */
let _resiCache = null, _serviCache = null;
async function getResidencias() { if (!_resiCache) _resiCache = await api('pub.residencias'); return _resiCache; }
async function getServicios() { if (!_serviCache) _serviCache = await api('pub.servicios'); return _serviCache; }

/* Confirmación */
function crow(label, v) { return `<div class="crow"><span>${esc(label)}</span><b>${esc(v || '—')}</b></div>`; }
function crowBlock(label, v) { return `<div class="crow block"><span>${esc(label)}</span><b>${esc(v || 'Sin información')}</b></div>`; }
function confirmar(title, rowsHtml) {
  return new Promise(resolve => {
    openSheet(`<div class="grip"></div><h2 class="h2" style="margin-bottom:10px;">${esc(title)}</h2><div class="confirm-list">${rowsHtml}</div><div class="stack" style="margin-top:18px;"><button class="btn btn-primary btn-block" data-yes>Confirmar</button><button class="btn btn-quiet btn-block" data-no>Seguir editando</button></div>`);
    layer.querySelector('[data-yes]').onclick = () => { closeLayer(); resolve(true); };
    layer.querySelector('[data-no]').onclick = () => { closeLayer(); resolve(false); };
  });
}
function saving(btn, on) { btn.disabled = on; btn.dataset.txt = btn.dataset.txt || btn.innerHTML; const azul = !btn.classList.contains('btn-primary'); btn.innerHTML = on ? `<span class="spinner${azul ? ' spinner-brand' : ''}"></span>` : btn.dataset.txt; }

/* ---------- Carga de scripts externos a demanda (SDK de Firebase) ---------- */
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error(src)); document.head.appendChild(s); }); }

/* ---------- Íconos ---------- */
const I = {
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  swap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3 21 7l-4 4"/><path d="M21 7H9"/><path d="M7 21 3 17l4-4"/><path d="M3 17h12"/></svg>',
  help:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  idea:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.79.65-1.5 1.41-2a5 5 0 1 0-5 0c.76.5 1.23 1.21 1.41 2"/></svg>',
  news:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V9h4"/><path d="M10 6h8M10 10h8M10 14h5"/></svg>',
  home2:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>',
  store:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1-5h16l1 5"/><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M3 9h18"/><path d="M9 22V12h6v10"/></svg>',
  chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.5 5.8 21 7 14 2 9.3 9 8.5 12 2"/></svg>',
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.2-5.6A8.4 8.4 0 1 1 21 11.5Z"/></svg>',
  card:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/></svg>',
  logout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  play:'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>',
  eyeOn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.2 3.1M6.6 6.6A13.3 13.3 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/></svg>',
  pencil:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  facebook:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z"/></svg>',
  instagram:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.1L4.6 21H1.4l7.5-8.6L1 3h6.6l4.5 5.6L17.5 3Zm-1.1 16h1.8L7.7 4.8H5.8L16.4 19Z"/></svg>',
  youtube:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.5-.4-5.2a2.7 2.7 0 0 0-1.9-1.9C19 4.5 12 4.5 12 4.5s-7 0-8.7.4a2.7 2.7 0 0 0-1.9 1.9C1 8.5 1 12 1 12s0 3.5.4 5.2c.2.9.9 1.6 1.9 1.9 1.7.4 8.7.4 8.7.4s7 0 8.7-.4a2.7 2.7 0 0 0 1.9-1.9C23 15.5 23 12 23 12ZM9.8 15.3V8.7l5.7 3.3-5.7 3.3Z"/></svg>',
  tiktok:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 2h-3v13.2a2.6 2.6 0 1 1-2.1-2.6V9.5a5.9 5.9 0 1 0 5.1 5.8V8.9a6.8 6.8 0 0 0 4 1.3V7.1a4 4 0 0 1-4-4Z"/></svg>',
  web:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20a15.3 15.3 0 0 1 0-20Z"/></svg>',
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  form:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="m8.5 12 1.5 1.5 3-3"/><path d="M14.5 16.5h2.5"/><path d="M8.5 16.5h2"/></svg>',
  map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><path d="M8 12h8"/></svg>'
};

/* ---------- Menú ---------- */
const MENU = [
  { id:'tarjeta',   icon:'card',  title:'Mi tarjeta',            desc:'Tu carné digital con QR', gold:true, wide:true },
  /* 17/07/2026 · En el lugar donde estaba "Actualizar datos" va ahora
     "Mis Datos": abre un modal solo-lectura con la info de la persona.
     No navega a #/datos (esa vista sí edita y sigue viva por si acaso). */
  { id:'misdatos',  icon:'user',  title:'Mis Datos',             desc:'Revisa tu información' },
  { id:'solicitud', icon:'help',  title:'Realiza tu solicitud',  desc:'Pide un servicio' },
  { id:'ideas',     icon:'idea',  title:'Suma tus ideas',        desc:'Propón para ' + MV.municipio },
  { id:'noticias',  icon:'news',  title:'Ponte al día',          desc:'Últimas noticias' },
  { id:'casa',      icon:'home2', title:'Nuestra casa social',   desc:'Programación y redes' },
  { id:'emergencia',icon:'phone', title:'Números de emergencia', desc:'Contactos útiles' },
  { id:'comercio',  icon:'store', title:'Comerciantes amigos',   desc:'Descubre y apoya' },
  { id:'lideres',   icon:'star',  title:'Líderes',               desc:'Zona de líderes' }
];
const IMPLEMENTADAS = new Set(['tarjeta', 'datos', 'solicitud', 'ideas', 'lideres', 'comercio', 'noticias', 'casa', 'emergencia']);   // 'datos' se queda: la ruta funciona aunque ya no tenga baldosa

/* ============================================================
   RÚTER
   ============================================================ */
function go(route) { location.hash = '#/' + route; }

/* 23/07/2026 · Rutas que van anchas en PC. El ancho se decide con la ruta de
   DESTINO, antes de pintar. Antes se hacia appWide(false) al entrar a render() y
   eso se aplicaba sobre el contenido VIEJO —que sigue en pantalla hasta que la
   vista nueva pinta—: al dar atras se veia colapsar a ancho de movil y un
   instante despues aparecia Inicio. Dos pasos en vez de uno.
   Las sub-vistas de la zona de lideres no son rutas propias y siguen encendiendo
   el ancho ellas mismas al pintar. */
const RUTAS_ANCHAS = new Set(['', 'home', 'ideas', 'casa', 'emergencia', 'comercio', 'noticias']);
/* Ensancha el contenedor en vistas con grid (referidos/servicios) */
function appWide(on) { document.body.classList.toggle('wide', !!on); }
window.addEventListener('hashchange', render);
function render() {
  const route = (location.hash.replace(/^#\//, '') || '').split('?')[0];
  const user = getActive();
  appWide(!!user && RUTAS_ANCHAS.has(route));   // 23/07: se decide con la ruta de destino (ver RUTAS_ANCHAS)
  if (window.__ntTeardown && route !== 'noticias') { window.__ntTeardown(); window.__ntTeardown = null; }
  if (window.__lrTeardown) { window.__lrTeardown(); }   // 22/07: apaga el vivo de Mis referidos
  /* 23/07/2026 · Si la app YA corre instalada (ventana standalone), la vista
     Instalar no tiene sentido y ademas dejaba la ventana muerta: Chrome abre la
     PWA en la misma URL desde la que se instalo, y si esa URL traia #/instalar,
     Ctrl+R la mantenia ahi para siempre. Se limpia el hash SIN dejar rastro en el
     historial (replaceState no dispara hashchange, por eso se repinta a mano). */
  if (route === 'instalar' && isStandalone()) { history.replaceState(null, '', location.pathname + location.search + '#/'); return render(); }
  if (route === 'instalar') return viewInstalar();
  if (route === 'registro') return go('login');   // ajuste 20/07: sin auto-registro
  if (!user && route !== 'login') return go('login');
  if (route === 'login' || !user) return viewLogin();
  switch (route) {
    case 'tarjeta':   return viewTarjeta(user);
    case 'datos':     return viewDatos(user);
    case 'solicitud': return viewSolicitud(user);
    case 'ideas':     return viewIdeas(user);
    case 'lideres':   return viewLideres(user);
    case 'comercio':  return viewComercio(user);
    case 'noticias':  return viewNoticias(user);
    case 'casa':       return viewCasa(user);
    case 'emergencia': return viewEmergencia(user);
    default:          return viewHome(user);
  }
}

/* ============================================================
   VISTA INSTALAR  (patrón SEP-GROUP)
   ============================================================ */
function viewInstalar() {
  app.innerHTML = `
    <div class="login-wrap"><div class="login-card">
      <img class="login-logo" src="${APP_ICON}" alt="${esc(MV.candidato)}" />
      <h1 class="login-title">${esc(MV.candidato)}</h1>
      <p class="login-sub">Instala la aplicación para acceder más rápido y usarla como app nativa.</p>

      <div id="install-box" style="margin-top:16px;">
        <button id="btn-install" class="btn btn-primary btn-block" style="display:none;">📲 Instalar aplicación</button>
        <div id="install-aviso" class="hidden ios-steps-wrap">
          <p class="small" id="install-aviso-txt" style="text-align:left;color:var(--muted);"></p>
        </div>
        <button id="btn-cont-web" class="btn btn-ghost btn-block" style="margin-top:10px;">🌐 Continuar en el navegador</button>
      </div>

      ${footBrand()}
    </div></div>`;
  app.hidden = false; hideSplash(); paintVersion(APP_VERSION_LOADED || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''));
  updateInstallSection(true);
  const cont = () => { sessionStorage.setItem(nsKey('continuedWeb'), '1'); go('login'); };
  const bi = $('#btn-install');
  if (bi) bi.onclick = async () => {
    if (!deferredPrompt) { toast('La instalación aún no está disponible. Usa el menú del navegador.'); return; }
    const dp = deferredPrompt; dp.prompt(); try { await dp.userChoice; } catch {} deferredPrompt = null; updateInstallSection();
  };
  const cw = $('#btn-cont-web'); if (cw) cw.onclick = cont;
}

/* ============================================================
   LOGIN  (pestañas PIN rápido / Documento — patrón SEP-GROUP)
   ============================================================ */
let pinBuffer = ''; // PIN rápido: siempre resuelve contra sesiones guardadas en el dispositivo
function viewLogin() {
  const sesiones = getSessions();
  const startTab = sesiones.length ? 'pin' : 'doc';
  app.innerHTML = `
    <div class="login-wrap"><div class="login-card">
      <img class="login-logo" src="${APP_ICON}" alt="${esc(MV.candidato)}" />
      <h1 class="login-title">Bienvenido</h1>
      <p class="login-sub">${esc(MV.lema)} · ${esc(MV.candidato)}</p>

      <div class="login-tabs">
        <button class="login-tab ${startTab === 'pin' ? 'active' : ''}" data-tab="pin">PIN rápido</button>
        <button class="login-tab ${startTab === 'doc' ? 'active' : ''}" data-tab="doc">Documento</button>
      </div>

      <div id="tab-pin" class="${startTab === 'pin' ? '' : 'hidden'}">
        <p class="pin-hint" id="pin-hint">${sesiones.length ? 'Ingresa tu PIN (últimos 4 de tu documento)' : 'Elige la pestaña Documento para tu primer ingreso'}</p>
        <div class="pin-pad"><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div></div>
        <div class="pin-keypad">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="pin-key" data-key="${n}">${n}</button>`).join('')}
          <button class="pin-key action" data-key="clear">Borrar</button>
          <button class="pin-key" data-key="0">0</button>
          <button class="pin-key action" data-key="back">⌫</button>
        </div>
      </div>

      <div id="tab-doc" class="${startTab === 'doc' ? '' : 'hidden'}">
        <label class="field"><span>Número de documento</span>
          <input class="input" id="login-doc" inputmode="numeric" placeholder="Sin puntos ni espacios" autocomplete="off" /></label>
        <button class="btn btn-primary btn-block" id="btn-login-doc" style="margin-top:8px;">Iniciar sesión</button>
      </div>

      ${footBrand()}
    </div></div>`;
  app.hidden = false; hideSplash(); paintVersion(APP_VERSION_LOADED || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''));
  pinBuffer = ''; paintPin();

  $$('.login-tab').forEach(tab => tab.onclick = () => {
    $$('.login-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
    const w = tab.dataset.tab; $('#tab-doc').classList.toggle('hidden', w !== 'doc'); $('#tab-pin').classList.toggle('hidden', w !== 'pin');
    if (w === 'pin') { pinBuffer = ''; paintPin(); $('#pin-hint').textContent = getSessions().length ? 'Ingresa tu PIN (últimos 4 de tu documento)' : 'Elige la pestaña Documento para tu primer ingreso'; }
  });

  const doc = $('#login-doc'); onlyDigits(doc);
  doc.addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-login-doc').click(); });
  // Pestaña DOCUMENTO: inicia sesión SOLO con el documento (sin pedir PIN),
  // igual que SEP-GROUP. Si el documento no existe, se ofrece registrarse.
  $('#btn-login-doc').onclick = async () => {
    const d = onlyDig(doc.value);
    if (!/^\d{6,10}$/.test(d)) return toast('Documento inválido (6 a 10 dígitos)', 'err');
    const btn = $('#btn-login-doc'); saving(btn, true);
    try {
      const r = await api('pub.login', {}, 'POST', { documento: d }); // sin PIN
      saving(btn, false);
      if (!r.ok) {
        if (/no est[aá]s registrad/i.test(r.msg || '')) return avisoSinRegistro();
        return toast(r.msg || 'No se pudo iniciar sesión', 'err');
      }
      saveSession(r.user); go('home'); ntAutoActivar(r.user);   // 30/07: avisos desde el primer ingreso
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };

  $$('.pin-key').forEach(k => k.onclick = () => onPinKey(k.dataset.key));

  // Ajuste 20/07: a la app SOLO entra quien ya está en PRINCIPAL. El alta de
  // nuevos se hace desde Asistencia, desde Referidos (zona de líder) o desde la
  // app privada. Aquí solo se informa, sin ofrecer auto-registro.
  function avisoSinRegistro() {
    openSheet(`<div class="grip"></div><div class="center stack"><div class="ico" style="width:56px;height:56px;margin:0 auto;border-radius:16px;background:var(--brand-050);display:grid;place-content:center;">${I.user}</div><h2 class="h2">Sin registro</h2><p class="muted">No hay registros asociados con el documento ingresado.</p><button class="btn btn-primary btn-block" data-close>Entendido</button></div>`);
  }
}
function paintPin() { $$('.pin-dot').forEach((d, i) => d.classList.toggle('filled', i < pinBuffer.length)); }
async function onPinKey(k) {
  if (k === 'clear') { pinBuffer = ''; return paintPin(); }
  if (k === 'back') { pinBuffer = pinBuffer.slice(0, -1); return paintPin(); }
  if (pinBuffer.length >= 4) return;
  pinBuffer += k; paintPin();
  if (pinBuffer.length === 4) { const pin = pinBuffer; setTimeout(() => resolverPin(pin), 120); }
}
async function resolverPin(pin) {
  // PIN rápido: coincidencias entre sesiones guardadas del dispositivo
  const matches = getSessions().filter(s => onlyDig(s.documento).slice(-4) === pin);
  if (matches.length === 0) { toast('No hay cuenta guardada con ese PIN. Usa la pestaña Documento.', 'err'); pinBuffer = ''; paintPin(); return; }
  if (matches.length === 1) return loginCon(matches[0].documento, pin);
  // varias: elegir
  openSheet(`<div class="grip"></div><h2 class="h2">¿Con cuál cuenta entras?</h2><div class="stack" style="margin-top:12px;">${matches.map(s => `<button class="chip" style="width:100%;justify-content:flex-start;" data-doc="${esc(s.documento)}"><span class="av">${esc(iniciales(s.nombre))}</span>${esc(s.nombre)}</button>`).join('')}</div>`);
  layer.querySelectorAll('.chip').forEach(c => c.onclick = () => { closeLayer(); loginCon(c.dataset.doc, pin); });
  pinBuffer = ''; paintPin();
}
async function loginCon(documento, pin) {
  try {
    const r = await api('pub.login', {}, 'POST', { documento, pin });
    if (!r.ok) { toast(r.msg || 'PIN incorrecto', 'err'); pinBuffer = ''; paintPin(); return; }
    saveSession(r.user); go('home'); ntAutoActivar(r.user);   // 30/07: avisos desde el primer ingreso
  } catch (e) { toast('Error de conexión', 'err'); pinBuffer = ''; paintPin(); }
}

/* Registro público (auto-registro) retirado el 20/07: el alta de nuevos se
   hace desde Asistencia, Referidos (zona de líder) o la app privada. */

/* ============================================================
   ACTUALIZAR DATOS
   ============================================================ */
async function viewDatos(user) {
  app.innerHTML = `${backbar('Actualizar mis datos')}<div class="pad stack"><div class="card pad stack">${field('Documento', inputEl('d-doc', 'readonly'))}${field('Nombre', inputEl('d-nombre', ''))}${field('WhatsApp (nuevo)', inputEl('d-tel', 'inputmode="numeric" maxlength="10" placeholder="Déjalo vacío si no cambia"'))}${field('Residencia (opcional)', comboboxHtml('d-resi', 'Escribe para cambiarla'))}${referidoBlock('d')}<button class="btn btn-primary btn-block" id="d-save">Guardar cambios</button></div></div>`;
  app.hidden = false; hideSplash(); $('#backbtn').onclick = () => go('home');
  $('#d-doc').value = user.documento; onlyLetters($('#d-nombre')); onlyDigits($('#d-tel'));
  getResidencias().then(l => bindCombobox('d-resi', l)).catch(() => {}); bindReferido('d');
  try { const r = await api('pub.validarDoc', { documento: user.documento }); $('#d-nombre').value = (r.existe && r.nombre) || user.nombre || ''; } catch { $('#d-nombre').value = user.nombre || ''; }
  $('#d-save').onclick = async () => {
    const body = { documento: user.documento, nombre: val('d-nombre'), telefono: onlyDig(val('d-tel')), residencia: val('d-resi'), referencia: refValue('d') };
    if (body.nombre && /\d/.test(body.nombre)) return toast('El nombre no debe tener números', 'err');
    if (body.telefono && !/^\d{10}$/.test(body.telefono)) return toast('El WhatsApp debe tener 10 dígitos', 'err');
    if (body.referencia && !/^\d{1,3}$/.test(body.referencia)) return toast('El N° de Referido tiene 1 a 3 dígitos', 'err');
    const ok = await confirmar('Confirma la actualización', crow('Documento', body.documento) + crow('Nombre', body.nombre || 'Sin cambios') + crow('WhatsApp', body.telefono || 'Sin cambios') + crow('Residencia', body.residencia || 'Sin cambios') + crow('Referido', body.referencia || 'Sin cambios'));
    if (!ok) return;
    const btn = $('#d-save'); saving(btn, true);
    try { const r = await api('pub.actualizar', {}, 'POST', body); if (!r.success) { toast(r.message || 'No se pudo guardar', 'err'); saving(btn, false); return; } const s = getActive(); if (body.nombre) s.nombre = body.nombre.toUpperCase(); if (body.residencia) s.residencia = body.residencia; saveSession(s); toast('Datos actualizados', 'ok'); go('home'); }
    catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

async function prefill(user) { try { const r = await api('pub.validarDoc', { documento: user.documento }); if (r.existe) return { nombre: r.nombre || user.nombre || '', telefono: r.telefono || '', residencia: r.residencia || user.residencia || '' }; } catch {} return { nombre: user.nombre || '', telefono: '', residencia: user.residencia || '' }; }

/* ============================================================
   SOLICITUD / IDEAS
   ============================================================ */
async function viewSolicitud(user) {
  app.innerHTML = `${backbar('Realiza tu solicitud')}<div class="pad stack"><div class="card pad stack">${field('Servicio', '<div id="s-serv-wrap">' + selectEl('s-servicio', [], 'Cargando…') + '</div>')}${field('Tu solicitud', areaEl('s-solicitud', 'Describe brevemente lo que necesitas', 4))}<p class="small muted" id="s-quien">Cargando tus datos…</p><button class="btn btn-primary btn-block" id="s-save">Enviar solicitud</button></div></div>`;
  app.hidden = false; hideSplash(); $('#backbtn').onclick = () => go('home');
  getServicios().then(l => { $('#s-serv-wrap').innerHTML = selectEl('s-servicio', l, 'Selecciona un servicio'); }).catch(() => {});
  const p = await prefill(user); $('#s-quien').innerHTML = `Se enviará a nombre de <b>${esc(p.nombre)}</b>`;
  $('#s-save').onclick = async () => {
    const body = { documento: user.documento, nombre: p.nombre, telefono: p.telefono, residencia: p.residencia, servicio: val('s-servicio'), solicitud: val('s-solicitud') };
    if (!body.servicio) return toast('Selecciona un servicio', 'err'); if (!body.solicitud) return toast('Describe tu solicitud', 'err');
    const ok = await confirmar('Confirma tu solicitud', crow('Servicio', body.servicio) + crowBlock('Solicitud', body.solicitud)); if (!ok) return;
    const btn = $('#s-save'); saving(btn, true);
    try { const r = await api('pub.solicitud', {}, 'POST', body); if (!r.success) { toast(r.message || 'No se pudo enviar', 'err'); saving(btn, false); return; } celebrar('✅', '¡Solicitud recibida!', 'Pronto te daremos una respuesta. Gracias por confiar en el Equipo del Hacer.'); } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}
/* Info por área (21/07). "Otros" NO lleva botón: no tiene definición. */
const IDEAS_INFO = {
  social:        { t: 'Social',        d: 'Salud, educación, vivienda, cultura, deporte y recreación, agua potable y saneamiento básico, y promoción social (atención a grupos vulnerables).' },
  institucional: { t: 'Institucional', d: 'Seguridad y justicia, desarrollo comunitario, fortalecimiento institucional, equipamiento público y centros de reclusión.' },
  economico:     { t: 'Económico',     d: 'Promoción del desarrollo, empleo, turismo, emprendimiento, agropecuario, transporte, servicios públicos diferentes a acueducto, alcantarillado y aseo.' },
  ambiental:     { t: 'Ambiental',     d: 'Ambiental, prevención y atención de desastres, gestión del riesgo, protección animal.' }
};
/* Campo con etiqueta + botón de info (abre una hoja con la descripción del área) */
function fieldInfo(label, key, inner) {
  return `<div class="field"><div class="field-lbl">${esc(label)}<button type="button" class="fi-btn" data-info="${esc(key)}" aria-label="¿Qué incluye ${esc(label)}?">${I.info}</button></div>${inner}</div>`;
}
async function viewIdeas(user) {
  app.innerHTML = `${backbar('Suma tus ideas')}<div class="pad stack"><p class="muted">Comparte tus ideas para ${esc(MV.municipio)}. Llena solo los aspectos que quieras.</p><div class="card pad stack"><div class="ideas-grid">${fieldInfo('Social', 'social', areaEl('i-social', 'Ideas sociales…'))}${fieldInfo('Institucional', 'institucional', areaEl('i-institucional', 'Ideas institucionales…'))}${fieldInfo('Económico', 'economico', areaEl('i-economico', 'Ideas económicas…'))}${fieldInfo('Ambiental', 'ambiental', areaEl('i-ambiental', 'Ideas ambientales…'))}${field('Otros', areaEl('i-otros', 'Otras ideas…'))}</div>
    <div class="ter-block">
      <label class="check-row"><input type="checkbox" id="i-tercero" /> <span>A nombre de un tercero</span></label>
      <p class="small muted" style="margin:2px 0 0 2px;">Ayuda a personas que no pueden tener la App en sus dispositivos.</p>
      <div id="i-ter-wrap" hidden style="margin-top:10px;">
        ${field('Nombre', inputEl('i-ter-nombre', 'placeholder="Nombre y apellido"'))}
        ${field('Teléfono', inputEl('i-ter-tel', 'inputmode="numeric" maxlength="10" placeholder="Número de 10 dígitos"'))}
        ${field('Residencia', comboboxHtml('i-ter-resi', 'Escribe para buscar'))}
      </div>
    </div>
    <button class="btn btn-primary btn-block" id="i-save">Enviar mis ideas</button></div></div>`;
  app.hidden = false; hideSplash(); appWide(true); $('#backbtn').onclick = () => go('home');   /* 23/07 */
  const p = await prefill(user);

  // Botones de info por área
  $$('.fi-btn').forEach(b => b.onclick = () => {
    const it = IDEAS_INFO[b.dataset.info]; if (!it) return;
    openSheet(`<div class="grip"></div><h2 class="h2" style="margin-bottom:8px;">${esc(it.t)}</h2><p class="muted" style="line-height:1.5;">${esc(it.d)}</p><button class="btn btn-quiet btn-block" data-close style="margin-top:14px;">Entendido</button>`);
  });

  // "A nombre de un tercero": revela los 2 campos y filtra el teléfono a dígitos
  const chk = $('#i-tercero'), wrap = $('#i-ter-wrap');
  if (chk) chk.onchange = () => { wrap.hidden = !chk.checked; };
  onlyDigits($('#i-ter-tel'));
  /* 25/07: Residencia del tercero — mismo catálogo y mismo buscador que el de
     "nuevo referido" (pub.residencias). Se enlaza aunque el bloque esté oculto:
     el combo ya existe en el DOM y no cuesta nada. */
  getResidencias().then(l => bindCombobox('i-ter-resi', l)).catch(() => {});

  $('#i-save').onclick = async () => {
    let nombre = p.nombre, telefono = p.telefono, residencia = p.residencia;
    const ter = chk && chk.checked;
    if (ter) {
      const tn = val('i-ter-nombre'), tt = onlyDig(val('i-ter-tel')), tr = val('i-ter-resi');
      if (tn.split(/\s+/).filter(Boolean).length < 2) return toast('Nombre del tercero: al menos 2 palabras', 'err');
      if (!/^\d{10}$/.test(tt)) return toast('Teléfono del tercero: exactamente 10 dígitos', 'err');
      if (!tr) return toast('Selecciona la residencia del tercero', 'err');
      nombre = tn; telefono = tt; residencia = tr;   // reemplazan al usuario logueado en la hoja IDEAS (NOMBRE→B, CONTACTO→C, RESIDENCIA→D)
    }
    const body = { documento: user.documento, nombre: nombre, telefono: telefono, residencia: residencia, social: val('i-social'), institucional: val('i-institucional'), economico: val('i-economico'), ambiental: val('i-ambiental'), otros: val('i-otros') };
    if (!(body.social || body.institucional || body.economico || body.ambiental || body.otros)) return toast('Escribe al menos una idea', 'err');
    const ok = await confirmar('Confirma tus ideas', (ter ? crow('A nombre de', nombre + ' · ' + telefono) + crow('Residencia', residencia) : '') + crowBlock('Social', body.social) + crowBlock('Institucional', body.institucional) + crowBlock('Económico', body.economico) + crowBlock('Ambiental', body.ambiental) + crowBlock('Otros', body.otros)); if (!ok) return;
    const btn = $('#i-save'); saving(btn, true);
    try { const r = await api('pub.ideas', {}, 'POST', body); if (!r.success) { toast(r.message || 'No se pudo enviar', 'err'); saving(btn, false); return; } celebrar('💡', '¡Gracias por tu idea!', `Cada idea nos ayuda a construir un mejor ${MV.municipio}. La tendremos muy en cuenta.`); } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* ============================================================
   HOME + TARJETA
   ============================================================ */
/* 23/07/2026 · pub.esLider se guarda por sesion. Antes Inicio esperaba SIEMPRE
   esa llamada antes de pintar, y mientras tanto la vista anterior seguia en
   pantalla: era la otra mitad del "atras en dos pasos". La primera vez se espera
   igual que antes; de ahi en adelante Inicio pinta de una y se revalida callado. */
let ES_LIDER = { doc: '', val: null };
async function esLiderCargar(user) {
  try {
    const el = await api('pub.esLider', { documento: user.documento });
    ES_LIDER = { doc: user.documento, val: !!(el && el.esLider) };
  } catch {
    if (ES_LIDER.doc !== user.documento) ES_LIDER = { doc: user.documento, val: false };
  }
  return ES_LIDER.val;
}
const esLiderCache = (user) => (ES_LIDER.doc === user.documento && ES_LIDER.val !== null) ? ES_LIDER.val : null;
async function viewHome(user) {
  const plan = planUser(user);
  // Sección de líderes (y Refiere, que es solo para líderes) se muestran solo
  // si el usuario está en la hoja LIDERES.
  const cacheLider = esLiderCache(user);
  const esLider = cacheLider === null ? await esLiderCargar(user) : cacheLider;
  const soloLider = new Set(['lideres']);
  const menu = MENU.filter(m => !soloLider.has(m.id) || esLider);

  app.innerHTML = `${appbar(user)}<div class="pad stack"><div><p class="eyebrow">${esc(MV.lema)}</p><h1 class="h1">Hola, ${esc(primerNombre(user.nombre))} 👋🏾</h1><span class="plan-badge ${plan.premium ? 'premium' : ''}">${esc(plan.label)}</span></div><div id="inicio"><div class="hero"><div class="skeleton" style="aspect-ratio:16/10;"></div></div></div><div id="banner"></div><p class="eyebrow" style="margin-top:6px;">Explora</p><div class="menu-grid">${menu.map(m => `<button class="tile ${m.gold ? 'gold' : ''} ${m.wide ? 'wide' : ''}" data-id="${m.id}"><span class="ico">${I[m.icon]}</span><span class="txt"><b>${esc(m.title)}</b><br><span>${esc(m.desc)}</span></span></button>`).join('')}</div><p class="center small muted" style="margin-top:10px;">${esc(MV.candidato)} · ${esc(MV.lugar)}</p></div>`;
  app.hidden = false; hideSplash(); bindAppbar(user); appWide(true);   /* 23/07: Inicio se expande en PC */
  app.querySelectorAll('.tile').forEach(t => t.onclick = () => openMenu(t.dataset.id, user));
  /* Se pinto con el valor guardado: se confirma en silencio y solo se repinta si
     de verdad cambio (dejo de ser lider o acaba de serlo) y seguimos en Inicio. */
  if (cacheLider !== null) esLiderCargar(user).then(v => {
    const enInicio = ['', '#/', '#/home'].indexOf(location.hash) >= 0;
    if (v !== cacheLider && enInicio) viewHome(user);
  }).catch(() => {});
  try {
    const d = await api('pub.inicio'); const cont = $('#inicio');
    if (!cont) return; // el usuario ya cambió de vista mientras cargaba: no toques el DOM
    const media = d.imagen ? `<img class="hero-img" src="${esc(d.imagen)}" alt="${esc(MV.candidato)}" onerror="this.replaceWith(heroFallback())" />` : heroFallback().outerHTML;
    const play = d.reel ? `<button class="hero-play-c" id="playReel" aria-label="Ver video">${I.play}</button>` : '';
    cont.innerHTML = `<div class="hero${d.reel ? ' has-video' : ''}">${media}${play}</div>`;
    if (d.reel) {
      const hero = cont.querySelector('.hero');
      if (hero) hero.onclick = () => openVideo(d.reel);
    }
    if (d.hayNoticias) {
      // Cuántas NO ha visto ESTE dispositivo (los ts vienen en pub.inicio: sin llamada extra)
      const nuevas = ntNoLeidas((d.noticiasTs || []).map(t => ({ ts: t })));
      const txt = nuevas ? `${nuevas} noticia(s) nueva(s) para ti` : `${d.noticias} novedad(es) publicadas`;
      const banner = $('#banner');
      if (banner) {
        banner.innerHTML = `<button class="banner">${nuevas ? '<span class="dot"></span>' : ''}<div><b>Ponte al día</b><br><span class="small muted">${esc(txt)}</span></div></button>`;
        const bBtn = $('#banner .banner'); if (bBtn) bBtn.onclick = () => openMenu('noticias', user);
        const tile = app.querySelector('.tile[data-id="noticias"]');
        if (tile && nuevas) tile.insertAdjacentHTML('beforeend', `<span class="tile-badge">${nuevas > 9 ? '9+' : nuevas}</span>`);
      }
    }
  } catch (e) { const c = $('#inicio'); if (c) c.innerHTML = `<div class="hero">${heroFallback().outerHTML}</div>`; }
}

/* Editar foto de perfil: elegir archivo → previsualizar → subir a Drive */
function editarFoto(user) {
  const tieneFoto = user.foto && user.foto !== FOTO_DEFAULT;
  openSheet(`<div class="grip"></div><h2 class="h2" style="margin-bottom:4px;">Foto de perfil</h2>
    <p class="muted" style="margin-bottom:14px;">Elige una imagen (JPG, PNG o WEBP, máx. 6 MB).</p>
    <div class="stack center">
      <div class="foto-preview" id="foto-prev"><img src="${esc(user.foto || FOTO_DEFAULT)}" alt="" /></div>
      <input type="file" id="foto-file" accept="image/png,image/jpeg,image/webp" style="display:none;" />
      <button class="btn btn-ghost btn-block" id="foto-pick">Elegir imagen</button>
      <button class="btn btn-primary btn-block" id="foto-save" disabled>Guardar foto</button>
      ${tieneFoto ? `<button class="btn btn-quiet btn-block" id="foto-del">Quitar foto</button>` : ''}
    </div>`);
  let dataUrl = '';
  $('#foto-pick').onclick = () => $('#foto-file').click();
  $('#foto-file').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 6 * 1024 * 1024) return toast('La imagen supera 6 MB', 'err');
    const rd = new FileReader();
    rd.onload = () => { dataUrl = rd.result; $('#foto-prev').innerHTML = `<img src="${dataUrl}" alt="" />`; $('#foto-save').disabled = false; };
    rd.readAsDataURL(f);
  };
  $('#foto-save').onclick = async () => {
    if (!dataUrl) return;
    const btn = $('#foto-save'); saving(btn, true);
    try {
      const r = await api('pub.subirFoto', {}, 'POST', { documento: user.documento, dataUrl });
      saving(btn, false);
      if (!r.ok) return toast(r.msg || 'No se pudo subir', 'err');
      user.foto = r.foto; saveSession(user);
      closeLayer(); toast('Foto actualizada', 'ok'); viewHome(user);
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
  const del = $('#foto-del');
  if (del) del.onclick = async () => {
    const btn = del; saving(btn, true);
    try {
      const r = await api('pub.quitarFoto', {}, 'POST', { documento: user.documento });
      saving(btn, false);
      if (!r.ok) return toast(r.msg || 'No se pudo quitar', 'err');
      user.foto = r.foto; saveSession(user);
      closeLayer(); toast('Foto quitada', 'ok'); viewHome(user);
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}
function heroFallback() { return h(`<div class="hero-fallback"><b class="h2">${esc(MV.lema)} 💪🏾</b><span class="small">Juntos por un municipio próspero</span></div>`); }

async function viewTarjeta(user) {
  app.innerHTML = `${appbar(user, 'Mi tarjeta')}<div class="pad stack"><div class="carne"><div class="skeleton" style="height:360px;background:rgba(255,255,255,.2);"></div></div></div>`;
  app.hidden = false; hideSplash(); bindAppbar(user);
  try {
    const d = await api('qr.tarjeta', { documento: user.documento });
    if (!d.ok) return toast(d.msg || 'No encontramos tu tarjeta', 'err');
    const t = d.tarjeta;
    $('.pad').innerHTML = `<div class="carne"><div class="row"><div><div class="label">Portador</div><div class="name">${esc(t.nombre)}</div><div class="doc">CC ${esc(t.documento)}</div></div><img class="carne-logo" src="${APP_ICON}" alt="" /></div><div class="qr-wrap"><img src="${esc(t.qrUrl)}" alt="Código QR" /></div><div class="foot"><span class="idpill">${esc(t.idUsuario)}</span><span class="flag">${esc(MV.lema.toUpperCase())}</span></div></div><button class="btn btn-ghost btn-block" id="share">${I.share} Compartir mi tarjeta</button><button class="btn btn-quiet btn-block" id="back">Volver al inicio</button>`;
    $('#back').onclick = () => go('home');
    $('#share').onclick = async () => { if (navigator.share) { try { await navigator.share({ title: 'Mi tarjeta · ' + MV.candidato, text: `${t.nombre} — ${MV.lema}`, url: t.qrUrl }); } catch {} } else window.open(t.qrUrl, '_blank'); };
  } catch (e) { toast('Error al cargar la tarjeta', 'err'); }
}

/* ============================================================
   REFIERE POR WHATSAPP
   Comportamiento REAL del portal (BOTHEART911/portal-jhonny-perdomo):
   "Refiere por Whatsapp" valida que el usuario sea LÍDER (validarLider);
   si lo es, arma el mensaje con su N° de Referido y abre WhatsApp
   (whatsapp://send en móvil, api.whatsapp.com/send en escritorio) y copia
   el texto al portapapeles. Si NO es líder: "No estás en registros de Líderes".
   ============================================================ */
let COMERCIO_URL = 'https://tinyurl.com/comercio-jhonny-perdomo';
let APP_CONFIG = null;
/* 30/07/2026 · la silueta por defecto vive en el repo central de imágenes.
   Absoluta a propósito: es la MISMA imagen que sirve el CORE, y así las dos
   caras (lo que pinta el front y lo que guarda la hoja) coinciden. */
const FOTO_DEFAULT = 'https://botheart911.github.io/IMAGENES-JHONNY/marca/user.png';
/* ============================================================
   MÓDULO LÍDERES  (zona del líder en la app pública)
   Sub-vistas: referidos (tarjetas con Asistencia/Intención/Editar),
   nuevo referido, mis servicios, mis compromisos, actualizar contraseña,
   refiere por WhatsApp.  Todo nativo, en tarjetas. Sin stubs.
   ============================================================ */
async function viewLideres(user) {
  // Si ya validó la contraseña en esta sesión, va directo al panel.
  if (LIDER && LIDER.documento === user.documento) return liderPanel(user);

  /* 31/07 · seguridad: antes de pintar el login preguntamos el estado real
     de la cuenta (si tiene correo y si la zona está bloqueada). */
  app.innerHTML = `${backbar('Zona de líderes')}<div class="pad stack">${loadingBox('Un momento…')}</div>`;
  app.hidden = false; hideSplash(); appWide(false); $('#backbtn').onclick = () => go('home');

  let est = null;
  try { est = await api('pub.esLider', { documento: user.documento }); } catch (e) { est = null; }
  if (est && est.esLider === false) {
    app.innerHTML = `${backbar('Zona de líderes')}<div class="pad stack"><div class="card pad center muted">No estás registrado como líder.</div></div>`;
    $('#backbtn').onclick = () => go('home');
    return;
  }
  if (est && est.bloqueado) return liderBloqueado(user, est.segundos);

  liderLoginPintar(user);
  // Sin correo registrado → modal de activación automático (se puede cerrar).
  if (est && est.tieneCorreo === false) liderActivarCorreo(user);
}

/* Login de la zona (solo contraseña). Se separó de viewLideres para poder
   repintarlo al vencer un bloqueo sin repetir la consulta de estado. */
function liderLoginPintar(user) {
  // Clave recordada (si el usuario marcó "recordar")
  let recordada = '';
  try { const raw = localStorage.getItem(LIDER_REMEMBER_KEY); if (raw) { const o = JSON.parse(raw); if (o && o.doc === user.documento) recordada = o.clave || ''; } } catch {}

  app.innerHTML = `${backbar('Zona de líderes')}<div class="pad stack">
    <div class="card pad stack center">
      <img class="lider-banner" src="${APP_BANNER}" alt="${esc(MV.candidato)}" onerror="this.style.display='none'" />
      <h2 class="h2">Acceso de líder</h2>
      <p class="muted">Este apartado es de uso exclusivo de los líderes. Ingresa tu contraseña para administrar tus referidos.</p>
      <label class="field" style="text-align:left;"><span>Contraseña</span>
        <div class="input-pass">
          <input class="input" id="lg-clave" type="password" placeholder="Tu contraseña" autocomplete="off" value="${esc(recordada)}" />
          <button type="button" class="pass-eye" id="lg-eye" aria-label="Mostrar u ocultar">${I.eyeOff}</button>
        </div></label>
      <label class="check-row"><input type="checkbox" id="lg-recordar" ${recordada ? 'checked' : ''} /> <span>Recordar mi contraseña</span></label>
      <button class="btn btn-primary btn-block" id="lg-entrar">Entrar</button>
      <button class="link-quiet" id="lg-olvide">📧 Olvidé mi contraseña</button>
    </div>
  </div>`;
  app.hidden = false; hideSplash(); appWide(false); $('#backbtn').onclick = () => go('home');
  const inp = $('#lg-clave');
  // ojo ver/ocultar
  let visible = false;
  $('#lg-eye').onclick = () => { visible = !visible; inp.type = visible ? 'text' : 'password'; $('#lg-eye').innerHTML = visible ? I.eyeOn : I.eyeOff; };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') $('#lg-entrar').click(); });
  $('#lg-olvide').onclick = () => liderOlvideClave(user);
  $('#lg-entrar').onclick = async () => {
    const clave = inp.value.trim();
    if (!clave) return toast('Ingresa tu contraseña', 'err');
    const btn = $('#lg-entrar'); saving(btn, true);
    try {
      const r = await api('pub.liderEntrar', {}, 'POST', { documento: user.documento, clave });
      saving(btn, false);
      if (!r.ok) {
        if (r.bloqueado) return liderBloqueado(user, r.segundos);
        if (r.requiereCrearClave) return liderCrearClave(user);
        return toast(r.msg || 'No se pudo entrar', 'err');
      }
      // recordar / olvidar
      try {
        if ($('#lg-recordar').checked) localStorage.setItem(LIDER_REMEMBER_KEY, JSON.stringify({ doc: user.documento, clave }));
        else localStorage.removeItem(LIDER_REMEMBER_KEY);
      } catch {}
      LIDER = { codigo: r.lider.codigo, nombre: r.lider.nombre, documento: user.documento, correo: r.lider.correo || '', opciones: r.opciones };
      liderPanel(user);
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* Zona cerrada por 3 contraseñas malas: cuenta regresiva y nada más.
   El bloqueo lo lleva el servidor; esto solo lo muestra. */
function liderBloqueado(user, segundos) {
  let seg = Math.max(1, parseInt(segundos, 10) || 0);
  app.innerHTML = `${backbar('Zona de líderes')}<div class="pad stack">
    <div class="card pad stack center">
      <div class="lock-big">🔒</div>
      <h2 class="h2">Ingreso bloqueado</h2>
      <p class="muted">Por seguridad cerramos esta zona tras varios intentos fallidos con tu contraseña. Si no fuiste tú, revisa tu correo y cambia tu contraseña apenas puedas entrar.</p>
      <div class="lock-count" id="lb-count">${mmss(seg)}</div>
      <button class="btn btn-quiet btn-block" id="lb-home">Volver al inicio</button>
    </div>
  </div>`;
  app.hidden = false; hideSplash(); appWide(false);
  $('#backbtn').onclick = () => go('home');
  $('#lb-home').onclick = () => go('home');
  const t = setInterval(() => {
    const el = $('#lb-count');
    if (!el) return clearInterval(t);          // el usuario se fue de la vista
    seg--;
    if (seg <= 0) { clearInterval(t); return viewLideres(user); }
    el.textContent = mmss(seg);
  }, 1000);
}

function mmss(s) {
  s = Math.max(0, parseInt(s, 10) || 0);
  return String(Math.floor(s / 60)) + ':' + ('0' + (s % 60)).slice(-2);
}

/* ---- CORREO DE ACTIVACIÓN / CAMBIO DE CORREO (31/07) ----
   Un solo modal para los dos casos:
     modo 'activar' → el líder no tiene correo. Paso 1 correo, paso 2 código.
     modo 'cambiar' → ya viene con el código enviado desde la tarjeta
                      "Actualiza tu correo" (cfg.destino), así que abre en el paso 2.
   El correo NO se guarda hasta que el código se valida. */
function liderActivarCorreo(user, cfg) {
  cfg = cfg || {};
  const modo = cfg.modo === 'cambiar' ? 'cambiar' : 'activar';
  let correo = cfg.correo || '';
  let claveActual = cfg.claveActual || '';
  let tmr = null;

  const sh = openSheet(`<div class="grip"></div>
    <h2 class="h2" style="margin-bottom:6px;">${modo === 'cambiar' ? 'Confirma tu correo' : 'Correo de activación'}</h2>
    <p class="muted small" id="lm-help">${modo === 'cambiar'
      ? 'Te enviamos un código al correo nuevo. Escríbelo aquí para confirmarlo.'
      : 'Aún no tienes un correo registrado. Regístralo para poder recuperar tu contraseña si la olvidas.'}</p>

    <div class="stack" id="lm-p1" ${modo === 'cambiar' ? 'hidden' : ''} style="margin-top:14px;">
      <label class="field" style="text-align:left;"><span>Correo</span>
        <input class="input" id="lm-mail" type="email" inputmode="email" autocomplete="email" placeholder="tucorreo@ejemplo.com" value="${esc(correo)}" />
      </label>
      <button class="btn btn-primary btn-block" id="lm-send">Guardar y enviar código</button>
      <button class="btn btn-quiet btn-block" data-close>Ahora no</button>
    </div>

    <div class="stack" id="lm-p2" hidden style="margin-top:14px;">
      <div class="crow"><span>Código enviado a</span><b id="lm-dest">—</b></div>
      <label class="field" style="text-align:left;"><span>Código de 6 dígitos</span>
        <input class="input code-input" id="lm-code" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code" />
      </label>
      <p class="muted small" id="lm-timer">&nbsp;</p>
      <button class="btn btn-primary btn-block" id="lm-ver">Validar código</button>
      <button class="btn btn-quiet btn-block" id="lm-again">Reenviar código</button>
    </div>`);

  const stop = () => { if (tmr) { clearInterval(tmr); tmr = null; } };
  const bd = layer.querySelector('.backdrop'); if (bd) bd.addEventListener('click', stop);
  sh.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', stop));

  /* Arranca (o reinicia) la cuenta regresiva del código */
  function contar(segundos) {
    stop();
    let seg = Math.max(1, parseInt(segundos, 10) || 180);
    const pinta = () => {
      const el = $('#lm-timer'); if (!el) return stop();
      el.textContent = seg > 0 ? ('El código vence en ' + mmss(seg)) : 'El código venció. Pide uno nuevo.';
      el.classList.toggle('danger', seg <= 30);
    };
    pinta();
    tmr = setInterval(() => { seg--; if (seg < 0) return stop(); pinta(); }, 1000);
  }

  function irPaso2(destino, segundos) {
    const p1 = $('#lm-p1'), p2 = $('#lm-p2'), help = $('#lm-help');
    if (p1) p1.hidden = true;
    if (p2) p2.hidden = false;
    if (help) help.textContent = 'Escribe el código que te llegó al correo. Si no lo ves, revisa la carpeta de spam.';
    const d = $('#lm-dest'); if (d) d.textContent = destino || correo;
    contar(segundos);
    const c = $('#lm-code'); if (c) { c.value = ''; c.focus(); }
  }

  async function enviar(btn) {
    if (btn) saving(btn, true);
    try {
      const r = await api('pub.liderCodigoEnviar', {}, 'POST',
        { documento: user.documento, correo, modo, claveActual });
      if (btn) saving(btn, false);
      if (!r.ok) {
        if (r.bloqueado) { stop(); closeLayer(); return liderBloqueado(user, r.segundos); }
        return toast(r.msg || 'No se pudo enviar el código', 'err');
      }
      irPaso2(r.destino, r.segundos);
      toast('Código enviado', 'ok');
      return true;
    } catch (e) { if (btn) saving(btn, false); toast('Error de conexión', 'err'); }
  }

  const send = $('#lm-send');
  if (send) send.onclick = () => {
    const v = String(($('#lm-mail') || {}).value || '').trim();
    if (!v) return toast('Escribe tu correo', 'err');
    if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(v)) return toast('Ese correo no parece válido. Revísalo.', 'err');
    correo = v;
    enviar(send);
  };

  const again = $('#lm-again');
  if (again) again.onclick = async () => {
    saving(again, true);
    await enviar(null);
    saving(again, false);
  };

  const ver = $('#lm-ver');
  if (ver) ver.onclick = async () => {
    const cod = String(($('#lm-code') || {}).value || '').replace(/\D/g, '');
    if (cod.length !== 6) return toast('El código es de 6 dígitos', 'err');
    saving(ver, true);
    try {
      const r = await api('pub.liderCodigoVerificar', {}, 'POST', { documento: user.documento, codigo: cod });
      saving(ver, false);
      if (!r.ok) {
        if (r.bloqueado) { stop(); closeLayer(); return liderBloqueado(user, r.segundos); }
        return toast(r.msg || 'Código incorrecto', 'err');
      }
      stop(); closeLayer();
      if (LIDER) LIDER.correo = r.correo || correo;
      if (modo === 'cambiar') { toast('Correo actualizado', 'ok'); return liderPanel(user); }
      toast('Correo activado', 'ok');
      // Activación: sigue el cambio de contraseña, con la actual precargada.
      liderActualizarClave(user, { precargar: true });
    } catch (e) { saving(ver, false); toast('Error de conexión', 'err'); }
  };

  const code = $('#lm-code');
  if (code) code.addEventListener('keydown', e => { if (e.key === 'Enter') ver.click(); });

  if (modo === 'cambiar') irPaso2(cfg.destino, cfg.segundos);
}

/* Primera vez: el líder no tiene contraseña → la crea */
function liderCrearClave(user) {
  app.innerHTML = `${backbar('Crea tu contraseña')}<div class="pad stack">
    <div class="card pad stack">
      <p class="muted">Eres líder pero aún no tienes contraseña. Créala para administrar tus referidos.</p>
      ${passField('lc-1', 'Nueva contraseña', 'Mínimo 4 caracteres')}
      ${passField('lc-2', 'Repite la contraseña', 'Vuelve a escribirla')}
      <button class="btn btn-primary btn-block" id="lc-save">Crear y entrar</button>
    </div>
  </div>`;
  app.hidden = false; hideSplash(); $('#backbtn').onclick = () => go('home'); bindPassEyes();
  $('#lc-save').onclick = async () => {
    const a = val('lc-1'), b = val('lc-2');
    if (a.length < 4) return toast('Mínimo 4 caracteres', 'err');
    if (a !== b) return toast('Las contraseñas no coinciden', 'err');
    const btn = $('#lc-save'); saving(btn, true);
    try {
      const r = await api('pub.liderCrearClave', {}, 'POST', { documento: user.documento, clave: a });
      if (!r.ok) { toast(r.msg || 'No se pudo crear', 'err'); saving(btn, false); return; }
      // entrar con la clave recién creada
      const e2 = await api('pub.liderEntrar', {}, 'POST', { documento: user.documento, clave: a });
      saving(btn, false);
      if (!e2.ok) return toast(e2.msg || 'Creada, vuelve a entrar', 'err');
      LIDER = { codigo: e2.lider.codigo, nombre: e2.lider.nombre, documento: user.documento, correo: e2.lider.correo || '', opciones: e2.opciones };
      toast('¡Contraseña creada!', 'ok'); liderPanel(user);
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* Panel principal del líder: menú de sub-secciones */
async function liderPanel(user) {
  let esProf = false;
  try { const pr = await api('pub.esProfesional', { documento: user.documento }); esProf = !!(pr && pr.esProfesional); } catch {}
  const items = [
    { id: 'l-referidos',   icon: 'user',  t: 'Mis referidos',        d: 'Referidos, asistencia e intención' },
    { id: 'l-compromisos', icon: 'idea',  t: 'Mis compromisos',      d: 'Lo que has asumido' },
    { id: 'l-solicitudes', icon: 'pencil', t: 'Mis solicitudes',     d: 'Lo que te han solicitado' },
    { id: 'l-clave',       icon: 'card',  t: 'Actualizar contraseña',d: 'Cambia tu clave · actualiza tu correo' }
  ];
  // "Mis servicios" (panel del profesional) solo para quien esté en PROFESIONALES
  if (esProf) items.splice(3, 0, { id: 'l-servicios', icon: 'help', t: 'Mis servicios', d: 'Solicitudes que atiendes' });

  app.innerHTML = `${backbar('Zona de líderes')}<div class="pad stack">
    <div><p class="eyebrow">Líder</p><h1 class="h1">${esc(primerNombre(LIDER.nombre))} 🤝🏾</h1>
      <span class="plan-badge premium">N° de Referido: ${esc(LIDER.codigo)}</span></div>
    <div class="menu-grid">${items.map(m => `<button class="tile" data-id="${m.id}"><span class="ico">${I[m.icon]}</span><span class="txt"><b>${esc(m.t)}</b><br><span>${esc(m.d)}</span></span></button>`).join('')}</div>
  </div>`;
  app.hidden = false; hideSplash(); appWide(false); $('#backbtn').onclick = () => go('home');
  app.querySelectorAll('.tile').forEach(t => t.onclick = () => {
    const id = t.dataset.id;
    if (id === 'l-referidos')   return liderReferidos(user);
    if (id === 'l-servicios')   return liderServicios(user);
    if (id === 'l-compromisos') return liderCompromisos(user);
    if (id === 'l-solicitudes') return liderSolicitudes(user);
    if (id === 'l-clave')       return liderActualizarClave(user);
  });
}

/* ---- MIS REFERIDOS (tarjetas con Asistencia/Intención/Editar) ---- */
async function liderReferidos(user) {
  app.innerHTML = `${backLider('Mis referidos')}<div class="pad stack" id="lr-body">${loadingBox('Cargando tus referidos…')}</div>`;
  app.hidden = false; hideSplash(); bindBackLider(user); appWide(true);
  ensureConfig();   // ajuste 20/07: plantilla del botón Conectar
  try {
    const r = await api('pub.liderReferidos', { documento: user.documento });
    if (!r.ok) { $('#lr-body').innerHTML = `<div class="card pad center muted">${esc(r.msg || 'No se pudo cargar')}</div>`; return; }
    LIDER.opciones = r.opciones;
    lrPintar(user, r.referidos);
    lrVivoStart(user);          // 22/07: la vista queda EN VIVO
  } catch (e) { $('#lr-body').innerHTML = `<div class="card pad center muted">Error de conexión</div>`; }
}

/* Pinta la vista con lo que haya (con referidos o vacía) y guarda la firma
   que usa el refresco en silencio para no repintar cuando nada cambió.
   Se sacó de liderReferidos porque el vivo también necesita el caso vacío:
   si te ceden un registro y no tenías ninguno, la lista aparece sola. */
function lrPintar(user, referidos) {
  LRV.sig = lrFirma(referidos);
  if (!referidos.length) {
    $('#lr-body').innerHTML = `<div class="card pad center"><p class="muted">Aún no tienes referidos. Usa <b>Nuevo referido</b> para sumar a los tuyos.</p><button class="btn btn-primary btn-block" id="lr-nuevo" style="margin-top:12px;">+ Nuevo referido</button></div>`;
    $('#lr-body').insertAdjacentHTML('beforeend', lrMemoriaBtn());   // 01/08: sin referidos hoy, pero puede tener meses cerrados
    $('#lr-nuevo').onclick = () => liderNuevoReferido(user);
    { const bm = $('#lr-memoria'); if (bm) bm.onclick = () => liderMemoria(user); }
    return;
  }
  pintarReferidos(user, referidos);
}

/* ============================================================
   FIDELIZACIÓN DEL MES (26/07) — la MISMA barra que las tarjetas de la
   vista Líderes en la app privada, aquí para el líder que entró.

   Por qué se calcula en el front y no se pide al CORE: 'pub.liderReferidos'
   ya devuelve exactamente las mismas filas que cuenta la privada (mismo
   código de líder en REFERENCIA y descartando ESTADO=INACTIVO) y trae la
   INTENCION de cada una. La fórmula del CORE (ld_statsMap_) es "cuenta como
   trabajado CUALQUIER valor en INTENCION", así que sale el mismo número sin
   una sola llamada extra… y sale EN VIVO gratis: se recalcula al marcar una
   intención y en cada refresco silencioso, que es cuando la lista cambia.

   La barra cuenta SIEMPRE el total del líder, no lo que quede tras buscar.
   ============================================================ */
let LR_REFS = [];   // la lista tal cual está pintada (los mismos objetos que las tarjetas)

function lrTrabColor(p) { return p >= 80 ? 'ld-verde' : p >= 40 ? 'ld-azul' : 'ld-rojo'; }

function lrFidHtml(list) {
  const ref  = (list || []).length;
  if (!ref) return '';
  const trab = (list || []).filter(x => String(x.intencion || '').trim() !== '').length;
  const pct  = Math.round(trab * 100 / ref);
  const col  = lrTrabColor(pct);
  return `<div class="lr-fid" id="lr-bar">
    <span class="lr-fid-t">Fidelización del mes</span>
    <div class="ld-bar-lbl">
      <span><b>${ref.toLocaleString('es-CO')}</b> ref.</span>
      <span class="ld-trab ${col}"><b>${pct}%</b> trab.</span>
    </div>
    <div class="ld-bar" title="${trab.toLocaleString('es-CO')} de ${ref.toLocaleString('es-CO')} referidos con intención registrada">
      <div class="ld-bar-in ${col}" style="width:${Math.max(pct ? 2 : 0, pct)}%"></div>
    </div>
  </div>`;
}

/* Repinta solo la barra (sin tocar tarjetas ni buscador) tras marcar una
   intención. Si la vista ya no está en pantalla, no hace nada. */
function lrFidRefrescar() {
  const box = document.getElementById('lr-bar');
  if (!box) return;
  const html = lrFidHtml(LR_REFS);
  if (!html) return;
  box.outerHTML = html;
}

/* ============================================================
   MEMORIA MENSUAL DEL LÍDER (01/08/2026)
   ------------------------------------------------------------
   El 1 de cada mes el CORE cierra el mes: guarda el balance de cada líder,
   archiva las filas que traían dato y deja ASISTENCIA e INTENCION en blanco.
   Aquí el líder ve SU historia mes a mes (nunca la de otros: el CORE filtra
   por su código) y se la puede llevar en Excel o PDF.

   OJO con el detalle: el cierre solo archiva los referidos que ese mes
   quedaron con asistencia o intención. Por eso el listado del mes son "los
   que trabajaste", y el total de referidos y los no fidelizados se leen del
   resumen, no de contar filas.
   ============================================================ */
const LR_ICO_DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;vertical-align:-3px;"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>';

function lrMemoriaBtn() {
  return `<button class="btn btn-quiet btn-block" id="lr-memoria" style="margin-bottom:12px;">Memoria mensual</button>`;
}

/* base64 → archivo en el dispositivo (la pública no tenía descargas hasta hoy) */
function lrDescargar(base64, mime, filename) {
  try {
    const bin = atob(base64), len = bin.length, bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' }));
    const a = document.createElement('a'); a.href = url; a.download = filename || 'archivo';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch (e) { toast('No se pudo descargar el archivo', 'err'); return false; }
}

async function lrBajar(accion, mes, user, btn, etiqueta) {
  if (btn) saving(btn, true);
  try {
    const r = await api(accion, {}, 'POST', { documento: user.documento, mes });
    if (btn) saving(btn, false);
    if (!r.ok) return toast(r.msg || 'No se pudo generar', 'err');
    lrDescargar(r.base64, r.mime, r.filename);
    toast(etiqueta + ' generado', 'ok');
  } catch (e) { if (btn) saving(btn, false); toast('No se pudo generar el ' + etiqueta, 'err'); }
}

async function liderMemoria(user) {
  openSheet(`<div class="grip"></div><h2 class="h2">Memoria mensual</h2>${loadingBox('Cargando tus meses…')}`);
  try {
    const r = await api('pub.liderBalances', { documento: user.documento });
    if (!r.ok) { closeLayer(); return toast(r.msg || 'No se pudo cargar', 'err'); }
    const meses = r.meses || [];
    const lista = meses.length ? meses.map(m => `<article style="background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;margin-top:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <b style="font-family:var(--font-display);font-size:1.02rem;">${esc(m.mesTxt)}</b>
          <span class="ld-trab ${lrTrabColor(m.pct)}"><b>${m.pct}%</b> trab.</span>
        </div>
        <div class="small muted" style="margin-top:3px;">${Number(m.ref).toLocaleString('es-CO')} referidos · ${Number(m.trab).toLocaleString('es-CO')} trabajados · ${Number(m.noFid).toLocaleString('es-CO')} sin intención</div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn btn-quiet" style="flex:1 1 0;min-width:0;" data-ver="${esc(m.mes)}">Ver</button>
          <button class="btn btn-quiet" style="flex:1 1 0;min-width:0;" data-pdf="${esc(m.mes)}">${LR_ICO_DL} PDF</button>
          <button class="btn btn-quiet" style="flex:1 1 0;min-width:0;" data-xlsx="${esc(m.mes)}">${LR_ICO_DL} Excel</button>
        </div>
      </article>`).join('')
      : `<p class="muted center" style="padding:22px 0;">${esc(r.aviso || 'Todavía no hay ningún mes cerrado.')}<br><span class="small">Cada primer día del mes se guarda el trabajo del mes anterior y aparece aquí.</span></p>`;
    openSheet(`<div class="grip"></div>
      <h2 class="h2" style="margin-bottom:4px;">Memoria mensual</h2>
      <p class="muted small">Tu trabajo con los referidos, mes a mes.</p>
      ${lista}`);
    layer.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => liderMemoriaVer(user, b.dataset.ver));
    layer.querySelectorAll('[data-pdf]').forEach(b => b.onclick = () => lrBajar('pub.liderBalancePdf', b.dataset.pdf, user, b, 'PDF'));
    layer.querySelectorAll('[data-xlsx]').forEach(b => b.onclick = () => lrBajar('pub.liderBalanceXlsx', b.dataset.xlsx, user, b, 'Excel'));
  } catch (e) { closeLayer(); toast('Error de conexión', 'err'); }
}

async function liderMemoriaVer(user, mes) {
  openSheet(`<div class="grip"></div><h2 class="h2">Tu mes</h2>${loadingBox('Cargando…')}`, 'sheet-xl');
  try {
    const r = await api('pub.liderBalanceVer', { documento: user.documento, mes });
    if (!r.ok) { closeLayer(); return toast(r.msg || 'No se pudo cargar', 'err'); }
    const s = r.resumen;
    const kpi = (n, l) => `<div style="flex:1 1 0;min-width:0;text-align:center;background:var(--brand-050);border-radius:12px;padding:10px 6px;">
        <div style="font-family:var(--font-display);font-weight:700;font-size:1.15rem;">${n}</div>
        <div class="small muted" style="line-height:1.2;">${l}</div></div>`;
    const filas = r.detalle.length ? r.detalle.map((x, i) => `<tr>
        <td style="padding:7px 8px;border-bottom:1px solid var(--line);">${i + 1}</td>
        <td style="padding:7px 8px;border-bottom:1px solid var(--line);white-space:nowrap;">${esc(x.nombre)}</td>
        <td style="padding:7px 8px;border-bottom:1px solid var(--line);white-space:nowrap;">${esc(x.asistencia || '—')}</td>
        <td style="padding:7px 8px;border-bottom:1px solid var(--line);white-space:nowrap;">${esc(x.intencion || '—')}</td>
      </tr>`).join('')
      : `<tr><td colspan="4" class="muted small" style="padding:12px 8px;">Ese mes no quedó ningún referido con asistencia o intención registrada.</td></tr>`;
    openSheet(`<div class="grip"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <h2 class="h2">${esc(r.mesTxt)}</h2>
        <span class="ld-trab ${lrTrabColor(s.pct)}"><b>${s.pct}%</b> trab.</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        ${kpi(Number(s.ref).toLocaleString('es-CO'), 'Referidos')}
        ${kpi(Number(s.trab).toLocaleString('es-CO'), 'Trabajados')}
        ${kpi(Number(s.firme).toLocaleString('es-CO'), 'Firmes')}
        ${kpi(Number(s.noFid).toLocaleString('es-CO'), 'Sin intención')}
      </div>
      <p class="small muted" style="margin-top:10px;">Abajo salen los referidos que ese mes quedaron con asistencia o intención registrada.</p>
      <div class="lm-tabla">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr><th style="text-align:left;padding:7px 8px;">#</th>
              <th style="text-align:left;padding:7px 8px;">Nombre</th>
              <th style="text-align:left;padding:7px 8px;">Asistencia</th>
              <th style="text-align:left;padding:7px 8px;">Intención</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;">
        <button class="btn btn-primary" id="lm-pdf" style="flex:1 1 0;min-width:0;">${LR_ICO_DL} PDF</button>
        <button class="btn btn-ghost" id="lm-xlsx" style="flex:1 1 0;min-width:0;">${LR_ICO_DL} Excel</button>
      </div>
      <button class="btn btn-quiet btn-block" id="lm-volver" style="margin-top:8px;">Volver a los meses</button>`, 'sheet-xl');
    $('#lm-pdf').onclick = () => lrBajar('pub.liderBalancePdf', r.mes, user, $('#lm-pdf'), 'PDF');
    $('#lm-xlsx').onclick = () => lrBajar('pub.liderBalanceXlsx', r.mes, user, $('#lm-xlsx'), 'Excel');
    $('#lm-volver').onclick = () => liderMemoria(user);
  } catch (e) { closeLayer(); toast('Error de conexión', 'err'); }
}

function pintarReferidos(user, referidos) {
  LR_REFS = referidos || [];
  const header = `<div class="lr-head">
    <div class="lr-search"><input class="input" id="lr-q" placeholder="Buscar por nombre o documento…" autocomplete="off" /></div>
    <button class="btn btn-primary" id="lr-nuevo" style="white-space:nowrap;">+ Nuevo referido</button>
  </div>`;
  const contador = lrFidHtml(referidos);
  const cards = referidos.map(rf => referidoCard(rf)).join('');
  $('#lr-body').innerHTML = `${header}${contador}${lrMemoriaBtn()}<div class="ref-grid" id="lr-list">${cards}</div>`;
  $('#lr-nuevo').onclick = () => liderNuevoReferido(user);
  { const bm = $('#lr-memoria'); if (bm) bm.onclick = () => liderMemoria(user); }   // 01/08
  $('#lr-q').addEventListener('input', e => {
    const q = norm(e.target.value);
    $$('#lr-list .rcard').forEach(c => { const hay = norm(c.dataset.search).includes(q); c.style.display = hay ? '' : 'none'; });
  });
  $$('#lr-list .rcard').forEach(card => {
    const doc = card.dataset.doc;
    const rf = referidos.find(x => x.documento === doc);
    card.querySelector('[data-act="asis"]').onclick = () => selectorMarcar(user, rf, 'ASISTENCIA', card);
    card.querySelector('[data-act="inten"]').onclick = () => selectorMarcar(user, rf, 'INTENCION', card);
    card.querySelector('[data-act="edit"]').onclick = () => liderEditarReferido(user, rf, () => liderReferidos(user));
    const con = card.querySelector('[data-act="conectar"]'); if (con) con.onclick = () => window.open('https://wa.me/57' + onlyDig(rf.contacto) + '?text=' + encodeURIComponent(msgConectar(rf)), '_blank');
    const ced = card.querySelector('[data-act="ceder"]'); if (ced) ced.onclick = () => liderCeder(user, rf);   // 22/07
    const wa = card.querySelector('[data-act="wa"]'); if (wa) wa.onclick = () => window.open('https://wa.me/57' + onlyDig(rf.contacto), '_blank');
    const tel = card.querySelector('[data-act="tel"]'); if (tel) tel.onclick = () => window.open('tel:' + onlyDig(rf.contacto), '_self');
    const fto = card.querySelector('[data-act="foto"]'); if (fto) fto.onclick = () => zoomImagen(refFoto(rf));   // 25/07
  });
}

function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

/* 25/07 · Color por estado de la columna MUNICIPIO (H). Son los MISMOS cinco
   grupos y los mismos colores que la app privada (bdColor / .bd-mun):
     FLANDES · SIN CONSULTAR · A LA ESPERA · POR CONFIRMAR · otro municipio.
   Se usa para el borde de la tarjeta y para la pastilla del municipio. */
function muniClase(m) {
  const v = String(m || '').trim().toUpperCase();
  if (MV.esMunicipio(v)) return 'muni-flandes';
  if (v === 'SIN CONSULTAR') return 'muni-sin';
  if (v === 'A LA ESPERA') return 'muni-espera';
  if (v === 'POR CONFIRMAR') return 'muni-confirmar';
  return v ? 'muni-otro' : '';
}

/* Ajuste 20/07: asegura que APP_CONFIG (plantillas/enlaces) esté cargado antes
   de usar el botón Conectar o el aviso de Líder Principal. */
async function ensureConfig() {
  if (APP_CONFIG && APP_CONFIG.conectar) return APP_CONFIG;
  try { const c = await api('pub.config'); if (c) { APP_CONFIG = c; if (c.comercioUrl) COMERCIO_URL = c.comercioUrl; } } catch {}
  return APP_CONFIG;
}

/* Mensaje del botón "Conectar": plantilla editable (pub.config) con respaldo.
   Variables: {pn_referido} {pn_candidato} {APP_PUBLICA_URL} {documento}. */
const CONECTAR_FALLBACK = 'Hola *{pn_referido}*\nTe comparto la App de *{pn_candidato}* \nInstala a través de este enlace: {APP_PUBLICA_URL}\nInicia sesión con tu CC: {documento} y toca el botón *Ponte al día*\n> Ante cualquier duda, no dudes en preguntarme.';
function msgConectar(rf) {
  const c = APP_CONFIG || {};
  const tpl = c.conectar || CONECTAR_FALLBACK;
  return String(tpl)
    .replace(/\{pn_referido\}/g, primerNombre(rf.nombre || ''))
    .replace(/\{pn_candidato\}/g, c.pnCandidato || MV.pnCandidato)
    .replace(/\{APP_PUBLICA_URL\}/g, c.appPublicaUrl || 'https://botheart911.github.io/JHONNY-PERDOMO/')
    .replace(/\{documento\}/g, rf.documento || '');
}

/* 25/07 · Foto del referido: la que tenga en PRINCIPAL (columna FOTO). Si no
   tiene (o guarda la de por defecto), se muestra la imagen de usuario por
   defecto del proyecto (FOTO_DEFAULT) y esa NO se amplía: no hay nada que ver. */
function refFoto(rf) {
  const f = String(rf.foto || '').trim();
  /* 30/07/2026 · se reconocen la silueta de HOY y la del hosting anterior:
     las filas guardadas hace meses siguen trayendo la URL vieja y tienen que
     seguir contando como "sin foto". Las marcas se suman, no se sustituyen. */
  const s = String(f || '').toLowerCase();
  const esDefault = !f || f === FOTO_DEFAULT ||
    ['user_zefosv', 'marca/user.png', 'data:image/svg+xml'].some(m => s.indexOf(m) !== -1);
  return esDefault ? '' : f;
}

/* 05/08/2026 · la marca se puede QUITAR, así que vacío ya NO se dibuja como
   "No contactado" (que es un valor de verdad, elegido a mano): vacío es
   "Sin marcar". Las dos pastillas se arman en un solo sitio porque también
   se repintan al marcar/desmarcar. */
function refBadgesHtml(rf) {
  const a = String(rf.asistencia || '').trim();
  const i = String(rf.intencion || '').trim();
  return `<span class="rc-badge ${badgeAsis(a)}">🏷 ${esc(a || 'Sin marcar')}</span>` +
         `<span class="rc-badge ${badgeInten(i)}">🗳 ${esc(i || 'Sin marcar')}</span>`;
}
function referidoCard(rf) {
  const lugar = String(rf.residencia || '').trim();   // 25/07: el municipio pasa a su pastilla
  const movil = esMovil();
  const foto = refFoto(rf);
  const mun = String(rf.municipio || '').trim();
  const av = foto
    ? `<button class="rc-av has-photo" data-act="foto" title="Ver la foto" aria-label="Ver la foto"><img src="${esc(foto)}" alt="" onerror="this.onerror=null;this.src='${esc(FOTO_DEFAULT)}';this.closest('.rc-av').classList.remove('has-photo');this.closest('.rc-av').removeAttribute('data-act');" /></button>`
    : `<div class="rc-av"><img src="${esc(FOTO_DEFAULT)}" alt="" /></div>`;
  return `<div class="rcard ${muniClase(rf.municipio)}" data-doc="${esc(rf.documento)}" data-search="${esc(rf.nombre + ' ' + rf.documento)}">
    <div class="rcard-top">
      ${av}
      <div class="rc-id"><b>${esc(rf.nombre)}</b><span>CC ${esc(rf.documento)}${lugar ? ' · ' + esc(lugar) : ''}</span></div>
    </div>
    <div class="rc-badges">${refBadgesHtml(rf)}</div>
    <div class="rc-actions">
      <button class="rc-btn" data-act="asis">🏷 Asistencia</button>
      <button class="rc-btn" data-act="inten">🗳 Intención</button>
      <button class="rc-btn" data-act="edit">✏️ Editar</button>
      <div class="rc-line">
        ${rf.contacto ? `<button class="rc-btn conectar" data-act="conectar" title="Conectar">${I.link} Conectar</button>` : ''}
        <button class="rc-btn ceder" data-act="ceder" title="Ceder a otro líder">${I.swap} Ceder</button>
      </div>
      ${rf.contacto ? `<button class="rc-btn wa" data-act="wa" title="WhatsApp">${I.wa}</button>` : ''}
      ${rf.contacto && movil ? `<button class="rc-btn tel" data-act="tel" title="Llamar">${I.phone}</button>` : ''}
      <span class="rc-mun ${muniClase(mun)}">${esc(mun || 'Sin consultar')}</span>
    </div>
  </div>`;
}
function badgeAsis(v) { if (MV.esFuera(v)) return 'warn'; const m = { 'Confirmada': 'ok', 'No puede': 'no', 'No filial': 'no', 'No contactado': 'mut' }; return m[v] || 'mut'; }
function badgeInten(v) { const m = { 'Firme con el voto': 'ok', 'No vota con nosotros': 'no', 'No está seguro(a)': 'warn', 'No sabe votar': 'warn', 'No contactado': 'mut' }; return m[v] || 'mut'; }

/* Selector dinámico (hoja inferior) para marcar Asistencia/Intención */
function selectorMarcar(user, rf, campo, card) {
  const opts = campo === 'ASISTENCIA' ? (LIDER.opciones.asistencia) : (LIDER.opciones.intencion);
  const titulo = campo === 'ASISTENCIA' ? '🏷 Asistencia' : '🗳 Intención';
  const actual = String((campo === 'ASISTENCIA' ? rf.asistencia : rf.intencion) || '').trim();
  /* 05/08: se puede DESMARCAR. Dos caminos para lo mismo, porque los dos son
     naturales: volver a tocar la opción que ya está elegida, o el botón de
     abajo. Al quitarla, la casilla de PRINCIPAL queda vacía. */
  const quitar = actual
    ? `<button class="btn btn-quiet btn-block" id="mk-quitar" style="margin-top:10px;">✕ Quitar ${campo === 'ASISTENCIA' ? 'la asistencia' : 'la intención'}</button>`
    : '';
  openSheet(`<div class="grip"></div><h2 class="h2" style="margin-bottom:4px;">${titulo}</h2><p class="muted" style="margin-bottom:12px;">${esc(rf.nombre)}</p>
    <div class="stack">${opts.map(o => `<button class="opt-row ${norm(o) === norm(actual) ? 'sel' : ''}" data-val="${esc(o)}">${esc(o)}${norm(o) === norm(actual) ? ' ✓ (toca para quitar)' : ''}</button>`).join('')}</div>${quitar}`);

  const guardar = async (valor) => {
    closeLayer();
    try {
      const r = await api('pub.liderMarcar', {}, 'POST', { documento: user.documento, refDoc: rf.documento, campo, valor });
      if (!r.ok) return toast(r.msg || 'No se pudo guardar', 'err');
      // actualizar en memoria y repintar solo el badge de esta tarjeta
      if (campo === 'ASISTENCIA') rf.asistencia = valor; else rf.intencion = valor;
      const badges = card.querySelector('.rc-badges');
      if (badges) badges.innerHTML = refBadgesHtml(rf);
      if (campo === 'INTENCION') lrFidRefrescar();   // 26/07: la barra se mueve al instante
      toast(valor ? 'Actualizado' : 'Marca quitada', 'ok');
    } catch (e) { toast('Error de conexión', 'err'); }
  };

  layer.querySelectorAll('.opt-row').forEach(b => b.onclick = () => {
    const valor = b.dataset.val;
    guardar(norm(valor) === norm(actual) ? '' : valor);   // re-toque = quitar
  });
  const q = $('#mk-quitar'); if (q) q.onclick = () => guardar('');
}

/* Editar nombre, contacto y residencia de un referido
   22/07/2026 — se sumó el NOMBRE. Se manda en mayúscula (es como está toda
   la columna B de PRINCIPAL) y el documento NO se toca: es la llave de la
   fila. Si esa persona además es líder, su nombre en la hoja LIDERES no
   cambia (así lo pediste). */
function liderEditarReferido(user, rf, onDone) {
  openSheet(`<div class="grip"></div><h2 class="h2" style="margin-bottom:10px;">Editar referido</h2>
    <p class="muted" style="margin-bottom:12px;">CC ${esc(rf.documento)}</p>
    <div class="stack">
      ${field('Nombre completo', inputEl('er-nom', ''))}
      ${field('WhatsApp', inputEl('er-tel', 'inputmode="numeric" maxlength="10"'))}
      ${field('Residencia', comboboxHtml('er-resi', 'Escribe para buscar'))}
      <button class="btn btn-primary btn-block" id="er-save">Guardar</button>
      <button class="btn btn-quiet btn-block" data-close>Cancelar</button>
    </div>`);
  $('#er-nom').value = rf.nombre || ''; onlyLetters($('#er-nom'));
  $('#er-tel').value = onlyDig(rf.contacto); onlyDigits($('#er-tel'));
  $('#er-resi').value = rf.residencia || '';
  getResidencias().then(l => bindCombobox('er-resi', l)).catch(() => {});
  $('#er-save').onclick = async () => {
    const nom = val('er-nom').trim().replace(/\s+/g, ' ');
    const tel = onlyDig(val('er-tel')), resi = val('er-resi');
    if (!nom || nom.length < 3) return toast('Escribe el nombre completo', 'err');
    if (tel && !/^\d{10}$/.test(tel)) return toast('El WhatsApp debe tener 10 dígitos', 'err');
    const btn = $('#er-save'); saving(btn, true);
    try {
      const r = await api('pub.liderEditarRef', {}, 'POST', { documento: user.documento, refDoc: rf.documento, nombre: nom, contacto: tel, residencia: resi });
      saving(btn, false);
      if (!r.ok) return toast(r.msg || 'No se pudo guardar', 'err');
      closeLayer(); toast('Referido actualizado', 'ok'); if (onDone) onDone();
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* ============================================================
   CEDER UN REFERIDO A OTRO LÍDER  (22/07/2026)
   ------------------------------------------------------------
   Mismo patrón del modal "Reasignar" de la app privada: se escribe y la
   lista se va filtrando; al elegir y confirmar, el registro pasa al otro
   líder (col E = su código, col F = su nombre) y la vista se refresca.
   La lista se pide UNA vez por sesión (95 líderes, no cambia mientras
   estás en la vista).
   ============================================================ */
/* La caché va amarrada al documento del líder: en este teléfono pueden
   entrar varias personas (Cambiar de cuenta), y la lista de cada quien se
   arma SIN él mismo. */
let _lideresCache = null;
async function getLideresLista(user) {
  if (_lideresCache && _lideresCache.doc === user.documento) return _lideresCache.lista;
  const r = await api('pub.lideresLista', { documento: user.documento });
  if (!r || !r.ok) throw new Error((r && r.msg) || 'No se pudo cargar');
  _lideresCache = { doc: user.documento, lista: r.lideres || [] };
  return _lideresCache.lista;
}
const cdLabel = (l) => 'N° ' + l.codigo + ' · ' + l.nombre;

function liderCeder(user, rf, preset) {
  openSheet(`<div class="grip"></div><h2 class="h2" style="margin-bottom:4px;">Ceder referido</h2>
    <p class="muted" style="margin-bottom:12px;">${esc(rf.nombre)} · CC ${esc(rf.documento)}</p>
    <div class="stack">
      ${field('Nuevo líder', comboboxHtml('cd-lid', 'Escribe el nombre o el N° del líder'))}
      <p class="small" style="color:#B7791F;margin:-4px 0 0;">Al ceder, esta persona sale de tu lista y pasa al grupo del líder que elijas. Desde la app no la puedes recuperar.</p>
      <button class="btn btn-primary btn-block" id="cd-save">Ceder</button>
      <button class="btn btn-quiet btn-block" data-close>Cancelar</button>
    </div>`);
  const inp = $('#cd-lid');
  inp.value = preset || '';
  inp.disabled = true;
  inp.placeholder = 'Cargando líderes…';
  let mapa = {};
  getLideresLista(user).then(lista => {
    if (!$('#cd-lid')) return;           // cerró el modal mientras cargaba
    const labels = (lista || []).map(l => { const et = cdLabel(l); mapa[et] = String(l.codigo); return et; });
    bindCombobox('cd-lid', labels);
    $('#cd-lid').disabled = false;
    $('#cd-lid').placeholder = 'Escribe el nombre o el N° del líder';
  }).catch(() => { toast('No se pudo cargar la lista de líderes', 'err'); });

  $('#cd-save').onclick = async () => {
    const etiqueta = val('cd-lid').trim();
    const destino = mapa[etiqueta] || '';
    if (!destino) return toast('Elige un líder de la lista', 'err');
    const ok = await confirmar('Confirma la cesión',
      crow('Referido', rf.nombre) + crow('Documento', rf.documento) + crow('Nuevo líder', etiqueta));
    if (!ok) return liderCeder(user, rf, etiqueta);   // "Seguir editando": vuelve con lo elegido
    try {
      const r = await api('pub.liderCeder', {}, 'POST', { documento: user.documento, refDoc: rf.documento, destino: destino });
      if (!r.ok) return toast(r.msg || 'No se pudo ceder', 'err');
      toast('Cedido a ' + (r.lider || etiqueta), 'ok');
      liderReferidos(user);
    } catch (e) { toast('Error de conexión', 'err'); }
  };
}

/* ============================================================
   MIS REFERIDOS EN VIVO  (22/07/2026)
   ------------------------------------------------------------
   DOS CANALES, igual que "Ponte al día":
     A) Señal instantánea: /meta/bd_rev en el mismo RTDB. Ahí suena TODA
        escritura sobre la hoja PRINCIPAL (Vivo.gs), venga de donde venga.
     B) Respaldo por sondeo cada 20 s contra pub.rev, por si las reglas del
        RTDB no dejan leer desde el cliente. Solo trae sellos de tiempo.
   NO se reusa priv.rev: su guard exige estar en la hoja USUARIOS y un líder
   de la pública no está ahí.
   Como el canal 'bd' suena por cualquier registro del sistema (no solo por
   los míos), el refresco es en silencio y con FIRMA: se vuelve a pedir la
   lista, y si es idéntica a la que ya está pintada NO se repinta nada. Así
   no se pierden el buscador ni la posición de lectura.
   ============================================================ */
let LRV = { on: false, user: null, ref: null, cb: null, primer: true, t: null, poll: null, ts: 0, sig: '' };

function lrFirma(list) {
  return (list || []).map(x => [x.documento, x.nombre, x.contacto, x.residencia, x.municipio, x.asistencia, x.intencion].join('|')).join('~');
}

function lrVivoStop() {
  if (LRV.ref && LRV.cb) { try { LRV.ref.off('value', LRV.cb); } catch (e) {} }
  if (LRV.t) clearTimeout(LRV.t);
  if (LRV.poll) clearInterval(LRV.poll);
  LRV = { on: false, user: null, ref: null, cb: null, primer: true, t: null, poll: null, ts: 0, sig: '' };
  window.__lrTeardown = null;
}

/* ¿Sigue la vista en pantalla? Si el líder navegó a otro lado (atrás, otro
   tile, cerrar sesión), el vivo se apaga solo: no depende de que alguien
   se acuerde de llamarlo. */
function lrVivoVivo() {
  if (!LRV.on) return false;
  if (!document.getElementById('lr-body')) { lrVivoStop(); return false; }
  return true;
}

function lrVivoStart(user) {
  const firma = LRV.sig;          // la deja lrPintar justo antes: no se puede perder,
  lrVivoStop();                   // o el primer aviso repintaría de gratis
  LRV.on = true; LRV.user = user; LRV.primer = true; LRV.sig = firma;
  window.__lrTeardown = lrVivoStop;
  /* A) señal instantánea */
  ntLoadFirebase(false).then(fb => {
    if (!LRV.on) return;
    LRV.ref = fb.database().ref('meta/bd_rev');
    LRV.cb = LRV.ref.on('value', () => {
      if (LRV.primer) { LRV.primer = false; return; }   // el primer valor es el estado actual
      lrVivoTocar();
    }, () => {});
  }).catch(() => {});
  /* B) respaldo por sondeo */
  LRV.poll = setInterval(() => {
    if (!lrVivoVivo()) return;
    apiSilencio('pub.rev', { documento: user.documento })
      .then(r => {
        const ts = (r && r.bd && r.bd.ts) || 0;
        if (!LRV.ts) { LRV.ts = ts; return; }
        if (ts > LRV.ts) { LRV.ts = ts; lrVivoTocar(); }
      })
      .catch(() => {});
  }, 20000);
}

/* Amortiguador: si entran varias escrituras seguidas, una sola recarga. */
function lrVivoTocar() {
  if (!lrVivoVivo() || LRV.t) return;
  LRV.t = setTimeout(() => { LRV.t = null; lrVivoRefrescar(); }, 900);
}

async function lrVivoRefrescar() {
  if (!lrVivoVivo()) return;
  try {
    const r = await apiSilencio('pub.liderReferidos', { documento: LRV.user.documento });
    if (!r || !r.ok || !lrVivoVivo()) return;
    if (lrFirma(r.referidos) === LRV.sig) return;      // nada cambió para mi grupo
    if (r.opciones) LIDER.opciones = r.opciones;
    const q = ($('#lr-q') && $('#lr-q').value) || '';
    const y = window.scrollY;
    lrPintar(LRV.user, r.referidos);
    const bq = $('#lr-q');
    if (bq && q) { bq.value = q; bq.dispatchEvent(new Event('input')); }
    window.scrollTo(0, y);
  } catch (e) { /* sin conexión: el próximo aviso lo intenta de nuevo */ }
}

/* ---- NUEVO REFERIDO ---- */
function liderNuevoReferido(user) {
  app.innerHTML = `${backLider('Nuevo referido')}<div class="pad stack"><div class="card pad stack">
    <p class="muted">Escribe el documento. Verificaremos si ya está registrado antes de continuar.</p>
    ${field('Documento', inputEl('nr-doc', 'inputmode="numeric" maxlength="10" placeholder="Número de documento"'))}
    <button class="btn btn-primary btn-block" id="nr-check">Verificar documento</button>
    <div id="nr-next"></div>
  </div></div>`;
  app.hidden = false; hideSplash(); appWide(false);
  { const b = $('#backLiderBtn'); if (b) b.onclick = () => liderReferidos(user); } // atrás → Referidos
  onlyDigits($('#nr-doc'));
  $('#nr-doc').addEventListener('keydown', e => { if (e.key === 'Enter') $('#nr-check').click(); });
  $('#nr-check').onclick = async () => {
    const doc = onlyDig(val('nr-doc'));
    if (!/^\d{6,10}$/.test(doc)) return toast('Documento inválido (6 a 10 dígitos)', 'err');
    const btn = $('#nr-check'); saving(btn, true);
    try {
      const r = await api('pub.validarDoc', { documento: doc });
      saving(btn, false);
      if (r.existe) return nrExistente(user, doc, r);
      nrNuevo(user, doc);
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* El documento YA existe en PRINCIPAL → ofrecer sumarlo al grupo */
function nrExistente(user, doc, info) {
  const yaMio = String(info.referencia || '') && String(info.referencia) === String(LIDER.codigo);
  const box = $('#nr-next');
  box.innerHTML = `
    <div class="nr-found">
      <div class="rcard-top"><div class="rc-av">${esc(iniciales(info.nombre))}</div><div class="rc-id"><b>${esc(info.nombre)}</b><span>CC ${esc(info.documento)}${info.residencia ? ' · ' + esc(info.residencia) : ''}</span></div></div>
      ${yaMio
        ? `<p class="small" style="color:#1B7F4B;margin:10px 0 0;">✅ Esta persona ya está en tu grupo.</p>`
        : (info.referencia
            ? `<p class="small" style="color:#B7791F;margin:10px 0 0;">Ya pertenece a otro líder (N° ${esc(info.referencia)}${info.lider ? ' · ' + esc(info.lider) : ''}). No puedes reasignarla.</p>`
            : `<p class="small muted" style="margin:10px 0 0;">Esta persona ya está registrada pero sin líder. ¿Sumarla a tu grupo?</p>
               <button class="btn btn-primary btn-block" id="nr-asignar" style="margin-top:10px;">Sumar a mi grupo</button>`)}
    </div>`;
  const asg = $('#nr-asignar');
  if (asg) asg.onclick = async () => {
    saving(asg, true);
    try {
      const r = await api('pub.liderAsignar', {}, 'POST', { documento: user.documento, refDoc: doc });
      saving(asg, false);
      if (!r.ok) return toast(r.msg || 'No se pudo asignar', 'err');
      toast('¡Sumado a tu grupo!', 'ok'); liderReferidos(user);
    } catch (e) { toast('Error de conexión', 'err'); saving(asg, false); }
  };
}

/* El documento NO existe → mostrar el resto de campos para crearlo */
function nrNuevo(user, doc) {
  const box = $('#nr-next');
  box.innerHTML = `
    <p class="small muted" style="margin:8px 0 0;">No está registrado. Completa sus datos para crearlo en tu grupo:</p>
    ${field('Nombre completo', inputEl('nr-nombre', ''))}
    ${field('WhatsApp', inputEl('nr-tel', 'inputmode="numeric" maxlength="10"'))}
    ${field('Residencia', comboboxHtml('nr-resi', 'Escribe para buscar'))}
    <label class="check-row" style="margin-top:2px;"><input type="checkbox" id="nr-principal" /> <span>Líder Principal</span></label>
    <div id="nr-principal-aviso" class="small" style="display:none;color:#B7791F;margin-top:-4px;"></div>
    <button class="btn btn-primary btn-block" id="nr-save" style="margin-top:8px;">Registrar referido</button>`;
  onlyLetters($('#nr-nombre')); onlyDigits($('#nr-tel'));
  getResidencias().then(l => bindCombobox('nr-resi', l)).catch(() => {});
  ensureConfig().then(() => {
    const chk = $('#nr-principal'), av = $('#nr-principal-aviso'); if (!chk) return;
    chk.onchange = () => {
      if (!chk.checked) { av.style.display = 'none'; return; }
      const lp = (APP_CONFIG && APP_CONFIG.liderPrincipal) || null;
      av.textContent = lp ? ('Se guardará bajo el Líder Principal (N° 1: ' + lp.nombre + '), no en tu grupo.')
                          : 'Se guardará bajo el Líder Principal (N° 1), no en tu grupo.';
      av.style.display = 'block';
    };
  });
  $('#nr-save').onclick = async () => {
    const principal = !!($('#nr-principal') && $('#nr-principal').checked);
    const body = { documento: user.documento, refDoc: doc, nombre: val('nr-nombre'), contacto: onlyDig(val('nr-tel')), residencia: val('nr-resi'), principal: principal };
    if (!body.nombre) return toast('Escribe el nombre', 'err');
    if (!/^\d{10}$/.test(body.contacto)) return toast('El WhatsApp debe tener 10 dígitos', 'err');
    if (!body.residencia) return toast('Selecciona la residencia', 'err');
    const lp = (APP_CONFIG && APP_CONFIG.liderPrincipal) || null;
    const filaLider = principal ? crow('Se guarda a', 'Líder Principal · N° 1' + (lp ? ' (' + lp.nombre + ')' : '')) : '';
    const ok = await confirmar('Confirma el nuevo referido', crow('Nombre', body.nombre) + crow('Documento', doc) + crow('WhatsApp', body.contacto) + crow('Residencia', body.residencia) + filaLider); if (!ok) return;
    const btn = $('#nr-save'); saving(btn, true);
    try {
      const r = await api('pub.liderNuevoRef', {}, 'POST', body);
      saving(btn, false);
      if (!r.ok) return toast(r.msg || 'No se pudo registrar', 'err');
      toast('¡Referido registrado!', 'ok'); liderReferidos(user);
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* ---- MIS SERVICIOS ---- */
let MS = { data: null, estado: 'TODAS', texto: '' };
async function liderServicios(user) {
  app.innerHTML = `${backLider('Mis servicios')}<div class="pad stack" id="ls-body">${loadingBox('Cargando…')}</div>`;
  app.hidden = false; hideSplash(); bindBackLider(user); appWide(true);
  try {
    const r = await api('pub.liderServicios', { documento: user.documento });
    if (!r.ok) { $('#ls-body').innerHTML = `<div class="card pad center"><div style="font-size:2.4rem;margin-bottom:6px;">💼</div><p class="muted">${esc(r.msg || 'No se pudo cargar')}</p></div>`; return; }
    MS = { data: r, estado: 'TODAS', texto: '' };
    pintarMisServicios(user);
  } catch (e) { $('#ls-body').innerHTML = `<div class="card pad center muted">Error de conexión</div>`; }
}

function msEstadoClase(e) { const v = String(e || '').toUpperCase(); return ({ INGRESADA: 'ing', PENDIENTE: 'pen', SEGUIMIENTO: 'seg', ATENDIDA: 'ate', RECURRENTE: 'rec' })[v] || 'mut'; }

function pintarMisServicios(user) {
  const r = MS.data;
  const counts = { INGRESADA: 0, PENDIENTE: 0, SEGUIMIENTO: 0, ATENDIDA: 0, RECURRENTE: 0 };
  r.servicios.forEach(s => { if (counts[s.estado] !== undefined) counts[s.estado]++; });
  const kpiDefs = [['INGRESADA', '📥'], ['PENDIENTE', '⏳'], ['SEGUIMIENTO', '🔄'], ['ATENDIDA', '✅'], ['RECURRENTE', '🔁']];
  const kpis = kpiDefs.map(([k, ic]) => `<div class="ms-kpi kpi-${msEstadoClase(k)}"><div class="ms-kpi-ic">${ic}</div><div class="ms-kpi-n">${counts[k]}</div><div class="ms-kpi-l">${k.charAt(0) + k.slice(1).toLowerCase()}</div></div>`).join('');
  const chips = ['TODAS'].concat(r.estados).map(e => `<button class="ms-chip ${MS.estado === e ? 'active' : ''}" data-est="${e}">${e}</button>`).join('');

  // filtrar
  const q = norm(MS.texto);
  const filtradas = r.servicios.filter(s => (MS.estado === 'TODAS' || s.estado === MS.estado) && (!q || norm(s.nombre + ' ' + s.documento + ' ' + s.residencia + ' ' + s.solicitud).includes(q)));

  $('#ls-body').innerHTML = `
    <div><p class="eyebrow">Profesional</p><h1 class="h1" style="font-size:1.3rem;">${esc(r.profesional.nombre)}</h1><span class="plan-badge premium">${esc(r.profesional.servicio)}</span></div>
    <div class="ms-actions"><button class="btn btn-primary" id="ms-add-serv">+ Agregar servicio</button><button class="btn btn-ghost" id="ms-add-sol">+ Agregar solicitud</button><button class="btn btn-quiet" id="ms-export">${LR_ICO_DL} Exportar Excel</button></div>
    <div class="ms-kpis">${kpis}</div>
    <div class="ms-chips">${chips}</div>
    <div class="ms-toolbar"><span class="ms-count">TOTAL: <b>${filtradas.length}</b></span><input class="input ms-filter" id="ms-q" placeholder="Filtrar por nombre, documento, solicitud…" value="${esc(MS.texto)}" /></div>
    <div class="ref-grid" id="ms-list">${filtradas.map(s => msCard(s)).join('') || `<div class="card pad center muted">Sin solicitudes en este filtro.</div>`}</div>`;

  $('#ms-add-serv').onclick = () => msFormServicio(user);
  $('#ms-add-sol').onclick = () => msFormSolicitud(user);
  $('#ms-export').onclick = () => msExportar(user);
  $$('.ms-chip').forEach(c => c.onclick = () => { MS.estado = c.dataset.est; pintarMisServicios(user); });
  const qi = $('#ms-q'); qi.oninput = e => { MS.texto = e.target.value; const list = $('#ms-list'); const q2 = norm(MS.texto); $$('#ms-list .rcard').forEach(card => { card.style.display = norm(card.dataset.search).includes(q2) ? '' : 'none'; }); $('.ms-count b').textContent = $$('#ms-list .rcard:not([style*="none"])').length; };
  $$('#ms-list .rcard').forEach(card => {
    const s = filtradas.find(x => String(x.fila) === card.dataset.fila);
    /* 05/08: la pastilla del estado abre SU propio modal; el resto de la
       tarjeta sigue abriendo el detalle completo. */
    card.onclick = ev => { if (ev.target.closest('[data-act="estado"]')) return; msDetalle(user, s); };
    const est = card.querySelector('[data-act="estado"]');
    if (est) est.onclick = ev => { ev.stopPropagation(); msCambiarEstado(user, s); };
  });
}

function msCard(s) {
  const lugar = [s.residencia].filter(Boolean).join(' · ');
  return `<div class="rcard serv-${msEstadoClase(s.estado)}" data-fila="${s.fila}" data-search="${esc(s.nombre + ' ' + s.documento + ' ' + s.solicitud)}" style="cursor:pointer;">
    <div class="rcard-top"><div class="rc-av">${esc(iniciales(s.nombre))}</div><div class="rc-id"><b>${esc(s.nombre)}</b><span>CC ${esc(s.documento)}${lugar ? ' · ' + esc(lugar) : ''}</span></div></div>
    ${s.solicitud ? `<p class="lcard-txt" style="margin:8px 0 0;">${esc(recorta(s.solicitud, 120))}</p>` : ''}
    <div class="rc-badges"><button type="button" class="rc-badge ms-est est-${msEstadoClase(s.estado)}" data-act="estado" title="Tocar para cambiar el estado">${esc(s.estado)} ▾</button>${s.fecha ? `<span class="rc-badge mut">${esc(s.fecha)}</span>` : ''}</div>
  </div>`;
}
function recorta(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n) + '…' : t; }

/* 05/08/2026 · CAMBIAR EL ESTADO desde la tarjeta (sin abrir el detalle).
   Manda SOLO el estado: la respuesta escrita no se toca. Ojo: como en el
   detalle, quien cambia el estado queda de RESPONSABLE de la solicitud. */
function msCambiarEstado(user, s) {
  const opciones = MS.data.estados;
  openSheet(`<div class="grip"></div><h2 class="h2" style="margin-bottom:4px;">Estado de la solicitud</h2>
    <p class="muted" style="margin-bottom:12px;">${esc(s.nombre)} · ${esc(s.servicio)}</p>
    <div class="stack">${opciones.map(o => `<button class="opt-row ${o === s.estado ? 'sel' : ''}" data-val="${esc(o)}">${esc(o)}${o === s.estado ? ' ✓' : ''}</button>`).join('')}</div>
    <button class="btn btn-quiet btn-block" style="margin-top:10px;" data-close>Cerrar</button>`);
  layer.querySelectorAll('.opt-row').forEach(b => b.onclick = async () => {
    const estado = b.dataset.val;
    if (estado === s.estado) return closeLayer();
    closeLayer();
    try {
      const r = await api('pub.servResponder', {}, 'POST', { documento: user.documento, fila: s.fila, estado });
      if (!r.ok) return toast(r.msg || 'No se pudo guardar', 'err');
      s.estado = estado;
      s.responsable = MS.data.profesional.nombre || s.responsable;
      pintarMisServicios(user);
      toast('Estado actualizado', 'ok');
    } catch (e) { toast('Error de conexión', 'err'); }
  });
}

/* 05/08/2026 · EXCEL de lo que hay EN PANTALLA (respeta la pestaña de estado
   y el filtro escrito), con las columnas que el profesional elija. */
const MS_COLS_FALLBACK = ['DOCUMENTO', 'NOMBRE', 'CONTACTO', 'RESIDENCIA', 'SERVICIO', 'RESPONSABLE', 'SOLICITUD', 'ESTADO', 'RESPUESTA', 'MEDIO', 'FECHA'];
function msExportar(user) {
  const filas = $$('#ms-list .rcard').filter(c => c.style.display !== 'none').map(c => c.dataset.fila);
  if (!filas.length) return toast('No hay solicitudes en este filtro', 'err');
  const cols = (MS.data.columnas && MS.data.columnas.length) ? MS.data.columnas : MS_COLS_FALLBACK;
  openSheet(`<div class="grip"></div>
    <h2 class="h2" style="margin-bottom:4px;">Exportar a Excel</h2>
    <p class="muted small">${filas.length.toLocaleString('es-CO')} solicitud(es) · ${esc(MS.estado === 'TODAS' ? 'Todos los estados' : MS.estado)}. Elige las columnas:</p>
    <div class="col-pick" id="ms-colpick">
      ${cols.map(c => `<label class="col-opt"><input type="checkbox" data-c="${esc(c)}" checked/> <span>${esc(String(c).replace(/_/g, ' '))}</span></label>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="btn btn-quiet" id="ms-col-all" style="flex:1;">Marcar todo</button>
      <button class="btn btn-quiet" id="ms-col-none" style="flex:1;">Ninguna</button>
    </div>
    <button class="btn btn-primary btn-block" id="ms-col-go" style="margin-top:10px;">${LR_ICO_DL} Descargar Excel</button>`);
  $('#ms-col-all').onclick = () => $$('#ms-colpick input').forEach(i => i.checked = true);
  $('#ms-col-none').onclick = () => $$('#ms-colpick input').forEach(i => i.checked = false);
  $('#ms-col-go').onclick = async () => {
    const columnas = $$('#ms-colpick input:checked').map(i => i.dataset.c);
    if (!columnas.length) return toast('Elige al menos una columna', 'err');
    const btn = $('#ms-col-go'); saving(btn, true);
    try {
      const r = await api('pub.servExcel', {}, 'POST', { documento: user.documento, filas, columnas });
      saving(btn, false);
      if (!r.ok) return toast(r.msg || 'No se pudo generar', 'err');
      lrDescargar(r.base64, r.mime, r.filename);
      closeLayer(); toast('Excel generado', 'ok');
    } catch (e) { saving(btn, false); toast('No se pudo generar el Excel', 'err'); }
  };
}

function msDetalle(user, s) {
  const opciones = MS.data.estados;
  openSheet(`<div class="grip"></div>
    <div class="rcard-top" style="margin-bottom:10px;"><div class="rc-av">${esc(iniciales(s.nombre))}</div><div class="rc-id"><b>${esc(s.nombre)}</b><span>CC ${esc(s.documento)}${s.contacto ? ' · ' + esc(s.contacto) : ''}</span></div></div>
    <p class="small muted" style="margin:0 0 2px;">Servicio</p><p style="margin:0 0 10px;"><b>${esc(s.servicio)}</b></p>
    <p class="small muted" style="margin:0 0 2px;">Solicitud</p><p style="margin:0 0 12px;">${esc(s.solicitud || '—')}</p>
    <label class="field" style="text-align:left;"><span>Estado</span>
      <select class="input" id="ms-estado">${opciones.map(o => `<option value="${o}" ${o === s.estado ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
    ${field('Respuesta / observación', areaEl('ms-resp', 'Escribe tu respuesta o seguimiento', 3))}
    <button class="btn btn-primary btn-block" id="ms-guardar">Guardar cambios</button>
    ${s.contacto ? `<p class="small muted" style="margin:10px 0 4px;">Enviar la respuesta al solicitante</p>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-ghost" id="ms-enviar-yo" style="flex:1;min-width:0;">${I.wa} Tu WhatsApp</button>
      <button class="btn btn-ghost" id="ms-enviar" style="flex:1;min-width:0;">🤖 Bot</button>
    </div>` : ''}
    ${s.contacto ? `<button class="btn btn-ghost btn-block" id="ms-wa">${I.wa} Escribir por WhatsApp</button>` : ''}
    <button class="btn btn-danger btn-block" id="ms-eliminar">🗑️ Eliminar solicitud</button>
    <button class="btn btn-quiet btn-block" data-close>Cerrar</button>`);
  $('#ms-resp').value = s.respuesta || '';

  $('#ms-guardar').onclick = async () => {
    const btn = $('#ms-guardar'); saving(btn, true);
    try {
      const r = await api('pub.servResponder', {}, 'POST', { documento: user.documento, fila: s.fila, estado: val('ms-estado'), respuesta: val('ms-resp') });
      saving(btn, false);
      if (!r.ok) return toast(r.msg || 'No se pudo guardar', 'err');
      closeLayer(); toast('Solicitud actualizada', 'ok'); liderServicios(user);
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };

  /* 05/08/2026 · la respuesta sale por donde el profesional elija:
       Tu WhatsApp → se abre WhatsApp con el mensaje ya escrito (lo manda él)
       Bot         → lo manda BuilderBot desde el número de la campaña
     En las dos, el CORE deja el mismo rastro en la hoja (respuesta, ATENDIDA,
     responsable) y solo cambia la columna MEDIO. */
  const msEnviar = async (btn, via) => {
    const resp = val('ms-resp').trim();
    if (!resp) return toast('Escribe la respuesta antes de enviar', 'err');
    const ok = await confirmar(via === 'directo' ? 'Enviar desde tu WhatsApp' : 'Enviar con el bot',
      crow('Para', s.nombre) + crow('Servicio', s.servicio) +
      `<div class="crow"><span>Mensaje</span><b style="text-align:right;max-width:60%;">${esc(recorta(resp, 100))}</b></div>`);
    if (!ok) return;
    saving(btn, true);
    try {
      const r = await api('pub.servEnviarResp', {}, 'POST', { documento: user.documento, fila: s.fila, respuesta: resp, via });
      saving(btn, false);
      if (!r.ok) return toast(r.msg || 'No se pudo enviar', 'err');
      if (via === 'directo') {
        const tel = onlyDig(r.telefono || s.contacto);
        const base = esMovil() ? 'whatsapp://send?phone=' : 'https://wa.me/';
        window.open(base + tel + '?text=' + encodeURIComponent(r.texto || resp), '_blank');
        closeLayer(); toast('Abriendo WhatsApp con la respuesta', 'ok'); liderServicios(user);
      } else {
        closeLayer(); toast('¡Respuesta enviada por WhatsApp!', 'ok'); liderServicios(user);
      }
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
  const env = $('#ms-enviar');
  if (env) env.onclick = () => msEnviar(env, 'bot');
  const envYo = $('#ms-enviar-yo');
  if (envYo) envYo.onclick = () => msEnviar(envYo, 'directo');

  const wa = $('#ms-wa'); if (wa) wa.onclick = () => window.open((esMovil() ? 'whatsapp://send?phone=57' : 'https://wa.me/57') + onlyDig(s.contacto), '_blank');

  $('#ms-eliminar').onclick = async () => {
    const ok = await confirmar('¿Eliminar esta solicitud?', crow('Solicitante', s.nombre) + crow('Servicio', s.servicio) + `<p class="small" style="color:#C0392B;margin:8px 0 0;">Esta acción no se puede deshacer.</p>`);
    if (!ok) return; // el sheet de detalle ya se cerró al abrir el de confirmación
    try {
      const r = await api('pub.servEliminar', {}, 'POST', { documento: user.documento, fila: s.fila });
      if (!r.ok) return toast(r.msg || 'No se pudo eliminar', 'err');
      closeLayer(); toast('Solicitud eliminada', 'ok'); liderServicios(user);
    } catch (e) { toast('Error de conexión', 'err'); }
  };
}

/* Autollenar nombre/contacto/residencia desde PRINCIPAL por documento */
async function msBuscarDoc(prefix) {
  const doc = onlyDig(val(prefix + '-doc'));
  if (!/^\d{6,10}$/.test(doc)) return toast('Documento inválido (6 a 10 dígitos)', 'err');
  const btn = $('#' + prefix + '-buscar'); saving(btn, true);
  try {
    const r = await api('pub.validarDoc', { documento: doc });
    saving(btn, false);
    if (!r.existe) { toast('No está en la base. Puedes continuar el registro.', 'ok'); return; }
    if (r.nombre) $('#' + prefix + '-nombre').value = r.nombre;
    if (r.telefono) $('#' + prefix + '-tel').value = onlyDig(r.telefono).replace(/^57/, '');
    if (r.residencia) $('#' + prefix + '-resi').value = r.residencia;
    toast('Datos encontrados', 'ok');
  } catch (e) { saving(btn, false); toast('Error de conexión', 'err'); }
}

/* AGREGAR SERVICIO (estado INGRESADA, servicio fijo del profesional) */
function msFormServicio(user) {
  const servicio = MS?.data?.profesional?.servicio || '';
  app.innerHTML = `${backLider('Agregar servicio')}<div class="pad stack"><div class="card pad stack">
    <div class="ms-serv-tag"><span class="small muted">Servicio</span><b>${esc(servicio || '—')}</b></div>
    <div class="lr-head"><div class="lr-search">${field('Documento', inputEl('as-doc', 'inputmode="numeric" maxlength="10" placeholder="Número de documento"'))}</div><button class="btn btn-ghost" id="as-buscar" style="white-space:nowrap;align-self:end;">Buscar</button></div>
    ${field('Nombre completo', inputEl('as-nombre', ''))}
    ${field('WhatsApp', inputEl('as-tel', 'inputmode="numeric" maxlength="10"'))}
    ${field('Residencia', comboboxHtml('as-resi', 'Escribe para buscar'))}
    ${field('Solicitud', areaEl('as-sol', 'Describe la solicitud', 3))}
    ${field('Respuesta / observación (opcional)', areaEl('as-resp', 'Puedes dejarlo vacío', 2))}
    <button class="btn btn-primary btn-block" id="as-save">Guardar servicio</button>
  </div></div>`;
  app.hidden = false; hideSplash(); appWide(false);
  { const b = $('#backLiderBtn'); if (b) b.onclick = () => liderServicios(user); }
  onlyDigits($('#as-doc')); onlyDigits($('#as-tel')); onlyLetters($('#as-nombre'));
  getResidencias().then(l => bindCombobox('as-resi', l)).catch(() => {});
  $('#as-buscar').onclick = () => msBuscarDoc('as');
  $('#as-doc').addEventListener('keydown', e => { if (e.key === 'Enter') $('#as-buscar').click(); });
  $('#as-save').onclick = async () => {
    const body = { documento: user.documento, refDoc: onlyDig(val('as-doc')), nombre: val('as-nombre'), contacto: onlyDig(val('as-tel')), residencia: val('as-resi'), solicitud: val('as-sol'), respuesta: val('as-resp') };
    if (!/^\d{6,10}$/.test(body.refDoc)) return toast('Documento inválido', 'err');
    if (!body.nombre || body.nombre.trim().split(/\s+/).length < 2) return toast('Escribe el nombre completo', 'err');
    if (!/^\d{10}$/.test(body.contacto)) return toast('El WhatsApp debe tener 10 dígitos', 'err');
    if (!body.residencia) return toast('Selecciona la residencia', 'err');
    if (!body.solicitud.trim()) return toast('Escribe la solicitud', 'err');
    const btn = $('#as-save'); saving(btn, true);
    try {
      const r = await api('pub.servAgregar', {}, 'POST', body);
      saving(btn, false);
      if (!r.ok) return toast(r.msg || 'No se pudo guardar', 'err');
      toast('¡Servicio agregado! Quedó como INGRESADA.', 'ok'); liderServicios(user);
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* AGREGAR SOLICITUD (estado PENDIENTE, servicio seleccionable) */
function msFormSolicitud(user) {
  app.innerHTML = `${backLider('Agregar solicitud')}<div class="pad stack"><div class="card pad stack">
    <div class="lr-head"><div class="lr-search">${field('Documento', inputEl('nq-doc', 'inputmode="numeric" maxlength="10" placeholder="Número de documento"'))}</div><button class="btn btn-ghost" id="nq-buscar" style="white-space:nowrap;align-self:end;">Buscar</button></div>
    ${field('Nombre completo', inputEl('nq-nombre', ''))}
    ${field('WhatsApp', inputEl('nq-tel', 'inputmode="numeric" maxlength="10"'))}
    ${field('Residencia', comboboxHtml('nq-resi', 'Escribe para buscar'))}
    <label class="field"><span>Servicio</span><select class="input" id="nq-serv"><option value="" selected disabled>Cargando servicios…</option></select></label>
    ${field('Solicitud', areaEl('nq-sol', 'Describe la solicitud', 3))}
    <button class="btn btn-primary btn-block" id="nq-save">Enviar solicitud</button>
  </div></div>`;
  app.hidden = false; hideSplash(); appWide(false);
  { const b = $('#backLiderBtn'); if (b) b.onclick = () => liderServicios(user); }
  onlyDigits($('#nq-doc')); onlyDigits($('#nq-tel')); onlyLetters($('#nq-nombre'));
  getResidencias().then(l => bindCombobox('nq-resi', l)).catch(() => {});
  api('pub.serviciosCatalogo').then(r => {
    const sel = $('#nq-serv'); if (!sel) return;
    const list = (r && r.servicios) || [];
    sel.innerHTML = '<option value="" selected disabled>Selecciona el servicio</option>' + list.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  }).catch(() => {});
  $('#nq-buscar').onclick = () => msBuscarDoc('nq');
  $('#nq-doc').addEventListener('keydown', e => { if (e.key === 'Enter') $('#nq-buscar').click(); });
  $('#nq-save').onclick = async () => {
    const body = { documento: user.documento, refDoc: onlyDig(val('nq-doc')), nombre: val('nq-nombre'), contacto: onlyDig(val('nq-tel')), residencia: val('nq-resi'), servicio: val('nq-serv'), solicitud: val('nq-sol') };
    if (!/^\d{6,10}$/.test(body.refDoc)) return toast('Documento inválido', 'err');
    if (!body.nombre || body.nombre.trim().split(/\s+/).length < 2) return toast('Escribe el nombre completo', 'err');
    if (!/^\d{10}$/.test(body.contacto)) return toast('El WhatsApp debe tener 10 dígitos', 'err');
    if (!body.residencia) return toast('Selecciona la residencia', 'err');
    if (!body.servicio) return toast('Selecciona el servicio', 'err');
    if (!body.solicitud.trim()) return toast('Escribe la solicitud', 'err');
    const btn = $('#nq-save'); saving(btn, true);
    try {
      const r = await api('pub.servNuevaSolicitud', {}, 'POST', body);
      saving(btn, false);
      if (!r.ok) return toast(r.msg || 'No se pudo enviar', 'err');
      toast('¡Solicitud enviada! Quedó como PENDIENTE.', 'ok'); liderServicios(user);
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* ---- MIS COMPROMISOS ---- */
let LC = { data: [], estado: 'TODAS', plantilla: '' };

async function liderCompromisos(user) {
  app.innerHTML = `${backLider('Mis compromisos')}<div class="pad" id="lc-body">${loadingBox('Cargando…')}</div>`;
  app.hidden = false; hideSplash(); bindBackLider(user); appWide(true);   /* 23/07: va DESPUES de bindBackLider, que apaga el ancho */
  try {
    const r = await api('pub.liderCompromisos', { documento: user.documento });
    if (!r.ok) { $('#lc-body').innerHTML = `<div class="card pad center muted">${esc(r.msg || 'No se pudo cargar')}</div>`; return; }
    LC.data = r.compromisos || []; LC.plantilla = r.plantillaRevision || ''; LC.estado = 'TODAS';
    lcPintar(user);
  } catch (e) { $('#lc-body').innerHTML = `<div class="card pad center muted">Error de conexión</div>`; }
}

/* Estados visibles al líder: ASIGNADO / PENDIENTE / CUMPLIDO (DESCARTADO ya viene oculto del CORE) */
function lcEstadoClase(e) { const v = String(e || '').toUpperCase(); if (v === 'CUMPLIDO') return 'ok'; if (v === 'PENDIENTE') return 'warn'; if (v === 'ASIGNADO') return 'asg'; return 'mut'; }

function lcPintar(user) {
  const d = LC.data;
  if (!d.length) { $('#lc-body').innerHTML = `<div class="card pad center muted">No tienes compromisos registrados.</div>`; return; }
  const counts = { ASIGNADO: 0, PENDIENTE: 0, CUMPLIDO: 0 };
  d.forEach(c => { if (counts[c.estado] !== undefined) counts[c.estado]++; });
  const pills = ['TODAS', 'ASIGNADO', 'PENDIENTE', 'CUMPLIDO']
    .map(e => `<button class="ms-chip lc-chip ${LC.estado === e ? 'active' : ''}" data-est="${e}">${e === 'TODAS' ? 'TODAS' : e}${e !== 'TODAS' ? ` <i>${counts[e] || 0}</i>` : ''}</button>`).join('');
  const lista = d.filter(c => LC.estado === 'TODAS' || c.estado === LC.estado);
  $('#lc-body').innerHTML = `
    <div class="ms-chips lc-chips">${pills}</div>
    <div class="stack" id="lc-list">${lista.map(lcCard).join('') || `<div class="card pad center muted">Sin compromisos en este filtro.</div>`}</div>`;
  $$('.lc-chip').forEach(c => c.onclick = () => { LC.estado = c.dataset.est; lcPintar(user); });
  $$('#lc-list .lcard').forEach(card => { const c = d.find(x => String(x.id) === card.dataset.id); if (c) card.onclick = () => lcDetalle(user, c); });
}

function lcCard(c) {
  const n = (c.traza || []).length;
  return `<div class="lcard lc-card lc-${lcEstadoClase(c.estado)}" data-id="${esc(c.id)}" style="cursor:pointer;">
    <div class="lcard-head"><b>Compromiso</b><span class="estado ${lcEstadoClase(c.estado)}">${esc(c.estado)}</span></div>
    <p class="lcard-txt">${esc(c.compromiso)}</p>
    <div class="lc-foot">
      ${c.asignado ? `<span class="lcard-date">Asignado: ${esc(c.asignado)}</span>` : ''}
      ${n ? `<span class="lc-tzn">${I.pencil} ${n} en bitácora</span>` : ''}
      ${c.fecha ? `<span class="lcard-date">${esc(c.fecha)}</span>` : ''}
    </div>
  </div>`;
}

/* Detalle: hilo de bitácora + (si no está CUMPLIDO) registrar avance y Solicitar revisión */
function lcDetalle(user, c) {
  const cumplido = c.estado === 'CUMPLIDO';
  openSheet(`<div class="grip"></div>
    <div class="lcard-head" style="margin-bottom:10px;"><h2 class="h2" style="margin:0;">Compromiso</h2><span class="estado ${lcEstadoClase(c.estado)}">${esc(c.estado)}</span></div>
    <p style="margin:0 0 12px;">${esc(c.compromiso)}</p>
    ${lcDetsHtml([['Asignador', c.asignador], ['Asignado a', c.asignado], ['Persona', c.nombre], ['Contacto', c.contacto], ['Fecha', c.fecha]])}
    <div class="tz-wrap"><div class="tz-head"><span>${I.pencil} Bitácora</span><em id="lc-tz-res">${esc(c.trazaResumen || '')}</em></div>
      <div class="tz-list" id="lc-tz-list">${lcTzList(c.traza)}</div>
    </div>
    ${cumplido ? `<p class="small muted center" style="margin-top:10px;">Este compromiso está cumplido.</p>` : `
      ${field('Registrar un avance', areaEl('lc-tz-in', 'Cuenta qué has avanzado…', 3))}
      <button class="btn btn-primary btn-block" id="lc-tz-add">${I.pencil} Guardar avance</button>
      ${lcRevisionBtn(c)}
    `}
    <button class="btn btn-quiet btn-block" data-close style="margin-top:8px;">Cerrar</button>`);

  if (!cumplido) {
    $('#lc-tz-add').onclick = () => lcTzAgregar(user, c);
    const rev = $('#lc-rev');
    if (rev) rev.onclick = () => lcSolicitarRevision(c);
  }
}

/* AJUSTE 20/07: bloque de detalles del compromiso/solicitud (asignador, etc.) */
function lcDetsHtml(rows) {
  const r = rows.filter(x => x[1]).map(([k, v]) => `<div class="lc-det"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  return r ? `<div class="lc-dets">${r}</div>` : '';
}

function lcTzList(entries) {
  if (!entries || !entries.length) return `<p class="muted small tz-empty">Sin entradas todavía.</p>`;
  return entries.map(e => `<div class="tz-item ${e.origen === 'pub' ? 'tz-pub' : 'tz-priv'}">
    <div class="tz-meta"><b>${esc(e.autor || (e.origen === 'pub' ? 'Yo' : 'Panel'))}</b><span>${esc(e.fecha || '')}</span></div>
    <p class="tz-texto">${esc(e.texto || '')}</p></div>`).join('');
}

/* Botón "Solicitar revisión": solo si NO está cumplido y el asignador tiene WhatsApp */
function lcRevisionBtn(c) {
  if (!c.asignadorWa) return `<p class="small muted center" style="margin:8px 0 0;">El asignador no tiene WhatsApp registrado para solicitar revisión.</p>`;
  return `<button class="btn btn-ghost btn-block" id="lc-rev">${I.wa} Solicitar revisión</button>`;
}

async function lcTzAgregar(user, c) {
  const inp = $('#lc-tz-in'); if (!inp) return;
  const texto = (inp.value || '').trim();
  if (!texto) return toast('Escribe el avance', 'err');
  const btn = $('#lc-tz-add'); saving(btn, true);
  try {
    const r = await api('pub.liderComTraza', {}, 'POST', { documento: user.documento, id: c.id, texto });
    saving(btn, false);
    if (!r.ok) return toast(r.msg || 'No se pudo guardar', 'err');
    inp.value = '';
    c.traza = r.entries || c.traza; c.trazaResumen = r.resumen || c.trazaResumen; c.estado = r.estado || c.estado;
    const list = $('#lc-tz-list'); if (list) list.innerHTML = lcTzList(c.traza);
    const res = $('#lc-tz-res'); if (res) res.textContent = c.trazaResumen || '';
    // el estado pudo pasar ASIGNADO→PENDIENTE: refrescar la vista por debajo
    const i = LC.data.findIndex(x => String(x.id) === String(c.id)); if (i >= 0) LC.data[i] = c;
    toast('Avance guardado', 'ok');
    closeLayer(); lcPintar(user); lcDetalle(user, c);
  } catch (e) { saving(btn, false); toast('Error de conexión', 'err'); }
}

/* Abre WhatsApp directo al asignador con la plantilla renderizada */
function lcSolicitarRevision(c) {
  if (!c.asignadorWa) return toast('El asignador no tiene WhatsApp registrado', 'err');
  const msg = String(LC.plantilla || '')
    .replace(/\{p_nombre\}/g, c.asignadorNombre || '')
    .replace(/\{compromiso\}/g, c.compromiso || '');
  const num = onlyDig(c.asignadorWa).replace(/^57/, '');
  const text = encodeURIComponent(msg);
  const url = esMovil()
    ? ('whatsapp://send?phone=57' + num + '&text=' + text)
    : ('https://wa.me/57' + num + '?text=' + text);
  window.open(url, '_blank');
}
/* ============================================================
   MIS SOLICITUDES (app pública · Lote B1·G) — gemela de Mis compromisos
   ============================================================ */
let LS = { data: [], estado: 'TODAS', plantilla: '' };

async function liderSolicitudes(user) {
  app.innerHTML = `${backLider('Mis solicitudes')}<div class="pad" id="ls2-body">${loadingBox('Cargando…')}</div>`;
  app.hidden = false; hideSplash(); bindBackLider(user); appWide(true);   /* 23/07: va DESPUES de bindBackLider, que apaga el ancho */
  try {
    const r = await api('pub.liderSolicitudes', { documento: user.documento });
    if (!r.ok) { $('#ls2-body').innerHTML = `<div class="card pad center muted">${esc(r.msg || 'No se pudo cargar')}</div>`; return; }
    LS.data = r.solicitudes || []; LS.plantilla = r.plantillaRevision || ''; LS.estado = 'TODAS';
    lsPintar(user);
  } catch (e) { $('#ls2-body').innerHTML = `<div class="card pad center muted">Error de conexión</div>`; }
}

function lsPintar(user) {
  const d = LS.data;
  if (!d.length) { $('#ls2-body').innerHTML = `<div class="card pad center muted">No tienes solicitudes registradas.</div>`; return; }
  const counts = { ASIGNADO: 0, PENDIENTE: 0, CUMPLIDO: 0 };
  d.forEach(c => { if (counts[c.estado] !== undefined) counts[c.estado]++; });
  const pills = ['TODAS', 'ASIGNADO', 'PENDIENTE', 'CUMPLIDO']
    .map(e => `<button class="ms-chip lc-chip ${LS.estado === e ? 'active' : ''}" data-est="${e}">${e}${e !== 'TODAS' ? ` <i>${counts[e] || 0}</i>` : ''}</button>`).join('');
  const lista = d.filter(c => LS.estado === 'TODAS' || c.estado === LS.estado);
  $('#ls2-body').innerHTML = `
    <div class="ms-chips lc-chips">${pills}</div>
    <div class="stack" id="ls2-list">${lista.map(lsCard).join('') || `<div class="card pad center muted">Sin solicitudes en este filtro.</div>`}</div>`;
  $$('.lc-chip').forEach(c => c.onclick = () => { LS.estado = c.dataset.est; lsPintar(user); });
  $$('#ls2-list .lcard').forEach(card => { const c = d.find(x => String(x.id) === card.dataset.id); if (c) card.onclick = () => lsDetalle(user, c); });
}

function lsCard(c) {
  const n = (c.traza || []).length;
  return `<div class="lcard lc-card lc-${lcEstadoClase(c.estado)}" data-id="${esc(c.id)}" style="cursor:pointer;">
    <div class="lcard-head"><b>Solicitud</b><span class="estado ${lcEstadoClase(c.estado)}">${esc(c.estado)}</span></div>
    <p class="lcard-txt">${esc(c.solicitud)}</p>
    <div class="lc-foot">
      ${n ? `<span class="lc-tzn">${I.pencil} ${n} en bitácora</span>` : ''}
      ${c.fecha ? `<span class="lcard-date">${esc(c.fecha)}</span>` : ''}
    </div>
  </div>`;
}

function lsDetalle(user, c) {
  const cumplido = c.estado === 'CUMPLIDO';
  openSheet(`<div class="grip"></div>
    <div class="lcard-head" style="margin-bottom:10px;"><h2 class="h2" style="margin:0;">Solicitud</h2><span class="estado ${lcEstadoClase(c.estado)}">${esc(c.estado)}</span></div>
    <p style="margin:0 0 12px;">${esc(c.solicitud)}</p>
    ${lcDetsHtml([['Asignador', c.asignador], ['Fecha', c.fecha]])}
    <div class="tz-wrap"><div class="tz-head"><span>${I.pencil} Bitácora</span><em id="ls2-tz-res">${esc(c.trazaResumen || '')}</em></div>
      <div class="tz-list" id="ls2-tz-list">${lcTzList(c.traza)}</div>
    </div>
    ${cumplido ? `<p class="small muted center" style="margin-top:10px;">Esta solicitud está cumplida.</p>` : `
      ${field('Registrar un avance', areaEl('ls2-tz-in', 'Cuenta qué has avanzado…', 3))}
      <button class="btn btn-primary btn-block" id="ls2-tz-add">${I.pencil} Guardar avance</button>
      ${lcRevisionBtn(Object.assign({}, c, { _id: 'ls2-rev' }))}
    `}
    <button class="btn btn-quiet btn-block" data-close style="margin-top:8px;">Cerrar</button>`);
  if (!cumplido) {
    $('#ls2-tz-add').onclick = () => lsTzAgregar(user, c);
    const rev = $('#lc-rev'); if (rev) rev.onclick = () => lsSolicitarRevision(c);
  }
}

async function lsTzAgregar(user, c) {
  const inp = $('#ls2-tz-in'); if (!inp) return;
  const texto = (inp.value || '').trim();
  if (!texto) return toast('Escribe el avance', 'err');
  const btn = $('#ls2-tz-add'); saving(btn, true);
  try {
    const r = await api('pub.liderSolTraza', {}, 'POST', { documento: user.documento, id: c.id, texto });
    saving(btn, false);
    if (!r.ok) return toast(r.msg || 'No se pudo guardar', 'err');
    inp.value = '';
    c.traza = r.entries || c.traza; c.trazaResumen = r.resumen || c.trazaResumen; c.estado = r.estado || c.estado;
    const i = LS.data.findIndex(x => String(x.id) === String(c.id)); if (i >= 0) LS.data[i] = c;
    toast('Avance guardado', 'ok');
    closeLayer(); lsPintar(user); lsDetalle(user, c);
  } catch (e) { saving(btn, false); toast('Error de conexión', 'err'); }
}

function lsSolicitarRevision(c) {
  if (!c.asignadorWa) return toast('El asignador no tiene WhatsApp registrado', 'err');
  const msg = String(LS.plantilla || '')
    .replace(/\{p_nombre\}/g, c.asignadorNombre || '')
    .replace(/\{solicitud\}/g, c.solicitud || '')
    .replace(/\{compromiso\}/g, c.solicitud || '');
  const num = onlyDig(c.asignadorWa).replace(/^57/, '');
  const text = encodeURIComponent(msg);
  const url = esMovil()
    ? ('whatsapp://send?phone=57' + num + '&text=' + text)
    : ('https://wa.me/57' + num + '?text=' + text);
  window.open(url, '_blank');
}

function estadoClase(e) { const v = norm(e); if (/realiz|complet|resuel|entreg/.test(v)) return 'ok'; if (/pend/.test(v)) return 'warn'; if (/rechaz|no /.test(v)) return 'no'; return 'mut'; }

/* Campo de contraseña con botón ver/ocultar. id único, label, placeholder. */
function passField(id, label, ph) {
  return `<label class="field" style="text-align:left;"><span>${esc(label)}</span>
    <div class="input-pass">
      <input class="input" id="${id}" type="password" placeholder="${esc(ph || '')}" autocomplete="off" />
      <button type="button" class="pass-eye" data-eye="${id}" aria-label="Mostrar u ocultar">${I.eyeOff}</button>
    </div></label>`;
}
function bindPassEyes() {
  $$('.pass-eye[data-eye]').forEach(btn => btn.onclick = () => {
    const inp = document.getElementById(btn.dataset.eye); if (!inp) return;
    const vis = inp.type === 'text'; inp.type = vis ? 'password' : 'text';
    btn.innerHTML = vis ? I.eyeOff : I.eyeOn;
  });
}

/* Olvidé mi contraseña: envía la clave por correo + WhatsApp (automáticos) */
async function liderOlvideClave(user) {
  const ok = await confirmar('Recuperar contraseña', 'Te enviaremos tu contraseña de acceso a los medios que tengas registrados. ¿Continuar?');
  if (!ok) return;
  try {
    const r = await api('pub.liderRecuperar', {}, 'POST', { documento: user.documento });
    if (!r.ok) return toast(r.msg || 'No pudimos enviar tu contraseña ahora. Inténtalo más tarde.', 'err');
    let via;
    if (r.correo && r.wa) via = 'Revisa tu correo o WhatsApp';
    else if (r.correo)    via = 'Revisa tu correo';
    else                  via = 'Revisa tu WhatsApp';
    celebrar('🔐', '¡Contraseña enviada!', via + ' para ver tu contraseña y vuelve a ingresar.', 3000);
  } catch (e) { toast('Error de conexión', 'err'); }
}

/* ---- ACTUALIZAR CONTRASEÑA ----
   Dos secciones INDEPENDIENTES: la clave (arriba) y el correo (abajo).
   31/07:
   - Al guardar la contraseña se cierra la sesión de líder y se vuelve al
     LOGIN para entrar con la nueva (y se borra la clave recordada, que
     quedaría vieja).
   - "Actualiza tu correo" pide la contraseña actual y confirma el correo
     nuevo con un código; solo entonces se escribe en la hoja.
   - opts.precargar = viene del correo de activación: el líder todavía no
     inició sesión, así que se precarga su documento como contraseña actual
     (es la que traen de fábrica) y no se muestra la tarjeta del correo. */
function liderActualizarClave(user, opts) {
  opts = opts || {};
  const enSesion = !!(LIDER && LIDER.documento === user.documento);
  const precargar = !!opts.precargar;

  const cardCorreo = enSesion ? `
    <div class="card pad stack">
      <div><b>Actualiza tu correo</b><p class="muted small" style="margin:4px 0 0;">Es el medio por el que te enviamos tu contraseña si la olvidas. Para cambiarlo necesitas tu contraseña actual y confirmar el correo nuevo con un código.</p></div>
      <label class="field" style="text-align:left;"><span>Correo</span>
        <input class="input" id="cm-mail" type="email" inputmode="email" autocomplete="email" placeholder="tucorreo@ejemplo.com" value="${esc((LIDER && LIDER.correo) || '')}" />
      </label>
      ${passField('cm-act', 'Contraseña actual', 'Tu contraseña de líder')}
      <button class="btn btn-primary btn-block" id="cm-save">Guardar correo</button>
    </div>` : '';

  app.innerHTML = `${backLider('Actualizar contraseña')}<div class="pad stack">
    ${precargar ? `<div class="card pad soft-note">✅ Correo activado. Ahora crea tu nueva contraseña: la actual viene precargada con tu número de documento. Si ya la habías cambiado, escribe la tuya.</div>` : ''}
    <div class="card pad stack">
      ${passField('cc-act', 'Contraseña actual', 'Tu contraseña actual')}
      ${passField('cc-1', 'Nueva contraseña', 'Mínimo 4 caracteres')}
      ${passField('cc-2', 'Repite la nueva', 'Vuelve a escribirla')}
      <button class="btn btn-primary btn-block" id="cc-save">Guardar contraseña</button>
    </div>
    ${cardCorreo}
  </div>`;
  app.hidden = false; hideSplash(); bindPassEyes();

  /* Sin sesión (viene de la activación) la flecha vuelve al login, no al panel. */
  appWide(false);
  const back = $('#backLiderBtn');
  if (back) back.onclick = () => { if (enSesion) return liderPanel(user); viewLideres(user); };

  if (precargar) { const a = $('#cc-act'); if (a) a.value = user.documento; }

  const cm = $('#cm-save');
  if (cm) cm.onclick = async () => {
    const correo = String(($('#cm-mail') || {}).value || '').trim();
    const clave  = val('cm-act');
    if (!correo) return toast('Escribe tu correo', 'err');
    if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(correo)) return toast('Ese correo no parece válido. Revísalo.', 'err');
    if (LIDER && String(LIDER.correo || '').trim().toLowerCase() === correo.toLowerCase()) return toast('Ese ya es tu correo registrado');
    if (!clave) return toast('Escribe tu contraseña actual', 'err');
    saving(cm, true);
    try {
      const r = await api('pub.liderCodigoEnviar', {}, 'POST', { documento: user.documento, correo, modo: 'cambiar', claveActual: clave });
      saving(cm, false);
      if (!r.ok) {
        if (r.bloqueado) return liderBloqueado(user, r.segundos);
        return toast(r.msg || 'No se pudo enviar el código', 'err');
      }
      liderActivarCorreo(user, { modo: 'cambiar', correo, claveActual: clave, destino: r.destino, segundos: r.segundos });
    } catch (e) { toast('Error de conexión', 'err'); saving(cm, false); }
  };

  $('#cc-save').onclick = async () => {
    const act = val('cc-act'), a = val('cc-1'), b = val('cc-2');
    if (!act) return toast('Escribe tu contraseña actual', 'err');
    if (a.length < 4) return toast('La nueva debe tener mínimo 4 caracteres', 'err');
    if (a !== b) return toast('Las contraseñas no coinciden', 'err');
    const btn = $('#cc-save'); saving(btn, true);
    try {
      const r = await api('pub.liderClave', {}, 'POST', { documento: user.documento, claveActual: act, claveNueva: a });
      saving(btn, false);
      if (!r.ok) {
        if (r.bloqueado) return liderBloqueado(user, r.segundos);
        return toast(r.msg || 'No se pudo actualizar', 'err');
      }
      /* Se vuelve al login: la sesión y la clave recordada quedan viejas. */
      LIDER = null;
      try { localStorage.removeItem(LIDER_REMEMBER_KEY); } catch {}
      toast('Contraseña actualizada. Ingresa con la nueva.', 'ok');
      viewLideres(user);
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* Barra superior que vuelve al panel de líder (no al home) */
function backLider(title) { return `<div class="appbar"><button class="icon-btn" id="backLiderBtn">${I.back}</button><div class="who"><b>${esc(title)}</b><span>Zona de líderes</span></div></div>`; }
function bindBackLider(user) { appWide(false); const b = $('#backLiderBtn'); if (b) b.onclick = () => liderPanel(user); }

/* ============================================================
   Navegación / componentes comunes
   ============================================================ */

/* ============================================================
   COMERCIANTES AMIGOS  (categoría → especificaciones → tarjetas)
   Reconstruido del repo real portal-jhonny-perdomo (go-comercios),
   nativo con helpers api()/go()/$ — sin Choices/jQuery.
   ============================================================ */
/* Íconos de acción de las tarjetas de comercios.
   30/07/2026 · viven en la carpeta img/ de ESTE repo, no en un hosting
   externo. Son propios de esta app: no los usa ninguna otra y no los sirve
   el CORE, así que no van al repo central de imágenes. Ruta relativa a
   propósito — el mismo GitHub Pages que sirve la app los sirve a ellos, sin
   depender de que otro repo siga publicado. */
let COM_STATE = { items: [], categorias: [], filtro: "TODAS", q: "", menu: false, tocado: false };
const COM_ICON = {
  ubic: 'img/ubicacion.png',
  fb:   'img/facebook.webp',
  ig:   'img/instagram.webp',
  tt:   'img/tiktok.webp',
  wa:   'img/whatsapp.webp',
  tel:  'img/llamada.webp'
};
// Convierte id/enlace de Drive en miniatura mostrable (idéntico al portal)
function comThumb(url) {
  const m = String(url || '').match(/[-\w]{25,}/);
  return m ? `https://drive.google.com/thumbnail?sz=w1000&id=${m[0]}` : String(url || '');
}

async function viewComercio(user) {
  app.innerHTML = `${backbar('Comerciantes amigos')}
    <div class="pad stack">
      <div class="com-top">
        <div class="com-tagline">Apoyemos a nuestros comerciantes</div>
        <div class="small muted">Busca por nombre o servicio, o elige una categoría.</div>
      </div>
      ${comBarraHtml()}
      <div id="com-spec" class="com-spec hidden"><div id="com-spec-text" class="small"></div></div>
      <div id="com-list" class="com-list">${loadingBox('Cargando comercios…')}</div>
    </div>`;
  app.hidden = false; hideSplash();
  appWide(true);
  $('#backbtn').onclick = () => go('home');

  COM_USER = user;                                   // 03/08: calificar y reseñar van con el documento
  comReset();                                        // se entra siempre sin búsqueda y en "Todas"
  try {
    /* Las dos lecturas van en paralelo. Si la social falla, la vitrina se
       pinta igual con los contadores en cero. */
    const [data, social] = await Promise.all([
      api('com.todo'),
      api('pub.comSocial', { documento: user.documento }).catch(() => ({ com: {} }))
    ]);
    COM_STATE = { items: (data && data.items) || [], categorias: (data && data.categorias) || [], filtro: 'TODAS', q: '', menu: false, tocado: false };
    COM_SOCIAL = (social && social.com) || {};
  } catch (e) {
    $('#com-list').innerHTML = `<p class="center muted" style="padding:24px 0;">No se pudieron cargar los comercios.</p>`;
    return;
  }
  if (!COM_STATE.items.length) {
    const tools = $('.com-tools'); if (tools) tools.classList.add('hidden');
    const cuenta = $('#com-cuenta'); if (cuenta) cuenta.textContent = '';
    $('#com-list').innerHTML = `<p class="center muted" style="padding:24px 0;">Todavía no hay comerciantes publicados. Vuelve pronto 🛍️</p>`;
    return;
  }
  comBarraBind();
  comAplicarFiltro();
}

/* ============================================================
   BUSCADOR + SELECTOR DE CATEGORÍA (03/08/2026)
   Sustituye la fila de pastillas: un solo botón que arranca en
   "Todas" (con pulso vivo mientras nadie lo ha tocado) y se abre
   en la lista de categorías. El buscador y la categoría se
   combinan. Todo vuelve a cero al entrar de nuevo a la vista.
   ============================================================ */

/* Iconos propios de la barra (no toco el objeto I: ya tiene dos `x` en
   archivos distintos y no vale la pena arriesgar). */
const ICO_LUPA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
const ICO_EQUIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICO_CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

/* Texto contra el que se busca: nombre, especificación, categoría,
   descripción, ofertas y dirección. Se calcula UNA vez por comercio. */
function comTextoBusqueda(it) {
  if (it.__buscable) return it.__buscable;
  it.__buscable = norm([
    it.titulo, it.subtitulo, it.categoria, it.descripcion,
    it.premiumColor, it.estandarColor, it.direccion
  ].filter(Boolean).join(' '));
  return it.__buscable;
}

/* Búsqueda por palabras sueltas: "pizza flandes" encuentra al que tenga
   las dos, en cualquier orden y en cualquiera de sus campos. Sin tildes
   ni mayúsculas de por medio (norm ya las quita). */
function comCoincide(it, q) {
  if (!q) return true;
  const texto = comTextoBusqueda(it);
  return norm(q).split(/\s+/).filter(Boolean).every(p => texto.indexOf(p) !== -1);
}

/* Lo que se ve ahora mismo, aplicando categoría Y búsqueda. */
function comFiltrados() {
  const cat = COM_STATE.filtro || 'TODAS';
  const q = COM_STATE.q || '';
  let items = COM_STATE.items;
  if (cat !== 'TODAS') items = items.filter(it => norm(it.categoria) === norm(cat));
  if (q) {
    items = items.filter(it => comCoincide(it, q));
    /* Primero los que lo llevan en el nombre: es lo que la gente espera. */
    const nq = norm(q);
    items = items.slice().sort((a, b) => {
      const A = norm(a.titulo).indexOf(nq) === 0 ? 0 : (norm(a.titulo).indexOf(nq) !== -1 ? 1 : 2);
      const B = norm(b.titulo).indexOf(nq) === 0 ? 0 : (norm(b.titulo).indexOf(nq) !== -1 ? 1 : 2);
      return A - B;
    });
  }
  return items;
}

function comCuantos(cat) {
  return cat === 'TODAS'
    ? COM_STATE.items.length
    : COM_STATE.items.filter(it => norm(it.categoria) === norm(cat)).length;
}

/* Deja la vista como recién abierta. Se llama al montar, así que al salir
   y volver a entrar no queda ni la búsqueda ni la categoría anteriores. */
function comReset() {
  COM_STATE.filtro = 'TODAS';
  COM_STATE.q = '';
  COM_STATE.menu = false;
  COM_STATE.tocado = false;
}

function comCatMenuHtml() {
  const cats = ['TODAS'].concat(COM_STATE.categorias.map(c => c.categoria));
  return cats.map(c => {
    const n = comCuantos(c);
    const activa = norm(c) === norm(COM_STATE.filtro);
    return `<button class="com-opt ${activa ? 'on' : ''}" data-opt="${esc(c)}" ${n ? '' : 'disabled'}>
      <span>${esc(c === 'TODAS' ? 'Todas' : c)}</span><b>${n}</b>
    </button>`;
  }).join('');
}

function comPintarBarra() {
  const btn = $('#com-cat-btn');
  if (!btn) return;
  const cat = COM_STATE.filtro;
  btn.classList.toggle('vivo', !COM_STATE.tocado);          // el pulso se apaga en cuanto lo tocan
  btn.classList.toggle('abierto', !!COM_STATE.menu);
  btn.classList.toggle('filtrando', cat !== 'TODAS');
  $('#com-cat-lb').textContent = cat === 'TODAS' ? 'Todas' : cat;
  $('#com-cat-n').textContent = comCuantos(cat);
  const menu = $('#com-cat-menu');
  menu.classList.toggle('hidden', !COM_STATE.menu);
  btn.setAttribute('aria-expanded', COM_STATE.menu ? 'true' : 'false');
  if (COM_STATE.menu) {
    menu.innerHTML = comCatMenuHtml();
    $$('#com-cat-menu [data-opt]').forEach(b => b.onclick = () => comElegirCat(b.dataset.opt));
  }
  const limpiar = $('#com-q-clear');
  if (limpiar) limpiar.classList.toggle('hidden', !COM_STATE.q);
}

function comAbrirMenu(abrir) {
  COM_STATE.menu = abrir === undefined ? !COM_STATE.menu : !!abrir;
  if (COM_STATE.menu) COM_STATE.tocado = true;
  comPintarBarra();
}

function comElegirCat(cat) {
  COM_STATE.filtro = cat;
  COM_STATE.tocado = true;
  COM_STATE.menu = false;
  comAplicarFiltro();
}

/* Repinta la línea de especificaciones + la lista + el contador. */
function comAplicarFiltro() {
  const cat = COM_STATE.filtro;
  const spec = $('#com-spec'), specText = $('#com-spec-text');
  if (spec) {
    const c = cat === 'TODAS' ? null : COM_STATE.categorias.find(x => norm(x.categoria) === norm(cat));
    const txt = (c && c.especificaciones) || '';
    specText.textContent = txt;
    spec.classList.toggle('hidden', !txt);
  }
  const items = comFiltrados();
  comPintarBarra();
  const cuenta = $('#com-cuenta');
  if (cuenta) {
    const hayFiltro = cat !== 'TODAS' || COM_STATE.q;
    cuenta.textContent = hayFiltro
      ? `${items.length} de ${COM_STATE.items.length} comercios`
      : `${COM_STATE.items.length} comercios`;
  }
  renderComercioList(items);
}

function comBuscar(v) {
  COM_STATE.q = String(v || '').trim();
  comAplicarFiltro();
}

function comBarraHtml() {
  return `<div class="com-tools">
    <div class="com-search">
      ${ICO_LUPA}
      <input id="com-q" type="search" inputmode="search" autocomplete="off"
        placeholder="Buscar comercio, servicio o categoría…" aria-label="Buscar comercios">
      <button id="com-q-clear" class="com-q-clear hidden" aria-label="Limpiar búsqueda">${ICO_EQUIS}</button>
    </div>
    <div class="com-catwrap">
      <button id="com-cat-btn" class="com-cat-btn vivo" aria-haspopup="listbox" aria-expanded="false">
        <span id="com-cat-lb">Todas</span><b id="com-cat-n">0</b>${ICO_CHEV}
      </button>
      <div id="com-cat-menu" class="com-cat-menu hidden" role="listbox"></div>
    </div>
  </div>
  <div id="com-cuenta" class="com-cuenta small muted"></div>`;
}

function comBarraBind() {
  const q = $('#com-q');
  let t = null;
  q.oninput = () => { clearTimeout(t); t = setTimeout(() => comBuscar(q.value), 120); };
  q.onsearch = () => comBuscar(q.value);          // la "x" nativa del type=search
  $('#com-q-clear').onclick = () => { q.value = ''; comBuscar(''); q.focus(); };
  $('#com-cat-btn').onclick = (e) => { e.stopPropagation(); comAbrirMenu(); };
  /* Cerrar el desplegable al tocar fuera o con Escape. */
  document.addEventListener('click', comCerrarFuera);
  document.addEventListener('keydown', comCerrarEsc);
}

function comCerrarFuera(e) {
  if (!$('#com-cat-menu')) return document.removeEventListener('click', comCerrarFuera);
  if (!COM_STATE.menu) return;
  if (e.target.closest('.com-catwrap')) return;
  comAbrirMenu(false);
}

function comCerrarEsc(e) {
  if (!$('#com-cat-menu')) return document.removeEventListener('keydown', comCerrarEsc);
  if (e.key === 'Escape' && COM_STATE.menu) comAbrirMenu(false);
}

/* ============================================================
   COMERCIANTES AMIGOS · tarjetas horizontales + estrellas y reseñas
   (03/08/2026)
   ------------------------------------------------------------
   La vitrina se pinta con DOS llamadas en paralelo: com.todo (los
   comercios, como siempre) y pub.comSocial (calificaciones, reseñas y
   lo que hizo esta persona). Si la segunda falla, la vitrina se ve
   igual: las estrellas y el contador salen en cero y se puede
   reintentar tocándolos. Nunca se cae la vista por el añadido.
   ============================================================ */
let COM_SOCIAL = {};      // { '<id>': { estrellas, promedio, resenas, miEstrella, miResena } }
let COM_USER = null;      // persona logueada (para calificar y reseñar)
let RS_MODAL = null;      // estado del modal de reseñas abierto

const RS_VACIO = { estrellas: 0, promedio: 0, resenas: 0, miEstrella: 0, miResena: '' };
function comSoc(id) { return COM_SOCIAL[String(id)] || RS_VACIO; }

/* Estrellas: si la persona ya calificó se muestra SU nota en ámbar; si no,
   se muestra el promedio del comercio atenuado, que es la señal de "así lo
   ven los demás". Tocar la misma estrella que ya diste la retira. */
function comEstrellasHtml(id) {
  const s = comSoc(id);
  const mia = s.miEstrella > 0;
  const base = mia ? s.miEstrella : Math.round(s.promedio);
  let est = '';
  for (let i = 1; i <= 5; i++) {
    est += `<button class="rs-st ${i <= base ? (mia ? 'on' : 'avg') : ''}" data-cal="${esc(id)}" data-n="${i}"
      aria-label="Calificar con ${i}" title="${mia && i === s.miEstrella ? 'Toca de nuevo para retirar tu calificación' : 'Calificar con ' + i}">${I.star}</button>`;
  }
  const nota = s.estrellas ? `<b>${String(s.promedio).replace('.', ',')}</b><span>(${s.estrellas})</span>` : `<span>Sé el primero</span>`;
  return `<div class="rs-stars ${mia ? 'mine' : ''}">${est}<div class="rs-nota">${nota}</div></div>`;
}

function comResenasBtnHtml(id) {
  const s = comSoc(id);
  return `<button class="rs-chat" data-res="${esc(id)}" aria-label="Ver reseñas">${I.chat}<b>${s.resenas}</b>
    <span>${s.resenas === 1 ? 'reseña' : 'reseñas'}</span></button>`;
}

function comRedesHtml(it) {
  let wa = String(it.whatsapp || '').replace(/\D/g, '');
  if (/^3\d{9}$/.test(wa)) wa = '57' + wa;
  const tel = String(it.llamada || '').replace(/\D/g, '');
  const icon = (href, src, alt) => href ? `<a href="${esc(href)}" target="_blank" rel="noopener" title="${alt}"><img src="${src}" alt="${alt}" loading="lazy"></a>` : '';
  return [
    icon(it.ubicacion || '', COM_ICON.ubic, 'Ubicación'),
    icon(it.facebook || '', COM_ICON.fb, 'Facebook'),
    icon(it.instagram || '', COM_ICON.ig, 'Instagram'),
    icon(it.tiktok || '', COM_ICON.tt, 'TikTok'),
    icon(wa ? ('https://wa.me/' + wa) : '', COM_ICON.wa, 'WhatsApp'),
    (tel && esMovil()) ? icon('tel:' + tel, COM_ICON.tel, 'Llamar') : ''   // tel: no sirve en PC
  ].join('');
}

/* La tarjeta ya no es una columna con la foto grande arriba: la imagen pasa a
   ser una miniatura a la izquierda (primer toque amplía, dentro de la
   ampliación el segundo reproduce el video) y el texto ocupa el resto. */
function comCardHtml(it) {
  const img = comThumb(it.imagen || '');
  const media = img
    ? `<button class="rs-thumb" data-zoom="${esc(img)}" data-reel="${esc(it.reel || '')}" aria-label="Ampliar la imagen">
         <img src="${esc(img)}" alt="" loading="lazy" onerror="this.closest('.rs-thumb').classList.add('noimg')">
         ${it.reel ? `<span class="rs-thumb-vid">${I.play}</span>` : ''}
       </button>`
    : (it.reel
      ? `<button class="rs-thumb noimg" data-reel="${esc(it.reel)}" aria-label="Ver el video">${I.play}</button>`
      : `<div class="rs-thumb noimg empty">${I.store}</div>`);

  const ofertas = `${it.premiumColor ? `<div class="rs-off prem"><span>⭐ Premium</span><em>${esc(it.premiumColor)}</em></div>` : ''}
    ${it.estandarColor ? `<div class="rs-off est"><span>Estándar</span><em>${esc(it.estandarColor)}</em></div>` : ''}`;

  return `<article class="rs-card" data-id="${esc(it.id || '')}">
    <div class="rs-card-main">
      ${media}
      <div class="rs-card-body">
        <div class="rs-card-cat">${esc(it.categoria || '')}</div>
        <h3 class="rs-card-t">${esc(it.titulo || '')}</h3>
        ${it.subtitulo ? `<div class="rs-card-sub">${esc(it.subtitulo)}</div>` : ''}
        ${it.descripcion ? `<p class="rs-card-d">${esc(it.descripcion)}</p>` : ''}
        <div class="rs-offs">${ofertas}</div>
        ${(it.descripcion && it.descripcion.length > 90) || it.premiumColor || it.estandarColor
      ? `<button class="rs-more" data-more>Ver más</button>` : ''}
        <div class="rs-redes">${comRedesHtml(it)}</div>
      </div>
    </div>
    <div class="rs-card-foot">
      ${comEstrellasHtml(it.id)}
      ${comResenasBtnHtml(it.id)}
    </div>
  </article>`;
}

function renderComercioList(items) {
  const wrap = $('#com-list');
  if (!wrap) return;
  if (!items.length) {
    wrap.innerHTML = `<p class="center muted" style="padding:24px 0;">No hay comercios en esta categoría.</p>`;
    return;
  }
  wrap.innerHTML = items.map(comCardHtml).join('');
  comBindLista();
}

function comBindLista() {
  $$('#com-list .rs-thumb[data-zoom]').forEach(b => b.onclick = () => comMedia(b.dataset.zoom, b.dataset.reel));
  $$('#com-list .rs-thumb.noimg[data-reel]').forEach(b => b.onclick = () => openVideo(b.dataset.reel));
  $$('#com-list [data-more]').forEach(b => b.onclick = () => {
    const card = b.closest('.rs-card');
    const abierta = card.classList.toggle('open');
    b.textContent = abierta ? 'Ver menos' : 'Ver más';
  });
  $$('#com-list [data-cal]').forEach(b => b.onclick = () => comCalificar(b.dataset.cal, parseInt(b.dataset.n, 10), b));
  $$('#com-list [data-res]').forEach(b => b.onclick = () => rsAbrir(b.dataset.res));
}

/* Repinta SOLO el pie de una tarjeta: si se redibuja la lista entera se
   pierde el "Ver más" que la persona acabara de abrir. */
function comRefrescarPie(id) {
  const card = $(`#com-list .rs-card[data-id="${CSS.escape(String(id))}"]`);
  if (!card) return;
  const pie = card.querySelector('.rs-card-foot');
  if (!pie) return;
  pie.innerHTML = comEstrellasHtml(id) + comResenasBtnHtml(id);
  pie.querySelectorAll('[data-cal]').forEach(b => b.onclick = () => comCalificar(b.dataset.cal, parseInt(b.dataset.n, 10), b));
  pie.querySelectorAll('[data-res]').forEach(b => b.onclick = () => rsAbrir(b.dataset.res));
}

async function comCalificar(id, n, btn) {
  if (!COM_USER) return toast('Inicia sesión para calificar', 'err');
  const s = comSoc(id);
  const nota = (s.miEstrella === n) ? 0 : n;            // tocar la misma retira
  const antes = Object.assign({}, s);
  COM_SOCIAL[id] = Object.assign({}, s, { miEstrella: nota });   // respuesta inmediata
  comRefrescarPie(id);
  try {
    const r = await api('pub.comEstrella', { documento: COM_USER.documento, nit: id, estrellas: nota });
    COM_SOCIAL[id] = Object.assign({}, COM_SOCIAL[id], {
      estrellas: r.estrellas, promedio: r.promedio, resenas: r.resenas, miEstrella: r.miEstrella
    });
    comRefrescarPie(id);
    if (RS_MODAL && RS_MODAL.id === id) rsCargar(id);
    toast(nota ? '¡Gracias por calificar!' : 'Retiraste tu calificación');
  } catch (e) {
    COM_SOCIAL[id] = antes;
    comRefrescarPie(id);
    toast(e.message || 'No se pudo calificar', 'err');
  }
}

/* ---------- Modal de reseñas ---------- */
function rsFechaCorta(f) {
  const m = String(f || '').match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return esc(f || '');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${m[1]} ${meses[parseInt(m[2], 10) - 1]} ${m[3]}${m[4] ? ' · ' + m[4] + ':' + m[5] : ''}`;
}

function rsAvatarHtml(it) {
  const f = String(it.foto || '').trim();
  const s = f.toLowerCase();
  const esDefault = !f || f === FOTO_DEFAULT || ['user_zefosv', 'marca/user.png', 'data:image/svg+xml'].some(x => s.indexOf(x) !== -1);
  return esDefault
    ? `<div class="rs-av">${esc(iniciales(it.nombre))}</div>`
    : `<div class="rs-av has-photo"><img src="${esc(f)}" alt="" onerror="this.parentNode.classList.remove('has-photo');this.replaceWith(document.createTextNode('${esc(iniciales(it.nombre))}'))"></div>`;
}

function rsEstrellasFijas(n, cls) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="rs-stf ${i <= n ? 'on' : ''}">${I.star}</span>`;
  return `<div class="rs-stfs ${cls || ''}">${s}</div>`;
}

function rsAbrir(id) {
  const it = (COM_STATE.items || []).find(x => String(x.id) === String(id)) || {};
  RS_MODAL = { id: String(id), titulo: it.titulo || 'Comercio', datos: null, editando: false };
  const sh = openSheet(`<div class="grip"></div>
    <div class="rs-head">
      <h2 class="h2">${esc(RS_MODAL.titulo)}</h2>
      <div class="small muted">Reseñas de la gente</div>
    </div>
    <div id="rs-body">${loadingBox('Cargando reseñas…')}</div>`, 'rs-sheet');
  sh.addEventListener('click', e => { if (e.target.closest('[data-close]')) RS_MODAL = null; });
  rsCargar(id);
}

async function rsCargar(id) {
  try {
    const r = await api('pub.comResenas', { nit: id, documento: (COM_USER && COM_USER.documento) || '' });
    if (!RS_MODAL || RS_MODAL.id !== String(id)) return;
    RS_MODAL.datos = r;
    COM_SOCIAL[id] = Object.assign({}, comSoc(id), {
      estrellas: r.resumen.estrellas, promedio: r.resumen.promedio, resenas: r.resumen.resenas
    });
    comRefrescarPie(id);
    rsPintar();
  } catch (e) {
    const b = $('#rs-body');
    if (b) b.innerHTML = `<p class="center muted" style="padding:18px 0;">No se pudieron cargar las reseñas.</p>`;
  }
}

function rsPintar() {
  const b = $('#rs-body');
  if (!b || !RS_MODAL || !RS_MODAL.datos) return;
  const d = RS_MODAL.datos, res = d.resumen;
  const mia = (d.items || []).find(x => x.mia) || null;
  const maxDist = Math.max.apply(null, res.dist.concat([1]));

  const barras = [5, 4, 3, 2, 1].map(n => {
    const v = res.dist[n - 1] || 0;
    return `<div class="rs-bar"><span>${n}</span><i><b style="width:${Math.round((v / maxDist) * 100)}%"></b></i><em>${v}</em></div>`;
  }).join('');

  const compositor = !COM_USER ? '' : (mia && !RS_MODAL.editando
    ? ''
    : `<div class="rs-write">
         <div class="rs-write-top">${rsAvatarHtml({ nombre: COM_USER.nombre, foto: COM_USER.foto })}
           <div><b>${esc(primerNombre(COM_USER.nombre))}</b><span class="small muted">${mia ? 'Editando tu reseña' : 'Cuenta cómo te fue'}</span></div></div>
         <textarea id="rs-txt" maxlength="${d.tope}" rows="3" placeholder="Escribe tu reseña…">${esc(mia ? mia.texto : '')}</textarea>
         <div class="rs-write-foot"><span class="small muted" id="rs-count">0/${d.tope}</span>
           <div class="rs-write-btns">
             ${mia ? `<button class="btn btn-quiet" id="rs-cancel">Cancelar</button>` : ''}
             <button class="btn btn-primary" id="rs-save">${mia ? 'Guardar' : 'Publicar'}</button>
           </div></div>
       </div>`);

  const tarjetas = (d.items || []).map(it => `
    <article class="rs-item ${it.mia ? 'mia' : ''}">
      <div class="rs-item-top">
        ${rsAvatarHtml(it)}
        <div class="rs-item-id">
          <b>${esc(it.nombre)}${it.mia ? ' <span class="rs-tag">Tú</span>' : ''}</b>
          <span class="small muted">${rsFechaCorta(it.fecha)}${it.editado ? ' · editada' : ''}</span>
        </div>
        ${it.estrellas ? rsEstrellasFijas(it.estrellas, 'mini') : ''}
      </div>
      <p class="rs-item-tx">${esc(it.texto)}</p>
      ${it.respuesta ? `<div class="rs-reply"><b>Respuesta del comercio</b><p>${esc(it.respuesta)}</p><span class="small muted">${rsFechaCorta(it.respuestaFecha)}</span></div>` : ''}
      <div class="rs-item-acts">
        <button class="rs-like ${it.miLike ? 'on' : ''}" data-like="${esc(it.id)}" ${COM_USER ? '' : 'disabled'}>${I.star}<b>${it.likes}</b></button>
        ${it.mia ? `<button class="rs-mini" data-edit>Editar</button><button class="rs-mini danger" data-del="${esc(it.id)}">Eliminar</button>` : ''}
      </div>
    </article>`).join('');

  b.innerHTML = `
    <div class="rs-resumen">
      <div class="rs-prom"><b>${res.estrellas ? String(res.promedio).replace('.', ',') : '—'}</b>
        ${rsEstrellasFijas(Math.round(res.promedio))}
        <span class="small muted">${res.estrellas} calificación${res.estrellas === 1 ? '' : 'es'} · ${res.resenas} reseña${res.resenas === 1 ? '' : 's'}</span>
      </div>
      <div class="rs-bars">${barras}</div>
    </div>
    ${compositor}
    <div class="rs-list">${tarjetas || `<p class="center muted" style="padding:16px 0;">Todavía no hay reseñas. La tuya puede ser la primera.</p>`}</div>`;

  const txt = $('#rs-txt');
  if (txt) {
    const cnt = $('#rs-count');
    const pinta = () => { cnt.textContent = `${txt.value.length}/${RS_MODAL.datos.tope}`; };
    txt.oninput = pinta; pinta();
    $('#rs-save').onclick = () => rsGuardar();
    const cancel = $('#rs-cancel');
    if (cancel) cancel.onclick = () => { RS_MODAL.editando = false; rsPintar(); };
  }
  $$('#rs-body [data-like]').forEach(x => x.onclick = () => rsLike(x.dataset.like, x));
  const ed = $('#rs-body [data-edit]');
  if (ed) ed.onclick = () => { RS_MODAL.editando = true; rsPintar(); };
  const del = $('#rs-body [data-del]');
  if (del) del.onclick = () => rsEliminar(del.dataset.del, del);
}

async function rsGuardar() {
  if (!RS_MODAL || !COM_USER) return;
  const txt = $('#rs-txt'), btn = $('#rs-save');
  const texto = String(txt.value || '').trim();
  if (texto.length < 3) return toast('Escribe tu reseña', 'err');
  saving(btn, true);
  try {
    const r = await api('pub.comResenaGuardar', {}, 'POST', { documento: COM_USER.documento, nit: RS_MODAL.id, texto: texto });
    RS_MODAL.editando = false;
    RS_MODAL.datos = Object.assign({}, RS_MODAL.datos, { items: r.items, resumen: r.resumen });
    COM_SOCIAL[RS_MODAL.id] = Object.assign({}, comSoc(RS_MODAL.id), {
      estrellas: r.resumen.estrellas, promedio: r.resumen.promedio, resenas: r.resumen.resenas, miResena: r.id
    });
    comRefrescarPie(RS_MODAL.id);
    rsPintar();
    toast('¡Gracias por tu reseña!');
  } catch (e) {
    saving(btn, false);
    toast(e.message || 'No se pudo publicar', 'err');
  }
}

async function rsEliminar(id, btn) {
  if (!RS_MODAL || !COM_USER) return;
  saving(btn, true);
  try {
    const r = await api('pub.comResenaEliminar', {}, 'POST', { documento: COM_USER.documento, id: id });
    RS_MODAL.editando = false;
    RS_MODAL.datos = Object.assign({}, RS_MODAL.datos, { items: r.items, resumen: r.resumen });
    COM_SOCIAL[RS_MODAL.id] = Object.assign({}, comSoc(RS_MODAL.id), {
      estrellas: r.resumen.estrellas, promedio: r.resumen.promedio, resenas: r.resumen.resenas, miResena: ''
    });
    comRefrescarPie(RS_MODAL.id);
    rsPintar();
    toast('Reseña eliminada');
  } catch (e) {
    saving(btn, false);
    toast(e.message || 'No se pudo eliminar', 'err');
  }
}

async function rsLike(id, btn) {
  if (!COM_USER) return toast('Inicia sesión para participar', 'err');
  btn.disabled = true;
  try {
    const r = await api('pub.comResenaLike', { documento: COM_USER.documento, id: id });
    const it = (RS_MODAL.datos.items || []).find(x => x.id === id);
    if (it) { it.likes = r.likes; it.miLike = r.miLike; }
    rsPintar();
  } catch (e) {
    btn.disabled = false;
    toast(e.message || 'No se pudo registrar tu me gusta', 'err');
  }
}

/* Visor de la imagen del comercio (17/07/2026).
   No se reusa zoomImagen(): ese trae doble-toque para acercar, y aquí el toque
   sobre la imagen es lo que reproduce el video — los dos gestos se pisarían.
   Se queda con lo que el usuario pidió: ampliar, tocar para el video, tocar
   por fuera para cerrar. Escape también cierra (en PC no hay "por fuera"
   evidente). Reusa el CSS .imgzoom que ya existe. */
function comMedia(src, reel) {
  if (!src) return;
  const ov = h(`<div class="imgzoom com-zoom"><button class="imgzoom-close" aria-label="Cerrar">${I.x}</button>
    <img src="${esc(src)}" alt="" draggable="false" />
    ${reel ? `<div class="com-zoom-hint">${I.play} Toca la imagen para ver el video</div>` : ''}</div>`);
  layer.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  const cerrar = () => { document.removeEventListener('keydown', onEsc); ov.classList.remove('show'); setTimeout(() => ov.remove(), 250); };
  const onEsc = e => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', onEsc);
  ov.querySelector('.imgzoom-close').onclick = cerrar;
  ov.onclick = e => { if (e.target === ov) cerrar(); };          // clic por fuera
  ov.querySelector('img').onclick = () => {
    if (!reel) return cerrar();                                   // sin video, el toque cierra
    document.removeEventListener('keydown', onEsc);
    ov.remove();                                                  // el video entra en su lugar
    openVideo(reel);
  };
}


function openMenu(id, user) {
  if (id === 'misdatos') return openMisDatos(user);   // 17/07/2026: modal solo-lectura
  if (id === 'noticias') return abrirPonteAlDia(user); // ajuste 20/07: puerta + avisos
  if (IMPLEMENTADAS.has(id)) return go(id);
  const item = MENU.find(m => m.id === id) || { title: 'Sección', icon: 'star' };
  openSheet(`<div class="grip"></div><div class="center stack"><div class="ico" style="width:56px;height:56px;margin:0 auto;border-radius:16px;background:var(--brand-050);display:grid;place-content:center;">${I[item.icon] || I.star}</div><h2 class="h2">${esc(item.title)}</h2><p class="muted">Estamos afinando esta sección. Muy pronto la tendrás lista.</p><button class="btn btn-primary btn-block" data-close>Entendido</button></div>`);
}
function avatarHtml(user, cls) {
  const ini = esc(iniciales(user.nombre));
  const foto = user.foto && user.foto !== FOTO_DEFAULT ? esc(user.foto) : '';
  const inner = foto
    ? `<div class="${cls} has-photo" id="avatarBox"><img src="${foto}" alt="" onerror="this.parentNode.classList.remove('has-photo');this.replaceWith(document.createTextNode('${ini}'))"/></div>`
    : `<div class="${cls}" id="avatarBox">${ini}</div>`;
  // lápiz pequeño para editar la foto
  return `<div class="avatar-wrap">${inner}<button class="avatar-edit" id="avatarEdit" title="Editar foto" aria-label="Editar foto">${I.pencil}</button></div>`;
}
function appbar(user, titulo) { return `<div class="appbar">${titulo ? `<div class="mark">${esc(iniciales(user.nombre))}</div>` : avatarHtml(user, 'mark')}<div class="who"><b>${esc(titulo || primerNombre(user.nombre))}</b><span>${titulo ? esc(MV.candidato) : 'CC ' + esc(user.documento)}</span></div><button class="icon-btn" id="btnSwap" title="Cambiar de cuenta">${I.swap}</button><button class="icon-btn" id="btnOut" title="Salir">${I.logout}</button></div>`; }
function bindAppbar(user) {
  const s = $('#btnSwap'), o = $('#btnOut'); if (o) o.onclick = () => logout(); if (s) s.onclick = () => openSwitch();
  const ed = $('#avatarEdit'); if (ed) ed.onclick = () => editarFoto(user);
  const box = $('#avatarBox'); if (box) box.onclick = () => { if (box.classList.contains('has-photo')) zoomImagen(user.foto); else editarFoto(user); };
}
function openSwitch() {
  const sesiones = getSessions();
  const activo = localStorage.getItem(ACT_KEY) || '';
  openSheet(`<div class="grip"></div><h2 class="h2" style="margin-bottom:12px;">Cambiar de cuenta</h2><div class="stack">${sesiones.map(s => `<div class="acct-row"><button class="chip acct-pick" data-doc="${esc(s.documento)}"><span class="av">${esc(iniciales(s.nombre))}</span>${esc(s.nombre)}</button><button class="icon-btn acct-del" data-del="${esc(s.documento)}" title="Eliminar esta cuenta del dispositivo" aria-label="Eliminar cuenta">${I.trash}</button></div>`).join('')}<button class="btn btn-quiet btn-block" data-add>+ Entrar con otro documento</button></div>`);
  layer.querySelectorAll('.acct-pick').forEach(c => c.onclick = () => {
    setActive(c.dataset.doc); closeLayer();
    // El botón vive en el appbar de Home: si ya estás en #/home, cambiar el hash
    // a lo mismo NO dispara hashchange → render() no corre y "no pasa nada".
    // Por eso se re-renderiza directo cuando ya estás ahí.
    if ((location.hash || '#/home') === '#/home') render(); else go('home');
  });
  // Papelera: borra la cuenta GUARDADA en este dispositivo (no toca la base de
  // datos). Sin confirmación, tal como se pidió. Si borra la que está usando
  // —o si se queda sin cuentas— sale al login.
  layer.querySelectorAll('.acct-del').forEach(b => b.onclick = (ev) => {
    ev.stopPropagation();
    const doc = b.dataset.del;
    const quedan = removeSession(doc);
    if (String(doc) === String(activo) || !quedan.length) { closeLayer(); return logout(); }
    closeLayer(); openSwitch();
  });
  const add = layer.querySelector('[data-add]'); if (add) add.onclick = () => { closeLayer(); logout(); };
}
function openSheet(html, cls) {
  closeLayer();
  const bd = h('<div class="backdrop"></div>');
  const sh = h(`<div class="sheet ${cls || ''}">${html}</div>`);
  bd.onclick = closeLayer;
  layer.append(bd, sh);
  sh.querySelectorAll('[data-close]').forEach(b => b.onclick = closeLayer);
  // Bloquea el scroll del fondo: el modal toma el mando de la vista
  document.body.classList.add('sheet-open');
  return sh;
}

/* ============================================================
   MIS DATOS (17/07/2026) — modal informativo, solo lectura.
   Reemplaza a la vieja baldosa "Actualizar datos" en el inicio. Aquí NO se
   edita: si un dato está mal, la persona habla con su referente. Los 8 campos
   y el orden salen tal cual del pliego; lo vacío lo marca el servidor como
   "Sin consultar" y aquí se pinta atenuado para que se note que falta.
   ============================================================ */
const MD_CAMPOS = [
  ['user',  'Nombre',      'nombre'],
  ['card',  'CC',          'documento'],
  ['wa',    'WhatsApp',    'whatsapp'],
  ['home2', 'Residencia',  'residencia'],
  ['star',  'N° Referido', 'referido'],
  ['map',   'Municipio',   'municipio'],
  ['form',  'Puesto',      'puesto'],
  ['doc',   'Mesa',        'mesa']
];

async function openMisDatos(user) {
  const esqueleto = MD_CAMPOS.map(() =>
    `<div class="md-row"><div class="md-ico skeleton"></div><div class="md-body"><div class="skeleton" style="height:11px;width:70px;"></div><div class="skeleton" style="height:15px;width:130px;margin-top:6px;"></div></div></div>`).join('');
  const sh = openSheet(`<div class="grip"></div>
    <div class="md-head">
      <div class="md-avatar">${esc(iniciales(user.nombre))}</div>
      <div><h2 class="h2" style="margin:0;">Mis Datos</h2><p class="muted small" style="margin:2px 0 0;">Revisa tu información</p></div>
    </div>
    <div class="md-list" id="md-list">${esqueleto}</div>
    <div id="md-foot"></div>`);

  let d;
  try {
    d = await api('pub.misDatos', { documento: user.documento });
    if (!d || !d.ok) throw new Error((d && d.msg) || 'No pudimos traer tus datos');
  } catch (e) {
    if (!$('#md-list')) return;   // el modal ya se cerró
    $('#md-list').innerHTML = `<p class="muted center" style="padding:14px 0;">${esc(e.message || 'No pudimos traer tus datos')}</p>`;
    $('#md-foot').innerHTML = `<button class="btn btn-primary btn-block" data-close>Cerrar</button>`;
    sh.querySelectorAll('[data-close]').forEach(b => b.onclick = closeLayer);
    return;
  }
  if (!$('#md-list')) return;

  $('#md-list').innerHTML = MD_CAMPOS.map(([ico, label, key], i) => {
    const v = d[key] || 'Sin consultar';
    const falta = v === 'Sin consultar';
    return `<div class="md-row md-in" style="animation-delay:${i * 45}ms;">
      <div class="md-ico">${I[ico] || I.user}</div>
      <div class="md-body"><span class="md-k">${esc(label)}</span><span class="md-v${falta ? ' md-empty' : ''}">${esc(v)}</span></div>
    </div>`;
  }).join('');

  $('#md-foot').innerHTML = `
    <div class="md-note">${I.help} Si alguno de estos datos está errado, por favor comunícate con tu referente para hacer la actualización respectiva.</div>
    <button class="btn btn-primary btn-block" data-close>Entendido</button>`;
  sh.querySelectorAll('[data-close]').forEach(b => b.onclick = closeLayer);
}
function closeLayer() { layer.innerHTML = ''; document.body.classList.remove('sheet-open'); }
function ytId(url) { const m = String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/); return m ? m[1] : ''; }
function driveVideoId(url) { const m = String(url || '').match(/\/d\/([-\w]{25,})|[?&]id=([-\w]{25,})/); return m ? (m[1] || m[2]) : ''; }
function openVideo(url) {
  const yt = ytId(url);
  const dv = !yt ? driveVideoId(url) : '';
  const src = yt ? `https://www.youtube.com/embed/${yt}?autoplay=1&rel=0&playsinline=1`
            : dv ? `https://drive.google.com/file/d/${dv}/preview`
            : url;
  const vertical = !!(yt && /shorts\//.test(String(url))) || !!dv; // reels verticales / drive
  /* CERRAR AL TOCAR AFUERA — arreglado en la Fase 9.2.
     Antes había un .backdrop aparte con el onclick de cerrar, pero .modal-video
     va DESPUÉS en el layer y también es inset:0 → se comía todos los clics y el
     onclick del backdrop no se disparaba NUNCA. El backdrop estaba de adorno.
     Se quita: .modal-video ya cubre toda la pantalla, así que él mismo hace de
     fondo y de captador. Cierra cuando el clic cae en el overlay y no en el
     video (e.target === mv) — es el mismo patrón que zoomImagen usa desde
     siempre en esta app. Se le suma la tecla Escape en PC. */
  const mv = h(`<div class="modal-video ${vertical ? 'vertical' : ''}"><button class="close" aria-label="Cerrar">${I.x}</button><div class="frame"><iframe src="${esc(src)}" allow="autoplay; encrypted-media" allowfullscreen></iframe></div></div>`);
  const cerrar = () => { document.removeEventListener('keydown', onEsc); closeLayer(); };
  const onEsc = e => { if (e.key === 'Escape') cerrar(); };
  mv.querySelector('.close').onclick = cerrar;
  mv.onclick = e => { if (e.target === mv) cerrar(); };
  document.addEventListener('keydown', onEsc);
  layer.append(mv);
}
function hideSplash() { const s = $('#splash'); if (s && !s.classList.contains('hide')) { s.classList.add('hide'); setTimeout(() => s.remove(), 500); } }

/* ============================================================
   MÓDULO 7 · PONTE AL DÍA  (noticias + avisos push)
   ------------------------------------------------------------
   DOBLE CANAL:
     A) Push FCM  → llega con la app CERRADA (firebase-messaging-sw.js).
     B) Señal RTDB /noticias → si la app está ABIERTA (o negaste el permiso),
        baja un banner "Nueva noticia" al instante, sin refrescar ni polling.
   El feed siempre se lee de la hoja NOTIFICACIONES (la fuente de verdad).
   ============================================================ */
const NT_FBCFG = (typeof MARCA !== 'undefined' && MARCA.FIREBASE) || {};
/* Clave pública VAPID (Firebase Console → Cloud Messaging → Certificados push web).
   Es PÚBLICA por diseño: identifica al remitente, no autoriza a enviar. */
const NT_VAPID = 'BIx99jmx_Bxg05CqJu3UDqHqN-icTA-g_4GKdbDcEZwL_LIgxv6l5Ao3LcEtmYFdBKp9X04ogoq62LxTATpNR-s';

const NT_LEIDAS_KEY = nsKey('jp_noticias_leidas');   // ts de la última noticia vista
const NT_TOKEN_KEY = nsKey('jp_fcm_token');          // token registrado en este dispositivo
const NT_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

let NT_ALL = [], NT_ME = null, NT_fb = null, NT_ref = null, NT_onVal = null, NT_reloadT = null, NT_primerSignal = true;

/* ---------- Estado de los avisos en este dispositivo ---------- */
const ntSoporta = () => ('Notification' in window) && ('serviceWorker' in navigator) && ('PushManager' in window);
const ntPermiso = () => (ntSoporta() ? Notification.permission : 'unsupported');
const ntTokenLocal = () => { try { return localStorage.getItem(NT_TOKEN_KEY) || ''; } catch { return ''; } };
const ntLeidas = () => { try { return parseInt(localStorage.getItem(NT_LEIDAS_KEY), 10) || 0; } catch { return 0; } };
function ntMarcarLeidas(ts) { try { localStorage.setItem(NT_LEIDAS_KEY, String(ts || Date.now())); } catch {} }

/* ---------- SDK de Firebase (a demanda, como en la privada) ---------- */
async function ntLoadFirebase(conMessaging) {
  if (!window.firebase) await loadScript(NT_SDK + 'firebase-app-compat.js');
  if (!window.firebase.database) await loadScript(NT_SDK + 'firebase-database-compat.js');
  if (conMessaging && !window.firebase.messaging) await loadScript(NT_SDK + 'firebase-messaging-compat.js');
  if (!(window.firebase.apps && window.firebase.apps.length)) window.firebase.initializeApp(NT_FBCFG);
  return window.firebase;
}

/* ---------- Registro del token (permiso → token → FCM_TOKENS) ---------- */
async function ntActivarAvisos(user, opts) {
  const o = opts || {};
  const avisar = (msg, kind) => { if (!o.silencioso) toast(msg, kind); };

  /* OJO CON EL ORDEN (arreglado el 30/07). En iOS sin instalar (pestaña de
     Safari) window.Notification NI SIQUIERA EXISTE, así que ntSoporta() da
     false. Cuando la guarda de soporte iba primero, el iPhone caía SIEMPRE en
     "tu navegador no permite avisos" y esta rama —la única accionable— era
     código muerto: nunca se ejecutaba. Por eso iOS va PRIMERO. */
  if (isIOS() && !isStandalone()) {
    openSheet(`<div class="grip"></div><div class="center stack"><div class="nt-ico">${I.news}</div>
      <h2 class="h2">Instala la app primero</h2>
      <p class="muted">En iPhone/iPad los avisos solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4 o superior).</p>
      <button class="btn btn-primary btn-block" id="nt-ins">Ver cómo instalarla</button>
      <button class="btn btn-quiet btn-block" data-close>Ahora no</button></div>`);
    $('#nt-ins').onclick = () => { closeLayer(); go('instalar'); };
    return false;
  }
  if (!ntSoporta()) { avisar('Tu navegador no permite avisos', 'err'); return false; }
  /* Permiso ya denegado: el navegador NO vuelve a preguntar (requestPermission
     devuelve 'denied' sin mostrar nada). Se explica dónde se desbloquea. */
  if (ntPermiso() === 'denied') {
    if (!o.silencioso) {
      const dondeIOS = 'Ajustes del iPhone → Notificaciones → busca la app y permite los avisos.';
      const dondeOtro = 'Toca el candado (o el icono de ajustes) junto a la dirección del sitio y permite las notificaciones.';
      openSheet(`<div class="grip"></div><div class="center stack"><div class="nt-ico">${I.news}</div>
        <h2 class="h2">Avisos bloqueados</h2>
        <p class="muted">${esc(isIOS() ? dondeIOS : dondeOtro)}</p>
        <button class="btn btn-primary btn-block" data-close>Entendido</button></div>`);
    }
    return false;
  }
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') { avisar('No activaste los avisos', 'err'); return false; }
    const fb = await ntLoadFirebase(true);
    // OJO: scope propio. Si lo registráramos en './' reemplazaría al sw.js de la
    // PWA (dos service workers no pueden compartir scope) y romperíamos el caché
    // y la instalación. Este es el scope que usa el propio SDK de FCM.
    const reg = await navigator.serviceWorker.register('firebase-messaging-sw.js', { scope: './firebase-cloud-messaging-push-scope' });
    const msg = fb.messaging();
    const token = await msg.getToken({ vapidKey: NT_VAPID, serviceWorkerRegistration: reg });
    if (!token) { toast('No se pudo generar el aviso', 'err'); return false; }
    await api('pub.tokenGuardar', {}, 'POST', {
      token, idUsuario: (user && user.idUsuario) || '', documento: (user && user.documento) || '',
      plataforma: ntPlataforma()
    });
    try { localStorage.setItem(NT_TOKEN_KEY, token); } catch {}
    // Con la app abierta el push no se muestra solo: lo convertimos en banner.
    try { msg.onMessage(() => ntAvisoNueva()); } catch {}
    toast('Avisos activados 🔔', 'ok');
    return true;
  } catch (e) {
    /* En iOS el permiso debe salir de un clic DIRECTO. Si el navegador lo
       rechaza por el gesto (NotAllowedError), no se molesta al usuario: la
       puerta de "Ponte al día" lo recoge después con un toque real. */
    avisar('No se pudieron activar los avisos', 'err');
    return false;
  }
}

/* ---------- Activación al INICIAR SESIÓN (30/07) ----------
   Antes los avisos solo se activaban al entrar a "Ponte al día". Ahora se
   intentan apenas la persona inicia sesión, para que queden listos desde el
   primer ingreso. La puerta de "Ponte al día" SIGUE VIVA como red de
   seguridad: cubre a quien ya tenía la sesión abierta (no vuelve a pasar por
   el login) y a quien el navegador le rechace el permiso por el gesto.
   Silencioso a propósito: nadie quiere errores rojos justo al entrar. Lo
   único que sí se muestra es la hoja de iOS sin instalar (decisión del
   usuario) y el "Avisos activados" cuando sale bien. */
function ntAutoActivar(user) {
  try {
    if (ntTokenLocal()) return;              // este dispositivo ya está registrado
    Promise.resolve(ntActivarAvisos(user, { silencioso: true })).catch(() => {});
  } catch (e) {}
}

function ntPlataforma() {
  const ua = navigator.userAgent || '';
  const so = /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) ? 'iOS' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'macOS' : 'Web';
  return so + (isStandalone() ? ' · PWA' : ' · navegador');
}

/* ---------- CANAL B: señal RTDB ---------- */
function ntTeardown() {
  if (NT_ref && NT_onVal) { try { NT_ref.off('value', NT_onVal); } catch (e) {} }
  NT_ref = null; NT_onVal = null;
  if (NT_reloadT) { clearTimeout(NT_reloadT); NT_reloadT = null; }
}
function ntInitSignal() {
  NT_primerSignal = true;
  ntLoadFirebase(false).then(fb => {
    NT_fb = fb;
    NT_ref = fb.database().ref('noticias');
    NT_onVal = NT_ref.on('value', () => {
      if (NT_primerSignal) { NT_primerSignal = false; return; }   // el primer valor es el estado actual
      if (NT_reloadT) return;
      NT_reloadT = setTimeout(() => { NT_reloadT = null; ntAvisoNueva(); }, 500);
    }, () => {});
  }).catch(() => {});
}
/* Banner "Hay una noticia nueva" (no interrumpe la lectura) */
function ntAvisoNueva() {
  const el = $('#nt-nueva');
  if (!el) return;
  el.innerHTML = `<button class="nt-nueva">${I.news} Hay una noticia nueva · toca para verla</button>`;
  el.querySelector('.nt-nueva').onclick = () => ntCargar(true);
}

/* ---------- Utilidades del feed ---------- */
const NT_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function ntFecha(s) {
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return String(s || '');
  const dd = +m[1], mm = +m[2] - 1, yy = +m[3];
  let hora = '';
  if (m[4] != null) {
    let hh = +m[4]; const mi = m[5];
    const ap = hh >= 12 ? 'pm' : 'am'; hh = hh % 12 || 12;
    hora = ` – ${hh}:${mi} ${ap}`;
  }
  return `${dd} de ${NT_MESES[mm]} de ${yy}${hora}`;
}
function ntRelativa(ts) {
  if (!ts) return '';
  const dif = Math.floor((Date.now() - ts) / 60000);
  if (dif < 1) return 'ahora';
  if (dif < 60) return `hace ${dif} min`;
  const hrs = Math.floor(dif / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const dias = Math.floor(hrs / 24);
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  return '';
}
/* El enlace NO es solo de redes sociales: también puede ser un formulario, un
   documento, un mapa o cualquier página. Se detecta el destino y el botón se
   nombra por lo que la persona va a encontrar, no por "abrir enlace". */
const NT_REDES = {
  facebook:  { txt: 'Ver en Facebook',        cls: 'nt-fb',  ico: 'facebook' },
  instagram: { txt: 'Ver en Instagram',       cls: 'nt-ig',  ico: 'instagram' },
  x:         { txt: 'Ver en X',               cls: 'nt-x',   ico: 'x' },
  youtube:   { txt: 'Ver el video',           cls: 'nt-yt',  ico: 'youtube' },
  tiktok:    { txt: 'Ver en TikTok',          cls: 'nt-tt',  ico: 'tiktok' },
  whatsapp:  { txt: 'Abrir en WhatsApp',      cls: 'nt-wa',  ico: 'wa' },
  forms:     { txt: 'Responder el formulario',cls: 'nt-form',ico: 'form' },
  maps:      { txt: 'Ver la ubicación',       cls: 'nt-map', ico: 'map' },
  doc:       { txt: 'Abrir el documento',     cls: 'nt-doc', ico: 'doc' },
  web:       { txt: 'Abrir enlace',           cls: 'nt-web', ico: 'web' }
};
/* Se deriva del enlace aquí (no del servidor): el botón siempre queda bien
   aunque el CORE todavía no tenga la detección nueva. */
function ntRedDe(url) {
  const u = String(url || '').trim().toLowerCase();
  if (!u) return '';
  if (/facebook\.com|fb\.watch|fb\.me/.test(u)) return 'facebook';
  if (/instagram\.com|instagr\.am/.test(u)) return 'instagram';
  if (/(^|\/\/)(www\.)?(x\.com|twitter\.com)/.test(u)) return 'x';
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
  if (/tiktok\.com/.test(u)) return 'tiktok';
  if (/wa\.me|whatsapp\.com/.test(u)) return 'whatsapp';
  if (/forms\.gle|docs\.google\.com\/forms|forms\.office\.com|typeform\.com/.test(u)) return 'forms';
  if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|waze\.com/.test(u)) return 'maps';
  if (/docs\.google\.com|drive\.google\.com|\.pdf($|\?)|sheets\.google\.com/.test(u)) return 'doc';
  return 'web';
}
/* Para un enlace cualquiera, el botón dice a dónde lleva: "Ver en alcaldia.gov.co" */
function ntDominio(url) {
  try { return new URL(String(url)).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function ntBoton(enlace) {
  const tipo = ntRedDe(enlace);
  const base = NT_REDES[tipo] || NT_REDES.web;
  if (tipo !== 'web') return base;
  const dom = ntDominio(enlace);
  return { txt: dom ? `Ver en ${dom}` : base.txt, cls: base.cls, ico: base.ico };
}

function ntCardHtml(n, nueva) {
  const red = ntBoton(n.enlace);
  const rel = ntRelativa(n.ts);
  return `<article class="nt-card${nueva ? ' nt-new' : ''}" data-id="${esc(n.id)}">
    ${nueva ? '<span class="nt-flag">Nuevo</span>' : ''}
    <h3 class="nt-titulo">${esc(n.titulo)}</h3>
    <p class="nt-fecha">${esc(ntFecha(n.fecha))}${rel ? ' · ' + esc(rel) : ''}</p>
    <div class="nt-cuerpo">${esc(n.cuerpo)}</div>
    ${n.enlace ? `<a class="nt-link ${red.cls}" href="${esc(n.enlace)}" target="_blank" rel="noopener noreferrer">${I[red.ico] || I.web} ${esc(red.txt)}</a>` : ''}
  </article>`;
}

/* Tarjeta de arriba: activar / estado de los avisos */
function ntAvisosHtml() {
  if (!ntSoporta()) {
    return `<div class="nt-avisos nt-avisos-off"><div class="nt-ico">${I.news}</div>
      <div><b>Avisos no disponibles</b><span class="small muted">Tu navegador no los permite. Igual verás aquí todas las noticias.</span></div></div>`;
  }
  const p = ntPermiso();
  if (p === 'granted' && ntTokenLocal()) {
    // Sin botón de desactivar (decisión del usuario): una vez activados, se quedan.
    // Quien de verdad quiera apagarlos puede hacerlo desde los ajustes del navegador.
    return `<div class="nt-avisos nt-avisos-on"><div class="nt-ico">${I.news}</div>
      <div><b>Avisos activados 🔔</b><span class="small muted">Te avisamos apenas haya una noticia.</span></div></div>`;
  }
  if (p === 'denied') {
    return `<div class="nt-avisos nt-avisos-off"><div class="nt-ico">${I.news}</div>
      <div><b>Avisos bloqueados</b><span class="small muted">Los bloqueaste en tu navegador. Puedes permitirlos desde los ajustes del sitio.</span></div></div>`;
  }
  // Ajuste 20/07: sin botón "Activar" — la activación se hace en la puerta de
  // acceso. Aquí solo se informa el estado.
  return `<div class="nt-avisos"><div class="nt-ico">${I.news}</div>
    <div><b>Avisos</b><span class="small muted">Te avisaremos apenas haya una noticia nueva.</span></div></div>`;
}

function ntPintarAvisos(user) {
  const el = $('#nt-avisos'); if (!el) return;
  el.innerHTML = ntAvisosHtml();
  const on = $('#nt-on');
  if (on) on.onclick = async () => { saving(on, true); const ok = await ntActivarAvisos(user); saving(on, false); if (ok) ntPintarAvisos(user); };
}

/* ---------- Puerta de acceso (ajuste 20/07) ----------
   Al tocar por primera vez el banner/tile de "Ponte al día" NO se pregunta si
   activa avisos: solo si desea ingresar. Al aceptar se activan (el permiso lo
   pide el navegador por su cuenta) y quedan activados sin desactivar. Si ya
   pasó la puerta o ya tiene avisos, entra directo. */
const NT_GATE_KEY = nsKey('jp_ponteAlDia_gate');
function abrirPonteAlDia(user) {
  let pasada = false; try { pasada = localStorage.getItem(NT_GATE_KEY) === '1'; } catch {}
  const yaActivo = (ntPermiso() === 'granted' && ntTokenLocal());
  if (pasada || yaActivo) return go('noticias');
  openSheet(`<div class="grip"></div><div class="center stack"><div class="nt-ico">${I.news}</div>
    <h2 class="h2">Ponte al día</h2>
    <p class="muted">Entérate de cada anuncio de la campaña apenas se publique. ¿Quieres ingresar?</p>
    <button class="btn btn-primary btn-block" id="pad-si">Ingresar a Ponte al día</button>
    <button class="btn btn-quiet btn-block" data-close>Ahora no</button></div>`);
  $('#pad-si').onclick = async () => {
    try { localStorage.setItem(NT_GATE_KEY, '1'); } catch {}
    closeLayer();
    try { await ntActivarAvisos(user); } catch {}   // best-effort; iOS no-standalone entra igual
    go('noticias');
  };
}

/* ---------- Vista ---------- */
async function viewNoticias(user) {
  NT_ME = user; appWide(true);   // en PC el feed se expande (patrón de Comerciantes)
  ntTeardown(); window.__ntTeardown = ntTeardown;
  app.innerHTML = `${backbar('Ponte al día')}
    <div class="pad stack">
      <div id="nt-avisos"></div>
      <div id="nt-nueva"></div>
      <div id="nt-body">${loadingBox('Cargando noticias…')}</div>
    </div>`;
  app.hidden = false; hideSplash();
  $('#backbtn').onclick = () => { ntTeardown(); window.__ntTeardown = null; go('home'); };
  ntPintarAvisos(user);
  await ntCargar(false);
  ntInitSignal();
}

async function ntCargar(avisar) {
  const body = $('#nt-body'); if (!body) return;
  try {
    const r = await api('pub.noticias');
    NT_ALL = (r && r.items) || [];
  } catch (e) {
    body.innerHTML = `<p class="muted center">No pudimos cargar las noticias. Revisa tu conexión.</p>`;
    return;
  }
  const nu = $('#nt-nueva'); if (nu) nu.innerHTML = '';
  const leidas = ntLeidas();
  if (!NT_ALL.length) {
    body.innerHTML = `<div class="nt-vacio">${I.news}<b>Todavía no hay noticias</b><span class="small muted">Cuando publiquemos algo, lo verás aquí.</span></div>`;
  } else {
    body.innerHTML = `<div class="nt-feed">${NT_ALL.map(n => ntCardHtml(n, n.ts > leidas)).join('')}</div>`;
  }
  if (avisar) toast('Noticias actualizadas', 'ok');
  // Marcar como leídas después de un momento (para que se alcance a ver la franja "Nuevo")
  const top = NT_ALL.length ? NT_ALL[0].ts : 0;
  if (top) setTimeout(() => ntMarcarLeidas(top), 1500);
}

/* Cuántas noticias no ha visto este dispositivo (alimenta el banner del Inicio) */
function ntNoLeidas(items) {
  const leidas = ntLeidas();
  return (items || []).filter(n => n.ts > leidas).length;
}

/* ============================================================
   ARRANQUE  (gate de instalación como SEP-GROUP)
   ============================================================ */
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
async function initApp() {
  if (typeof APP_VERSION !== 'undefined' && APP_VERSION) { APP_VERSION_LOADED = String(APP_VERSION); paintVersion(APP_VERSION_LOADED); }
  checkVersion(); setInterval(checkVersion, 60000);
  // Carga de enlaces configurables (no bloquea el arranque)
  api('pub.config').then(c => { if (c) { APP_CONFIG = c; if (c.comercioUrl) COMERCIO_URL = c.comercioUrl; } }).catch(() => {});
  const hash = location.hash || '';
  const arranqueLimpio = (hash === '' || hash === '#/' || hash.startsWith('#/login'));
  const yaContinuoWeb = sessionStorage.getItem(nsKey('continuedWeb')) === '1';
  // Gate: la vista Instalar es la PRIMERA pantalla, siempre que se entre desde el
  // navegador. Solo se salta si la app ya corre instalada (standalone) o si en
  // ESTA sesión ya eligió "Continuar en el navegador" (para no repetirla en cada
  // recarga de la misma pestaña; en una sesión nueva vuelve a salir).
  if (!isStandalone() && !yaContinuoWeb && arranqueLimpio) { location.hash = '#/instalar'; }
  render();
}
initApp();


/* ============================================================
   NUESTRA CASA SOCIAL  (Módulo 9)
   Todo sale de lo que se ajusta en la app privada → Configuración.
   Las redes sociales viven DENTRO de esta vista.
   ============================================================ */
let CASA = null;

async function viewCasa(user) {
  app.innerHTML = `${backbar('Nuestra casa social')}<div class="pad stack" id="casa-body">${loadingBox('Cargando la programación…')}</div>`;
  app.hidden = false; hideSplash(); appWide(true);   /* 23/07 */
  $('#backbtn').onclick = () => go('home');
  try {
    CASA = await api('pub.casa');
    casaPintar();
  } catch (e) {
    $('#casa-body').innerHTML = `<div class="card pad center"><p class="muted">No se pudo cargar la casa social. Revisa tu conexión.</p></div>`;
  }
}

/* ¿La coordenada sirve? No basta con que venga: durante un tiempo la hoja
   guardó "4289013" (se comió el punto decimal) y el botón de recorrido
   apuntaba a la nada. Si no es un punto válido, no se pinta el mapa. */
function casaCoordOk(lat, lng) {
  const a = Number(lat), b = Number(lng);
  if (!isFinite(a) || !isFinite(b)) return false;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return false;
  return !(a === 0 && b === 0);
}

function casaPintar() {
  const c = CASA;
  const hayMapa = casaCoordOk(c.lat, c.lng);

  const dias = c.dias.length ? c.dias.map(d => `
    <article class="casa-dia">
      ${d.imagen ? `<img class="casa-dia-img" src="${esc(d.imagen)}" alt="" loading="lazy" onerror="this.remove()" />` : ''}
      <div class="casa-dia-b">
        <h3 class="casa-dia-t">${esc(d.label)}</h3>
        <ul class="casa-items">
          ${d.items.map(i => `<li class="casa-item">
            <span class="casa-item-p"></span>
            <div><span class="casa-item-x">${esc(i.item)}</span>
            ${i.horario ? `<span class="casa-item-h">${esc(i.horario)}</span>` : ''}
            ${i.descripcion ? `<span class="casa-item-d">${esc(i.descripcion)}</span>` : ''}</div>
          </li>`).join('')}
        </ul>
      </div>
    </article>`).join('')
    : `<div class="card pad center"><p class="muted">Pronto publicaremos la programación.</p></div>`;

  const redes = c.redes.length ? `
    <section class="casa-redes">
      <h3 class="casa-h">${esc(c.redesTitulo || 'Conoce nuestras redes sociales')}</h3>
      ${c.redesSub ? `<p class="casa-sub">${esc(c.redesSub)}</p>` : ''}
      <div class="casa-redes-g">
        ${c.redes.map(r => {
          const red = NT_REDES[ntRedDe(r.enlace)] || NT_REDES.web;
          return `<a class="nt-link ${red.cls}" href="${esc(r.enlace)}" target="_blank" rel="noopener noreferrer">${I[red.ico] || I.web} ${esc(r.nombre)}</a>`;
        }).join('')}
      </div>
    </section>` : '';

  /* Mapa + Iniciar recorrido: en el celular, Waze y Maps; en PC, Waze no sirve.
     El mapa es un embed de Google Maps (sin API key, como en la app vieja),
     pero con el alto puesto por CSS: en la vieja el iframe vivía dentro de un
     div sin altura y salía aplastado en una franja. */
  const coord = encodeURIComponent(Number(c.lat) + ',' + Number(c.lng));
  const recorrido = hayMapa ? `
    <section class="casa-ir">
      ${c.direccion ? `<p class="casa-dir">${I.map} ${esc(c.direccion)}</p>` : ''}
      <div class="casa-map">
        <iframe src="https://www.google.com/maps?q=${coord}&z=17&hl=es&output=embed"
                loading="lazy" referrerpolicy="no-referrer-when-downgrade"
                title="Dónde queda la casa social"></iframe>
      </div>
      <div class="casa-ir-b">
        <a class="btn btn-primary btn-block" id="casa-maps" href="https://www.google.com/maps/dir/?api=1&destination=${coord}" target="_blank" rel="noopener noreferrer">${I.map} Iniciar recorrido</a>
        ${esMovil() ? `<a class="btn btn-ghost btn-block" id="casa-waze" href="https://waze.com/ul?ll=${coord}&navigate=yes" target="_blank" rel="noopener noreferrer">Abrir en Waze</a>` : ''}
      </div>
    </section>` : '';

  $('#casa-body').innerHTML = `
    <section class="casa-top">
      <h2 class="casa-tit">${esc(c.titulo)}</h2>
      ${c.intro ? `<p class="casa-intro">${esc(c.intro)}</p>` : ''}
    </section>
    <div class="casa-dias">${dias}</div>
    ${c.cierre ? `<p class="casa-cierre">${esc(c.cierre)}</p>` : ''}
    ${recorrido}
    ${redes}
    ${c.hashtags ? `<p class="casa-tags">${esc(c.hashtags)}</p>` : ''}`;
}

/* ============================================================
   NÚMEROS DE EMERGENCIA  (Módulo 9)
   En el computador NO se muestra "Llamar": tel: no hace nada ahí.
   ============================================================ */
const EM_TIPOS = {
  POLICIA:  { label: 'Policía',  cls: 'em-pol' },
  BOMBEROS: { label: 'Bomberos', cls: 'em-bom' },
  SALUD:    { label: 'Salud',    cls: 'em-sal' },
  OTRO:     { label: 'Contacto', cls: 'em-otr' }
};

async function viewEmergencia(user) {
  app.innerHTML = `${backbar('Números de emergencia')}<div class="pad stack" id="em-body">${loadingBox('Cargando contactos…')}</div>`;
  app.hidden = false; hideSplash(); appWide(true);   /* 23/07 */
  $('#backbtn').onclick = () => go('home');
  try {
    const e = await api('pub.emergencia');
    emPintar(e);
  } catch (err) {
    $('#em-body').innerHTML = `<div class="card pad center"><p class="muted">No se pudieron cargar los contactos. Revisa tu conexión.</p></div>`;
  }
}

function emPintar(e) {
  const movil = esMovil();
  const cards = e.items.length ? e.items.map(i => {
    const t = EM_TIPOS[i.tipo] || EM_TIPOS.OTRO;
    const tel = i.fijo || i.whatsapp;
    return `<article class="em-card">
      <div class="em-top">
        <span class="em-tipo ${t.cls}">${esc(t.label)}</span>
        <h3 class="em-nom">${esc(i.nombre)}</h3>
        <p class="em-num">${esc(i.whatsapp || i.fijo)}</p>
      </div>
      <div class="em-acts">
        ${i.whatsapp ? `<a class="btn btn-primary em-btn" href="https://wa.me/${esc(i.whatsapp)}" target="_blank" rel="noopener noreferrer">${I.wa} WhatsApp</a>` : ''}
        ${movil && tel ? `<a class="btn btn-ghost em-btn" href="tel:${esc(tel)}">${I.phone} Llamar</a>` : ''}
      </div>
    </article>`;
  }).join('') : `<div class="card pad center"><p class="muted">Aún no hay contactos publicados.</p></div>`;

  $('#em-body').innerHTML = `
    ${e.sub ? `<p class="em-sub">${esc(e.sub)}</p>` : ''}
    <div class="em-grid">${cards}</div>
    ${movil ? '' : '<p class="em-nota">Para llamar, abre esta página desde tu celular.</p>'}`;
}
