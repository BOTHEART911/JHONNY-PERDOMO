/* ============================================================
   JHONNY PERDOMO — App Pública · app.js
   Login/instalar/versión replicando el patrón de SEP-GROUP.
   ============================================================ */

/* URL del Web App del backend JHONNY CORE (/exec) */
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
const LIDER_REMEMBER_KEY = 'jp_lider_clave';
let LIDER = null; // sesión de zona de líder (se limpia en logout)
const getSessions = () => { try { return JSON.parse(localStorage.getItem(SS_KEY)) || []; } catch { return []; } };
function saveSession(u) { const list = getSessions().filter(x => x.documento !== u.documento); list.unshift(u); localStorage.setItem(SS_KEY, JSON.stringify(list.slice(0, 6))); localStorage.setItem(ACT_KEY, u.documento); }
const getActive = () => { const d = localStorage.getItem(ACT_KEY); return getSessions().find(x => x.documento === d) || null; };
const setActive = (doc) => localStorage.setItem(ACT_KEY, doc);
function logout() { LIDER = null; try { localStorage.removeItem(LIDER_REMEMBER_KEY); } catch {} localStorage.removeItem(ACT_KEY); go('login'); }

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
  if (isIOS()) { ios.classList.remove('hidden'); return; }
  // Android / escritorio
  and.classList.remove('hidden');
  const b = $('#btn-install'), man = $('#install-manual');
  if (deferredPrompt) {
    // El navegador ofrece instalación nativa
    if (b) b.style.display = '';
    if (man) man.classList.add('hidden');
  } else {
    // Sin beforeinstallprompt (típico en escritorio): guía manual clara,
    // nunca un botón muerto. La entrada "Continuar en el navegador" queda visible.
    if (b) b.style.display = 'none';
    if (man) man.classList.remove('hidden');
  }
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
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>',
  eyeOn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.2 3.1M6.6 6.6A13.3 13.3 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/></svg>'
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
const IMPLEMENTADAS = new Set(['tarjeta', 'datos', 'solicitud', 'ideas', 'refiere', 'lideres']);

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
    case 'refiere':   return viewRefiere(user);
    case 'lideres':   return viewLideres(user);
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
        <div id="install-manual" class="hidden ios-steps-wrap">
          <p class="small" style="text-align:left;color:var(--muted);">Para instalarla en tu equipo:</p>
          <ol class="ios-steps">
            <li>Abre el menú <b>⋮</b> del navegador (arriba a la derecha).</li>
            <li>Elige <b>“Instalar aplicación”</b> o <b>“Añadir a la pantalla de inicio”</b>.</li>
            <li>Confirma con <b>“Instalar”</b>.</li>
          </ol>
        </div>
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
let pinBuffer = ''; // PIN rápido: siempre resuelve contra sesiones guardadas en el dispositivo
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
        <button class="btn btn-primary btn-block" id="btn-login-doc" style="margin-top:8px;">Iniciar sesión</button>
        <button class="btn btn-quiet btn-block" id="goReg" style="margin-top:8px;">Crear mi registro</button>
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
  $('#goReg').onclick = () => go('registro');
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
        if (/no est[aá]s registrad/i.test(r.msg || '')) return offerReg(d);
        return toast(r.msg || 'No se pudo iniciar sesión', 'err');
      }
      saveSession(r.user); go('home');
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
    try { const r = await api('pub.solicitud', {}, 'POST', body); if (!r.success) { toast(r.message || 'No se pudo enviar', 'err'); saving(btn, false); return; } celebrar('✅', '¡Solicitud recibida!', 'Pronto te daremos una respuesta. Gracias por confiar en el Equipo del Hacer.'); } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
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
    try { const r = await api('pub.ideas', {}, 'POST', body); if (!r.success) { toast(r.message || 'No se pudo enviar', 'err'); saving(btn, false); return; } celebrar('💡', '¡Gracias por tu idea!', 'Cada idea nos ayuda a construir un mejor Flandes. La tendremos muy en cuenta.'); } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* ============================================================
   HOME + TARJETA
   ============================================================ */
