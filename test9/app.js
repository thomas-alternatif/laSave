/* laSave — test9 : à la une, rendez-vous, rubriques, organisateurs */
(() => {
  'use strict';
  const API = 'https://lasave-api.partage.workers.dev';
  const $ = s => document.querySelector(s);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    const pb = $('#hero-pause');
    const setPause = p => { paused = p; pb.setAttribute('aria-pressed', String(p)); pb.setAttribute('aria-label', p ? 'Relancer le diaporama' : 'Mettre en pause le diaporama'); restart(); };
    pb.addEventListener('click', () => setPause(!paused));
    const hero = $('.hero');
    hero.addEventListener('focusin', () => { if (!paused) { cancelAnimationFrame(raf); } });
    hero.addEventListener('focusout', ev => { if (!hero.contains(ev.relatedTarget)) restart(); });
    setPause(paused);
    show(0);
  }

  /* ── 2. Les rendez-vous des prochains jours (carrousel) ── */
  function buildFlow(events) {
    const stage = $('#flow-stage');
    const list = events.filter(e => e.Date).slice(0, 12);
    if (!list.length) { stage.appendChild(el('p', 'row-kicker', 'Aucun événement daté à venir pour le moment.')); return; }
    let cur = Math.min(2, list.length - 1);
    const cards = list.map((e, i) => {
      const c = el('div', 'fcard');
      c.setAttribute('role', 'button'); c.tabIndex = -1;
      c.setAttribute('aria-label', `${e.Titre || 'Événement'}, ${whenOf(e)}`);
      const p = photoOf(e); if (p) c.appendChild(img(p));
      c.appendChild(heart(e));
      const cap = el('div', 'fcard-cap');
      cap.appendChild(el('small', null, [whenOf(e), e.Commune].filter(Boolean).join(' · ')));
      cap.appendChild(el('strong', null, e.Titre || 'Événement'));
      c.appendChild(cap);
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
  }

  /* ── 3. Les rubriques (comme le site actuel) ── */
  const RUBRIQUES = [
    { title: "Envie d'une belle soirée ?", kicker: 'Concerts, spectacles & festivals', cats: ['Concert', 'Spectacle', 'Festival'] },
    { title: 'Et si vous vous lanciez ?', kicker: 'Ateliers & conférences', cats: ['Conférence / Atelier'] },
    { title: 'Transformez vos envies en énergie', kicker: 'Sport & loisirs', cats: ['Sport / Loisir'] },
    { title: 'À découvrir dans la vallée', kicker: 'Marchés, fêtes, guinguettes & expositions', cats: ['Guinguette', 'Marché', 'Fête & Célébration', 'Exposition', 'Autre'] },
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
    const used = new Set();
    const known = RUBRIQUES.flatMap(r => r.cats);
    const secs = RUBRIQUES.map(r => ({ ...r, evs: events.filter(e => r.cats.includes(e['Catégorie']) || (r.cats.includes('Autre') && !known.includes(e['Catégorie']))) }));
    secs.forEach((r, k) => {
      if (!r.evs.length) return;
      const sec = el('section', 'row-sec'); sec.setAttribute('aria-labelledby', 'rub-' + k);
      const head = el('div', 'row-head');
      const t = el('div'); t.appendChild(el('p', 'row-kicker', r.kicker));
      const h = el('h2', 'row-title', r.title); h.id = 'rub-' + k; t.appendChild(h); head.appendChild(t);
      const side = el('div', 'row-side');
      const all = el('button', 'see-all', `Voir tout (${r.evs.length})`); all.type = 'button'; all.setAttribute('aria-expanded', 'false');
      side.appendChild(all);
      const nav = el('div', 'row-nav');
      const mk = (lbl, d, dir) => { const b = el('button', 'circle sm'); b.type = 'button'; b.setAttribute('aria-label', lbl); b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="${d}"/></svg>`; b.addEventListener('click', () => track.scrollBy({ left: dir * track.clientWidth * .8, behavior: reduce ? 'auto' : 'smooth' })); return b; };
      nav.appendChild(mk(`Précédent : ${r.title}`, 'm15 5-7 7 7 7', -1)); nav.appendChild(mk(`Suivant : ${r.title}`, 'm9 5 7 7-7 7', 1));
      side.appendChild(nav); head.appendChild(side);
      const track = el('div', 'track'); r.evs.forEach(e => track.appendChild(poster(e)));
      all.addEventListener('click', () => { const o = sec.classList.toggle('open'); all.setAttribute('aria-expanded', String(o)); all.textContent = o ? 'Réduire' : `Voir tout (${r.evs.length})`; });
      sec.appendChild(head); sec.appendChild(track); box.appendChild(sec);
    });
  }

  /* ── 4. Organisateurs ── */
  function buildOrgs(orgas, events) {
    const row = $('#orgs-row');
    const list = orgas.filter(o => o.Nom).slice(0, 18);
    const count = n => events.filter(e => (e.Organisation || '').toLowerCase().includes(n.toLowerCase())).length;
    list.sort((a, b) => count(b.Nom) - count(a.Nom));
    const order = []; list.forEach((o, i) => (i % 2 ? order.push(o) : order.unshift(o)));
    const pattern = ['s2', 'm', 's2', 'l', 'm', 's2', 'm', 'l', 's2', 'm'];
    const circle = (o, size, k) => {
      const tint = ['orange', 'or', 'bleu', 'violet'][k % 4];
      const b = el('button', `org ${size}${o.Photo ? '' : ' ' + tint}`); b.type = 'button';
      b.style.setProperty('--dur', (5.5 + (k * 1.37) % 4).toFixed(2) + 's');
      b.style.setProperty('--delay', (-(k * 0.83) % 5).toFixed(2) + 's');
      b.style.setProperty('--dx', ((k % 2 ? 1 : -1) * (3 + k % 5)) + 'px');
      b.style.setProperty('--dy', (-(6 + (k * 3) % 9)) + 'px');
      b.style.setProperty('--s1', (1.04 + (k % 3) * 0.03).toFixed(2));
      b.style.setProperty('--s2', (0.95 - (k % 2) * 0.03).toFixed(2));
      b.setAttribute('aria-label', o.Nom);
      const ph = o.Photo && o.Photo[0] && ((o.Photo[0].thumbnails && o.Photo[0].thumbnails.large) ? o.Photo[0].thumbnails.large.url : o.Photo[0].url);
      if (ph) b.appendChild(img(ph));
      else b.appendChild(el('span', 'org-ini', (o.Nom.split(/[\s'’-]+/).filter(w => w.length > 2).map(w => w[0]).join('').slice(0, 2) || o.Nom.slice(0, 2)).toUpperCase()));
      b.appendChild(el('span', 'org-name', o.Nom));
      b.addEventListener('click', () => { const mine = events.filter(e => isActive(e) && (e.Organisation || '').toLowerCase().includes(o.Nom.toLowerCase())).sort((x, y) => sortKey(x) - sortKey(y)); if (mine.length) openSheet(mine[0]); });
      return b;
    };
    let i = 0, p = 0;
    while (i < order.length) {
      const kind = pattern[p++ % pattern.length];
      if (kind === 's2') { const col = el('div', 'org-col'); col.appendChild(circle(order[i], 's', i)); i++; if (i < order.length) { col.appendChild(circle(order[i], 's', i)); i++; } row.appendChild(col); }
      else { row.appendChild(circle(order[i], kind, i)); i++; }
    }
    if (!order.length) $('#organisateurs').hidden = true;
    const sec = $('#organisateurs'), pb = $('#orgs-pause');
    const setStill = p => { sec.classList.toggle('still', p); pb.setAttribute('aria-pressed', String(p)); pb.setAttribute('aria-label', p ? "Relancer l'animation des bulles" : "Arrêter l'animation des bulles"); };
    pb.addEventListener('click', () => setStill(!sec.classList.contains('still')));
    if (reduce) { setStill(true); pb.hidden = true; }
    requestAnimationFrame(() => { row.scrollLeft = (row.scrollWidth - row.clientWidth) / 2; });
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
  })();
})();
