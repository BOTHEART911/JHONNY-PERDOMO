/* ============================================================
   JHONNY PERDOMO — App Pública · app.js
   Fase 1.0: armazón + login + inicio + menú + tarjeta digital
   ============================================================ */

/* ⚙️ PEGA AQUÍ la URL del Web App del backend JHONNY CORE
   (Implementar → Aplicación web → copiar la URL que termina en /exec) */
const API_URL = 'https://script.google.com/macros/s/AKfycbxXlxYzr6cTilsvSTGH6l0CGjLb35a7xyvgFgd5EMnLtWIfR8isHiSGSqCdNqlUYE2P/exec';

/* ---------- Utilidades ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const layer = $('#layer');

function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function primerNombre(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
function iniciales(n) { const p = String(n || '').trim().split(/\s+/); return ((p[0] || ' ')[0] + (p[1] || '')[0] || '').toUpperCase() || 'JP'; }

function toast(msg, kind = '') {
  const t = h(`<div class="toast ${kind}">${esc(msg)}</div>`);
  layer.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ---------- Cliente API (backend CORE) ---------- */
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

/* ---------- Sesiones en el dispositivo (varias personas) ---------- */
const SS_KEY = 'jp_sessions', ACT_KEY = 'jp_active';
const getSessions = () => { try { return JSON.parse(localStorage.getItem(SS_KEY)) || []; } catch { return []; } };
function saveSession(u) {
  const list = getSessions().filter(x => x.documento !== u.documento);
  list.unshift(u); localStorage.setItem(SS_KEY, JSON.stringify(list.slice(0, 6)));
  localStorage.setItem(ACT_KEY, u.documento);
}
const getActive = () => { const d = localStorage.getItem(ACT_KEY); return getSessions().find(x => x.documento === d) || null; };
const setActive = (doc) => localStorage.setItem(ACT_KEY, doc);
function logout() { localStorage.removeItem(ACT_KEY); go('login'); }

/* ---------- Íconos (SVG en línea, estilo lucide) ---------- */
const I = {
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3 21 7l-4 4"/><path d="M21 7H9"/><path d="M7 21 3 17l4-4"/><path d="M3 17h12"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  idea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.79.65-1.5 1.41-2a5 5 0 1 0-5 0c.76.5 1.23 1.21 1.41 2"/></svg>',
  news: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V9h4"/><path d="M10 6h8M10 10h8M10 14h5"/></svg>',
  home2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>',
  store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1-5h16l1 5"/><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M3 9h18"/><path d="M9 22V12h6v10"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.5 5.8 21 7 14 2 9.3 9 8.5 12 2"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.2-5.6A8.4 8.4 0 1 1 21 11.5Z"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
};

/* ---------- Menú (icono + nombre + descripción) ---------- */
const MENU = [
  { id: 'tarjeta',   icon: 'card',  title: 'Mi tarjeta',        desc: 'Tu carné digital con QR', gold: true, wide: true },
  { id: 'datos',     icon: 'user',  title: 'Actualizar datos',  desc: 'Corrige tu información' },
  { id: 'solicitud', icon: 'help',  title: 'Realiza tu solicitud', desc: 'Pide un servicio' },
  { id: 'ideas',     icon: 'idea',  title: 'Suma tus ideas',    desc: 'Propón para Flandes' },
  { id: 'noticias',  icon: 'news',  title: 'Ponte al día',      desc: 'Últimas noticias' },
  { id: 'casa',      icon: 'home2', title: 'Nuestra casa social', desc: 'Programación y redes' },
  { id: 'emergencia',icon: 'phone', title: 'Números de emergencia', desc: 'Contactos útiles' },
  { id: 'comercio',  icon: 'store', title: 'Comerciantes amigos', desc: 'Descubre y apoya' },
  { id: 'refiere',   icon: 'wa',    title: 'Refiere por WhatsApp', desc: 'Invita a los tuyos' },
  { id: 'lideres',   icon: 'star',  title: 'Líderes',           desc: 'Zona de líderes' }
];
const IMPLEMENTADAS = new Set(['tarjeta']); // se irán activando por fases

