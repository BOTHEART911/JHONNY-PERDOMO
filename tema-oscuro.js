/* ================================================================
   MODO OSCURO (luna/sol) — App PÚBLICA Jhonny Perdomo
   Qué hace: agrega un botón luna/sol JUNTO al ícono de salir en el
     appbar (vista Inicio y las demás que lo muestran). Al tocarlo,
     alterna el tema (html.oscuro) y recuerda la elección en
     localStorage ("jp_tema"). El botón reusa .icon-btn, así que hereda
     el ripple y el micro-resorte de las capas nativas.
   Instalación: <script src="tema-oscuro.js"></script> al final del
     <body>, DESPUÉS de app.js. Pareja: tema-oscuro.css. En el <head>
     va además el mini-script anti-parpadeo (ver LEEME).
   Reversible: borra las 3 líneas del index y estos 2 archivos.
   ================================================================ */
(function () {
  if (window.__jpTema) return; window.__jpTema = true;
  var KEY = 'jp_tema';
  var LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var SOL  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>';
  function oscuro(){ return document.documentElement.classList.contains('oscuro'); }
  function pinta(btn){ if(!btn) return; var d=oscuro();
    btn.innerHTML = d ? SOL : LUNA;
    btn.title = d ? 'Modo claro' : 'Modo oscuro';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('aria-pressed', d ? 'true' : 'false');
  }
  function metaColor(){ var m=document.querySelector('meta[name="theme-color"]');
    if(m) m.setAttribute('content', oscuro() ? '#0F1826' : '#007BFF'); }
  function aplica(d){
    document.documentElement.classList.toggle('oscuro', d);
    try{ localStorage.setItem(KEY, d ? 'oscuro' : 'claro'); }catch(e){}
    metaColor();
    var b=document.getElementById('btnTema'); if(b) pinta(b);
  }
  function toggle(){ aplica(!oscuro()); }
  function inyecta(bar){
    if(!bar || bar.querySelector('#btnTema')) return;
    var out = bar.querySelector('#btnOut');            /* ancla: el ícono de salir */
    var b = document.createElement('button');
    b.className='icon-btn'; b.id='btnTema'; b.type='button';
    pinta(b);
    b.addEventListener('click', function(ev){ ev.preventDefault(); toggle(); });
    if(out && out.parentNode===bar) bar.insertBefore(b, out); else bar.appendChild(b);
  }
  function barrer(root){ var ls=(root||document).querySelectorAll('.appbar');
    for(var i=0;i<ls.length;i++) inyecta(ls[i]); }
  /* respalda el mini-script del head por si no está */
  try{ var g=localStorage.getItem(KEY); if(g) document.documentElement.classList.toggle('oscuro', g==='oscuro'); }catch(e){}
  metaColor();
  function arranca(){
    barrer();
    var app = document.getElementById('app') || document.body;
    try{
      new MutationObserver(function(muts){
        for(var i=0;i<muts.length;i++){ var m=muts[i];
          for(var j=0;j<m.addedNodes.length;j++){ var n=m.addedNodes[j];
            if(n.nodeType!==1) continue;
            if(n.classList && n.classList.contains('appbar')) inyecta(n);
            else if(n.querySelector) barrer(n);
          }
        }
      }).observe(app, {childList:true, subtree:true});
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', arranca);
  else arranca();
})();
