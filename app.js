/* ============================================================
   JHONNY PERDOMO — App Pública · app.js
   ============================================================ */

/* ⚙️ PEGA AQUÍ la URL del Web App del backend JHONNY CORE (/exec) */
const API_URL = 'https://script.google.com/macros/s/AKfycbxXlxYzr6cTilsvSTGH6l0CGjLb35a7xyvgFgd5EMnLtWIfR8isHiSGSqCdNqlUYE2P/exec';

const APP_ICON   = 'https://res.cloudinary.com/dqqeavica/image/upload/v1753538807/JHONNY_PERDOMO_dn3dah.png';
const APP_BANNER = 'https://res.cloudinary.com/dqqeavica/image/upload/v1753538919/BANNER_JHONNY_e0yw7m.png';

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

/* ---------- Cliente API ---------- */
async function api(action, params = {}, method = 'GET', body = null) {
  if (API_URL.startsWith('PEGA_AQUI')) { toast('Falta configurar la URL del backend', 'err'); throw new Error('API_URL sin configurar'); }
  const qs = new URLSearchParams(Object.assign({ action }, params)).toString();
  const opts = { method };
  if (method === 'POST') { opts.headers = { 'Content-Type': 'text/plain;charset=utf-8' }; opts.body = JSON.stringify(body || {}); }
  const res = await fetch(`${API_URL}?${qs}`, opts);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error del servidor');
  return json.data;
}

/* ---------- Sesiones en el dispositivo ---------- */
const SS_KEY = 'jp_sessions', ACT_KEY = 'jp_active';
const getSessions = () => { try { return JSON.parse(localStorage.getItem(SS_KEY)) || []; } catch { return []; } };
function saveSession(u) { const list = getSessions().filter(x => x.documento !== u.documento); list.unshift(u); localStorage.setItem(SS_KEY, JSON.stringify(list.slice(0, 6))); localStorage.setItem(ACT_KEY, u.documento); }
const getActive = () => { const d = localStorage.getItem(ACT_KEY); return getSessions().find(x => x.documento === d) || null; };
const setActive = (doc) => localStorage.setItem(ACT_KEY, doc);
function logout() { localStorage.removeItem(ACT_KEY); go('login'); }

/* ============================================================
   PWA: INSTALACIÓN  (patrón SEP-GROUP)
   ============================================================ */
let deferredPrompt = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: installed)').matches || window.navigator.standalone === true;
const isIOS = () => /(iphone|ipad|ipod)/i.test(navigator.userAgent || '');
const isMarkedInstalled = () => { try { return localStorage.getItem('pwaInstalledFlag') === '1'; } catch { return false; } };
const markInstalled = () => { try { localStorage.setItem('pwaInstalledFlag', '1'); } catch {} };
async function detectInstalled() {
  if (isStandalone()) return true;
  if (typeof navigator.getInstalledRelatedApps === 'function') { try { const a = await navigator.getInstalledRelatedApps(); if (a.some(x => x.platform === 'webapp')) { markInstalled(); return true; } } catch {} }
  return isMarkedInstalled();
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if (location.hash === '#/instalar') updateInstallSection(); });
window.addEventListener('appinstalled', () => { markInstalled(); deferredPrompt = null; toast('¡App instalada!', 'ok'); });

function updateInstallSection() {
  const and = $('#install-android'), ios = $('#install-ios'); if (!and || !ios) return;
  and.classList.add('hidden'); ios.classList.add('hidden');
  if (isIOS()) ios.classList.remove('hidden');
  else { and.classList.remove('hidden'); const b = $('#btn-install'); if (b) b.style.display = deferredPrompt ? '' : 'none'; }
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
    if (v !== APP_VERSION_LOADED) { try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch {} location.reload(); }
  } finally { __verInFlight = false; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });

