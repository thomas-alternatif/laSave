/* laSave — modifications du site faites depuis l'admin (textes, tailles, couleurs, ordre, masquage).
   Les réglages sont lus sur l'API et appliqués ici ; l'éditeur (edit.js) ne se charge qu'avec ?edit=1. */
(() => {
  const API = 'https://go.la-save.fr', CACHE = 'lasave_edits';
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
  // une taille en px qui rétrécit un peu avec l'écran : 100 % sur ordinateur, ~70 % sur téléphone
  const sc = n => `min(${n}px, calc(${(n * 0.55).toFixed(1)}px + ${(n * 0.0409).toFixed(2)}vw))`;
  const has = v => v !== undefined && v !== null && v !== '';
  function css(d, editing) {
    return Object.entries(d.styles).map(([sel, o]) => {
      const x = [];
      if (has(o.font)) x.push(`font-size:${sc(o.font)}`);
      if (has(o.color)) x.push(`color:${o.color}`);
      if (has(o.bg)) x.push(`background-color:${o.bg}`);
      [['pt', 'padding-top'], ['pb', 'padding-bottom'], ['pl', 'padding-left'], ['pr', 'padding-right'], ['mt', 'margin-top'], ['mb', 'margin-bottom']].forEach(([k, p]) => { if (has(o[k])) x.push(`${p}:${sc(o[k])}`); });
      if (has(o.radius)) x.push(`border-radius:${o.radius}px`);
      if (has(o.w)) x.push(`width:${sc(o.w)}`, 'max-width:100%');
      if (has(o.h)) x.push(`height:${sc(o.h)}`);
      if (o.hidden) x.push(editing ? 'opacity:.28' : 'display:none');
      return x.length ? `${sel}{${x.map(s => s + ' !important').join(';')}}` : '';
    }).filter(Boolean).join('\n');
  }
  const q = s => { try { return document.querySelector(s); } catch (_) { return null; } };
  function dom(d) {
    Object.entries(d.texts).forEach(([s, t]) => { const n = q(s); if (n && n.childElementCount === 0) { if (!('__o' in n)) n.__o = n.textContent; if (n.textContent !== t) n.textContent = t; } });
    Object.entries(d.order).forEach(([ps, list]) => {
      const p = q(ps); if (!p) return;
      const kids = list.map(q).filter(c => c && c.parentElement === p);
      const cur = [...p.children].filter(c => kids.includes(c));
      if (kids.length < 2 || kids.every((c, i) => c === cur[i])) return;
      const marks = cur.map(c => { const m = document.createComment(''); p.insertBefore(m, c); return m; });
      kids.forEach((c, i) => p.insertBefore(c, marks[i]));
      marks.forEach(m => m.remove());
    });
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
  window.__ES = { get E() { return E; }, norm, update, dom, API, EDIT };
  update(E, false);

  const start = () => {
    tag(); dom(E);
    if (EDIT) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/edit.css?v=1'; document.head.appendChild(l);
      const s = document.createElement('script'); s.src = '/edit.js?v=1'; document.body.appendChild(s);
    }
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
  window.addEventListener('load', () => setTimeout(() => dom(E), 1200));
  window.addEventListener('hashchange', () => setTimeout(() => dom(E), 150));

  fetch(API + '/site-edits').then(r => r.ok ? r.json() : null).then(d => {
    if (!d) return;
    const n = norm(d);
    if (!EDIT) { try { localStorage.setItem(CACHE, JSON.stringify(n)); } catch (_) {} }
    update(n, EDIT); dom(n);
    if (EDIT && window.__EDITOR) window.__EDITOR.reload(n);
  }).catch(() => {});
})();