/* ============================================================
   RÚTER
   ============================================================ */
function go(route) { location.hash = '#/' + route; }
window.addEventListener('hashchange', render);

function render() {
  const route = (location.hash.replace(/^#\//, '') || '').split('?')[0];
  const user = getActive();
  if (!user && route !== 'login') return go('login');

  if (route === 'login' || !user) return viewLogin();
  if (route === 'tarjeta') return viewTarjeta(user);
  if (route === '' || route === 'home') return viewHome(user);
  // menú aún no implementado
  return viewHome(user);
}

/* ============================================================
   VISTA: LOGIN
   ============================================================ */
function viewLogin() {
  const sesiones = getSessions();
  const chips = sesiones.length ? `
    <div class="stack">
      <p class="eyebrow">Entrar rápido</p>
      <div class="chips">
        ${sesiones.map(s => `<button class="chip" data-doc="${esc(s.documento)}"><span class="av">${esc(iniciales(s.nombre))}</span>${esc(primerNombre(s.nombre))}</button>`).join('')}
      </div>
    </div>` : '';

  app.innerHTML = `
    <div class="pad stack" style="padding-top: 12vh; min-height:100dvh; display:flex; flex-direction:column; justify-content:center;">
      <div class="center stack" style="margin-bottom: 8px;">
        <div class="appbar" style="justify-content:center; background:none; padding:0;">
          <div class="mark" style="width:56px;height:56px;border-radius:18px;font-size:22px;">JP</div>
        </div>
        <h1 class="h1">Bienvenido</h1>
        <p class="muted">Ingresa con tu documento para ser parte del cambio en Flandes.</p>
      </div>
      ${chips}
      <div class="card pad stack" style="margin-top:8px;">
        <label class="field"><span>Documento</span>
          <input class="input" id="doc" inputmode="numeric" placeholder="Tu número de documento" autocomplete="off" /></label>
        <label class="field"><span>PIN (últimos 4 dígitos de tu documento)</span>
          <input class="input" id="pin" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off" /></label>
        <button class="btn btn-primary btn-block" id="enter">Entrar</button>
      </div>
      <p class="center small muted">¿No estás registrado? Pídele a tu líder que te ingrese.</p>
    </div>`;
  app.hidden = false; hideSplash();

  const doc = $('#doc'), pin = $('#pin');
  app.querySelectorAll('.chip').forEach(c => c.onclick = () => { doc.value = c.dataset.doc; pin.focus(); });
  $('#enter').onclick = doLogin;
  [doc, pin].forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); }));

  async function doLogin() {
    const documento = doc.value.replace(/\D/g, ''), p = pin.value.trim();
    if (!documento) return toast('Escribe tu documento', 'err');
    if (p.length !== 4) return toast('El PIN son los últimos 4 dígitos de tu documento', 'err');
    const btn = $('#enter'); btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;
    try {
      const r = await api('pub.login', {}, 'POST', { documento, pin: p });
      if (!r.ok) { toast(r.msg || 'No pudimos ingresar', 'err'); btn.innerHTML = 'Entrar'; btn.disabled = false; return; }
      saveSession(r.user); go('home');
    } catch (e) { toast('Error de conexión', 'err'); btn.innerHTML = 'Entrar'; btn.disabled = false; }
  }
}

/* ============================================================
   VISTA: HOME (inicio + menú)
   ============================================================ */
