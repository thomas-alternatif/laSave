/* laSave — test7 : arc de photos, carrousel 3D, cercles d'organisateurs */
(() => {
  'use strict';
  const API = 'https://lasave-api.partage.workers.dev';
  const FALLBACK = {
    'Concert': '/images/cat-concert.webp', 'Festival': '/images/cat-festival.webp', 'Spectacle': '/images/cat-concert.webp',
    'Guinguette': '/images/cat-guinguette.webp', 'Marché': '/images/cat-marche.webp', 'Sport / Loisir': '/images/cat-sport.webp',
    'Fête & Célébration': '/images/cat-fete.webp'
  };
  const $ = s => document.querySelector(s);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Données ── */
  const today = () => new Date(new Date().toDateString());
  const isRec = e => e['Récurrence'] && e['Récurrence'] !== 'Aucune';
  const isActive = e => isRec(e) || (e['Date de fin'] ? new Date(e['Date de fin']) >= today() : (e.Date ? new Date(e.Date) >= today() : true));
  const photoOf = e => {
    const a = e.Photo && e.Photo[0];
    if (a) return (a.thumbnails && a.thumbnails.large) ? a.thumbnails.large.url : a.url;
    return FALLBACK[e['Catégorie']] || null;
  };
  const whenOf = e => {
    if (!e.Date) return isRec(e) ? (e['Période'] || e['Récurrence'] || '') : '';
    const d = new Date(e.Date);
    let s = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
    if (e.Heure) s += ' · ' + String(e.Heure).replace(':', 'h');
    return s;
  };
  const sortKey = e => e.Date ? Math.max(new Date(e.Date).getTime(), Date.now()) : 9e15;
  async function get(path) {
    const r = await fetch(API + path, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const img = (src, alt = '') => { const i = new Image(); i.src = src; i.alt = alt; i.loading = 'lazy'; i.decoding = 'async'; return i; };

  /* ── Fiche ── */
  const sheet = $('#sheet');
  let lastFocus = null;
  function openSheet(e) {
    lastFocus = document.activeElement;
    const p = photoOf(e);
    $('#sheet-img').style.backgroundImage = p ? `url("${String(p).replace(/["\\\n]/g, '')}")` : '';
    $('#sheet-when').textContent = [whenOf(e), e['Catégorie']].filter(Boolean).join(' — ');
    $('#sheet-title').textContent = e.Titre || 'Événement';
    $('#sheet-where').textContent = [e.Lieu, e.Commune].filter(Boolean).join(', ') + (e.Tarif ? ' · ' + e.Tarif : '');
    $('#sheet-desc').textContent = e.Description || '';
    $('#sheet-link').href = '../#event-' + encodeURIComponent(e.id);
    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
    sheet.querySelector('.sheet-x').focus();
  }
  function closeSheet() {
    sheet.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  sheet.addEventListener('click', ev => { if (ev.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown', ev => {
    if (sheet.hidden) return;
    if (ev.key === 'Escape') closeSheet();
    if (ev.key === 'Tab') { // garder le focus dans la fiche
      const f = [...sheet.querySelectorAll('button, a[href]')];
      if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
    }
  });

  /* ── 1. L'arc ── */
  function buildArc(events) {
    const stage = $('#arc-stage');
    let pics = events.filter(photoOf);
    if (!pics.length) return;
    const N = 15;
    const items = Array.from({ length: N }, (_, i) => pics[i % pics.length]);
    const tiles = items.map(e => {
      const t = el('div', 'tile');
      t.appendChild(img(photoOf(e), ''));
      t.addEventListener('click', () => openSheet(e));
      stage.appendChild(t);
      return t;
    });
    let offset = 0, target = null, paused = reduce, hover = false, last = 0;
    const step = Math.PI / 9; // écart entre deux photos
    function layout() {
      const W = stage.clientWidth, H = stage.clientHeight;
      const mob = W < 720;
      const size = Math.round(mob ? 76 : Math.max(80, Math.min(W * 0.085, 118)));
      const R = mob ? W * 0.66 : Math.min(W * 0.40, H * 0.52);
      const cx = W / 2, cy = mob ? H * 0.60 : H * 0.74;
      stage.style.setProperty('--t', size + 'px');
      tiles.forEach((t, i) => {
        let a = Math.PI + (i * step + offset) % (N * step); // de gauche (π) vers la droite
        const k = (a - Math.PI) / Math.PI;               // 0 → 1 sur le demi-cercle
        const x = cx + R * Math.cos(a) - size / 2, y = cy + R * Math.sin(a) - size / 2;
        const vis = k < -0.02 || k > 1.02 ? 0 : Math.min(1, Math.min(k, 1 - k) * 8);
        t.style.opacity = vis.toFixed(3);
        t.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${((a - 1.5 * Math.PI) * 0.55).toFixed(3)}rad)`;
        t.style.pointerEvents = vis > .5 ? 'auto' : 'none';
      });
    }
    function tick(ts) {
      const dt = last ? Math.min(64, ts - last) : 16; last = ts;
      if (target !== null) {
        const d = target - offset; offset += d * Math.min(1, dt / 140);
        if (Math.abs(d) < 0.001) { offset = target; target = null; }
      } else if (!paused && !hover) offset += dt * 0.000045;
      layout();
      requestAnimationFrame(tick);
    }
    stage.parentElement.addEventListener('mouseenter', () => hover = true);
    stage.parentElement.addEventListener('mouseleave', () => hover = false);
    $('#arc-next').addEventListener('click', () => { target = (target ?? offset) + step; });
    const pb = $('#arc-pause');
    pb.setAttribute('aria-pressed', String(paused));
    pb.addEventListener('click', () => { paused = !paused; pb.setAttribute('aria-pressed', String(paused)); pb.setAttribute('aria-label', paused ? "Relancer l'animation" : "Mettre en pause l'animation"); });
    window.addEventListener('resize', layout);
    layout();
    requestAnimationFrame(tick);
  }

  /* ── 2. Le carrousel ── */
  function buildFlow(events) {
    const stage = $('#flow-stage');
    const list = events.slice(0, 12);
    if (!list.length) { stage.appendChild(el('p', 'flow-empty', 'Aucun événement à venir pour le moment.')); return; }
    let cur = Math.min(2, list.length - 1);
    const cards = list.map((e, i) => {
      const c = el('div', 'fcard');
      c.setAttribute('role', 'button'); c.tabIndex = -1;
      c.setAttribute('aria-label', `${e.Titre || 'Événement'}, ${whenOf(e)}`);
      const p = photoOf(e); if (p) c.appendChild(img(p, ''));
      const cap = el('div', 'fcard-cap');
      cap.appendChild(el('small', null, [whenOf(e), e.Commune].filter(Boolean).join(' · ')));
      cap.appendChild(el('strong', null, e.Titre || 'Événement'));
      c.appendChild(cap);
      c.addEventListener('click', () => { if (i === cur) openSheet(e); else go(i); });
      c.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openSheet(e); } });
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

  /* ── 3. Les organisateurs ── */
  function buildOrgs(orgas, events) {
    const row = $('#orgs-row');
    const list = orgas.filter(o => o.Nom).slice(0, 18);
    // Les plus actifs au centre, en grand
    const count = n => events.filter(e => (e.Organisation || '').toLowerCase().includes(n.toLowerCase())).length;
    list.sort((a, b) => count(b.Nom) - count(a.Nom));
    const order = [];
    list.forEach((o, i) => (i % 2 ? order.push(o) : order.unshift(o)));
    const pattern = ['s2', 'm', 's2', 'l', 'm', 's2', 'm', 'l', 's2', 'm'];
    let i = 0, p = 0;
    const circle = (o, size, k) => {
      const b = el('button', `org ${size}${!o.Photo && k % 3 === 1 ? ' orange' : ''}`);
      b.type = 'button';
      b.setAttribute('aria-label', o.Nom);
      const ph = o.Photo && o.Photo[0] && ((o.Photo[0].thumbnails && o.Photo[0].thumbnails.large) ? o.Photo[0].thumbnails.large.url : o.Photo[0].url);
      if (ph) b.appendChild(img(ph, ''));
      else b.appendChild(el('span', 'org-ini', o.Nom.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 || /^[A-Z]{2,}$/.test(w)).map(w => w[0]).join('').slice(0, 2).toUpperCase() || o.Nom.slice(0, 2).toUpperCase()));
      b.appendChild(el('span', 'org-name', o.Nom));
      b.addEventListener('click', () => {
        const mine = events.filter(e => (e.Organisation || '').toLowerCase().includes(o.Nom.toLowerCase()));
        if (mine.length) openSheet(mine[0]);
      });
      return b;
    };
    while (i < order.length) {
      const kind = pattern[p++ % pattern.length];
      if (kind === 's2') {
        const col = el('div', 'org-col');
        col.appendChild(circle(order[i], 's', i)); i++;
        if (i < order.length) { col.appendChild(circle(order[i], 's', i)); i++; }
        row.appendChild(col);
      } else { row.appendChild(circle(order[i], kind, i)); i++; }
    }
    // Centrer la rangée sur le plus grand cercle
    requestAnimationFrame(() => { row.scrollLeft = (row.scrollWidth - row.clientWidth) / 2; });
  }

  /* ── 4. Toutes les dates ── */
  function buildList(events) {
    const ol = $('#list-rows');
    events.slice(0, 40).forEach(e => {
      const li = el('li');
      const b = el('button', 'row'); b.type = 'button';
      b.appendChild(el('span', 'row-d', whenOf(e)));
      b.appendChild(el('span', 'row-t', e.Titre || 'Événement'));
      b.appendChild(el('span', 'row-c', e.Commune || ''));
      b.addEventListener('click', () => openSheet(e));
      li.appendChild(b); ol.appendChild(li);
    });
  }

  /* ── Démarrage ── */
  (async () => {
    let events = [], orgas = [];
    try { events = await get('/events'); } catch (e) { console.warn('events', e); }
    try { orgas = await get('/orgas'); } catch (e) { console.warn('orgas', e); }
    const up = events.filter(isActive).sort((a, b) => sortKey(a) - sortKey(b));
    buildArc(up.length ? up : events);
    buildFlow(up);
    buildOrgs(orgas, events);
    buildList(up);
  })();
})();
