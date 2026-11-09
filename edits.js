/* laSave — modifications du site faites depuis l'admin (textes, tailles, couleurs, images, ordre, masquage).
   Les réglages sont lus sur l'API et appliqués ici ; l'éditeur (edit.js) ne se charge qu'avec ?edit=1. */
(() => {
  const API = 'https://go.la-save.fr', CACHE = 'lasave_edits', MOBILE = 720;
  const EDIT = /[?&]edit=1(&|$)/.test(location.search);
  const empty = () => ({ styles: {}, texts: {}, order: {} });
  const norm = d => ({ styles: (d && d.styles) || {}, texts: (d && d.texts) || {}, order: (d && d.order) || {} });
  let E = empty();
  try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (c && !EDIT) E = norm(c); } catch (_) {}

  // Feuille de style construite par le navigateur (la sécurité du site interdit les <style> écrits à la main)
  let sheet = null, tagStyle = null;
  try { sheet = new CSSStyleSheet(); document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; } catch (_) { sheet = null; }
  function setCss(text) {
    if (sheet) { try { sheet.replaceSync(text); return; } catch (_) {} }
    if (!tagStyle) { tagStyle = document.createElement('style'); document.head.appendChild(tagStyle); }
    const s = tagStyle.sheet; if (!s) return;
    while (s.cssRules.length) s.deleteRule(0);
    text.split('\n').forEach(r => { if (r) try { s.insertRule(r, s.cssRules.length); } catch (_) {} });
  }
  // une taille en px qui rétrécit avec l'écran : 100 % sur ordinateur, ~70 % sur téléphone
  const sc = n => n <= 0 ? n + 'px' : `min(${n}px, calc(${(n * 0.55).toFixed(1)}px + ${(n * 0.0409).toFixed(3)}vw))`;
  const has = v => v !== undefined && v !== null && v !== '';
  const FAM = { archivo: "'Archivo','Arial Narrow',system-ui,sans-serif", sans: "'Instrument Sans',system-ui,sans-serif", serif: "'Instrument Serif',Georgia,serif" };
  const SH = { none: 'none', soft: '0 8px 24px rgba(0,0,0,.28)', strong: '0 18px 50px rgba(0,0,0,.55)' };
  function props(o, editing, scale) {
    const L = n => scale ? sc(n) : n + 'px', x = [];
    if (has(o.font)) x.push(`font-size:${L(o.font)}`);
    if (has(o.weight)) x.push(`font-weight:${o.weight}`);
    if (has(o.lh)) x.push(`line-height:${o.lh}`);
    if (has(o.ls)) x.push(`letter-spacing:${o.ls}px`);
    if (has(o.align)) x.push(`text-align:${o.align}`);
    if (has(o.fam) && FAM[o.fam]) x.push(`font-family:${FAM[o.fam]}`);
    if (has(o.tt)) x.push(`text-transform:${o.tt}`);
    if (has(o.color)) x.push(`color:${o.color}`);
    if (has(o.bg)) x.push(`background-color:${o.bg}`);
    [['pt', 'padding-top'], ['pb', 'padding-bottom'], ['pl', 'padding-left'], ['pr', 'padding-right'], ['mt', 'margin-top'], ['mb', 'margin-bottom']].forEach(([k, p]) => { if (has(o[k])) x.push(`${p}:${L(o[k])}`); });
    if (has(o.radius)) x.push(`border-radius:${o.radius}px`);
    if (has(o.w)) x.push(`width:${L(o.w)}`, 'max-width:100%');
    if (has(o.h)) x.push(`height:${L(o.h)}`);
    if (has(o.ratio)) { x.push(`aspect-ratio:${o.ratio}`); if (!has(o.h)) x.push('height:auto'); }
    if (has(o.bw)) x.push(`border:${o.bw}px solid ${o.bc || 'currentColor'}`); else if (has(o.bc)) x.push(`border-color:${o.bc}`);
    if (has(o.shadow) && SH[o.shadow]) x.push(`box-shadow:${SH[o.shadow]}`);
    if (has(o.op)) x.push(`opacity:${o.op / 100}`);
    // recadrage : mode, point de cadrage, zoom (le zoom agrandit l'image puis la recoupe à sa taille d'origine)
    if (has(o.fit)) x.push(`object-fit:${o.fit}`, `background-size:${o.fit}`);
    const px = has(o.x) ? o.x : 50, py = has(o.y) ? o.y : 50;
    if (has(o.x) || has(o.y)) x.push(`object-position:${px}% ${py}%`, `background-position:${px}% ${py}%`);
    if (has(o.z) && o.z > 1) {
      const k = 1 - 1 / o.z, f = v => (v * k).toFixed(2) + '%';
      x.push(`scale:${o.z}`, `transform-origin:${px}% ${py}%`, `clip-path:inset(${f(py)} ${f(100 - px)} ${f(100 - py)} ${f(px)}${o.cr ? ` round ${(o.cr / o.z).toFixed(1)}px` : ''})`);
    }
    if (o.hidden) x.push(editing ? 'opacity:.28' : 'display:none');
    return x.map(s => s + ' !important').join(';');
  }
  function css(d, editing) {
    const base = [], mob = [];
    Object.entries(d.styles).forEach(([sel, o]) => {
      const a = props(o, editing, true); if (a) base.push(`${sel}{${a}}`);
      if (o.m) { const m = props(o.m, editing, false); if (m) mob.push(`${sel}{${m}}`); }
    });
    if (mob.length) base.push(`@media (max-width:${MOBILE}px){${mob.join('')}}`);
    return base.join('\n');
  }
  const q = s => { try { return document.querySelector(s); } catch (_) { return null; } };
  // range des enfants dans l'ordre demandé, sans toucher aux autres enfants (contenus ajoutés par le site)
  function reorder(p, kids) {
    kids = kids.filter(c => c && c.parentElement === p);
    const cur = [...p.children].filter(c => kids.includes(c));
    if (kids.length < 2 || kids.every((c, i) => c === cur[i])) return;
    const marks = cur.map(c => { const m = document.createComment(''); p.insertBefore(m, c); return m; });
    kids.forEach((c, i) => p.insertBefore(c, marks[i]));
    marks.forEach(m => m.remove());
  }
  function dom(d) {
    Object.entries(d.texts).forEach(([s, t]) => { const n = q(s); if (n && n.childElementCount === 0) { if (!('__o' in n)) n.__o = n.textContent; if (n.textContent !== t && !n.isContentEditable) n.textContent = t; } });
    Object.entries(d.order).forEach(([ps, list]) => { const p = q(ps); if (!p) return; if (!p.__k) p.__k = [...p.children]; reorder(p, list.map(q)); });
  }
  // Un repère stable (data-e) sur chaque élément du HTML d'origine : il survit aux changements d'ordre
  function path(n) {
    const parts = [];
    while (n && n !== document.body) {
      if (n.id) { parts.unshift('#' + n.id); break; }
      const p = n.parentElement; if (!p) break;
      parts.unshift(n.tagName.toLowerCase() + ':' + ([...p.children].filter(c => c.tagName === n.tagName).indexOf(n) + 1));
      n = p;
    }
    return parts.join('>');
  }
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
  function tag() { document.querySelectorAll('body *').forEach(n => { if (!/^(SCRIPT|STYLE|LINK|META|NOSCRIPT|BR)$/.test(n.tagName) && !n.hasAttribute('data-e')) n.setAttribute('data-e', hash(path(n))); }); }

  function update(d, editing) { E = d; setCss(css(d, editing)); }
  const ES = window.__ES = { get E() { return E; }, norm, update, dom, reorder, API, EDIT, MOBILE, loaded: false };
  update(E, false);

  const start = () => {
    tag(); dom(E);
    if (EDIT) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/edit.css?v=3'; document.head.appendChild(l);
      const s = document.createElement('script'); s.src = '/edit.js?v=3'; document.body.appendChild(s);
    }
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
  window.addEventListener('load', () => setTimeout(() => dom(E), 1200));
  window.addEventListener('hashchange', () => setTimeout(() => dom(E), 150));

  fetch(API + '/site-edits' + (EDIT ? '?t=' + Date.now() : '')).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(d => {
    const n = norm(d);
    if (!EDIT) { try { localStorage.setItem(CACHE, JSON.stringify(n)); } catch (_) {} }
    update(n, EDIT); dom(n); ES.loaded = true;
    if (EDIT && window.__EDITOR) window.__EDITOR.reload(n);
  }).catch(() => { ES.loaded = 'error'; if (EDIT && window.__EDITOR) window.__EDITOR.fail(); });
})();
