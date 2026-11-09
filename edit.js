/* Espace édition du site (admin) — chargé par edits.js uniquement avec ?edit=1 */
(() => {
  const ES = window.__ES; if (!ES) return;
  const KEY = 'lasave_admin';
  let token = ''; try { token = sessionStorage.getItem(KEY) || ''; } catch (_) {}
  const b = document.body;
  b.classList.add('ed-on'); b.classList.remove('intro-on');
  const intro = document.getElementById('intro'); if (intro) intro.remove();
  setTimeout(() => b.classList.remove('intro-on'), 1500);

  const h = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const clone = o => JSON.parse(JSON.stringify(o));

  if (!token) {
    const g = h('div', 'ed-gate');
    const c = h('div'); c.append(h('p', '', 'Connecte-toi d’abord à l’administration pour modifier le site.'));
    const a = h('a', '', 'Aller à l’admin'); a.href = '/admin.html'; c.append(a); g.append(c); b.append(g); return;
  }

  let P = clone(ES.E), sel = null, scope = 'one', dirty = false, hist = [], lastSnap = 0, resetArm = false;
  const state = { side: 'right', min: false };

  /* ── sélecteurs ── */
  const oneSel = el => el && el.getAttribute('data-e') ? `[data-e="${el.getAttribute('data-e')}"]` : null;
  const klass = el => [...el.classList].find(c => !/^ed-/.test(c));
  const allSel = el => { const k = el && klass(el); return k ? `${el.tagName.toLowerCase()}.${CSS.escape(k)}` : null; };
  const curSel = () => !sel ? null : (scope === 'all' ? (allSel(sel) || oneSel(sel)) : (oneSel(sel) || allSel(sel)));
  const parentSel = p => p.id ? '#' + p.id : oneSel(p);
  const label = el => {
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 38);
    return `${el.tagName.toLowerCase()}${klass(el) ? '.' + klass(el) : ''}${t ? ' · « ' + t + (el.textContent.trim().length > 38 ? '…' : '') + ' »' : ''}`;
  };

  /* ── état / historique ── */
  function snap() { const n = Date.now(); if (n - lastSnap > 600) { hist.push(JSON.stringify(P)); if (hist.length > 60) hist.shift(); } lastSnap = n; }
  function changed() { dirty = true; ES.update(P, true); status(); }
  function setStyle(key, val) {
    const s = curSel(); if (!s) return; snap();
    const o = P.styles[s] || (P.styles[s] = {});
    if (val === '' || val === null || val === undefined) delete o[key]; else o[key] = val;
    if (!Object.keys(o).length) delete P.styles[s];
    changed();
  }
  const sv = key => { const s = curSel(); return s && P.styles[s] ? P.styles[s][key] : undefined; };

  /* ── panneau ── */
  const panel = h('aside', 'ed-panel'); panel.setAttribute('aria-label', 'Édition du site');
  const head = h('div', 'ed-head'), body = h('div', 'ed-body'), msg = h('p', 'ed-msg');
  panel.append(head, body, msg); b.append(panel);
  const btn = (txt, cls, fn) => { const x = h('button', 'ed-btn ' + (cls || ''), txt); x.type = 'button'; x.addEventListener('click', fn); return x; };
  const tt = h('div', 'ed-title', 'Édition du site'); tt.append(h('small', '', 'Clique sur un élément pour le modifier'));
  const bSave = btn('Enregistrer', 'main sm', save), bUndo = btn('↶ Annuler', 'sm', undo);
  const bSide = btn('⇄', 'sm ed-side', () => { state.side = state.side === 'right' ? 'left' : 'right'; panel.classList.toggle('left', state.side === 'left'); });
  bSide.title = 'Mettre le panneau de l’autre côté';
  const bMin = btn('▾', 'sm ed-collapse', () => { state.min = !state.min; panel.classList.toggle('min', state.min); bMin.textContent = state.min ? '▴' : '▾'; });
  const bQuit = btn('Quitter', 'sm ghost', () => { if (dirty && !confirm('Des changements ne sont pas enregistrés. Quitter quand même ?')) return; dirty = false; location.href = '/admin.html'; });
  head.append(tt, bSave, bUndo, bSide, bMin, bQuit);
  function say(t, kind) { msg.textContent = t || ''; msg.className = 'ed-msg' + (kind ? ' ' + kind : ''); msg.hidden = !t; }
  function status() { bUndo.disabled = !hist.length; bSave.textContent = dirty ? 'Enregistrer •' : 'Enregistrer'; }

  async function save() {
    bSave.disabled = true; say('Enregistrement…');
    try {
      const r = await fetch(ES.API + '/admin/site-edits', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(P) });
      if (r.status === 401) { say('Session expirée : reconnecte-toi dans l’admin (tes changements restent ici tant que la page est ouverte).', 'err'); }
      else if (!r.ok) { const d = await r.json().catch(() => ({})); say(d.error || 'Enregistrement impossible (' + r.status + ').', 'err'); }
      else { dirty = false; say('Enregistré. Visible sur le site dans moins d’une minute.', 'ok'); status(); }
    } catch (_) { say('Pas de connexion à l’API. Réessaie.', 'err'); }
    bSave.disabled = false;
  }
  function undo() {
    const s = hist.pop(); if (!s) return;
    P = JSON.parse(s); dirty = true; ES.update(P, true); applyTexts(); applyOrder(); render(); status();
  }
  // remet à l'écran les textes / l'ordre d'un état (annuler, réinitialiser)
  function applyTexts() { document.querySelectorAll('[data-e]').forEach(n => { if (n.childElementCount === 0 && '__o' in n) { const s = oneSel(n); const t = P.texts[s]; const want = t !== undefined ? t : n.__o; if (n.textContent !== want) n.textContent = want; } }); ES.dom(P); }
  function applyOrder() { ES.dom(P); }

  /* ── contrôles ── */
  function row(lab, ...ctl) { const r = h('div', 'ed-row'); r.append(h('label', '', lab)); const v = h('div', 'val'); v.append(...ctl.filter(c => !c.classList.contains('range'))); r.append(v); ctl.filter(c => c.classList.contains('range')).forEach(c => r.append(c)); return r; }
  function numCtl(lab, key, min, max, def) {
    const cur = sv(key), start = cur !== undefined ? cur : Math.round(def);
    const n = h('input'); n.type = 'number'; n.min = min; n.max = max; n.value = start;
    const rg = h('input', 'range'); rg.type = 'range'; rg.min = min; rg.max = max; rg.value = start;
    const x = h('button', 'ed-x', '×'); x.type = 'button'; x.title = 'Remettre la valeur d’origine';
    const go = v => { v = Math.max(min, Math.min(max, Number(v) || 0)); n.value = v; rg.value = v; setStyle(key, v); };
    n.addEventListener('input', () => { if (n.value !== '') go(n.value); }); rg.addEventListener('input', () => go(rg.value));
    x.addEventListener('click', () => { setStyle(key, undefined); render(); });
    const r = row(lab, n, x, rg); if (cur === undefined) r.style.opacity = .85; return r;
  }
  const toHex = c => { const m = String(c).match(/\d+(\.\d+)?/g); if (!m || m.length < 3) return '#000000'; return '#' + m.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); };
  function colCtl(lab, key, cssProp) {
    const cur = sv(key), cs = getComputedStyle(sel);
    const i = h('input'); i.type = 'color'; i.value = cur || toHex(cs[cssProp]);
    const x = h('button', 'ed-x', '×'); x.type = 'button'; x.title = 'Remettre la couleur d’origine';
    i.addEventListener('input', () => setStyle(key, i.value)); x.addEventListener('click', () => { setStyle(key, undefined); render(); });
    return row(lab, i, x);
  }
  function section(title) { const s = h('div', 'ed-sec'); s.append(h('h3', '', title)); return s; }

  function render() {
    body.textContent = ''; status();
    const views = h('div', 'ed-views');
    [['Accueil', ''], ['Agenda', 'agenda'], ['Organisateurs', 'structures'], ['Sondages', 'sondages'], ['Proposer', 'partager']].forEach(([t, hs]) => {
      const cur = location.hash.replace('#', '');
      const v = btn(t, 'sm' + (cur === hs ? ' on' : ''), () => { location.hash = hs; setTimeout(render, 250); }); views.append(v);
    });
    body.append(h('p', 'ed-sel-sub', 'Page affichée :'), views);
    if (!sel || !document.contains(sel)) { sel = null; body.append(h('p', 'ed-hint', 'Clique sur un texte, un bouton, une image ou un bloc du site pour le modifier ici. Les liens et boutons ne se déclenchent pas pendant l’édition.')); return; }
    const cs = getComputedStyle(sel);
    const nm = h('p', 'ed-sel-name', label(sel)); body.append(nm);
    const similar = allSel(sel) ? document.querySelectorAll(allSel(sel)).length : 0;
    body.append(h('p', 'ed-sel-sub', scope === 'all' ? `Modifie les ${similar} éléments semblables` : 'Modifie uniquement cet élément'));

    const acts = h('div', 'ed-acts');
    acts.append(btn('↑ Parent', 'sm', () => { const p = sel.parentElement; if (p && p !== b && p.id !== 'contenu') pick(p); }));
    if (allSel(sel) && oneSel(sel)) {
      const seg = h('div', 'ed-seg');
      seg.append(btn('Cet élément', 'sm' + (scope === 'one' ? ' on' : ''), () => { scope = 'one'; render(); }), btn(`Tous les semblables (${similar})`, 'sm' + (scope === 'all' ? ' on' : ''), () => { scope = 'all'; render(); }));
      body.append(seg);
    } else if (!oneSel(sel)) scope = 'all';
    body.append(acts);

    // texte
    const so = oneSel(sel);
    if (so && sel.childElementCount === 0 && (sel.textContent.trim() || '__o' in sel)) {
      const sc = section('Texte'), ta = h('textarea', 'ed-text'); ta.value = P.texts[so] !== undefined ? P.texts[so] : sel.textContent;
      ta.addEventListener('input', () => { snap(); P.texts[so] = ta.value; if (!('__o' in sel)) sel.__o = sel.textContent; sel.textContent = ta.value; dirty = true; status(); });
      sc.append(ta, btn('Remettre le texte d’origine', 'sm ghost', () => { snap(); delete P.texts[so]; if ('__o' in sel) sel.textContent = sel.__o; dirty = true; render(); }));
      body.append(sc);
    }
    // police
    const t = section('Taille et couleurs');
    t.append(numCtl('Taille du texte (px)', 'font', 8, 140, parseFloat(cs.fontSize)), colCtl('Couleur du texte', 'color', 'color'), colCtl('Couleur du fond', 'bg', 'backgroundColor'));
    body.append(t);
    // espacements
    const e = section('Espacements et forme');
    e.append(numCtl('Espace intérieur haut', 'pt', 0, 160, parseFloat(cs.paddingTop)), numCtl('Espace intérieur bas', 'pb', 0, 160, parseFloat(cs.paddingBottom)),
      numCtl('Marge au-dessus', 'mt', 0, 200, parseFloat(cs.marginTop)), numCtl('Marge en dessous', 'mb', 0, 200, parseFloat(cs.marginBottom)),
      numCtl('Arrondi des coins (px)', 'radius', 0, 80, parseFloat(cs.borderTopLeftRadius) || 0));
    const adv = h('details', 'ed-adv'); adv.append(h('summary', '', 'Plus de réglages'));
    adv.append(numCtl('Espace intérieur gauche', 'pl', 0, 160, parseFloat(cs.paddingLeft)), numCtl('Espace intérieur droite', 'pr', 0, 160, parseFloat(cs.paddingRight)),
      numCtl('Largeur (px)', 'w', 20, 1600, sel.getBoundingClientRect().width), numCtl('Hauteur (px)', 'h', 10, 1200, sel.getBoundingClientRect().height));
    e.append(adv); body.append(e);
    // organisation
    const o = section('Organisation'), oa = h('div', 'ed-acts');
    const hid = !!sv('hidden');
    oa.append(btn(hid ? 'Réafficher' : 'Masquer', 'sm', () => { setStyle('hidden', hid ? undefined : true); render(); }));
    const par = sel.parentElement;
    if (so && par && parentSel(par)) {
      oa.append(btn('↑ Monter', 'sm', () => move(-1)), btn('↓ Descendre', 'sm', () => move(1)));
    }
    oa.append(btn('Tout remettre pour cet élément', 'sm ghost', () => { const s = curSel(); snap(); delete P.styles[s]; if (so) delete P.texts[so]; applyTexts(); changed(); render(); }));
    o.append(oa); body.append(o);
    const s2 = section('Tout le site'), arm = btn(resetArm ? 'Confirmer : tout effacer' : 'Réinitialiser tout le site', 'sm ghost', () => {
      if (!resetArm) { resetArm = true; render(); setTimeout(() => { resetArm = false; }, 4000); return; }
      resetArm = false; snap(); P = { styles: {}, texts: {}, order: {} }; ES.update(P, true); applyTexts(); dirty = true; status(); say('Tout est remis à l’origine (clique Enregistrer pour confirmer ; l’ordre des blocs se rétablit après rechargement).'); render();
    });
    s2.append(arm); body.append(s2);
  }

  function move(dir) {
    const par = sel.parentElement, ps = parentSel(par); if (!ps) return;
    const kids = [...par.children].filter(c => c.getAttribute('data-e'));
    const i = kids.indexOf(sel), j = i + dir; if (j < 0 || j >= kids.length) { say('Déjà en ' + (dir < 0 ? 'première' : 'dernière') + ' position.'); return; }
    snap();
    if (dir < 0) par.insertBefore(sel, kids[j]); else par.insertBefore(sel, kids[j].nextSibling);
    P.order[ps] = [...par.children].filter(c => c.getAttribute('data-e')).map(c => oneSel(c));
    dirty = true; status(); say(''); sel.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ── sélection sur le site ── */
  let hov = null;
  const inPanel = t => panel.contains(t) || (t.closest && t.closest('.ed-gate'));
  function pick(el) {
    if (sel) sel.classList.remove('ed-sel');
    sel = el; sel.classList.remove('ed-hov'); sel.classList.add('ed-sel');
    scope = oneSel(el) ? 'one' : 'all';
    if (state.min) { state.min = false; panel.classList.remove('min'); bMin.textContent = '▾'; }
    render();
  }
  document.addEventListener('mouseover', e => { if (inPanel(e.target)) return; if (hov) hov.classList.remove('ed-hov'); hov = e.target === b || e.target === document.documentElement ? null : e.target; if (hov && hov !== sel) hov.classList.add('ed-hov'); }, true);
  document.addEventListener('mouseout', e => { if (hov) { hov.classList.remove('ed-hov'); hov = null; } }, true);
  document.addEventListener('click', e => {
    if (inPanel(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    const t = e.target.closest ? e.target : e.target.parentElement;
    if (!t || t === b || t === document.documentElement) return;
    pick(t);
  }, true);
  ['submit', 'auxclick', 'dblclick'].forEach(ev => document.addEventListener(ev, e => { if (!inPanel(e.target)) { e.preventDefault(); e.stopPropagation(); } }, true));
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !/^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName)) { e.preventDefault(); undo(); } }, true);
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('hashchange', () => { sel = null; setTimeout(render, 200); });

  window.__EDITOR = { reload(n) { if (dirty) return; P = clone(n); render(); } };
  render(); status(); say('');
})();