/* ---------- Plan Premium / Estándar ---------- */
function planUser(user) { const m = (user.municipio || '').trim().toUpperCase(); return (m === 'FLANDES' || m === 'A LA ESPERA') ? { premium: true, label: '⭐ Usuario Premium' } : { premium: false, label: 'Usuario Estándar' }; }

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
function backbar(title) { return `<div class="appbar"><button class="icon-btn" id="backbtn">${I.back}</button><div class="who"><b>${esc(title)}</b><span>Jhonny Perdomo</span></div></div>`; }
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
function saving(btn, on) { btn.disabled = on; btn.dataset.txt = btn.dataset.txt || btn.innerHTML; btn.innerHTML = on ? '<span class="spinner"></span>' : btn.dataset.txt; }

/* ---------- Íconos ---------- */
const I = {
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  swap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3 21 7l-4 4"/><path d="M21 7H9"/><path d="M7 21 3 17l4-4"/><path d="M3 17h12"/></svg>',
  help:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  idea:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.79.65-1.5 1.41-2a5 5 0 1 0-5 0c.76.5 1.23 1.21 1.41 2"/></svg>',
  news:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V9h4"/><path d="M10 6h8M10 10h8M10 14h5"/></svg>',
  home2:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>',
  store:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1-5h16l1 5"/><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M3 9h18"/><path d="M9 22V12h6v10"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.5 5.8 21 7 14 2 9.3 9 8.5 12 2"/></svg>',
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.2-5.6A8.4 8.4 0 1 1 21 11.5Z"/></svg>',
  card:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/></svg>',
  logout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  play:'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>'
};

/* ---------- Menú ---------- */
const MENU = [
  { id:'tarjeta',   icon:'card',  title:'Mi tarjeta',            desc:'Tu carné digital con QR', gold:true, wide:true },
  { id:'datos',     icon:'user',  title:'Actualizar datos',      desc:'Corrige tu información' },
  { id:'solicitud', icon:'help',  title:'Realiza tu solicitud',  desc:'Pide un servicio' },
  { id:'ideas',     icon:'idea',  title:'Suma tus ideas',        desc:'Propón para Flandes' },
  { id:'noticias',  icon:'news',  title:'Ponte al día',          desc:'Últimas noticias' },
  { id:'casa',      icon:'home2', title:'Nuestra casa social',   desc:'Programación y redes' },
  { id:'emergencia',icon:'phone', title:'Números de emergencia', desc:'Contactos útiles' },
  { id:'comercio',  icon:'store', title:'Comerciantes amigos',   desc:'Descubre y apoya' },
  { id:'refiere',   icon:'wa',    title:'Refiere por WhatsApp',   desc:'Invita a los tuyos' },
  { id:'lideres',   icon:'star',  title:'Líderes',               desc:'Zona de líderes' }
];
const IMPLEMENTADAS = new Set(['tarjeta', 'datos', 'solicitud', 'ideas']);

/* ============================================================
   RÚTER
   ============================================================ */
