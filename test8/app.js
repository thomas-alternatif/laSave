/* laSave — test8 : à la une, envies, agenda par jour, organisateurs */
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

  /* ── 2. Envies : panorama ── */
  let filterEnvie = null;
  function buildPano(events) {
    const row = $('#pano-row');
    const list = ENVIES.map(v => ({ v, evs: events.filter(e => v.cats.includes(e['Catégorie'])) })).filter(x => x.evs.length);
    const n = list.length, mid = (n - 1) / 2;
    const s = Math.max(0.62, Math.min(1.3, window.innerWidth / 1150)); // échelle selon l'écran
    list.forEach(({ v, evs }, i) => {
      const o = i - mid, a = Math.abs(o);
      const li = el('li', 'pano-item');
      li.style.setProperty('--ry', (-o * 12).toFixed(1) + 'deg');
      li.style.setProperty('--tz', (a * a * 8 * s).toFixed(0) + 'px');
      li.style.setProperty('--w', ((140 + a * 22) * s).toFixed(0) + 'px');
      li.style.setProperty('--h', ((250 + a * 44) * s).toFixed(0) + 'px');
      const b = el('button', 'pano-btn'); b.type = 'button';
      b.setAttribute('aria-label', `${v.label} : ${evs.length} événement${evs.length > 1 ? 's' : ''}`);
      b.appendChild(el('span', 'pano-cap', v.label));
      const box = el('span', 'pano-img');
      const withPhoto = evs.find(e => e.Photo && e.Photo[0]);
      const src = withPhoto ? photoOf(withPhoto) : (v.img || photoOf(evs[0]));
      if (src) box.appendChild(img(src));
      b.appendChild(box);
      b.appendChild(el('span', 'pano-n', `${evs.length} à venir`));
      b.addEventListener('click', () => { filterEnvie = v; renderAgenda(); document.getElementById('agenda').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); });
      li.appendChild(b); row.appendChild(li);
    });
    if (!n) $('#envies').hidden = true;
    const wrap = row.parentElement; requestAnimationFrame(() => { wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2; });
  }

  /* ── 3. Agenda ── */
  let all = [], selDay = null, selCommune = null, q = '';
  function buildAgenda(events) {
    all = events;
    const days = $('#days');
    const mk = (label, big, sub, d, count) => {
      const b = el('button', 'day' + (count === 0 ? ' empty' : ''));
      b.type = 'button'; b.setAttribute('role', 'tab');
      b.appendChild(el('span', null, label)); b.appendChild(el('b', null, big)); b.appendChild(el('small', null, sub));
      b.addEventListener('click', () => { selDay = d; renderAgenda(); });
      b._d = d; days.appendChild(b);
    };
    mk('Tout', String(events.length), 'à venir', null, events.length);
    for (let k = 0; k < 14; k++) {
      const d = new Date(today()); d.setDate(d.getDate() + k);
      const c = events.filter(e => onDay(e, d)).length;
      const wd = k === 0 ? 'Auj.' : k === 1 ? 'Dem.' : d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
      mk(wd.charAt(0).toUpperCase() + wd.slice(1), String(d.getDate()), c ? `${c} évén.` : '—', d, c);
    }
    const communes = [...new Set(events.map(e => e.Commune).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const box = $('#communes');
    [null, ...communes].forEach(c => {
      const b = el('button', 'chip', c || 'Toutes les communes'); b.type = 'button'; b._c = c;
      b.addEventListener('click', () => { selCommune = c; renderAgenda(); });
      box.appendChild(b);
    });
    $('#q').addEventListener('input', ev => { q = ev.target.value.trim().toLowerCase(); renderAgenda(); });
    $('#see-all').addEventListener('click', () => { selDay = null; selCommune = null; filterEnvie = null; q = ''; $('#q').value = ''; renderAgenda(); });
    renderAgenda();
  }
  function renderAgenda() {
    document.querySelectorAll('.day').forEach(b => b.setAttribute('aria-selected', String((b._d && selDay && +b._d === +selDay) || (!b._d && !selDay))));
    document.querySelectorAll('#communes .chip').forEach(b => b.setAttribute('aria-pressed', String(b._c === selCommune)));
    const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const list = all.filter(e =>
      (!selDay || onDay(e, selDay)) &&
      (!selCommune || e.Commune === selCommune) &&
      (!filterEnvie || filterEnvie.cats.includes(e['Catégorie'])) &&
      (!q || norm([e.Titre, e.Commune, e.Lieu, e.Organisation, e['Catégorie']].join(' ')).includes(norm(q))));
    const parts = [`${list.length} événement${list.length > 1 ? 's' : ''}`];
    if (selDay) parts.push(selDay.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
    if (selCommune) parts.push(selCommune);
    if (filterEnvie) parts.push(filterEnvie.label);
    $('#agenda-sum').textContent = parts.join(' · ');
    const box = $('#posters'); box.textContent = '';
    if (!list.length) { box.appendChild(el('p', 'empty-msg', 'Rien de prévu avec ces filtres. Essayez un autre jour ou une autre commune.')); return; }
    list.forEach(e => {
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
      box.appendChild(b);
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
      const b = el('button', `org ${size}${!o.Photo && k % 3 === 1 ? ' orange' : ''}`); b.type = 'button';
      b.setAttribute('aria-label', o.Nom);
      const ph = o.Photo && o.Photo[0] && ((o.Photo[0].thumbnails && o.Photo[0].thumbnails.large) ? o.Photo[0].thumbnails.large.url : o.Photo[0].url);
      if (ph) b.appendChild(img(ph));
      else b.appendChild(el('span', 'org-ini', (o.Nom.split(/[\s'’-]+/).filter(w => w.length > 2).map(w => w[0]).join('').slice(0, 2) || o.Nom.slice(0, 2)).toUpperCase()));
      b.appendChild(el('span', 'org-name', o.Nom));
      b.addEventListener('click', () => { q = o.Nom.toLowerCase(); $('#q').value = o.Nom; selDay = null; renderAgenda(); document.getElementById('agenda').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); });
      return b;
    };
    let i = 0, p = 0;
    while (i < order.length) {
      const kind = pattern[p++ % pattern.length];
      if (kind === 's2') { const col = el('div', 'org-col'); col.appendChild(circle(order[i], 's', i)); i++; if (i < order.length) { col.appendChild(circle(order[i], 's', i)); i++; } row.appendChild(col); }
      else { row.appendChild(circle(order[i], kind, i)); i++; }
    }
    if (!order.length) $('#organisateurs').hidden = true;
    requestAnimationFrame(() => { row.scrollLeft = (row.scrollWidth - row.clientWidth) / 2; });
  }

  /* ── Démarrage ── */
  (async () => {
    let events = [], orgas = [];
    try { events = await api('/events'); } catch (e) { console.warn('events', e); }
    try { orgas = await api('/orgas'); } catch (e) { console.warn('orgas', e); }
    const up = events.filter(isActive).sort((a, b) => sortKey(a) - sortKey(b));
    buildHero(up);
    buildPano(up);
    buildAgenda(up);
    buildOrgs(orgas, events);
  })();
})();
