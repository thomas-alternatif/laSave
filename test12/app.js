/* laSave — test12 : à la une, rendez-vous, rubriques, organisateurs */
(() => {
  'use strict';
  const API = 'https://lasave-api.partage.workers.dev';
  const $ = s => document.querySelector(s);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Un seul interrupteur pour toutes les animations (pied de page), mémorisé comme sur le site actuel
  const motion = { still: reduce || (() => { try { return localStorage.getItem('lasave_motion') === 'off'; } catch (_) { return false; } })(), subs: [] };
  const onMotion = fn => { motion.subs.push(fn); fn(motion.still); };

  /* ── Catégories regroupées en « envies » ── */
  const ENVIES = [
    { id: 'concerts', label: 'Concerts', cats: ['Concert', 'Festival'], img: '/images/cat-concert.webp', color: '#FFA823' },
    { id: 'guinguettes', label: 'Guinguettes', cats: ['Guinguette'], img: '/images/cat-guinguette.webp', color: '#FFA823' },
    { id: 'spectacles', label: 'Spectacles', cats: ['Spectacle'], img: '/images/cat-festival.webp', color: '#FFA823' },
    { id: 'fetes', label: 'Fêtes', cats: ['Fête & Célébration'], img: '/images/cat-fete.webp', color: '#E4572E' },
    { id: 'marches', label: 'Marchés', cats: ['Marché'], img: '/images/cat-marche.webp', color: '#5C96AB' },
    { id: 'sport', label: 'Sport & loisirs', cats: ['Sport / Loisir'], img: '/images/cat-sport.webp', color: '#5C96AB' },
    { id: 'ateliers', label: 'Ateliers', cats: ['Conférence / Atelier'], img: null, color: '#B923FF' },
    { id: 'expos', label: 'Expositions', cats: ['Exposition'], img: null, color: '#B923FF' },
  ];
  const envieOf = e => ENVIES.find(v => v.cats.includes(e['Catégorie'])) || { id: 'autre', label: e['Catégorie'] || 'Autre', color: '#9C988F', img: null };

  /* ── Outils ── */
  const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = () => day0(new Date());
  const isRec = e => e['Récurrence'] && e['Récurrence'] !== 'Aucune';
  const isActive = e => isRec(e) || (e['Date de fin'] ? new Date(e['Date de fin']) >= today() : (e.Date ? new Date(e.Date) >= today() : true));
  const photoOf = e => {
    const a = e.Photo && e.Photo[0];
    if (a) return (a.thumbnails && a.thumbnails.large) ? a.thumbnails.large.url : a.url;
    return envieOf(e).img;
  };
  const hour = e => e.Heure ? String(e.Heure).replace(':', 'h') : '';
  const whenOf = e => {
    if (!e.Date) return isRec(e) ? (e['Période'] || e['Récurrence'] || '') : '';
    let s = new Date(e.Date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
    if (e.Heure) s += ' · ' + hour(e);
    return s;
  };
  const sortKey = e => e.Date ? Math.max(new Date(e.Date).getTime(), Date.now()) : 9e15;
  const onDay = (e, d) => {
    if (!e.Date) return false;
    const a = day0(new Date(e.Date)), b = e['Date de fin'] ? day0(new Date(e['Date de fin'])) : a;
    return d >= a && d <= b;
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const img = (src, alt = '') => { const i = new Image(); i.src = src; i.alt = alt; i.loading = 'lazy'; i.decoding = 'async'; return i; };
  const bg = (node, src) => { node.style.backgroundImage = src ? `url("${String(src).replace(/["\\\n]/g, '')}")` : ''; };
  async function api(path, opt = {}) {
    const r = await fetch(API + path, { ...opt, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }

  /* ── J'y vais (cœur) : même mémoire que le site actuel ── */
  const liked = () => { try { return JSON.parse(localStorage.getItem('jyvais') || '[]'); } catch (_) { return []; } };
  const isLiked = id => liked().includes(id);
  const heartBtns = new Set();
  function syncHearts(e) {
    heartBtns.forEach(b => {
      if (b.dataset.id !== e.id) return;
      b.setAttribute('aria-pressed', String(isLiked(e.id)));
      const n = b.querySelector('.heart-n'); if (n) n.textContent = e.Likes || 0;
      b.setAttribute('aria-label', `J'y vais (${e.Likes || 0})`);
    });
  }
  async function toggleLike(e) {
    const on = !isLiked(e.id);
    let arr = liked().filter(x => x !== e.id); if (on) arr.push(e.id);
    try { localStorage.setItem('jyvais', JSON.stringify(arr)); } catch (_) {}
    e.Likes = Math.max(0, (e.Likes || 0) + (on ? 1 : -1));
    syncHearts(e);
    try { const d = await api(`/events/${e.id}/like`, { method: 'POST', body: JSON.stringify({ delta: on ? 1 : -1 }) }); if (typeof d.Likes === 'number') { e.Likes = d.Likes; syncHearts(e); } } catch (_) {}
  }
  function heart(e, big) {
    const b = el('button', 'heart' + (big ? ' big' : ''));
    b.type = 'button'; b.dataset.id = e.id;
    b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg><span class="heart-n"></span>';
    b.addEventListener('click', ev => { ev.stopPropagation(); toggleLike(e); });
    heartBtns.add(b); syncHearts(e);
    return b;
  }
  function bindHeart(btn, e) { // bouton déjà présent dans la page
    const nb = btn.cloneNode(true); btn.replaceWith(nb);
    nb.dataset.id = e.id; heartBtns.add(nb);
    nb.addEventListener('click', () => toggleLike(e));
    syncHearts(e);
    return nb;
  }

  /* ── Fiche ── */
  const sheet = $('#sheet');
  let lastFocus = null;
  function openSheet(e) {
    lastFocus = document.activeElement;
    bg($('#sheet-img'), photoOf(e));
    $('#sheet-when').textContent = [whenOf(e), envieOf(e).label].filter(Boolean).join(' — ');
    $('#sheet-title').textContent = e.Titre || 'Événement';
    $('#sheet-where').textContent = [e.Lieu, e.Commune].filter(Boolean).join(', ') + (e.Tarif ? ' · ' + e.Tarif : '');
    $('#sheet-desc').textContent = e.Description || '';
    $('#sheet-link').href = '../#event-' + encodeURIComponent(e.id);
    bindHeart($('#sheet-heart'), e);
    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
    sheet.querySelector('.sheet-x').focus();
  }
  function closeSheet() { sheet.hidden = true; document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  sheet.addEventListener('click', ev => { if (ev.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown', ev => {
    if (sheet.hidden) return;
    if (ev.key === 'Escape') closeSheet();
    if (ev.key === 'Tab') {
      const f = [...sheet.querySelectorAll('button, a[href]')];
      if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
    }
  });

  /* ── En-tête qui se remplit au défilement ── */
  const top = $('#top');
  const onScroll = () => top.classList.toggle('solid', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ── 1. À la une ── */
  function buildHero(events) {
    let feats = events.filter(e => e['À la une'] && photoOf(e));
    if (feats.length < 4) feats = feats.concat(events.filter(e => !feats.includes(e) && photoOf(e))).slice(0, 6);
    if (!feats.length) { $('.hero-rail').hidden = true; return; }
    const cards = $('#hero-cards');
    let cur = 0, timer = null, paused = reduce, t0 = 0, raf = 0;
    const items = feats.map((e, i) => {
      const c = el('button', 'hcard'); c.type = 'button'; c.setAttribute('role', 'listitem');
      c.setAttribute('aria-label', `${e.Titre || 'Événement'}, ${whenOf(e)}`);
      const p = photoOf(e); if (p) c.appendChild(img(p));
      const t = el('span', 'hcard-t');
      t.appendChild(el('small', null, [whenOf(e), e.Commune].filter(Boolean).join(' · ')));
      t.appendChild(el('strong', null, e.Titre || 'Événement'));
      c.appendChild(t);
      c.addEventListener('click', () => { if (i === cur) openSheet(e); else { show(i); restart(); } });
      cards.appendChild(c);
      return c;
    });
    let heroHeart = $('#hero-heart');
    function show(i) {
      cur = (i + feats.length) % feats.length;
      const e = feats[cur], b = $('#hero-bg');
      b.classList.add('fade');
      setTimeout(() => { bg(b, photoOf(e)); b.classList.remove('fade'); }, reduce ? 0 : 250);
      $('#hero-when').textContent = [whenOf(e), e.Commune].filter(Boolean).join(' · ');
      $('#hero-title').textContent = e.Titre || 'Événement';
      $('#hero-desc').textContent = e.Description || '';
      $('#hero-num').textContent = String(cur + 1).padStart(2, '0');
      heroHeart = bindHeart(heroHeart, e);
      items.forEach((c, k) => c.classList.toggle('on', k === cur));
      const c = items[cur];
      cards.scrollTo({ left: c.offsetLeft - cards.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
    }
    function progress(ts) {
      if (!t0) t0 = ts;
      const k = Math.min(1, (ts - t0) / 7000);
      $('#hero-progress').style.width = (k * 100).toFixed(1) + '%';
      if (k >= 1) { t0 = 0; show(cur + 1); }
      raf = requestAnimationFrame(progress);
    }
    function restart() { cancelAnimationFrame(raf); t0 = 0; $('#hero-progress').style.width = '0%'; if (!paused) raf = requestAnimationFrame(progress); }
    $('#hero-open').addEventListener('click', () => openSheet(feats[cur]));
    $('#hero-prev').addEventListener('click', () => { show(cur - 1); restart(); });
    $('#hero-next').addEventListener('click', () => { show(cur + 1); restart(); });
    const setPause = p => { paused = p; restart(); };
    onMotion(p => setPause(p));
    const hero = $('.hero');
    hero.addEventListener('mouseenter', () => { if (!paused) cancelAnimationFrame(raf); });
    hero.addEventListener('mouseleave', () => restart());
    hero.addEventListener('focusin', () => { if (!paused) { cancelAnimationFrame(raf); } });
    hero.addEventListener('focusout', ev => { if (!hero.contains(ev.relatedTarget)) restart(); });
    show(0);
  }

  /* ── 2. Les rendez-vous des prochains jours (carrousel) ── */
  function buildFlow(events) {
    const stage = $('#flow-stage');
    const limit = new Date(today()); limit.setDate(limit.getDate() + 30);
    const list = events.filter(e => e.Date && new Date(e.Date) <= limit && !['Conférence / Atelier', 'Sport / Loisir'].includes(e['Catégorie'])).slice(0, 16);
    if (!list.length) { stage.appendChild(el('p', 'row-kicker', 'Aucun événement daté à venir pour le moment.')); return; }
    let cur = Math.min(2, list.length - 1);
    const cards = list.map((e, i) => {
      const c = el('div', 'fcard');
      c.setAttribute('role', 'button'); c.tabIndex = -1;
      c.setAttribute('aria-label', `${e.Titre || 'Événement'}, ${whenOf(e)}`);
      const inner = el('div', 'fcard-in');
      const p = photoOf(e); if (p) inner.appendChild(img(p));
      inner.appendChild(heart(e));
      const cap = el('div', 'fcard-cap');
      cap.appendChild(el('small', null, [whenOf(e), e.Commune].filter(Boolean).join(' · ')));
      cap.appendChild(el('strong', null, e.Titre || 'Événement'));
      inner.appendChild(cap);
      c.appendChild(inner);
      // Reflet de la photo au sol (comme l'image d'inspiration)
      const ref = el('div', 'fcard-ref'); ref.setAttribute('aria-hidden', 'true'); bg(ref, p); c.appendChild(ref);
      c.addEventListener('click', () => { if (i === cur) openSheet(e); else go(i); });
      c.addEventListener('keydown', ev => { if (ev.target === c && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openSheet(e); } });
      stage.appendChild(c);
      return c;
    });
    function render() {
      const W = stage.clientWidth, cw = cards[0].offsetWidth;
      const gap = Math.min(cw * 1.02, W / 4.2);
      cards.forEach((c, i) => {
        const o = i - cur, a = Math.abs(o);
        c.style.transform = `translateX(${(o * gap).toFixed(1)}px) translateZ(${(-a * 110).toFixed(0)}px) rotateY(${(Math.max(-1, Math.min(1, o)) * -38).toFixed(1)}deg) scale(${a ? 0.9 : 1})`;
        c.style.zIndex = String(100 - a);
        c.style.opacity = a > 2 ? '0' : (a === 2 ? '.55' : '1');
        c.style.filter = a ? 'brightness(.62)' : 'none';
        c.style.pointerEvents = a > 2 ? 'none' : 'auto';
        c.tabIndex = a === 0 ? 0 : -1;
        c.setAttribute('aria-hidden', a > 2 ? 'true' : 'false');
      });
      $('#flow-count').textContent = `${cur + 1} / ${cards.length}`;
    }
    function go(i) { cur = Math.max(0, Math.min(cards.length - 1, i)); render(); }
    $('#flow-prev').addEventListener('click', () => go(cur - 1));
    $('#flow-next').addEventListener('click', () => go(cur + 1));
    stage.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(cur - 1); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); go(cur + 1); }
    });
    let sx = null;
    stage.addEventListener('pointerdown', ev => { sx = ev.clientX; });
    stage.addEventListener('pointerup', ev => { if (sx == null) return; const d = ev.clientX - sx; sx = null; if (Math.abs(d) > 40) go(cur + (d < 0 ? 1 : -1)); });
    window.addEventListener('resize', render);
    render();
    // Défilement automatique (pause au survol, au clavier et avec le bouton)
    let paused = reduce, hold = false, timer = null;
    const tick = () => { clearTimeout(timer); if (paused || hold || cards.length < 2) return; timer = setTimeout(() => { go(cur + 1 >= cards.length ? 0 : cur + 1); tick(); }, 4500); };
    const setPause = p => { paused = p; tick(); };
    const sec = stage.closest('section');
    sec.addEventListener('mouseenter', () => { hold = true; tick(); });
    sec.addEventListener('mouseleave', () => { hold = false; tick(); });
    sec.addEventListener('focusin', () => { hold = true; tick(); });
    sec.addEventListener('focusout', ev => { if (!sec.contains(ev.relatedTarget)) { hold = false; tick(); } });
    onMotion(p => setPause(p));
    stage.addEventListener('touchstart', () => { hold = true; tick(); setTimeout(() => { hold = false; tick(); }, 8000); }, { passive: true });
  }

  /* ── 3. Les rubriques (comme le site actuel) ── */
  const RUBRIQUES = [
    { tab: 'Soirées', title: "Envie d'une belle soirée ?", kicker: 'Concerts, spectacles & festivals', cats: ['Concert', 'Spectacle', 'Festival'], color: '#FFA823' },
    { tab: 'Ateliers', title: 'Et si vous vous lanciez ?', kicker: 'Ateliers & conférences', cats: ['Conférence / Atelier'], color: '#C955E0' },
    { tab: 'Sport & loisirs', title: 'Transformez vos envies en énergie', kicker: 'Sport & loisirs', cats: ['Sport / Loisir'], color: '#5C96AB' },
    { tab: 'Sorties', title: 'À découvrir dans la vallée', kicker: 'Marchés, fêtes, guinguettes & expositions', cats: ['Guinguette', 'Marché', 'Fête & Célébration', 'Exposition', 'Autre'], color: '#C8A96E' },
  ];
  function poster(e) {
    const b = el('div', 'poster'); b.setAttribute('role', 'button'); b.tabIndex = 0;
    b.setAttribute('aria-label', `${e.Titre || 'Événement'}, ${whenOf(e)}, ${e.Commune || ''}`);
    const pi = el('div', 'poster-img'); const p = photoOf(e); if (p) pi.appendChild(img(p)); pi.appendChild(heart(e));
    b.appendChild(pi);
    b.appendChild(el('span', 'poster-date', whenOf(e)));
    b.appendChild(el('span', 'poster-t', e.Titre || 'Événement'));
    const c = el('span', 'poster-c'); const dot = el('i'); dot.style.background = envieOf(e).color; c.appendChild(dot); c.appendChild(document.createTextNode(e.Commune || envieOf(e).label));
    b.appendChild(c);
    b.addEventListener('click', () => openSheet(e));
    b.addEventListener('keydown', ev => { if (ev.target === b && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openSheet(e); } });
    return b;
  }
  function buildRows(events) {
    const box = $('#rows');
    const known = RUBRIQUES.flatMap(r => r.cats);
    const secs = RUBRIQUES.map(r => ({ ...r, evs: events.filter(e => r.cats.includes(e['Catégorie']) || (r.cats.includes('Autre') && !known.includes(e['Catégorie']))) }));
    secs.forEach((r, k) => {
      if (!r.evs.length) return;
      const sec = el('section', 'row-sec'); sec.setAttribute('aria-labelledby', 'rub-' + k);
      sec.style.setProperty('--c', r.color);
      const head = el('div', 'row-block');
      const t = el('div', 'row-block-text'); t.appendChild(el('p', 'row-kicker', r.kicker));
      const h = el('h2', 'row-title', r.title); h.id = 'rub-' + k; t.appendChild(h); head.appendChild(t);
      const side = el('div', 'row-side');
      const all = el('button', 'see-all', `Voir tout (${r.evs.length})`); all.type = 'button'; all.setAttribute('aria-expanded', 'false');
      side.appendChild(all);
      const nav = el('div', 'row-nav');
      const mk = (lbl, d, dir) => { const b = el('button', 'circle sm'); b.type = 'button'; b.setAttribute('aria-label', lbl); b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="${d}"/></svg>`; b.addEventListener('click', () => track.scrollBy({ left: dir * track.clientWidth * .8, behavior: reduce ? 'auto' : 'smooth' })); return b; };
      nav.appendChild(mk(`Précédent : ${r.title}`, 'm15 5-7 7 7 7', -1)); nav.appendChild(mk(`Suivant : ${r.title}`, 'm9 5 7 7-7 7', 1));
      side.appendChild(nav); head.appendChild(side);
      const track = el('div', 'track'); r.evs.forEach(e => track.appendChild(poster(e)));
      all.addEventListener('click', () => { const o = sec.classList.toggle('open'); all.setAttribute('aria-expanded', String(o)); all.textContent = o ? 'Réduire' : `Voir tout (${r.evs.length})`; });
      sec.appendChild(head); sec.appendChild(track); box.appendChild(sec);
    });
  }

  /* ── 4. Organisateurs ── */
  function buildOrgs(orgas, events) {
    const row = $('#orgs-row'), sec = $('#organisateurs');
    let list = orgas.filter(o => o.Nom).slice(0, 30);
    if (!list.length) { sec.hidden = true; return; }
    while (list.length < 14) list = list.concat(list.map(o => ({ ...o, _dup: true })));
    // Emplacements : une bulle seule, ou deux petites bulles empilées (comme sur l'image d'inspiration)
    const slots = []; let k = 0;
    const bubble = (o, idx) => {
      const tint = ['orange', 'or', 'bleu', 'violet'][idx % 4];
      const b = el('button', `org${o.Photo ? '' : ' ' + tint}`); b.type = 'button';
      if (o._dup) { b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); } else b.setAttribute('aria-label', o.Nom);
      const ph = o.Photo && o.Photo[0] && ((o.Photo[0].thumbnails && o.Photo[0].thumbnails.large) ? o.Photo[0].thumbnails.large.url : o.Photo[0].url);
      if (ph) b.appendChild(img(ph));
      else b.appendChild(el('span', 'org-ini', (o.Nom.split(/[\s'’-]+/).filter(w => w.length > 2).map(w => w[0]).join('').slice(0, 2) || o.Nom.slice(0, 2)).toUpperCase()));
      b.appendChild(el('span', 'org-name', o.Nom));
      b.addEventListener('click', () => { const mine = events.filter(e => isActive(e) && (e.Organisation || '').toLowerCase().includes(o.Nom.toLowerCase())).sort((x, y) => sortKey(x) - sortKey(y)); if (mine.length) openSheet(mine[0]); });
      row.appendChild(b); return b;
    };
    while (k < list.length) {
      if (slots.length % 3 === 1 && k + 1 < list.length) { slots.push([bubble(list[k], k), bubble(list[k + 1], k + 1)]); k += 2; }
      else { slots.push([bubble(list[k], k)]); k++; }
    }
    const N = slots.length;
    // Taille selon la distance au centre : grande au milieu, petite sur les côtés
    const erf = x => { const t = 1 / (1 + .3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x < 0 ? -y : y; };
    let off = 0, last = 0, hold = false, paused = motion.still;
    function layout() {
      const W = row.clientWidth, H = row.clientHeight, mob = W < 720;
      const Smax = mob ? 176 : 258, Smin = mob ? 58 : 84, sig = mob ? 1.35 : 1.9, gap = mob ? 8 : 12;
      const X = u => (Smin + gap) * u + (Smax - Smin) * sig * Math.sqrt(Math.PI) / 2 * erf(u / sig);
      slots.forEach((sl, i) => {
        let u = ((i - off) % N + N) % N; if (u > N / 2) u -= N;
        const s = Smin + (Smax - Smin) * Math.exp(-((u / sig) ** 2));
        const x = W / 2 + X(u);
        if (sl.length === 1) {
          const b = sl[0]; b.style.setProperty('--sz', s.toFixed(1) + 'px');
          b.style.transform = `translate(${(x - s / 2).toFixed(1)}px, ${((H - s) / 2).toFixed(1)}px)`;
        } else {
          const t = s * .48;
          sl.forEach((b, j) => { b.style.setProperty('--sz', t.toFixed(1) + 'px'); b.style.transform = `translate(${(x - t / 2).toFixed(1)}px, ${(H / 2 + (j ? s * .02 : -s * .02 - t)).toFixed(1)}px)`; });
        }
      });
    }
    function frame(ts) {
      const dt = last ? Math.min(50, ts - last) : 16; last = ts;
      if (!paused && !hold) off += dt * 0.00032;
      layout();
      requestAnimationFrame(frame);
    }
    row.addEventListener('mouseenter', () => hold = true);
    row.addEventListener('mouseleave', () => hold = false);
    row.addEventListener('focusin', ev => { hold = true; const i = slots.findIndex(sl => sl.includes(ev.target)); if (i >= 0) off = i; });
    row.addEventListener('focusout', () => hold = false);
    onMotion(p => { paused = p; });
    requestAnimationFrame(frame);
  }

  /* ── Interrupteur des animations (pied de page) ── */
  function bindMotion() {
    const b = $('#motion');
    const paint = () => { b.textContent = motion.still ? 'Animations : désactivées' : 'Animations : activées'; b.setAttribute('aria-pressed', String(motion.still)); };
    b.addEventListener('click', () => {
      motion.still = !motion.still;
      try { localStorage.setItem('lasave_motion', motion.still ? 'off' : 'on'); } catch (_) {}
      motion.subs.forEach(fn => fn(motion.still)); paint();
    });
    paint();
  }

  /* ── Démarrage ── */
  (async () => {
    let events = [], orgas = [];
    try { events = await api('/events'); } catch (e) { console.warn('events', e); }
    try { orgas = await api('/orgas'); } catch (e) { console.warn('orgas', e); }
    const up = events.filter(isActive).sort((a, b) => sortKey(a) - sortKey(b));
    buildHero(up);
    buildFlow(up);
    buildRows(up);
    buildOrgs(orgas, events);
    bindMotion();
  })();
})();