async function viewHome(user) {
  const plan = planUser(user);
  // Sección de líderes (y Refiere, que es solo para líderes) se muestran solo
  // si el usuario está en la hoja LIDERES.
  let esLider = false;
  try { const el = await api('pub.esLider', { documento: user.documento }); esLider = !!(el && el.esLider); } catch {}
  const soloLider = new Set(['lideres', 'refiere']);
  const menu = MENU.filter(m => !soloLider.has(m.id) || esLider);

  app.innerHTML = `${appbar(user)}<div class="pad stack"><div><p class="eyebrow">Soy de Flandes</p><h1 class="h1">Hola, ${esc(primerNombre(user.nombre))} 👋🏾</h1><span class="plan-badge ${plan.premium ? 'premium' : ''}">${esc(plan.label)}</span></div><div id="inicio"><div class="hero"><div class="skeleton" style="aspect-ratio:16/10;"></div></div></div><div id="banner"></div><p class="eyebrow" style="margin-top:6px;">Explora</p><div class="menu-grid">${menu.map(m => `<button class="tile ${m.gold ? 'gold' : ''} ${m.wide ? 'wide' : ''}" data-id="${m.id}"><span class="ico">${I[m.icon]}</span><span class="txt"><b>${esc(m.title)}</b><br><span>${esc(m.desc)}</span></span></button>`).join('')}</div><p class="center small muted" style="margin-top:10px;">Jhonny Perdomo · Flandes, Tolima</p></div>`;
  app.hidden = false; hideSplash(); bindAppbar(user);
  app.querySelectorAll('.tile').forEach(t => t.onclick = () => openMenu(t.dataset.id, user));
  try {
    const d = await api('pub.inicio'); const cont = $('#inicio');
    const media = d.imagen ? `<img class="hero-img" src="${esc(d.imagen)}" alt="Jhonny Perdomo" onerror="this.replaceWith(heroFallback())" />` : heroFallback().outerHTML;
    const play = d.reel ? `<button class="hero-play" id="playReel">${I.play} Ver reel</button>` : '';
    cont.innerHTML = `<div class="hero">${media}${play}<button class="hero-editfoto" id="editFoto">📷 Editar foto</button></div>`;
    if (d.reel) $('#playReel').onclick = () => openVideo(d.reel);
    const ef = $('#editFoto'); if (ef) ef.onclick = () => editarFoto(user);
    if (d.hayNoticias) { $('#banner').innerHTML = `<button class="banner"><span class="dot"></span><div><b>Ponte al día</b><br><span class="small muted">Hay ${d.noticias} novedad(es) para ti</span></div></button>`; $('#banner .banner').onclick = () => openMenu('noticias', user); }
  } catch (e) { $('#inicio').innerHTML = `<div class="hero">${heroFallback().outerHTML}<button class="hero-editfoto" id="editFoto">📷 Editar foto</button></div>`; const ef = $('#editFoto'); if (ef) ef.onclick = () => editarFoto(user); }
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
   REFIERE POR WHATSAPP
   Comportamiento REAL del portal (BOTHEART911/portal-jhonny-perdomo):
   "Refiere por Whatsapp" valida que el usuario sea LÍDER (validarLider);
   si lo es, arma el mensaje con su N° de Referido y abre WhatsApp
   (whatsapp://send en móvil, api.whatsapp.com/send en escritorio) y copia
   el texto al portapapeles. Si NO es líder: "No estás en registros de Líderes".
   ============================================================ */
const REFIERE_URL = 'https://tinyurl.com/app-jhonny-perdomo';
const FOTO_DEFAULT = 'https://res.cloudinary.com/dqqeavica/image/upload/v1758738139/user_zefosv.png';
function msgRefiereLider(codigo, nombre) {
  return 'Hola 👋🏻\n\nQuiero pedirte que apoyes a nuestro gran amigo *Jhonny Perdomo*.\n\nInstala la App y regístrate aquí 👉 ' + REFIERE_URL + ' 👈\n\nEn el campo *N° de Referido* por favor escribe el N° 👉 ' + codigo + ' 👈 (solo el número).\n\nEn esta App encontrarás muchas opciones para ayudar a tu comunidad. ¡Bendiciones!\n\nCordialmente,\n\n*' + nombre + '*\n> Equipo del Hacer';
}
function abrirWhatsappTexto(mensaje) {
  try { navigator.clipboard && navigator.clipboard.writeText(mensaje); } catch {}
  const esMovil = /android|iphone|ipad|mobile/i.test(navigator.userAgent || '');
  const enc = encodeURIComponent(mensaje);
  window.open((esMovil ? 'whatsapp://send?text=' : 'https://api.whatsapp.com/send?text=') + enc, '_blank');
}
async function viewRefiere(user) {
  app.innerHTML = `${backbar('Refiere por WhatsApp')}<div class="pad stack">
    <div class="card pad stack center">
      <div class="ico" style="width:64px;height:64px;margin:0 auto;border-radius:18px;background:var(--brand-050);display:grid;place-content:center;">${I.wa}</div>
      <h2 class="h2">Invita a los tuyos</h2>
      <p class="muted" id="ref-sub">Cargando…</p>
      <div id="ref-code" class="hidden" style="margin:6px 0;"></div>
      <button class="btn btn-primary btn-block" id="ref-wa" disabled>${I.wa} Compartir por WhatsApp</button>
    </div>
    <p class="center small muted">Este apartado es para líderes: comparte tu N° de Referido.</p>
  </div>`;
  app.hidden = false; hideSplash();
  const back = $('#backbtn'); if (back) back.onclick = () => go('home');

  // Validar si es líder (como validarLider del portal)
  let esLider = false, codigo = '', nombre = user.nombre || '';
  try {
    const r = await api('pub.liderReferidos', { documento: user.documento });
    if (r && r.ok) { esLider = true; codigo = r.lider.codigo; nombre = r.lider.nombre || nombre; }
  } catch {}

  const sub = $('#ref-sub'), code = $('#ref-code'), wa = $('#ref-wa');
  if (!sub || !wa) return; // el usuario ya navegó fuera

  if (!esLider) {
    sub.textContent = 'Este apartado es de uso exclusivo de los líderes de Jhonny Perdomo. Si crees que debería estar aquí, comunícate con el Equipo del Hacer.';
    wa.remove();
    return;
  }

  sub.innerHTML = 'Cuando alguien se registre, pídele que escriba tu <b>N° de Referido</b> para sumarlo a tu grupo.';
  if (code) { code.classList.remove('hidden'); code.innerHTML = `<div class="idpill" style="font-size:1.05rem;padding:8px 16px;">Tu N° de Referido: <b>${esc(codigo)}</b></div>`; }
  const mensaje = msgRefiereLider(codigo, nombre);
  wa.disabled = false;
  wa.onclick = () => abrirWhatsappTexto(mensaje);
}

/* ============================================================
   MÓDULO LÍDERES  (zona del líder en la app pública)
   Sub-vistas: referidos (tarjetas con Asistencia/Intención/Editar),
   nuevo referido, mis servicios, mis compromisos, actualizar contraseña,
   refiere por WhatsApp.  Todo nativo, en tarjetas. Sin stubs.
   ============================================================ */
async function viewLideres(user) {
  // Si ya validó la contraseña en esta sesión, va directo al panel.
  if (LIDER && LIDER.documento === user.documento) return liderPanel(user);
  // Clave recordada (si el usuario marcó "recordar")
  let recordada = '';
  try { const raw = localStorage.getItem(LIDER_REMEMBER_KEY); if (raw) { const o = JSON.parse(raw); if (o && o.doc === user.documento) recordada = o.clave || ''; } } catch {}

  app.innerHTML = `${backbar('Zona de líderes')}<div class="pad stack">
    <div class="card pad stack center">
      <img class="lider-banner" src="${APP_BANNER}" alt="Jhonny Perdomo" onerror="this.style.display='none'" />
      <h2 class="h2">Acceso de líder</h2>
      <p class="muted">Este apartado es de uso exclusivo de los líderes. Ingresa tu contraseña para administrar tus referidos.</p>
      <label class="field" style="text-align:left;"><span>Contraseña</span>
        <div class="input-pass">
          <input class="input" id="lg-clave" type="password" placeholder="Tu contraseña" autocomplete="off" value="${esc(recordada)}" />
          <button type="button" class="pass-eye" id="lg-eye" aria-label="Mostrar u ocultar">${I.eyeOff}</button>
        </div></label>
      <label class="check-row"><input type="checkbox" id="lg-recordar" ${recordada ? 'checked' : ''} /> <span>Recordar mi contraseña</span></label>
      <button class="btn btn-primary btn-block" id="lg-entrar">Entrar</button>
    </div>
  </div>`;
  app.hidden = false; hideSplash(); $('#backbtn').onclick = () => go('home');
  const inp = $('#lg-clave');
  // ojo ver/ocultar
  let visible = false;
  $('#lg-eye').onclick = () => { visible = !visible; inp.type = visible ? 'text' : 'password'; $('#lg-eye').innerHTML = visible ? I.eyeOn : I.eyeOff; };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') $('#lg-entrar').click(); });
  $('#lg-entrar').onclick = async () => {
    const clave = inp.value.trim();
    if (!clave) return toast('Ingresa tu contraseña', 'err');
    const btn = $('#lg-entrar'); saving(btn, true);
    try {
      const r = await api('pub.liderEntrar', {}, 'POST', { documento: user.documento, clave });
      saving(btn, false);
      if (!r.ok) {
        if (r.requiereCrearClave) return liderCrearClave(user);
        return toast(r.msg || 'No se pudo entrar', 'err');
      }
      // recordar / olvidar
      try {
        if ($('#lg-recordar').checked) localStorage.setItem(LIDER_REMEMBER_KEY, JSON.stringify({ doc: user.documento, clave }));
        else localStorage.removeItem(LIDER_REMEMBER_KEY);
      } catch {}
      LIDER = { codigo: r.lider.codigo, nombre: r.lider.nombre, documento: user.documento, opciones: r.opciones };
      liderPanel(user);
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* Primera vez: el líder no tiene contraseña → la crea */
function liderCrearClave(user) {
  app.innerHTML = `${backbar('Crea tu contraseña')}<div class="pad stack">
    <div class="card pad stack">
      <p class="muted">Eres líder pero aún no tienes contraseña. Créala para administrar tus referidos.</p>
      ${field('Nueva contraseña', inputEl('lc-1', 'type="password" placeholder="Mínimo 4 caracteres"'))}
      ${field('Repite la contraseña', inputEl('lc-2', 'type="password" placeholder="Vuelve a escribirla"'))}
      <button class="btn btn-primary btn-block" id="lc-save">Crear y entrar</button>
    </div>
  </div>`;
  app.hidden = false; hideSplash(); $('#backbtn').onclick = () => go('home');
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
      LIDER = { codigo: e2.lider.codigo, nombre: e2.lider.nombre, documento: user.documento, opciones: e2.opciones };
      toast('¡Contraseña creada!', 'ok'); liderPanel(user);
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* Panel principal del líder: menú de sub-secciones */
function liderPanel(user) {
  const items = [
    { id: 'l-referidos',   icon: 'user',  t: 'Mis referidos',        d: 'Asistencia, intención y edición' },
    { id: 'l-nuevo',       icon: 'star',  t: 'Nuevo referido',       d: 'Suma a alguien a tu grupo' },
    { id: 'l-refiere',     icon: 'wa',    t: 'Refiere por WhatsApp', d: 'Comparte con tu N° de referido' },
    { id: 'l-servicios',   icon: 'help',  t: 'Mis servicios',        d: 'Solicitudes que has hecho' },
    { id: 'l-compromisos', icon: 'idea',  t: 'Mis compromisos',      d: 'Lo que has asumido' },
    { id: 'l-clave',       icon: 'card',  t: 'Actualizar contraseña',d: 'Cambia tu clave de líder' }
  ];
  app.innerHTML = `${backbar('Zona de líderes')}<div class="pad stack">
    <div><p class="eyebrow">Líder</p><h1 class="h1">${esc(primerNombre(LIDER.nombre))} 🤝🏾</h1>
      <span class="plan-badge premium">N° de Referido: ${esc(LIDER.codigo)}</span></div>
    <div class="menu-grid">${items.map(m => `<button class="tile" data-id="${m.id}"><span class="ico">${I[m.icon]}</span><span class="txt"><b>${esc(m.t)}</b><br><span>${esc(m.d)}</span></span></button>`).join('')}</div>
  </div>`;
  app.hidden = false; hideSplash(); $('#backbtn').onclick = () => go('home');
  app.querySelectorAll('.tile').forEach(t => t.onclick = () => {
    const id = t.dataset.id;
    if (id === 'l-referidos')   return liderReferidos(user);
    if (id === 'l-nuevo')       return liderNuevoReferido(user);
    if (id === 'l-refiere')     return go('refiere');
    if (id === 'l-servicios')   return liderServicios(user);
    if (id === 'l-compromisos') return liderCompromisos(user);
    if (id === 'l-clave')       return liderActualizarClave(user);
  });
}

/* ---- MIS REFERIDOS (tarjetas con Asistencia/Intención/Editar) ---- */
async function liderReferidos(user) {
  app.innerHTML = `${backLider('Mis referidos')}<div class="pad stack" id="lr-body"><div class="card pad center"><span class="spinner"></span> Cargando tus referidos…</div></div>`;
  app.hidden = false; hideSplash(); bindBackLider(user);
  try {
    const r = await api('pub.liderReferidos', { documento: user.documento });
    if (!r.ok) { $('#lr-body').innerHTML = `<div class="card pad center muted">${esc(r.msg || 'No se pudo cargar')}</div>`; return; }
    LIDER.opciones = r.opciones;
    if (!r.referidos.length) { $('#lr-body').innerHTML = `<div class="card pad center"><p class="muted">Aún no tienes referidos. Usa <b>Nuevo referido</b> para sumar a los tuyos.</p><button class="btn btn-primary btn-block" id="lr-nuevo" style="margin-top:12px;">+ Nuevo referido</button></div>`; $('#lr-nuevo').onclick = () => liderNuevoReferido(user); return; }
    pintarReferidos(user, r.referidos);
  } catch (e) { $('#lr-body').innerHTML = `<div class="card pad center muted">Error de conexión</div>`; }
}

function pintarReferidos(user, referidos) {
  const buscador = `<div class="lr-search"><input class="input" id="lr-q" placeholder="Buscar por nombre o documento…" autocomplete="off" /></div>`;
  const contador = `<p class="small muted" style="margin:2px 0 8px;">${referidos.length} referido(s)</p>`;
  const cards = referidos.map(rf => referidoCard(rf)).join('');
  $('#lr-body').innerHTML = `${buscador}${contador}<div class="lr-list" id="lr-list">${cards}</div>`;
  // buscador
  $('#lr-q').addEventListener('input', e => {
    const q = norm(e.target.value);
    $$('#lr-list .rcard').forEach(c => { const hay = norm(c.dataset.search).includes(q); c.style.display = hay ? '' : 'none'; });
  });
  // acciones por tarjeta
  $$('#lr-list .rcard').forEach(card => {
    const doc = card.dataset.doc;
    const rf = referidos.find(x => x.documento === doc);
    card.querySelector('[data-act="asis"]').onclick = () => selectorMarcar(user, rf, 'ASISTENCIA', card);
    card.querySelector('[data-act="inten"]').onclick = () => selectorMarcar(user, rf, 'INTENCION', card);
    card.querySelector('[data-act="edit"]').onclick = () => liderEditarReferido(user, rf, () => liderReferidos(user));
    const wa = card.querySelector('[data-act="wa"]'); if (wa) wa.onclick = () => window.open('https://wa.me/57' + onlyDig(rf.contacto), '_blank');
  });
}

function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function referidoCard(rf) {
  const asis = rf.asistencia || 'No contactado';
  const inten = rf.intencion || 'No contactado';
  const lugar = [rf.residencia, rf.municipio].filter(Boolean).join(' · ');
  return `<div class="rcard" data-doc="${esc(rf.documento)}" data-search="${esc(rf.nombre + ' ' + rf.documento)}">
    <div class="rcard-top">
      <div class="rc-av">${esc(iniciales(rf.nombre))}</div>
      <div class="rc-id"><b>${esc(rf.nombre)}</b><span>CC ${esc(rf.documento)}${lugar ? ' · ' + esc(lugar) : ''}</span></div>
    </div>
    <div class="rc-badges">
      <span class="rc-badge ${badgeAsis(asis)}">🏷 ${esc(asis)}</span>
      <span class="rc-badge ${badgeInten(inten)}">🗳 ${esc(inten)}</span>
    </div>
    <div class="rc-actions">
      <button class="rc-btn" data-act="asis">🏷 Asistencia</button>
      <button class="rc-btn" data-act="inten">🗳 Intención</button>
      <button class="rc-btn" data-act="edit">✏️ Editar</button>
      ${rf.contacto ? `<button class="rc-btn wa" data-act="wa">${I.wa}</button>` : ''}
    </div>
  </div>`;
}
function badgeAsis(v) { const m = { 'Confirmada': 'ok', 'No puede': 'no', 'Fuera de Flandes': 'warn', 'No filial': 'no', 'No contactado': 'mut' }; return m[v] || 'mut'; }
function badgeInten(v) { const m = { 'Firme con el voto': 'ok', 'No vota con nosotros': 'no', 'No está seguro(a)': 'warn', 'No sabe votar': 'warn', 'No contactado': 'mut' }; return m[v] || 'mut'; }

/* Selector dinámico (hoja inferior) para marcar Asistencia/Intención */
function selectorMarcar(user, rf, campo, card) {
  const opts = campo === 'ASISTENCIA' ? (LIDER.opciones.asistencia) : (LIDER.opciones.intencion);
  const titulo = campo === 'ASISTENCIA' ? '🏷 Asistencia' : '🗳 Intención';
  const actual = campo === 'ASISTENCIA' ? rf.asistencia : rf.intencion;
  openSheet(`<div class="grip"></div><h2 class="h2" style="margin-bottom:4px;">${titulo}</h2><p class="muted" style="margin-bottom:12px;">${esc(rf.nombre)}</p>
    <div class="stack">${opts.map(o => `<button class="opt-row ${norm(o) === norm(actual) ? 'sel' : ''}" data-val="${esc(o)}">${esc(o)}${norm(o) === norm(actual) ? ' ✓' : ''}</button>`).join('')}</div>`);
  layer.querySelectorAll('.opt-row').forEach(b => b.onclick = async () => {
    const valor = b.dataset.val; closeLayer();
    try {
      const r = await api('pub.liderMarcar', {}, 'POST', { documento: user.documento, refDoc: rf.documento, campo, valor });
      if (!r.ok) return toast(r.msg || 'No se pudo guardar', 'err');
      // actualizar en memoria y repintar solo el badge de esta tarjeta
      if (campo === 'ASISTENCIA') rf.asistencia = valor; else rf.intencion = valor;
      const badges = card.querySelector('.rc-badges');
      badges.innerHTML = `<span class="rc-badge ${badgeAsis(rf.asistencia || 'No contactado')}">🏷 ${esc(rf.asistencia || 'No contactado')}</span><span class="rc-badge ${badgeInten(rf.intencion || 'No contactado')}">🗳 ${esc(rf.intencion || 'No contactado')}</span>`;
      toast('Actualizado', 'ok');
    } catch (e) { toast('Error de conexión', 'err'); }
  });
}

/* Editar contacto y residencia de un referido */
function liderEditarReferido(user, rf, onDone) {
  openSheet(`<div class="grip"></div><h2 class="h2" style="margin-bottom:10px;">Editar referido</h2>
    <p class="muted" style="margin-bottom:12px;">${esc(rf.nombre)} · CC ${esc(rf.documento)}</p>
    <div class="stack">
      ${field('WhatsApp', inputEl('er-tel', 'inputmode="numeric" maxlength="10"'))}
      ${field('Residencia', comboboxHtml('er-resi', 'Escribe para buscar'))}
      <button class="btn btn-primary btn-block" id="er-save">Guardar</button>
      <button class="btn btn-quiet btn-block" data-close>Cancelar</button>
    </div>`);
  $('#er-tel').value = onlyDig(rf.contacto); onlyDigits($('#er-tel'));
  $('#er-resi').value = rf.residencia || '';
  getResidencias().then(l => bindCombobox('er-resi', l)).catch(() => {});
  $('#er-save').onclick = async () => {
    const tel = onlyDig(val('er-tel')), resi = val('er-resi');
    if (tel && !/^\d{10}$/.test(tel)) return toast('El WhatsApp debe tener 10 dígitos', 'err');
    const btn = $('#er-save'); saving(btn, true);
    try {
      const r = await api('pub.liderEditarRef', {}, 'POST', { documento: user.documento, refDoc: rf.documento, contacto: tel, residencia: resi });
      saving(btn, false);
      if (!r.ok) return toast(r.msg || 'No se pudo guardar', 'err');
      closeLayer(); toast('Referido actualizado', 'ok'); if (onDone) onDone();
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* ---- NUEVO REFERIDO ---- */
function liderNuevoReferido(user) {
  app.innerHTML = `${backLider('Nuevo referido')}<div class="pad stack"><div class="card pad stack">
    <p class="muted">Registra a una persona directamente en tu grupo.</p>
    ${field('Nombre completo', inputEl('nr-nombre', ''))}
    ${field('Documento', inputEl('nr-doc', 'inputmode="numeric" maxlength="10"'))}
    ${field('WhatsApp', inputEl('nr-tel', 'inputmode="numeric" maxlength="10"'))}
    ${field('Residencia', comboboxHtml('nr-resi', 'Escribe para buscar'))}
    <button class="btn btn-primary btn-block" id="nr-save">Registrar referido</button>
  </div></div>`;
  app.hidden = false; hideSplash(); bindBackLider(user);
  onlyLetters($('#nr-nombre')); onlyDigits($('#nr-doc')); onlyDigits($('#nr-tel'));
  getResidencias().then(l => bindCombobox('nr-resi', l)).catch(() => {});
  $('#nr-save').onclick = async () => {
    const body = { documento: user.documento, refDoc: onlyDig(val('nr-doc')), nombre: val('nr-nombre'), contacto: onlyDig(val('nr-tel')), residencia: val('nr-resi') };
    if (!body.nombre) return toast('Escribe el nombre', 'err');
    if (!/^\d{6,10}$/.test(body.refDoc)) return toast('Documento inválido (6 a 10 dígitos)', 'err');
    if (!/^\d{10}$/.test(body.contacto)) return toast('El WhatsApp debe tener 10 dígitos', 'err');
    if (!body.residencia) return toast('Selecciona la residencia', 'err');
    const ok = await confirmar('Confirma el nuevo referido', crow('Nombre', body.nombre) + crow('Documento', body.refDoc) + crow('WhatsApp', body.contacto) + crow('Residencia', body.residencia)); if (!ok) return;
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
async function liderServicios(user) {
  app.innerHTML = `${backLider('Mis servicios')}<div class="pad stack" id="ls-body"><div class="card pad center"><span class="spinner"></span> Cargando…</div></div>`;
  app.hidden = false; hideSplash(); bindBackLider(user);
  try {
    const r = await api('pub.liderServicios', { documento: user.documento });
    if (!r.ok) { $('#ls-body').innerHTML = `<div class="card pad center muted">${esc(r.msg || 'No se pudo cargar')}</div>`; return; }
    if (!r.servicios.length) { $('#ls-body').innerHTML = `<div class="card pad center"><p class="muted">No has hecho solicitudes de servicio.</p><button class="btn btn-primary btn-block" id="ls-new" style="margin-top:12px;">Hacer una solicitud</button></div>`; $('#ls-new').onclick = () => go('solicitud'); return; }
    $('#ls-body').innerHTML = r.servicios.map(s => `<div class="lcard"><div class="lcard-head"><b>${esc(s.servicio || 'Servicio')}</b><span class="estado ${estadoClase(s.estado)}">${esc(s.estado)}</span></div>${s.solicitud ? `<p class="lcard-txt">${esc(s.solicitud)}</p>` : ''}${s.respuesta ? `<p class="lcard-resp"><b>Respuesta:</b> ${esc(s.respuesta)}</p>` : ''}${s.fecha ? `<span class="lcard-date">${esc(s.fecha)}</span>` : ''}</div>`).join('');
  } catch (e) { $('#ls-body').innerHTML = `<div class="card pad center muted">Error de conexión</div>`; }
}

/* ---- MIS COMPROMISOS ---- */
async function liderCompromisos(user) {
  app.innerHTML = `${backLider('Mis compromisos')}<div class="pad stack" id="lc-body"><div class="card pad center"><span class="spinner"></span> Cargando…</div></div>`;
  app.hidden = false; hideSplash(); bindBackLider(user);
  try {
    const r = await api('pub.liderCompromisos', { documento: user.documento });
    if (!r.ok) { $('#lc-body').innerHTML = `<div class="card pad center muted">${esc(r.msg || 'No se pudo cargar')}</div>`; return; }
    if (!r.compromisos.length) { $('#lc-body').innerHTML = `<div class="card pad center muted">No tienes compromisos registrados.</div>`; return; }
    $('#lc-body').innerHTML = r.compromisos.map(c => `<div class="lcard"><div class="lcard-head"><b>Compromiso</b><span class="estado ${estadoClase(c.estado)}">${esc(c.estado)}</span></div><p class="lcard-txt">${esc(c.compromiso)}</p>${c.asignado ? `<span class="lcard-date">Asignado: ${esc(c.asignado)}</span>` : ''}${c.fecha ? `<span class="lcard-date">${esc(c.fecha)}</span>` : ''}</div>`).join('');
  } catch (e) { $('#lc-body').innerHTML = `<div class="card pad center muted">Error de conexión</div>`; }
}
function estadoClase(e) { const v = norm(e); if (/realiz|complet|resuel|entreg/.test(v)) return 'ok'; if (/pend/.test(v)) return 'warn'; if (/rechaz|no /.test(v)) return 'no'; return 'mut'; }

/* ---- ACTUALIZAR CONTRASEÑA ---- */
function liderActualizarClave(user) {
  app.innerHTML = `${backLider('Actualizar contraseña')}<div class="pad stack"><div class="card pad stack">
    ${field('Contraseña actual', inputEl('cc-act', 'type="password" placeholder="Tu contraseña actual"'))}
    ${field('Nueva contraseña', inputEl('cc-1', 'type="password" placeholder="Mínimo 4 caracteres"'))}
    ${field('Repite la nueva', inputEl('cc-2', 'type="password"'))}
    <button class="btn btn-primary btn-block" id="cc-save">Guardar contraseña</button>
  </div></div>`;
  app.hidden = false; hideSplash(); bindBackLider(user);
  $('#cc-save').onclick = async () => {
    const act = val('cc-act'), a = val('cc-1'), b = val('cc-2');
    if (a.length < 4) return toast('La nueva debe tener mínimo 4 caracteres', 'err');
    if (a !== b) return toast('Las contraseñas no coinciden', 'err');
    const btn = $('#cc-save'); saving(btn, true);
    try {
      const r = await api('pub.liderClave', {}, 'POST', { documento: user.documento, claveActual: act, claveNueva: a });
      saving(btn, false);
      if (!r.ok) return toast(r.msg || 'No se pudo actualizar', 'err');
      toast('Contraseña actualizada', 'ok'); liderPanel(user);
    } catch (e) { toast('Error de conexión', 'err'); saving(btn, false); }
  };
}

/* Barra superior que vuelve al panel de líder (no al home) */
function backLider(title) { return `<div class="appbar"><button class="icon-btn" id="backLiderBtn">${I.back}</button><div class="who"><b>${esc(title)}</b><span>Zona de líderes</span></div></div>`; }
function bindBackLider(user) { const b = $('#backLiderBtn'); if (b) b.onclick = () => liderPanel(user); }

/* ============================================================
   Navegación / componentes comunes
   ============================================================ */
function openMenu(id, user) {
  if (IMPLEMENTADAS.has(id)) return go(id);
  const item = MENU.find(m => m.id === id) || { title: 'Sección', icon: 'star' };
  openSheet(`<div class="grip"></div><div class="center stack"><div class="ico" style="width:56px;height:56px;margin:0 auto;border-radius:16px;background:var(--brand-050);display:grid;place-content:center;">${I[item.icon] || I.star}</div><h2 class="h2">${esc(item.title)}</h2><p class="muted">Estamos afinando esta sección. Muy pronto la tendrás lista.</p><button class="btn btn-primary btn-block" data-close>Entendido</button></div>`);
}
function avatarHtml(user, cls) {
  const ini = esc(iniciales(user.nombre));
  const foto = user.foto && user.foto !== FOTO_DEFAULT ? esc(user.foto) : '';
  if (foto) return `<div class="${cls} has-photo"><img src="${foto}" alt="" onerror="this.parentNode.classList.remove('has-photo');this.replaceWith(document.createTextNode('${ini}'))"/></div>`;
  return `<div class="${cls}">${ini}</div>`;
}
function appbar(user, titulo) { return `<div class="appbar">${titulo ? `<div class="mark">${esc(iniciales(user.nombre))}</div>` : avatarHtml(user, 'mark')}<div class="who"><b>${esc(titulo || primerNombre(user.nombre))}</b><span>${titulo ? 'Jhonny Perdomo' : 'CC ' + esc(user.documento)}</span></div><button class="icon-btn" id="btnSwap" title="Cambiar de cuenta">${I.swap}</button><button class="icon-btn" id="btnOut" title="Salir">${I.logout}</button></div>`; }
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
  const hash = location.hash || '';
  const arranqueLimpio = (hash === '' || hash === '#/' || hash.startsWith('#/login'));
  const yaContinuoWeb = sessionStorage.getItem('continuedWeb') === '1';
  // Gate: al primer arranque, si no está instalada y no eligió "continuar en el
  // navegador", se muestra la vista Instalar. Si ya continuó en web o ya está
  // instalada, sigue el flujo normal. La vista Instalar siempre es alcanzable
  // manualmente desde login (botón "Instalar la app").
  if (!installed && !yaContinuoWeb && arranqueLimpio) { location.hash = '#/instalar'; }
  render();
}
initApp();