function go(route) { location.hash = '#/' + route; }
window.addEventListener('hashchange', render);
function render() {
  const route = (location.hash.replace(/^#\//, '') || '').split('?')[0];
  const user = getActive();
  if (route === 'instalar') return viewInstalar();
  if (route === 'registro') return viewRegistro();
  if (!user && route !== 'login') return go('login');
  if (route === 'login' || !user) return viewLogin();
  switch (route) {
    case 'tarjeta':   return viewTarjeta(user);
    case 'datos':     return viewDatos(user);
    case 'solicitud': return viewSolicitud(user);
    case 'ideas':     return viewIdeas(user);
    default:          return viewHome(user);
  }
}

/* ============================================================
   VISTA INSTALAR  (patrón SEP-GROUP)
   ============================================================ */
function viewInstalar() {
  app.innerHTML = `
    <div class="login-wrap"><div class="login-card">
      <img class="login-logo" src="${APP_ICON}" alt="Jhonny Perdomo" />
      <h1 class="login-title">Jhonny Perdomo</h1>
      <p class="login-sub">Instala la aplicación para acceder más rápido y usarla como app nativa.</p>

      <div id="install-android" class="hidden" style="margin-top:16px;">
        <button id="btn-install" class="btn btn-primary btn-block" style="display:none;">📲 Instalar aplicación</button>
        <button id="btn-cont-web" class="btn btn-ghost btn-block" style="margin-top:10px;">🌐 Continuar en el navegador</button>
      </div>
      <div id="install-ios" class="hidden" style="margin-top:16px;">
        <p class="small" style="text-align:left;color:var(--muted);">En tu iPhone o iPad:</p>
        <ol class="ios-steps"><li>Pulsa <b>Compartir</b> en Safari.</li><li>Elige <b>“Añadir a pantalla de inicio”</b>.</li><li>Pulsa <b>“Añadir”</b>.</li></ol>
        <button id="btn-cont-web-ios" class="btn btn-ghost btn-block" style="margin-top:8px;">🌐 Continuar en el navegador</button>
      </div>

      ${footBrand()}
    </div></div>`;
  app.hidden = false; hideSplash(); paintVersion(APP_VERSION_LOADED || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''));
  updateInstallSection();
  const cont = () => { sessionStorage.setItem('continuedWeb', '1'); go('login'); };
  const bi = $('#btn-install');
  if (bi) bi.onclick = async () => {
    if (!deferredPrompt) { toast('La instalación aún no está disponible. Usa el menú del navegador.'); return; }
    const dp = deferredPrompt; dp.prompt(); try { await dp.userChoice; } catch {} deferredPrompt = null; updateInstallSection();
  };
  const cw = $('#btn-cont-web'); if (cw) cw.onclick = cont;
  const cwi = $('#btn-cont-web-ios'); if (cwi) cwi.onclick = cont;
}

/* ============================================================
   LOGIN  (pestañas PIN rápido / Documento — patrón SEP-GROUP)
   ============================================================ */
let pinBuffer = '', pinTarget = null; // pinTarget: null = PIN rápido ; o {documento, nombre}
function viewLogin() {
  const sesiones = getSessions();
  const startTab = sesiones.length ? 'pin' : 'doc';
  app.innerHTML = `
    <div class="login-wrap"><div class="login-card">
      <img class="login-logo" src="${APP_ICON}" alt="Jhonny Perdomo" />
      <h1 class="login-title">Bienvenido</h1>
      <p class="login-sub">Soy de Flandes · Jhonny Perdomo</p>

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
        <button class="btn btn-primary btn-block" id="btn-login-doc" style="margin-top:8px;">Continuar</button>
        <button class="btn btn-quiet btn-block" id="goReg" style="margin-top:8px;">Crear mi registro</button>
      </div>

      ${footBrand()}
    </div></div>`;
  app.hidden = false; hideSplash(); paintVersion(APP_VERSION_LOADED || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''));
  pinBuffer = ''; pinTarget = null; paintPin();

  $$('.login-tab').forEach(tab => tab.onclick = () => {
    $$('.login-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
    const w = tab.dataset.tab; $('#tab-doc').classList.toggle('hidden', w !== 'doc'); $('#tab-pin').classList.toggle('hidden', w !== 'pin');
    if (w === 'pin') { pinTarget = null; pinBuffer = ''; paintPin(); $('#pin-hint').textContent = getSessions().length ? 'Ingresa tu PIN (últimos 4 de tu documento)' : 'Elige la pestaña Documento para tu primer ingreso'; }
  });

  const doc = $('#login-doc'); onlyDigits(doc);
  doc.addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-login-doc').click(); });
  $('#goReg').onclick = () => go('registro');
  $('#btn-login-doc').onclick = async () => {
    const d = onlyDig(doc.value);
    if (!/^\d{6,10}$/.test(d)) return toast('Documento inválido (6 a 10 dígitos)', 'err');
    const btn = $('#btn-login-doc'); saving(btn, true);
    try {
      const r = await api('pub.validarDoc', { documento: d });
      saving(btn, false);
      if (!r.existe) { return offerReg(d); }
      // pasar a PIN, fijado a este documento
      pinTarget = { documento: d, nombre: r.nombre }; pinBuffer = '';
      $$('.login-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'pin'));
      $('#tab-doc').classList.add('hidden'); $('#tab-pin').classList.remove('hidden');
      $('#pin-hint').textContent = 'Hola, ' + primerNombre(r.nombre) + ' — ingresa tu PIN';
      paintPin();
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };

  $$('.pin-key').forEach(k => k.onclick = () => onPinKey(k.dataset.key));

  function offerReg(d) {
    openSheet(`<div class="grip"></div><h2 class="h2">No estás registrado</h2><p class="muted">No encontramos ese documento. ¿Quieres crear tu registro ahora?</p><div class="stack" style="margin-top:14px;"><button class="btn btn-primary btn-block" id="ir-reg">Crear mi registro</button><button class="btn btn-quiet btn-block" data-close>Revisar el documento</button></div>`);
    $('#ir-reg').onclick = () => { closeLayer(); location.hash = '#/registro?doc=' + d; };
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
  // Documento fijado (desde pestaña Documento)
  if (pinTarget) return loginCon(pinTarget.documento, pin);
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
    saveSession(r.user); go('home');
  } catch (e) { toast('Error de conexión', 'err'); pinBuffer = ''; paintPin(); }
}

/* ============================================================
   REGISTRO (consulta el documento primero)
   ============================================================ */
async function viewRegistro() {
  const pre = new URLSearchParams(location.hash.split('?')[1] || '').get('doc') || '';
  app.innerHTML = `${backbar('Crear mi registro')}<div id="reg-body"></div>`;
  app.hidden = false; hideSplash(); $('#backbtn').onclick = () => go('login');
  if (pre && /^\d{6,10}$/.test(pre)) return regForm(pre);
  stepDoc();

  function stepDoc() {
    $('#reg-body').innerHTML = `<div class="pad stack"><p class="muted">Primero verifica tu documento. Si ya estás en la base, no hace falta registrarte otra vez.</p><div class="card pad stack"><label class="field"><span>Documento</span><input class="input" id="rq-doc" inputmode="numeric" placeholder="Tu número de documento" /></label><button class="btn btn-primary btn-block" id="rq-consultar">Consultar</button></div></div>`;
    const d = $('#rq-doc'); onlyDigits(d);
    d.addEventListener('keydown', e => { if (e.key === 'Enter') $('#rq-consultar').click(); });
    $('#rq-consultar').onclick = async () => {
      const doc = onlyDig(d.value); if (!/^\d{6,10}$/.test(doc)) return toast('Documento inválido (6 a 10 dígitos)', 'err');
      const btn = $('#rq-consultar'); saving(btn, true);
      try {
        const r = await api('pub.validarDoc', { documento: doc }); saving(btn, false);
        if (r.existe) { openSheet(`<div class="grip"></div><h2 class="h2">Ya estás registrado</h2><p class="muted"><b>${esc(r.nombre)}</b>, ya estás en la base. Ingresa con tu PIN (los últimos 4 de tu documento).</p><button class="btn btn-primary btn-block" id="ir-log" style="margin-top:14px;">Ir a ingresar</button>`); $('#ir-log').onclick = () => { closeLayer(); go('login'); }; return; }
        regForm(doc);
      } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
    };
  }
  async function regForm(doc) {
    $('#reg-body').innerHTML = `<div class="pad stack"><p class="muted">Documento <b>${esc(doc)}</b> disponible. Completa tu registro. Tu PIN serán los <b>últimos 4 dígitos</b> de tu documento.</p><div class="card pad stack">${field('Nombre completo', inputEl('r-nombre', 'placeholder="Solo letras"'))}${field('WhatsApp', inputEl('r-tel', 'inputmode="numeric" maxlength="10" placeholder="Número de 10 dígitos"'))}${field('Residencia', comboboxHtml('r-resi', 'Escribe para buscar tu residencia'))}${referidoBlock('r')}<button class="btn btn-primary btn-block" id="r-save">Crear mi registro</button></div></div>`;
    onlyLetters($('#r-nombre')); onlyDigits($('#r-tel')); getResidencias().then(l => bindCombobox('r-resi', l)).catch(() => {}); bindReferido('r');
    $('#r-save').onclick = async () => {
      const body = { documento: doc, nombre: val('r-nombre'), telefono: onlyDig(val('r-tel')), residencia: val('r-resi'), referencia: refValue('r') };
      if (!body.nombre || /\d/.test(body.nombre)) return toast('Escribe tu nombre (solo letras)', 'err');
      if (!/^\d{10}$/.test(body.telefono)) return toast('El WhatsApp debe tener exactamente 10 dígitos', 'err');
      if (!body.residencia) return toast('Selecciona tu residencia', 'err');
      if (body.referencia && !/^\d{1,3}$/.test(body.referencia)) return toast('El N° de Referido tiene 1 a 3 dígitos', 'err');
      const ok = await confirmar('Confirma tu registro', crow('Nombre', body.nombre) + crow('Documento', doc) + crow('WhatsApp', body.telefono) + crow('Residencia', body.residencia) + crow('Referido', body.referencia || 'Sin referido'));
      if (!ok) return;
      const btn = $('#r-save'); saving(btn, true);
      try {
        const r = await api('pub.registrar', {}, 'POST', body);
        if (!r.success) { toast(r.message || 'No pudimos registrarte', 'err'); saving(btn, false); return; }
        const lg = await api('pub.login', {}, 'POST', { documento: doc, pin: doc.slice(-4) });
        if (lg.ok) { saveSession(lg.user); toast('¡Registro exitoso! Bienvenido', 'ok'); go('home'); } else { toast('Registro exitoso. Ingresa con tu documento', 'ok'); go('login'); }
      } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
    };
  }
}

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
    try { const r = await api('pub.solicitud', {}, 'POST', body); if (!r.success) { toast(r.message || 'No se pudo enviar', 'err'); saving(btn, false); return; } toast('Solicitud enviada', 'ok'); go('home'); } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}
async function viewIdeas(user) {
  app.innerHTML = `${backbar('Suma tus ideas')}<div class="pad stack"><p class="muted">Comparte tus ideas para Flandes. Llena solo los aspectos que quieras.</p><div class="card pad stack">${field('Social', areaEl('i-social', 'Ideas sociales…'))}${field('Institucional', areaEl('i-institucional', 'Ideas institucionales…'))}${field('Económico', areaEl('i-economico', 'Ideas económicas…'))}${field('Ambiental', areaEl('i-ambiental', 'Ideas ambientales…'))}${field('Otros', areaEl('i-otros', 'Otras ideas…'))}<button class="btn btn-primary btn-block" id="i-save">Enviar mis ideas</button></div></div>`;
  app.hidden = false; hideSplash(); $('#backbtn').onclick = () => go('home');
  const p = await prefill(user);
  $('#i-save').onclick = async () => {
    const body = { documento: user.documento, nombre: p.nombre, telefono: p.telefono, residencia: p.residencia, social: val('i-social'), institucional: val('i-institucional'), economico: val('i-economico'), ambiental: val('i-ambiental'), otros: val('i-otros') };
    if (!(body.social || body.institucional || body.economico || body.ambiental || body.otros)) return toast('Escribe al menos una idea', 'err');
    const ok = await confirmar('Confirma tus ideas', crowBlock('Social', body.social) + crowBlock('Institucional', body.institucional) + crowBlock('Económico', body.economico) + crowBlock('Ambiental', body.ambiental) + crowBlock('Otros', body.otros)); if (!ok) return;
    const btn = $('#i-save'); saving(btn, true);
    try { const r = await api('pub.ideas', {}, 'POST', body); if (!r.success) { toast(r.message || 'No se pudo enviar', 'err'); saving(btn, false); return; } toast('¡Gracias por tus ideas!', 'ok'); go('home'); } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* ============================================================
   HOME + TARJETA
   ============================================================ */
async function viewHome(user) {
  const plan = planUser(user);
  app.innerHTML = `${appbar(user)}<div class="pad stack"><div><p class="eyebrow">Soy de Flandes</p><h1 class="h1">Hola, ${esc(primerNombre(user.nombre))} 👋🏾</h1><span class="plan-badge ${plan.premium ? 'premium' : ''}">${esc(plan.label)}</span></div><div id="inicio"><div class="hero"><div class="skeleton" style="aspect-ratio:16/10;"></div></div></div><div id="banner"></div><p class="eyebrow" style="margin-top:6px;">Explora</p><div class="menu-grid">${MENU.map(m => `<button class="tile ${m.gold ? 'gold' : ''} ${m.wide ? 'wide' : ''}" data-id="${m.id}"><span class="ico">${I[m.icon]}</span><span class="txt"><b>${esc(m.title)}</b><br><span>${esc(m.desc)}</span></span></button>`).join('')}</div><p class="center small muted" style="margin-top:10px;">Jhonny Perdomo · Flandes, Tolima</p></div>`;
  app.hidden = false; hideSplash(); bindAppbar(user);
  app.querySelectorAll('.tile').forEach(t => t.onclick = () => openMenu(t.dataset.id, user));
  try {
    const d = await api('pub.inicio'); const cont = $('#inicio');
    const media = d.imagen ? `<img class="hero-img" src="${esc(d.imagen)}" alt="Jhonny Perdomo" onerror="this.replaceWith(heroFallback())" />` : heroFallback().outerHTML;
    const play = d.reel ? `<button class="hero-play" id="playReel">${I.play} Ver reel</button>` : '';
    cont.innerHTML = `<div class="hero">${media}${play}</div>`;
    if (d.reel) $('#playReel').onclick = () => openVideo(d.reel);
    if (d.hayNoticias) { $('#banner').innerHTML = `<button class="banner"><span class="dot"></span><div><b>Ponte al día</b><br><span class="small muted">Hay ${d.noticias} novedad(es) para ti</span></div></button>`; $('#banner .banner').onclick = () => openMenu('noticias', user); }
  } catch (e) { $('#inicio').innerHTML = `<div class="hero">${heroFallback().outerHTML}</div>`; }
}
function heroFallback() { return h(`<div class="hero-fallback"><b class="h2">Soy de Flandes 💪🏾</b><span class="small">Juntos por un municipio próspero</span></div>`); }

async function viewTarjeta(user) {
  app.innerHTML = `${appbar(user, 'Mi tarjeta')}<div class="pad stack"><div class="carne"><div class="skeleton" style="height:360px;background:rgba(255,255,255,.2);"></div></div></div>`;
  app.hidden = false; hideSplash(); bindAppbar(user);
  try {
    const d = await api('qr.tarjeta', { documento: user.documento });
    if (!d.ok) return toast(d.msg || 'No encontramos tu tarjeta', 'err');
    const t = d.tarjeta;
    $('.pad').innerHTML = `<div class="carne"><div class="row"><div><div class="label">Portador</div><div class="name">${esc(t.nombre)}</div><div class="doc">CC ${esc(t.documento)}</div></div><img class="carne-logo" src="${APP_ICON}" alt="" /></div><div class="qr-wrap"><img src="${esc(t.qrUrl)}" alt="Código QR" /></div><div class="foot"><span class="idpill">${esc(t.idUsuario)}</span><span class="flag">SOY DE FLANDES</span></div></div><button class="btn btn-ghost btn-block" id="share">${I.share} Compartir mi tarjeta</button><button class="btn btn-quiet btn-block" id="back">Volver al inicio</button>`;
    $('#back').onclick = () => go('home');
    $('#share').onclick = async () => { if (navigator.share) { try { await navigator.share({ title: 'Mi tarjeta · Jhonny Perdomo', text: `${t.nombre} — Soy de Flandes`, url: t.qrUrl }); } catch {} } else window.open(t.qrUrl, '_blank'); };
  } catch (e) { toast('Error al cargar la tarjeta', 'err'); }
}

/* ============================================================
   Navegación / componentes comunes
   ============================================================ */
function openMenu(id, user) {
  if (IMPLEMENTADAS.has(id)) return go(id);
  const item = MENU.find(m => m.id === id) || { title: 'Sección', icon: 'star' };
  openSheet(`<div class="grip"></div><div class="center stack"><div class="ico" style="width:56px;height:56px;margin:0 auto;border-radius:16px;background:var(--brand-050);display:grid;place-content:center;">${I[item.icon] || I.star}</div><h2 class="h2">${esc(item.title)}</h2><p class="muted">Estamos afinando esta sección. Muy pronto la tendrás lista.</p><button class="btn btn-primary btn-block" data-close>Entendido</button></div>`);
}
function appbar(user, titulo) { return `<div class="appbar"><div class="mark">${esc(iniciales(user.nombre))}</div><div class="who"><b>${esc(titulo || primerNombre(user.nombre))}</b><span>${titulo ? 'Jhonny Perdomo' : 'CC ' + esc(user.documento)}</span></div><button class="icon-btn" id="btnSwap" title="Cambiar de cuenta">${I.swap}</button><button class="icon-btn" id="btnOut" title="Salir">${I.logout}</button></div>`; }
function bindAppbar(user) { const s = $('#btnSwap'), o = $('#btnOut'); if (o) o.onclick = () => logout(); if (s) s.onclick = () => openSwitch(); }
function openSwitch() {
  const sesiones = getSessions();
  openSheet(`<div class="grip"></div><h2 class="h2" style="margin-bottom:12px;">Cambiar de cuenta</h2><div class="stack">${sesiones.map(s => `<button class="chip" style="width:100%;justify-content:flex-start;" data-doc="${esc(s.documento)}"><span class="av">${esc(iniciales(s.nombre))}</span>${esc(s.nombre)}</button>`).join('')}<button class="btn btn-quiet btn-block" data-add>+ Entrar con otro documento</button></div>`);
  layer.querySelectorAll('.chip').forEach(c => c.onclick = () => { setActive(c.dataset.doc); closeLayer(); go('home'); });
  const add = layer.querySelector('[data-add]'); if (add) add.onclick = () => { closeLayer(); logout(); };
}
function openSheet(html) { closeLayer(); const bd = h('<div class="backdrop"></div>'); const sh = h(`<div class="sheet">${html}</div>`); bd.onclick = closeLayer; layer.append(bd, sh); sh.querySelectorAll('[data-close]').forEach(b => b.onclick = closeLayer); }
function closeLayer() { layer.innerHTML = ''; }
function ytId(url) { const m = String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/); return m ? m[1] : ''; }
function openVideo(url) { const id = ytId(url); const src = id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1` : url; const bd = h('<div class="backdrop"></div>'); const mv = h(`<div class="modal-video"><button class="close">${I.x}</button><div class="frame"><iframe src="${esc(src)}" allow="autoplay; encrypted-media" allowfullscreen></iframe></div></div>`); bd.onclick = closeLayer; mv.querySelector('.close').onclick = closeLayer; layer.append(bd, mv); }
function hideSplash() { const s = $('#splash'); if (s && !s.classList.contains('hide')) { s.classList.add('hide'); setTimeout(() => s.remove(), 500); } }

/* ============================================================
   ARRANQUE  (gate de instalación como SEP-GROUP)
   ============================================================ */
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
async function initApp() {
  if (typeof APP_VERSION !== 'undefined' && APP_VERSION) { APP_VERSION_LOADED = String(APP_VERSION); paintVersion(APP_VERSION_LOADED); }
  checkVersion(); setInterval(checkVersion, 60000);
  const installed = await detectInstalled();
  if (!installed && !sessionStorage.getItem('continuedWeb') && (location.hash === '' || location.hash.startsWith('#/login'))) { location.hash = '#/instalar'; }
  render();
}
initApp();
