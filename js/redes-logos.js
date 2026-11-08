/* ============================================================================
 * redes-logos.js — Logos de redes sociales como íconos de app (08/11/2026)
 * ----------------------------------------------------------------------------
 *  Mismo archivo en JHONNY-PERDOMO y JHONNY-PRIV. SVG en línea (sin pedir
 *  imágenes a la red): cuadro con el color de la marca y su logo.
 *  redTipo(url) → 'facebook' | 'instagram' | 'tiktok' | 'youtube' |
 *                 'whatsapp' | 'x' | 'web'
 *  redLogo(tipo) → <svg> del ícono (cuadro redondeado, 48×48)
 *  REDES_CAT    → catálogo para el selector de la app privada
 * ============================================================================ */
(function () {
  'use strict';
  const T = (fondo, glifo, defs) => `<svg class="red-logo" viewBox="0 0 48 48" aria-hidden="true">${defs ? `<defs>${defs}</defs>` : ''}<rect width="48" height="48" rx="12" fill="${fondo}"/>${glifo}</svg>`;
  const LOGOS = {
    facebook: () => T('#0866FF',
      '<path fill="#fff" d="M33.3 30.4 34.4 23.5h-6.6v-4.5c0-1.9.9-3.7 3.9-3.7h3v-5.9s-2.7-.5-5.3-.5c-5.4 0-9 3.3-9 9.2v5.4h-6v6.9h6V48h7.4V30.4z"/>'),
    instagram: () => T('url(#rl-ig)',
      '<rect x="11" y="11" width="26" height="26" rx="7.5" fill="none" stroke="#fff" stroke-width="3.2"/><circle cx="24" cy="24" r="6.2" fill="none" stroke="#fff" stroke-width="3.2"/><circle cx="31.4" cy="16.6" r="1.9" fill="#fff"/>',
      '<radialGradient id="rl-ig" cx="30%" cy="107%" r="150%"><stop offset="0" stop-color="#FDF497"/><stop offset=".05" stop-color="#FDF497"/><stop offset=".45" stop-color="#FD5949"/><stop offset=".6" stop-color="#D6249F"/><stop offset=".9" stop-color="#285AEB"/></radialGradient>'),
    tiktok: () => {
      const n = 'M25.2 9h4.3c.3 3.3 2.6 5.9 5.9 6.2v4.4c-2.2 0-4.2-.7-5.9-1.9v8.8c0 4.6-3.7 8.3-8.3 8.3s-8.3-3.7-8.3-8.3 3.7-8.3 8.3-8.3c.4 0 .8 0 1.2.1v4.5c-.4-.1-.8-.2-1.2-.2-2.2 0-3.9 1.8-3.9 3.9s1.8 3.9 3.9 3.9 3.9-1.8 3.9-3.9V9z';
      return T('#000', `<path fill="#25F4EE" transform="translate(-1.3 -1.2)" d="${n}"/><path fill="#FE2C55" transform="translate(1.3 1.2)" d="${n}"/><path fill="#fff" d="${n}"/>`);
    },
    youtube: () => T('#fff',
      '<rect x="6" y="13" width="36" height="22" rx="6.5" fill="#FF0000"/><path fill="#fff" d="M20.5 18.6v10.8l9.4-5.4z"/>'),
    whatsapp: () => T('#25D366',
      '<g transform="translate(10 10) scale(1.1667)"><path fill="#fff" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></g>'),
    x: () => T('#000',
      '<g transform="translate(12 12)"><path fill="#fff" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></g>'),
    web: () => T('#64748B',
      '<g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><circle cx="24" cy="24" r="12"/><path d="M12 24h24M24 12c3.5 3.4 5 7.4 5 12s-1.5 8.6-5 12c-3.5-3.4-5-7.4-5-12s1.5-8.6 5-12z"/></g>')
  };
  function redTipo(url) {
    const u = String(url || '').trim().toLowerCase();
    if (/facebook\.com|fb\.watch|fb\.me/.test(u)) return 'facebook';
    if (/instagram\.com|instagr\.am/.test(u)) return 'instagram';
    if (/tiktok\.com/.test(u)) return 'tiktok';
    if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
    if (/wa\.me|whatsapp\.com/.test(u)) return 'whatsapp';
    if (/(^|\/\/|\.)(x\.com|twitter\.com)/.test(u)) return 'x';
    return 'web';
  }
  window.redTipo = redTipo;
  window.redLogo = t => (LOGOS[t] || LOGOS.web)();
  window.REDES_CAT = [
    { k: 'facebook', n: 'Facebook', ej: 'https://facebook.com/…' },
    { k: 'instagram', n: 'Instagram', ej: 'https://instagram.com/…' },
    { k: 'tiktok', n: 'TikTok', ej: 'https://tiktok.com/@…' },
    { k: 'youtube', n: 'YouTube', ej: 'https://youtube.com/@…' },
    { k: 'whatsapp', n: 'WhatsApp', ej: 'https://whatsapp.com/channel/…' },
    { k: 'x', n: 'X', ej: 'https://x.com/…' },
    { k: 'web', n: 'Otra', ej: 'https://…' }
  ];
})();