async function viewHome(user) {
  app.innerHTML = `
    ${appbar(user)}
    <div class="pad stack">
      <div>
        <p class="eyebrow">Soy de Flandes</p>
        <h1 class="h1">Hola, ${esc(primerNombre(user.nombre))} 👋🏾</h1>
      </div>
      <div id="inicio"><div class="hero"><div class="skeleton" style="aspect-ratio:16/10;"></div></div></div>
      <div id="banner"></div>
      <p class="eyebrow" style="margin-top:6px;">Explora</p>
      <div class="menu-grid">
        ${MENU.map(m => `
          <button class="tile ${m.gold ? 'gold' : ''} ${m.wide ? 'wide' : ''}" data-id="${m.id}">
            <span class="ico">${I[m.icon]}</span>
            <span class="txt"><b>${esc(m.title)}</b><br><span>${esc(m.desc)}</span></span>
          </button>`).join('')}
      </div>
      <p class="center small muted" style="margin-top:10px;">Jhonny Perdomo · Flandes, Tolima</p>
    </div>`;
  app.hidden = false; hideSplash();
  bindAppbar(user);
  app.querySelectorAll('.tile').forEach(t => t.onclick = () => openMenu(t.dataset.id, user));

  // Inicio dinámico
  try {
    const d = await api('pub.inicio');
    const cont = $('#inicio');
    const media = d.imagen
      ? `<img class="hero-img" src="${esc(d.imagen)}" alt="Jhonny Perdomo" onerror="this.replaceWith(heroFallback())" />`
      : heroFallback().outerHTML;
    const play = d.reel ? `<button class="hero-play" id="playReel">${I.play} Ver reel</button>` : '';
    cont.innerHTML = `<div class="hero">${media}${play}</div>`;
    if (d.reel) $('#playReel').onclick = () => openVideo(d.reel);
    if (d.hayNoticias) {
      $('#banner').innerHTML = `<button class="banner" data-id="noticias"><span class="dot"></span><div><b>Ponte al día</b><br><span class="small muted">Hay ${d.noticias} novedad(es) para ti</span></div></button>`;
      $('#banner .banner').onclick = () => openMenu('noticias', user);
    }
  } catch (e) { $('#inicio').innerHTML = `<div class="hero">${heroFallback().outerHTML}</div>`; }
}

function heroFallback() { return h(`<div class="hero-fallback"><b class="h2">Soy de Flandes 💪🏾</b><span class="small">Juntos por un municipio próspero</span></div>`); }

/* ============================================================
   VISTA: TARJETA DIGITAL
   ============================================================ */
async function viewTarjeta(user) {
  app.innerHTML = `${appbar(user, 'Mi tarjeta')}<div class="pad stack"><div class="carne"><div class="skeleton" style="height:360px;background:rgba(255,255,255,.2);"></div></div></div>`;
  app.hidden = false; hideSplash(); bindAppbar(user);
  try {
    const d = await api('qr.tarjeta', { documento: user.documento });
    if (!d.ok) return toast(d.msg || 'No encontramos tu tarjeta', 'err');
    const t = d.tarjeta;
    $('.pad').innerHTML = `
      <div class="carne">
        <div class="row">
          <div><div class="label">Portador</div><div class="name">${esc(t.nombre)}</div>
          <div class="doc">CC ${esc(t.documento)}</div></div>
          <div class="mark" style="background:rgba(255,255,255,.15);border:1.5px solid var(--gold);">JP</div>
        </div>
        <div class="qr-wrap"><img src="${esc(t.qrUrl)}" alt="Código QR" /></div>
        <div class="foot"><span class="idpill">${esc(t.idUsuario)}</span><span class="flag">SOY DE FLANDES</span></div>
      </div>
      <button class="btn btn-ghost btn-block" id="share">${I.share} Compartir mi tarjeta</button>
      <button class="btn btn-quiet btn-block" id="back">Volver al inicio</button>`;
    $('#back').onclick = () => go('home');
    $('#share').onclick = async () => {
      const url = t.qrUrl;
      if (navigator.share) { try { await navigator.share({ title: 'Mi tarjeta · Jhonny Perdomo', text: `${t.nombre} — Soy de Flandes`, url }); } catch {} }
      else { window.open(url, '_blank'); }
    };
  } catch (e) { toast('Error al cargar la tarjeta', 'err'); }
}

