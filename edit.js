/* laSave — espace édition du site (admin). Chargé par edits.js uniquement avec ?edit=1. */
(() => {
  const ES = window.__ES; if (!ES || window.__EDITOR) return;
  const KEY = 'lasave_admin', DRAFT = 'lasave_edit_draft', PREF = 'lasave_edit_pref';
  const D = document, b = D.body, MOB = ES.MOBILE || 720;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  let token = ''; try { token = sessionStorage.getItem(KEY) || ''; } catch (_) {}
  b.classList.add('ez-on'); b.classList.remove('intro-on');
  const intro = D.getElementById('intro'); if (intro) intro.remove();
  setTimeout(() => b.classList.remove('intro-on'), 1500);

  const h = (tag, cls, txt) => { const n = D.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const btn = (txt, cls, fn, title) => { const x = h('button', 'ez-btn ' + (cls || ''), txt); x.type = 'button'; if (title) { x.title = title; x.setAttribute('aria-label', title); } x.addEventListener('click', fn); return x; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const q = s => { try { return D.querySelector(s); } catch (_) { return null; } };
  const qa = s => { try { return D.querySelectorAll(s); } catch (_) { return []; } };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  if (!token) {
    const g = h('div', 'ez-gate'), c = h('div');
    c.append(h('p', '', 'Connecte-toi d’abord à l’administration pour modifier le site.'));
    const a = h('a', '', 'Aller à l’admin'); a.href = '/admin.html'; c.append(a); g.append(c); b.append(g); return;
  }

  /* ── état ── */
  const pref = Object.assign({ side: 'right', open: { txt: 1, img: 1, typo: 1, col: 0, esp: 0, forme: 0, fx: 0, chg: 1, ver: 0 } }, store.get(PREF, {}));
  const savePref = () => store.set(PREF, pref);
  let P = clone(ES.E), sel = null, scope = 'one', bp = innerWidth <= MOB ? 'm' : 'all';
  let dirty = false, undoS = [], redoS = [], lastSnap = 0, resetArm = false, loaded = ES.loaded, pendingDraft = null, clipboard = null;
  let cropOn = false, versions = null, nav = false, pass = false, under = [];
  const HOME = !!D.getElementById('view-home');
  // animations figées pendant l'édition (rendues en mode navigation)
  const motionApi = window.__lasaveMotion, motion0 = motionApi ? motionApi.still : false;
  const freeze = on => { b.classList.toggle('ez-frozen', on); try { if (motionApi) motionApi.set(on ? true : motion0); } catch (_) {} };
  const ratios = {}; // proportions des images de fond (pour zoomer sans déformer)
  const bgUrl = el => { const m = getComputedStyle(el).backgroundImage.match(/url\(["']?(.*?)["']?\)/); return m ? m[1] : ''; };
  const loadRatio = el => { const u = bgUrl(el); if (!u || ratios[u]) return; ratios[u] = -1; const i = new Image(); i.onload = () => { ratios[u] = i.naturalWidth / i.naturalHeight; }; i.src = u; };

  /* ── sélecteurs ── */
  const at = (el, a) => el && el.getAttribute && el.getAttribute(a);
  const oneSel = el => at(el, 'data-e') ? `[data-e="${at(el, 'data-e')}"]` : null;
  const imgSel = el => at(el, 'data-img') ? `[data-img="${at(el, 'data-img')}"]` : null;
  const klass = el => el && el.classList && [...el.classList].find(c => !/^ez-/.test(c) && /^[A-Za-z][\w-]*$/.test(c));
  const allSel = el => { const k = klass(el); return k ? `${el.tagName.toLowerCase()}.${k}` : null; };
  const selFor = (el, s) => s === 'img' ? imgSel(el) : s === 'all' ? allSel(el) : oneSel(el);
  const curSel = () => sel ? (selFor(sel, scope) || oneSel(sel) || imgSel(sel) || allSel(sel)) : null;
  const parentSel = p => p && (p.id ? '#' + p.id : oneSel(p));
  const NAMES = { H1: 'Grand titre', H2: 'Titre', H3: 'Sous-titre', H4: 'Petit titre', P: 'Paragraphe', A: 'Lien', BUTTON: 'Bouton', IMG: 'Image', SECTION: 'Section', HEADER: 'En-tête', FOOTER: 'Pied de page', NAV: 'Menu', UL: 'Liste', LI: 'Élément de liste', SPAN: 'Texte', EM: 'Texte en italique', STRONG: 'Texte en gras', LABEL: 'Étiquette', FIGURE: 'Illustration', ARTICLE: 'Carte', DIV: 'Bloc', SMALL: 'Petit texte', INPUT: 'Champ', FORM: 'Formulaire', I: 'Élément' };
  const isImg = el => !!el && el.nodeType === 1 && (el.tagName === 'IMG' || /url\(/.test(getComputedStyle(el).backgroundImage));
  const kind = el => isImg(el) && el.tagName !== 'IMG' ? 'Image (fond)' : (NAMES[el.tagName] || el.tagName.toLowerCase());
  const snippet = (el, n = 34) => { const t = (el.textContent || '').trim().replace(/\s+/g, ' '); return t ? '« ' + (t.length > n ? t.slice(0, n) + '…' : t) + ' »' : ''; };
  const textOk = el => !!el && !!oneSel(el) && el.childElementCount === 0 && !/^(INPUT|TEXTAREA|SELECT|IMG|SVG|PATH|IFRAME|VIDEO)$/i.test(el.tagName) && !!((el.textContent || '').trim() || '__o' in el);

  /* ── réglages : par écran (tous / mobile) ── */
  const bucket = (s, make) => {
    let o = P.styles[s]; if (!o) { if (!make) return null; o = P.styles[s] = {}; }
    if (bp !== 'm') return o;
    if (!o.m) { if (!make) return null; o.m = {}; }
    return o.m;
  };
  const tidy = s => { const o = P.styles[s]; if (!o) return; if (o.m && !Object.keys(o.m).length) delete o.m; if (!Object.keys(o).length) delete P.styles[s]; };
  function setMany(obj, noSnap) {
    const s = curSel(); if (!s) return; if (!noSnap) snap();
    const o = bucket(s, true);
    Object.entries(obj).forEach(([k, v]) => { if (v === '' || v === null || v === undefined) delete o[k]; else o[k] = v; });
    tidy(s); changed();
  }
  const setStyle = (k, v, noSnap) => setMany({ [k]: v }, noSnap);
  const sv = k => { const s = curSel(); const o = s && bucket(s, false); return o ? o[k] : undefined; };

  /* ── historique, brouillon, synchro entre fenêtres ── */
  function snap(force) { const n = Date.now(); if (force || n - lastSnap > 600) { undoS.push(JSON.stringify(P)); if (undoS.length > 100) undoS.shift(); redoS = []; } lastSnap = n; }
  let dT; const draft = () => { clearTimeout(dT); dT = setTimeout(() => store.set(DRAFT, dirty ? { at: Date.now(), P } : null), 400); };
  let chan = null; try { chan = new BroadcastChannel('lasave-edit'); } catch (_) {}
  const share = m => { try { chan && chan.postMessage(m || { t: 'P', P, dirty }); } catch (_) {} };
  function changed() { dirty = true; ES.update(P, true); draft(); share(); status(); if (cropOn) placeCrop(); }
  function applyAll() {
    qa('[data-e]').forEach(n => {
      if ('__o' in n && n.childElementCount === 0 && !n.isContentEditable) { const t = P.texts[oneSel(n)]; const w = t !== undefined ? t : n.__o; if (n.textContent !== w) n.textContent = w; }
      if (n.__k && !P.order[parentSel(n)]) ES.reorder(n, n.__k);
    });
    ES.dom(P);
  }
  function restore(st) { P = typeof st === 'string' ? JSON.parse(st) : st; dirty = true; ES.update(P, true); applyAll(); draft(); share(); render(); }
  function undo() { const s = undoS.pop(); if (!s) return; redoS.push(JSON.stringify(P)); restore(s); say('Modification annulée.'); }
  function redo() { const s = redoS.pop(); if (!s) return; undoS.push(JSON.stringify(P)); restore(s); say('Modification rétablie.'); }
  if (chan) chan.onmessage = e => {
    const d = e.data || {};
    if (d.t === 'P') { P = d.P; dirty = d.dirty; ES.update(P, true); applyAll(); status(); if (!cropOn && !D.hasFocus()) render(); }
    if (d.t === 'saved') { dirty = false; store.set(DRAFT, null); status(); say('Enregistré depuis l’autre fenêtre.', 'ok'); }
  };

  /* ── panneau ── */
  const panel = h('aside', 'ez-panel' + (pref.side === 'left' ? ' left' : '')); panel.setAttribute('aria-label', 'Édition du site');
  const head = h('div', 'ez-head'), bar = h('div', 'ez-bar'), body = h('div', 'ez-body'), msg = h('p', 'ez-msg');
  const nbar = h('div', 'ez-nav');
  panel.append(head, bar, nbar, body, msg); b.append(panel);
  const tt = h('div', 'ez-title', 'Édition du site'), count = h('small', 'ez-count'); tt.append(count);
  const bSave = btn('Enregistrer', 'main sm', save, 'Mettre en ligne (Ctrl + S)');
  const bUndo = btn('↶', 'sm icon', undo, 'Annuler (Ctrl + Z)'), bRedo = btn('↷', 'sm icon', redo, 'Rétablir (Ctrl + Maj + Z)');
  const bPrev = btn('Aperçu mobile', 'sm ez-side', () => {
    const w = window.open(location.pathname + '?edit=1' + location.hash, 'lasave-mobile', 'width=400,height=860');
    if (w) say('Aperçu mobile ouvert : il suit tes changements en direct.', 'ok'); else say('Autorise les fenêtres surgissantes pour l’aperçu mobile.', 'err');
  }, 'Ouvrir un aperçu téléphone synchronisé');
  const bSide = btn('⇄', 'sm icon ez-side', () => { pref.side = pref.side === 'right' ? 'left' : 'right'; panel.classList.toggle('left', pref.side === 'left'); savePref(); }, 'Mettre le panneau de l’autre côté');
  const bMin = btn('▾', 'sm icon ez-collapse', () => { panel.classList.toggle('min'); bMin.textContent = panel.classList.contains('min') ? '▴' : '▾'; }, 'Réduire le panneau');
  const bQuit = btn('Quitter', 'sm ghost', () => { if (dirty && !confirm('Des changements ne sont pas enregistrés (ils restent en brouillon sur cet appareil). Quitter ?')) return; leaving = true; location.href = '/admin.html'; });
  head.append(tt, bSave, bUndo, bRedo, bPrev, bSide, bMin, bQuit);
  // écran visé
  const bpAll = btn('Tous les écrans', 'sm', () => setBp('all')), bpMob = btn('Mobile seulement', 'sm', () => setBp('m'));
  bar.append(h('span', 'ez-bar-l', 'Réglages pour'), bpAll, bpMob);
  function setBp(v) { bp = v; render(); }

  /* ── aller partout : pages, fenêtres, autres pages, mode navigation ── */
  const goSel = h('select', 'ez-select go'); goSel.setAttribute('aria-label', 'Aller à une page ou ouvrir une fenêtre');
  const GO = [
    ['Pages du site', HOME ? [['#', 'Accueil'], ['#agenda', 'Tout l’agenda'], ['#structures', 'Organisateurs'], ['#sondages', 'Sondages'], ['#partager', 'Proposer un événement'], ['#mentions', 'Mentions légales'], ['#confidentialite', 'Confidentialité'], ['#cookies', 'Cookies'], ['#accessibilite', 'Accessibilité']] : [['/', 'Accueil du site']]],
    ['Fenêtres', HOME ? [['w:event', 'Fiche d’un événement'], ['w:pro', 'Profil d’un organisateur'], ['w:poll', 'Fenêtre de sondage'], ['w:menu', 'Menu du site']] : []],
    ['Autres pages', [['/guide.html', 'Guide « Tout savoir sur laSave »'], ['/archive.html', 'Archive des affiches']]],
  ];
  { const o0 = h('option', '', 'Aller à…'); o0.value = ''; goSel.append(o0);
    GO.forEach(([g, list]) => { if (!list.length) return; const og = D.createElement('optgroup'); og.label = g; list.forEach(([v, t]) => { const o = h('option', '', t); o.value = v; og.append(o); }); goSel.append(og); }); }
  goSel.addEventListener('change', () => { const v = goSel.value; goSel.value = ''; goTo(v); });
  const bEdit = btn('Modifier', 'sm', () => setNav(false), 'Cliquer sur le site sélectionne les éléments');
  const bNav = btn('Naviguer', 'sm', () => setNav(true), 'Le site fonctionne normalement : menus, fiches, liens');
  const bClose = btn('Fermer la fenêtre', 'sm', () => closeWin()); bClose.hidden = true;
  const mode = h('div', 'ez-mode'); mode.append(bEdit, bNav);
  nbar.append(goSel, mode, bClose);
  let leaving = false;
  function leave(url) {
    if (dirty) { store.set(DRAFT, { at: Date.now(), P }); try { sessionStorage.setItem('lasave_edit_carry', '1'); } catch (_) {} }
    leaving = true; location.href = url;
  }
  function goTo(v) {
    if (!v) return;
    if (v.startsWith('w:')) { openWin(v.slice(2)); return; }
    if (v.startsWith('#')) { if (HOME) location.hash = v.slice(1); else leave('/?edit=1' + (v.length > 1 ? v : '')); return; }
    leave(v === '/' ? '/?edit=1' : v + '?edit=1');
  }
  const viaSite = el => { if (!el) return false; pass = true; try { el.click(); } finally { pass = false; } return true; };
  const openWins = () => [...qa('.sheet:not([hidden]), #menu:not([hidden])')];
  function openWin(k) {
    const go = () => {
      let ok = false;
      if (k === 'event') ok = viaSite(q('#hero-open')) || viaSite(q('.fcard')) || viaSite(q('.ag-item, #view-agenda li button'));
      if (k === 'pro') ok = viaSite(q('.st-nom'));
      if (k === 'poll') ok = viaSite(q('.hpoll')) || viaSite([...qa('#view-sondages button')].find(x => !at(x, 'data-e')));
      if (k === 'menu') ok = viaSite(q('#burger'));
      unpick(true);
      say(ok ? 'Fenêtre ouverte : clique sur ses éléments pour les modifier, puis « Fermer la fenêtre ».' : 'Rien à ouvrir pour l’instant : aucun contenu de ce type n’est en ligne.', ok ? 'ok' : 'err');
      setTimeout(status, 300);
    };
    if ((k === 'event') && HOME && q('#view-home').hidden) { location.hash = ''; setTimeout(go, 450); } else go();
  }
  function closeWin() { openWins().forEach(w => viaSite(w.querySelector('[data-close], [data-menu-close]'))); unpick(true); setTimeout(status, 300); }
  function setNav(v) {
    nav = v;
    if (nav) { if (cropOn) stopCrop(); inlineOff(); if (sel) sel.classList.remove('ez-sel'); sel = null; if (hov) hov.classList.remove('ez-hov'); hl.hidden = true; }
    b.classList.toggle('ez-navmode', nav); freeze(!nav); render();
    say(nav ? 'Mode navigation : le site fonctionne normalement (menus, fiches, liens). Repasse sur « Modifier » pour sélectionner.' : '');
  }
  setInterval(() => { const o = openWins().length > 0; if (bClose.hidden === o) bClose.hidden = !o; }, 700);
  function say(t, k) { msg.textContent = t || ''; msg.className = 'ez-msg' + (k ? ' ' + k : ''); msg.hidden = !t; }
  const nChanges = () => Object.keys(P.styles).length + Object.keys(P.texts).length + Object.keys(P.order).length;
  function status() {
    bUndo.disabled = !undoS.length; bRedo.disabled = !redoS.length;
    bSave.disabled = loaded !== true; bSave.textContent = dirty || loaded !== true ? 'Enregistrer' : 'Enregistré';
    bSave.classList.toggle('done', !dirty && loaded === true);
    const n = nChanges(); count.textContent = n ? n + ' réglage' + (n > 1 ? 's' : '') + (dirty ? ' · non enregistré' : ' · en ligne') : (dirty ? 'non enregistré' : '');
    bEdit.classList.toggle('on', !nav); bNav.classList.toggle('on', nav);
    bpAll.classList.toggle('on', bp !== 'm'); bpMob.classList.toggle('on', bp === 'm');
    bar.classList.toggle('mob', bp === 'm');
  }

  async function api(path, opt = {}) {
    let r;
    try { r = await fetch(ES.API + path, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + token }, opt.body ? { 'Content-Type': 'application/json' } : {}) })); }
    catch (_) { throw new Error('Pas de connexion à l’API. Réessaie dans un instant.'); }
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) throw new Error('Session expirée : reconnecte-toi dans l’admin, puis reviens ici (ton brouillon est gardé).');
    if (!r.ok) throw new Error(d.error || 'Erreur ' + r.status);
    return d;
  }
  async function save() {
    if (loaded !== true) { say('Les réglages actuels n’ont pas pu être lus : enregistrer maintenant risquerait de les effacer.', 'err'); return; }
    bSave.disabled = true; say('Enregistrement…');
    try {
      await api('/admin/site-edits', { method: 'POST', body: JSON.stringify(P) });
      dirty = false; store.set(DRAFT, null); versions = null; share({ t: 'saved' });
      say('En ligne. Les visiteurs voient les changements dans moins d’une minute.', 'ok');
    } catch (e) { say(e.message, 'err'); }
    status(); if (!sel) render();
  }

  /* ── contrôles ── */
  function details(id, title, fill) {
    const d = h('details', 'ez-sec'); d.open = !!pref.open[id];
    d.addEventListener('toggle', () => { pref.open[id] = d.open ? 1 : 0; savePref(); });
    d.append(h('summary', '', title)); fill(d); return d;
  }
  function row(lab, ...ctl) {
    const r = h('div', 'ez-row'), l = h('label', '', lab), v = h('div', 'val');
    r.append(l, v); ctl.forEach(c => c && (c.classList.contains('range') || c.classList.contains('ez-sw') ? r.append(c) : v.append(c))); return r;
  }
  const resetX = keys => { const x = h('button', 'ez-x', '×'); x.type = 'button'; x.title = 'Revenir à l’origine'; x.setAttribute('aria-label', 'Revenir à l’origine'); x.addEventListener('click', () => { const o = {}; keys.forEach(k => { o[k] = undefined; }); setMany(o); render(); }); return x; };
  // curseur + champ numérique ; opt.get / opt.set permettent de stocker autrement (ex. le zoom en facteur)
  function numCtl(lab, key, min, max, def, step = 1, opt = {}) {
    const cur = opt.get ? opt.get() : sv(key);
    const start = cur !== undefined ? cur : Math.round((Number(def) || 0) / step) * step;
    const n = h('input'); n.type = 'number'; n.min = min; n.max = max; n.step = step; n.value = +Number(start).toFixed(2);
    const rg = h('input', 'range'); rg.type = 'range'; rg.min = min; rg.max = max; rg.step = step; rg.value = start;
    n.setAttribute('aria-label', lab); rg.setAttribute('aria-label', lab);
    const go = (v, from) => {
      v = clamp(Number(v), min, max); if (!Number.isFinite(v)) return;
      if (from !== n) n.value = +v.toFixed(2); if (from !== rg) rg.value = v;
      opt.set ? opt.set(v) : setStyle(key, v); r.classList.add('set');
    };
    n.addEventListener('input', () => { if (n.value !== '') go(n.value, n); });
    rg.addEventListener('input', () => go(rg.value, rg));
    const r = row(lab, n, resetX(opt.keys || [key]), rg); if (cur !== undefined) r.classList.add('set'); return r;
  }
  const toHex = c => { const m = String(c).match(/[\d.]+/g); if (!m || m.length < 3) return '#000000'; return '#' + m.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); };
  const SW = ['#050505', '#1a1a1a', '#f4f3ef', '#a3a19b', '#c8a96e', '#e4572e', '#FFA823', '#4CC38A', '#5C96AB', '#C955E0'];
  function colCtl(lab, key, cssProp, transp) {
    const cur = sv(key);
    const i = h('input'); i.type = 'color'; i.setAttribute('aria-label', lab);
    i.value = cur && cur !== 'transparent' ? cur : toHex(getComputedStyle(sel)[cssProp]);
    i.addEventListener('input', () => { setStyle(key, i.value); r.classList.add('set'); });
    const sw = h('div', 'ez-sw');
    SW.forEach(c => { const s = btn('', 'ez-swatch' + (cur === c ? ' on' : ''), () => { i.value = c; setStyle(key, c); render(); }, c); s.style.background = c; sw.append(s); });
    if (transp) sw.append(btn('', 'ez-swatch none' + (cur === 'transparent' ? ' on' : ''), () => { setStyle(key, 'transparent'); render(); }, 'Transparent'));
    const r = row(lab, i, resetX([key]), sw); if (cur !== undefined) r.classList.add('set'); return r;
  }
  function chipsCtl(lab, key, opts, onPick) {
    const cur = sv(key), c = h('div', 'ez-chips');
    opts.forEach(([v, t]) => c.append(btn(t, 'sm' + (cur === v ? ' on' : ''), () => { const nv = cur === v ? undefined : v; onPick ? onPick(nv) : setStyle(key, nv); render(); })));
    const r = h('div', 'ez-row col' + (cur !== undefined ? ' set' : '')); r.append(h('label', '', lab), c); return r;
  }

  /* ── recadrage à la souris ── */
  const ov = h('div', 'ez-crop'), dot = h('i', 'ez-dot'), tip = h('div', 'ez-crop-tip');
  tip.append(h('span', '', 'Glisse pour déplacer · molette pour zoomer'), btn('Terminer', 'main sm', () => stopCrop()));
  ov.append(h('i', 'ez-g ez-g1'), h('i', 'ez-g ez-g2'), h('i', 'ez-g ez-g3'), h('i', 'ez-g ez-g4'), dot, tip);
  let raf = 0, drag = null;
  const radius = () => parseFloat(getComputedStyle(sel).borderTopLeftRadius) || undefined;
  // bloc avec une image de fond ET du contenu : on zoome l'image de fond seule ; sinon on agrandit puis recoupe l'élément
  const bgBlock = el => el.tagName !== 'IMG' && el.childElementCount > 0;
  const setZoom = (z, noSnap) => {
    z = clamp(Math.round(z * 100) / 100, 1, 4);
    if (z <= 1) { setMany({ z: undefined, cr: undefined, zb: undefined }, noSnap); return; }
    if (bgBlock(sel)) {
      const r = ratios[bgUrl(sel)], box = sel.getBoundingClientRect();
      setMany({ z, zb: r > 0 && box.width / box.height < r ? 'h' : 'w', cr: undefined }, noSnap);
    } else setMany({ z, cr: radius(), zb: undefined }, noSnap);
  };
  function placeCrop() {
    if (!cropOn || !sel) return;
    const r = sel.getBoundingClientRect();
    Object.assign(ov.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    const x = sv('x') ?? 50, y = sv('y') ?? 50; Object.assign(dot.style, { left: x + '%', top: y + '%' });
  }
  function loop() { placeCrop(); raf = cropOn ? requestAnimationFrame(loop) : 0; }
  function startCrop() {
    if (!sel || !isImg(sel)) return;
    snap(true);
    const cs = getComputedStyle(sel), o = {};
    if (sel.tagName === 'IMG' && !sv('fit') && !/cover|contain|none/.test(cs.objectFit)) o.fit = 'cover';
    if (sv('x') === undefined) { o.x = 50; o.y = 50; }
    if (sel.tagName !== 'IMG' && !sv('fit') && /auto/.test(cs.backgroundSize) && !sv('z')) o.fit = 'cover';
    if (Object.keys(o).length) setMany(o, true);
    cropOn = true; b.append(ov); b.classList.add('ez-cropping'); loop(); render();
    say('Recadrage : glisse dans l’image, molette pour zoomer, Échap pour terminer.');
  }
  function stopCrop() { if (!cropOn) return; cropOn = false; ov.remove(); b.classList.remove('ez-cropping'); cancelAnimationFrame(raf); render(); say(''); }
  ov.addEventListener('pointerdown', e => {
    if (e.target.closest('.ez-crop-tip')) return;
    e.preventDefault(); ov.setPointerCapture(e.pointerId); snap(true);
    drag = { x: e.clientX, y: e.clientY, x0: sv('x') ?? 50, y0: sv('y') ?? 50, r: sel.getBoundingClientRect(), z: sv('z') || 1 };
    ov.classList.add('drag');
  });
  ov.addEventListener('pointermove', e => {
    if (!drag) return;
    const k = 1.6 / drag.z;
    const x = clamp(Math.round(drag.x0 - (e.clientX - drag.x) / drag.r.width * 100 * k), 0, 100);
    const y = clamp(Math.round(drag.y0 - (e.clientY - drag.y) / drag.r.height * 100 * k), 0, 100);
    setMany({ x, y }, true);
  });
  const endDrag = () => { if (!drag) return; drag = null; ov.classList.remove('drag'); render(); };
  ov.addEventListener('pointerup', endDrag); ov.addEventListener('pointercancel', endDrag);
  let wT;
  ov.addEventListener('wheel', e => {
    e.preventDefault(); snap();
    setZoom((sv('z') || 1) - e.deltaY * 0.0015, true);
    clearTimeout(wT); wT = setTimeout(render, 250);
  }, { passive: false });

  /* ── liste des modifications et versions ── */
  function describe(k) {
    const el = q(k);
    if (el) return { el, name: kind(el) + ' ' + snippet(el, 26) };
    if (k.startsWith('[data-img')) return { el: null, name: 'Photo (sur une autre page)' };
    if (k.startsWith('[data-e')) return { el: null, name: 'Élément d’une autre page' };
    return { el: null, name: 'Tous les « ' + k.split('.').pop() + ' »' };
  }
  function changesBox() {
    const box = h('div', 'ez-list'), keys = [...new Set([...Object.keys(P.styles), ...Object.keys(P.texts)])];
    if (!keys.length && !Object.keys(P.order).length) { box.append(h('p', 'ez-hint', 'Aucune modification pour l’instant.')); return box; }
    keys.forEach(k => {
      const { el, name } = describe(k), it = h('div', 'ez-item'), st = P.styles[k] || {}, bits = [];
      if (P.texts[k] !== undefined) bits.push('texte');
      if (Object.keys(st).some(f => !['m', 'x', 'y', 'z', 'cr', 'fit', 'ratio', 'hidden'].includes(f))) bits.push('style');
      if (st.z || st.x !== undefined || st.ratio || st.fit) bits.push('cadrage');
      if (st.hidden) bits.push('masqué');
      if (st.m) bits.push('réglage mobile');
      const t = h('div', 'ez-item-t'); t.append(h('b', '', name), h('small', '', bits.join(' · ')));
      it.append(t);
      if (el) it.append(btn('Voir', 'sm', () => { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); pick(el, k.startsWith('[data-img') ? 'img' : k.startsWith('[data-e') ? 'one' : 'all'); }));
      it.append(btn('×', 'sm ghost icon', () => { snap(true); delete P.styles[k]; delete P.texts[k]; applyAll(); changed(); render(); }, 'Supprimer cette modification'));
      box.append(it);
    });
    Object.keys(P.order).forEach(k => {
      const it = h('div', 'ez-item'), t = h('div', 'ez-item-t'), el = q(k);
      t.append(h('b', '', 'Ordre des blocs' + (el ? ' · ' + kind(el) : '')), h('small', '', P.order[k].length + ' blocs'));
      it.append(t, btn('×', 'sm ghost icon', () => { snap(true); delete P.order[k]; applyAll(); changed(); render(); }, 'Remettre l’ordre d’origine'));
      box.append(it);
    });
    return box;
  }
  function versionsBox() {
    const box = h('div', 'ez-list');
    if (!versions) {
      box.append(btn('Afficher les versions précédentes', 'sm', async () => { try { versions = await api('/admin/site-edits/versions'); render(); } catch (e) { say(e.message, 'err'); } }));
      return box;
    }
    if (!versions.length) { box.append(h('p', 'ez-hint', 'Pas encore de version précédente : une copie est gardée à chaque enregistrement (15 au maximum).')); return box; }
    versions.forEach(v => {
      const it = h('div', 'ez-item'), t = h('div', 'ez-item-t'), d = new Date(v.at);
      t.append(h('b', '', d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })), h('small', '', v.n + ' réglage' + (v.n > 1 ? 's' : '')));
      it.append(t, btn('Charger', 'sm', async () => {
        try { const d2 = await api('/admin/site-edits/versions?i=' + v.i); snap(true); restore(ES.norm(d2)); say('Version chargée. Vérifie, puis Enregistrer pour la remettre en ligne.', 'ok'); } catch (e) { say(e.message, 'err'); }
      }));
      box.append(it);
    });
    return box;
  }

  /* ── rendu du panneau ── */
  function render() {
    const keep = body.scrollTop; body.textContent = ''; status();
    if (loaded === 'error') body.append(h('p', 'ez-note warn', 'Les réglages en ligne n’ont pas pu être lus (API injoignable ou pas encore mise à jour). L’enregistrement est bloqué pour ne rien effacer.'));
    if (pendingDraft) {
      const w = h('div', 'ez-note'), d = new Date(pendingDraft.at);
      w.append(h('p', '', 'Un brouillon non enregistré existe (' + d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ').'));
      const a = h('div', 'ez-chips');
      a.append(btn('Reprendre le brouillon', 'sm main', () => { snap(true); const dd = pendingDraft.P; pendingDraft = null; restore(ES.norm(dd)); }), btn('Ignorer', 'sm ghost', () => { pendingDraft = null; store.set(DRAFT, null); render(); }));
      w.append(a); body.append(w);
    }
    if (bp === 'm') body.append(h('p', 'ez-note mob', 'Mode mobile : ces réglages ne s’appliquent qu’aux écrans de moins de ' + MOB + ' px, en tailles exactes. Le reste des écrans n’est pas touché.'));
    if (nav) { body.append(h('p', 'ez-note nav', 'Mode navigation : tu utilises le site comme un visiteur (ouvrir le menu, une fiche, changer de page…). Clique « Modifier » pour reprendre l’édition de ce qui est affiché.')); }

    if (!sel || !D.contains(sel)) {
      sel = null;
      if (!nav) body.append(h('p', 'ez-hint', 'Clique sur un texte, une image, un bouton ou un bloc du site pour le modifier. Les textes s’écrivent directement sur la page. Pour une page ou une fenêtre (fiche événement, menu…), utilise « Aller à… » en haut.'));
      const keys = h('p', 'ez-keys'); keys.textContent = 'Échap : désélectionner · Ctrl+Z : annuler · Ctrl+S : enregistrer';
      body.append(keys);
      body.append(details('chg', 'Modifications (' + nChanges() + ')', d => d.append(changesBox())));
      body.append(details('ver', 'Versions précédentes', d => d.append(versionsBox())));
      const s2 = h('div', 'ez-foot');
      s2.append(btn(resetArm ? 'Confirmer : tout remettre à l’origine' : 'Tout remettre à l’origine', 'sm ' + (resetArm ? 'danger' : 'ghost'), () => {
        if (!resetArm) { resetArm = true; render(); setTimeout(() => { if (resetArm) { resetArm = false; render(); } }, 4000); return; }
        resetArm = false; snap(true); restore({ styles: {}, texts: {}, order: {} }); say('Tout est revenu à l’origine. Enregistrer pour le mettre en ligne, ou ↶ pour annuler.');
      }));
      body.append(s2);
      body.scrollTop = keep; return;
    }

    const cs = getComputedStyle(sel), so = oneSel(sel), par = sel.parentElement;
    // identité + fil d'Ariane
    const idt = h('div', 'ez-id'); idt.append(h('b', '', kind(sel)), h('span', '', snippet(sel)));
    body.append(idt);
    const crumbs = h('div', 'ez-crumbs'), chain = []; let p = par;
    while (p && p !== b && chain.length < 4) { if (p.tagName !== 'MAIN' && !p.classList.contains('view')) chain.unshift(p); p = p.parentElement; }
    chain.forEach(a => { crumbs.append(btn(kind(a), 'crumb', () => pick(a), 'Sélectionner ce bloc parent')); crumbs.append(h('span', 'sep', '›')); });
    crumbs.append(h('span', 'crumb cur', kind(sel)));
    if (sel.firstElementChild) crumbs.append(btn('↓ intérieur', 'crumb', () => pick(sel.firstElementChild), 'Sélectionner le premier élément à l’intérieur'));
    body.append(crumbs);
    // toutes les images à l'endroit cliqué (même cachées sous un texte ou un dégradé) et dans le bloc
    const inner = isImg(sel) ? [] : [...sel.querySelectorAll('*')].filter(n => n.getBoundingClientRect().width > 8 && isImg(n)).slice(0, 8);
    const imgs = [...new Set([...under, ...inner])].filter(n => n !== sel && D.contains(n)).slice(0, 10);
    if (imgs.length) {
      const box = h('div', 'ez-imgs'); box.append(h('span', 'ez-lab', isImg(sel) ? 'Autres images ici' : 'Images ici — clique pour recadrer'));
      const row2 = h('div', 'ez-thumbs');
      imgs.forEach(n => {
        const t = btn('', 'ez-thumb', () => { pick(n); pref.open.img = 1; render(); }, 'Sélectionner cette image');
        const u = n.tagName === 'IMG' ? (n.currentSrc || n.src) : bgUrl(n);
        if (u) t.style.backgroundImage = `url("${u.replace(/["\\]/g, '')}")`;
        t.append(h('span', '', kind(n))); row2.append(t);
      });
      box.append(row2); body.append(box);
    }
    // portée
    const opts = [];
    if (imgSel(sel)) opts.push(['img', 'Cette photo, partout']);
    if (so) opts.push(['one', 'Cet élément']);
    if (allSel(sel)) opts.push(['all', 'Tous les semblables (' + qa(allSel(sel)).length + ')']);
    if (!opts.some(o => o[0] === scope)) scope = (opts[0] || ['one'])[0];
    if (opts.length > 1) { const sg = h('div', 'ez-chips scope'); sg.append(h('span', 'ez-lab', 'Appliquer à')); opts.forEach(([v, t]) => sg.append(btn(t, 'sm' + (scope === v ? ' on' : ''), () => { scope = v; render(); }))); body.append(sg); }
    // actions rapides
    const acts = h('div', 'ez-chips acts'), hid = !!sv('hidden');
    acts.append(btn(hid ? 'Réafficher' : 'Masquer', 'sm', () => { setStyle('hidden', hid ? undefined : true); render(); }));
    if (so && par && parentSel(par) && [...par.children].filter(c => at(c, 'data-e')).length > 1) acts.append(btn('↑ Monter', 'sm', () => move(-1)), btn('↓ Descendre', 'sm', () => move(1)));
    acts.append(btn('Copier le style', 'sm', () => { const s = curSel(); clipboard = clone(P.styles[s] || {}); say('Style copié : sélectionne un autre élément puis « Coller le style ».', 'ok'); render(); }));
    if (clipboard) acts.append(btn('Coller le style', 'sm', () => { const s = curSel(); snap(true); const c = clone(clipboard); if (Object.keys(c).length) P.styles[s] = c; else delete P.styles[s]; changed(); render(); }));
    acts.append(btn('Tout remettre', 'sm ghost', () => { const s = curSel(); snap(true); delete P.styles[s]; if (so) delete P.texts[so]; applyAll(); changed(); render(); }, 'Remettre cet élément à l’origine'));
    body.append(acts);

    if (textOk(sel)) body.append(details('txt', 'Texte', d => {
      const ta = h('textarea', 'ez-text'); ta.value = P.texts[so] !== undefined ? P.texts[so] : sel.textContent; ta.rows = 3; ta.setAttribute('aria-label', 'Texte');
      ta.addEventListener('input', () => { snap(); P.texts[so] = ta.value; if (!('__o' in sel)) sel.__o = sel.textContent; sel.textContent = ta.value; changed(); });
      d.append(ta, h('p', 'ez-hint sm', 'Tu peux aussi écrire directement sur le site. Entrée valide.'));
      if (P.texts[so] !== undefined) d.append(btn('Remettre le texte d’origine', 'sm ghost', () => { snap(true); delete P.texts[so]; if ('__o' in sel) sel.textContent = sel.__o; changed(); render(); }));
    }));
    if (isImg(sel)) body.append(details('img', 'Image et recadrage', d => {
      d.append(btn(cropOn ? 'Terminer le recadrage' : 'Recadrer à la souris', 'main sm wide', () => cropOn ? stopCrop() : startCrop()));
      d.append(chipsCtl('Format', 'ratio', [['1/1', 'Carré'], ['4/5', '4:5'], ['3/4', '3:4'], ['4/3', '4:3'], ['3/2', '3:2'], ['16/9', '16:9'], ['21/9', 'Panorama']], v => {
        const o = { ratio: v }; if (v && sel.tagName === 'IMG' && !sv('fit')) o.fit = 'cover'; setMany(o);
      }));
      d.append(chipsCtl('Remplissage', 'fit', [['cover', 'Remplir (recadré)'], ['contain', 'Image entière']]));
      d.append(numCtl('Zoom (%)', 'z', 100, 400, 100, 5, { get: () => sv('z') !== undefined ? Math.round(sv('z') * 100) : undefined, set: v => setZoom(v / 100), keys: ['z', 'cr', 'zb'] }));
      d.append(numCtl('Cadrage gauche ↔ droite (%)', 'x', 0, 100, 50), numCtl('Cadrage haut ↕ bas (%)', 'y', 0, 100, 50));
      d.append(btn('Réinitialiser le cadrage', 'sm ghost', () => { setMany({ x: undefined, y: undefined, z: undefined, cr: undefined, zb: undefined, fit: undefined, ratio: undefined }); render(); }));
      if (scope !== 'img' && imgSel(sel)) d.append(h('p', 'ez-hint sm', 'Pour recadrer cette photo précise partout où elle apparaît (accueil, agenda…), choisis « Cette photo, partout » en haut.'));
      if (sel.tagName === 'IMG' && /contain/.test(cs.objectFit) && !sv('fit')) d.append(h('p', 'ez-hint sm', 'Cette image est affichée en entier : choisis « Remplir » pour pouvoir la recadrer.'));
    }));
    body.append(details('typo', 'Texte : taille et police', d => {
      d.append(numCtl('Taille (px)', 'font', 8, 160, parseFloat(cs.fontSize)));
      const wr = h('div', 'ez-row'), ws = h('select', 'ez-select'); ws.setAttribute('aria-label', 'Graisse');
      [['', 'Origine'], ['300', 'Fine'], ['400', 'Normale'], ['500', 'Moyenne'], ['600', 'Demi-grasse'], ['700', 'Grasse'], ['800', 'Très grasse'], ['900', 'Noire']].forEach(([v, t]) => { const o = h('option', '', t); o.value = v; ws.append(o); });
      ws.value = sv('weight') !== undefined ? String(sv('weight')) : '';
      ws.addEventListener('change', () => { setStyle('weight', ws.value ? Number(ws.value) : undefined); wr.classList.toggle('set', !!ws.value); });
      const wv = h('div', 'val'); wv.append(ws); wr.append(h('label', '', 'Graisse'), wv); if (sv('weight') !== undefined) wr.classList.add('set'); d.append(wr);
      d.append(numCtl('Interligne', 'lh', 0.7, 2.6, (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)) || 1.3, 0.05));
      d.append(numCtl('Espacement des lettres (px)', 'ls', -5, 20, parseFloat(cs.letterSpacing) || 0, 0.5));
      d.append(chipsCtl('Alignement', 'align', [['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite']]));
      d.append(chipsCtl('Police', 'fam', [['archivo', 'Archivo'], ['sans', 'Instrument Sans'], ['serif', 'Instrument Serif']]));
      d.append(chipsCtl('Casse', 'tt', [['uppercase', 'MAJUSCULES'], ['none', 'Normale']]));
      if (bp !== 'm') d.append(h('p', 'ez-hint sm', 'Sur téléphone, tailles et espacements sont réduits d’environ 30 % automatiquement. Pour un réglage précis, passe en « Mobile seulement ».'));
    }));
    body.append(details('col', 'Couleurs', d => d.append(colCtl('Texte', 'color', 'color'), colCtl('Fond', 'bg', 'backgroundColor', true))));
    body.append(details('esp', 'Espacements', d => d.append(
      numCtl('Intérieur haut', 'pt', 0, 200, parseFloat(cs.paddingTop)), numCtl('Intérieur bas', 'pb', 0, 200, parseFloat(cs.paddingBottom)),
      numCtl('Intérieur gauche', 'pl', 0, 200, parseFloat(cs.paddingLeft)), numCtl('Intérieur droite', 'pr', 0, 200, parseFloat(cs.paddingRight)),
      numCtl('Marge au-dessus', 'mt', 0, 300, parseFloat(cs.marginTop)), numCtl('Marge en dessous', 'mb', 0, 300, parseFloat(cs.marginBottom)))));
    body.append(details('forme', 'Taille et forme', d => {
      const r = sel.getBoundingClientRect();
      d.append(numCtl('Largeur (px)', 'w', 20, 1800, r.width), numCtl('Hauteur (px)', 'h', 10, 1400, r.height), numCtl('Arrondi des coins (px)', 'radius', 0, 120, parseFloat(cs.borderTopLeftRadius) || 0));
      d.append(numCtl('Bordure (px)', 'bw', 0, 12, parseFloat(cs.borderTopWidth) || 0), colCtl('Couleur de bordure', 'bc', 'borderTopColor'));
    }));
    body.append(details('fx', 'Effets', d => {
      d.append(numCtl('Opacité (%)', 'op', 0, 100, Math.round(parseFloat(cs.opacity) * 100)));
      d.append(chipsCtl('Ombre', 'shadow', [['none', 'Aucune'], ['soft', 'Douce'], ['strong', 'Forte']]));
    }));
    body.scrollTop = keep;
  }

  function move(dir) {
    const par = sel.parentElement, ps = parentSel(par); if (!ps) return;
    if (!par.__k) par.__k = [...par.children];
    const kids = [...par.children].filter(c => at(c, 'data-e'));
    const i = kids.indexOf(sel), j = i + dir;
    if (j < 0 || j >= kids.length) { say('Déjà en ' + (dir < 0 ? 'première' : 'dernière') + ' position.'); return; }
    snap(true);
    if (dir < 0) par.insertBefore(sel, kids[j]); else par.insertBefore(sel, kids[j].nextSibling);
    P.order[ps] = [...par.children].filter(c => at(c, 'data-e')).map(oneSel);
    changed(); say(''); sel.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ── sélection et écriture directe sur le site ── */
  let hov = null, editingEl = null;
  const hl = h('div', 'ez-tag'); hl.hidden = true; b.append(hl);
  const inUI = t => !!(t && t.closest && (t.closest('.ez-panel') || t.closest('.ez-crop') || t.closest('.ez-gate')));
  function inlineOn(el) {
    if (!textOk(el)) return;
    if (!('__o' in el)) el.__o = el.textContent;
    try { el.contentEditable = 'plaintext-only'; } catch (_) {}
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    el.spellcheck = true; editingEl = el;
  }
  function inlineOff() { if (editingEl) { editingEl.removeAttribute('contenteditable'); editingEl = null; } }
  D.addEventListener('input', e => {
    if (!editingEl || e.target !== editingEl) return;
    e.stopPropagation();
    const so = oneSel(editingEl); snap(); P.texts[so] = editingEl.textContent;
    const ta = body.querySelector('.ez-text'); if (ta) ta.value = editingEl.textContent;
    changed();
  }, true);
  function pick(el, sc) {
    if (nav) setNav(false);
    if (cropOn) stopCrop();
    if (el.tagName !== 'IMG' && isImg(el)) loadRatio(el);
    if (sel) sel.classList.remove('ez-sel');
    inlineOff();
    sel = el; sel.classList.remove('ez-hov'); sel.classList.add('ez-sel'); hl.hidden = true;
    scope = sc || (oneSel(el) ? 'one' : imgSel(el) ? 'img' : 'all');
    if (panel.classList.contains('min')) { panel.classList.remove('min'); bMin.textContent = '▾'; }
    inlineOn(el); render();
  }
  function unpick(quiet) { if (cropOn) { stopCrop(); if (!quiet) return; } inlineOff(); if (sel) sel.classList.remove('ez-sel'); sel = null; under = []; render(); }
  D.addEventListener('mouseover', e => {
    if (hov) hov.classList.remove('ez-hov');
    if (nav) { hov = null; hl.hidden = true; return; }
    if (cropOn || inUI(e.target)) { hov = null; hl.hidden = true; return; }
    hov = e.target === b || e.target === D.documentElement || e.target.nodeType !== 1 ? null : e.target;
    if (!hov) { hl.hidden = true; return; }
    if (hov !== sel) hov.classList.add('ez-hov');
    const r = hov.getBoundingClientRect();
    hl.textContent = kind(hov) + ' · ' + Math.round(r.width) + ' × ' + Math.round(r.height);
    hl.hidden = false; hl.style.left = Math.max(4, r.left) + 'px'; hl.style.top = (r.top > 30 ? r.top - 26 : r.bottom + 4) + 'px';
  }, true);
  D.addEventListener('mouseout', e => { if (hov && !e.relatedTarget) { hov.classList.remove('ez-hov'); hov = null; hl.hidden = true; } }, true);
  function imagesAt(x, y) {
    const out = [];
    D.querySelectorAll('body *').forEach(n => {
      if (panel.contains(n) || n === hl || n === ov || ov.contains(n)) return;
      const r = n.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || x < r.left || x > r.right || y < r.top || y > r.bottom) return;
      if (isImg(n)) out.push(n);
    });
    return out.reverse();
  }
  D.addEventListener('click', e => {
    if (pass || inUI(e.target)) return;
    if (nav) {
      // en navigation, les liens vers les autres pages du site restent en mode édition
      const a = e.target.closest && e.target.closest('a[href]');
      if (a && a.origin === location.origin && /\.html$/.test(a.pathname) && !/admin|stats/.test(a.pathname)) { e.preventDefault(); leave(a.pathname + '?edit=1'); }
      return;
    }
    e.preventDefault(); e.stopPropagation();
    if (editingEl && editingEl.contains(e.target)) return; // on écrit dans le texte : on laisse le curseur
    const t = e.target.nodeType === 1 ? e.target : e.target.parentElement;
    if (!t || t === b || t === D.documentElement) return;
    under = imagesAt(e.clientX, e.clientY).filter(n => n !== t);
    // clic sur un bloc qui n'est en fait qu'une photo (bulle de logo, vignette…) : on prend directement la photo
    let target = t;
    if (!isImg(t) && under.length) {
      const tr = t.getBoundingClientRect(), ir = under[0].getBoundingClientRect(), ta = tr.width * tr.height, ia = ir.width * ir.height;
      if (ta > 0 && ia > 0 && ia / ta > 0.7 && ta / ia > 0.7) { target = under[0]; under = under.slice(1); }
    }
    pick(target);
  }, true);
  // les autres interactions du site (carrousels, formulaires…) sont neutralisées pendant l'édition
  ['pointerdown', 'mousedown', 'touchstart', 'submit', 'auxclick', 'dblclick', 'change'].forEach(ev => D.addEventListener(ev, e => {
    if (nav || pass || inUI(e.target)) return;
    if (ev === 'submit' || ev === 'auxclick' || ev === 'dblclick') e.preventDefault();
    e.stopPropagation();
  }, true));
  D.addEventListener('keydown', e => {
    const k = (e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey, typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName);
    if (mod && k === 's') { e.preventDefault(); save(); return; }
    if (nav || pass) return;
    if (mod && k === 'z' && !typing && e.target !== editingEl) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 'y' && !typing && e.target !== editingEl) { e.preventDefault(); redo(); return; }
    if (k === 'escape') { e.preventDefault(); if (editingEl && D.activeElement === editingEl) editingEl.blur(); unpick(); return; }
    if (e.target === editingEl) { if (k === 'enter' && !e.shiftKey) { e.preventDefault(); editingEl.blur(); } e.stopPropagation(); return; }
    if (!inUI(e.target) && !typing) e.stopPropagation();
  }, true);
  window.addEventListener('beforeunload', e => { if (dirty && !leaving) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('hashchange', () => { if (cropOn) stopCrop(); inlineOff(); if (sel) sel.classList.remove('ez-sel'); sel = null; under = []; setTimeout(render, 250); });
  window.addEventListener('resize', () => { if (cropOn) placeCrop(); });

  /* ── démarrage ── */
  function checkDraft() {
    const dr = store.get(DRAFT, null);
    let carry = false; try { carry = sessionStorage.getItem('lasave_edit_carry') === '1'; sessionStorage.removeItem('lasave_edit_carry'); } catch (_) {}
    if (carry && dr && dr.P) { snap(true); P = ES.norm(dr.P); dirty = true; ES.update(P, true); applyAll(); share(); return; }
    if (dr && dr.P && JSON.stringify(ES.norm(dr.P)) !== JSON.stringify(ES.norm(P))) pendingDraft = dr;
  }
  window.__EDITOR = {
    reload(n) { loaded = true; if (!dirty) { P = clone(n); ES.update(P, true); applyAll(); } checkDraft(); render(); },
    fail() { loaded = 'error'; checkDraft(); render(); },
  };
  if (loaded === true) checkDraft();
  freeze(true);
  ES.update(P, true); render(); say('Animations figées pendant l’édition (elles reprennent en mode « Naviguer »).');
})();