/* ============================================================
   Navegación del menú
   ============================================================ */
function openMenu(id, user) {
  if (id === 'tarjeta') return go('tarjeta');
  if (IMPLEMENTADAS.has(id)) return go(id);
  const item = MENU.find(m => m.id === id) || { title: 'Sección' };
  openSheet(`
    <div class="grip"></div>
    <div class="center stack">
      <div class="ico" style="width:56px;height:56px;margin:0 auto;border-radius:16px;background:var(--brand-050);display:grid;place-content:center;">${I[item.icon] || I.star}</div>
      <h2 class="h2">${esc(item.title)}</h2>
      <p class="muted">Estamos afinando esta sección. Muy pronto la tendrás lista.</p>
      <button class="btn btn-primary btn-block" data-close>Entendido</button>
    </div>`);
}

/* ---------- App bar reutilizable ---------- */
function appbar(user, titulo) {
  return `<div class="appbar">
    <div class="mark">${esc(iniciales(user.nombre))}</div>
    <div class="who"><b>${esc(titulo || primerNombre(user.nombre))}</b><span>${titulo ? 'Jhonny Perdomo' : 'CC ' + esc(user.documento)}</span></div>
    <button class="icon-btn" id="btnSwap" title="Cambiar de cuenta">${I.swap}</button>
    <button class="icon-btn" id="btnOut" title="Salir">${I.logout}</button>
  </div>`;
}
function bindAppbar(user) {
  const s = $('#btnSwap'), o = $('#btnOut');
  if (o) o.onclick = () => logout();
  if (s) s.onclick = () => openSwitch();
}
function openSwitch() {
  const sesiones = getSessions();
  openSheet(`
    <div class="grip"></div>
    <h2 class="h2" style="margin-bottom:12px;">Cambiar de cuenta</h2>
    <div class="stack">
      ${sesiones.map(s => `<button class="chip" style="width:100%;justify-content:flex-start;" data-doc="${esc(s.documento)}"><span class="av">${esc(iniciales(s.nombre))}</span>${esc(s.nombre)}</button>`).join('')}
      <button class="btn btn-quiet btn-block" data-add>+ Entrar con otro documento</button>
    </div>`);
  layer.querySelectorAll('.chip').forEach(c => c.onclick = () => { setActive(c.dataset.doc); closeLayer(); go('home'); });
  const add = layer.querySelector('[data-add]'); if (add) add.onclick = () => { closeLayer(); logout(); };
}

/* ---------- Hoja inferior ---------- */
function openSheet(html) {
  closeLayer();
  const bd = h('<div class="backdrop"></div>');
  const sh = h(`<div class="sheet">${html}</div>`);
  bd.onclick = closeLayer;
  layer.append(bd, sh);
  sh.querySelectorAll('[data-close]').forEach(b => b.onclick = closeLayer);
}
function closeLayer() { layer.innerHTML = ''; }

/* ---------- Modal de video (reel vertical) ---------- */
function ytId(url) {
  const m = String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : '';
}
function openVideo(url) {
  const id = ytId(url);
  const src = id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1` : url;
  const bd = h('<div class="backdrop"></div>');
  const mv = h(`<div class="modal-video"><button class="close">${I.x}</button><div class="frame"><iframe src="${esc(src)}" allow="autoplay; encrypted-media" allowfullscreen></iframe></div></div>`);
  const close = () => closeLayer();
  bd.onclick = close; mv.querySelector('.close').onclick = close;
  layer.append(bd, mv);
}

/* ---------- Splash ---------- */
function hideSplash() { const s = $('#splash'); if (s && !s.classList.contains('hide')) { s.classList.add('hide'); setTimeout(() => s.remove(), 500); } }

/* ---------- Service Worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ---------- Arranque ---------- */
render();
