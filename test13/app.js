/* laSave — test13 : site complet (accueil, fiches, organisateurs, partager, pages d'information) */
(() => {
  'use strict';
  const API = 'https://lasave-api.partage.workers.dev';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Un seul interrupteur pour toutes les animations (pied de page), mémorisé comme sur le site actuel
  const motion = { still: reduce || (() => { try { return localStorage.getItem('lasave_motion') === 'off'; } catch (_) { return false; } })(), subs: [] };
  const onMotion = fn => { motion.subs.push(fn); fn(motion.still); };
  // Pause uniquement quand on navigue au clavier dans un bloc (pas au survol de la souris)
  const keyFocus = n => { try { return n && n.matches(':focus-visible'); } catch (_) { return false; } };

  const COMMUNES = ['Aussonne', 'Beaupuy', 'Bellegarde-Sainte-Marie', 'Bouconne', 'Brignemont', 'Cabanac-Séguenville', 'Caubiac', 'Cox', 'Daux', 'Drudas', 'Garac', 'Le Grès', 'Lévignac', 'Lagraulet-Saint-Nicolas', 'Larra', 'Launac', 'Laréole', 'Le Burgaud', 'Mérenvielle', 'Menville', 'Merville', 'Mondonville', 'Montaigut-sur-Save', 'Pelleport', 'Pradère-les-Bourguets', 'Puysségur', 'Saint-Cézert', 'Saint-Paul-sur-Save', 'Seilh', 'Thil', 'Vignaux'].sort((a, b) => a.localeCompare(b, 'fr'));

  /* ── Catégories ── */
  const CATS = {
    'Concert': ['#FFA823', '/images/cat-concert.webp'], 'Festival': ['#FFA823', '/images/cat-festival.webp'], 'Spectacle': ['#FFA823', '/images/cat-festival.webp'],
    'Guinguette': ['#C8A96E', '/images/cat-guinguette.webp'], 'Fête & Célébration': ['#E4572E', '/images/cat-fete.webp'], 'Marché': ['#C8A96E', '/images/cat-marche.webp'],
    'Exposition': ['#C955E0', null], 'Conférence / Atelier': ['#C955E0', null], 'Sport / Loisir': ['#5C96AB', '/images/cat-sport.webp'],
  };
  const catOf = e => CATS[e['Catégorie']] || ['#9C988F', null];
  const RUBRIQUES = [
    { title: "Envie d'une belle soirée ?", kicker: 'Concerts, spectacles & festivals', cats: ['Concert', 'Spectacle', 'Festival'], color: '#FFA823' },
    { title: 'Et si vous vous lanciez ?', kicker: 'Ateliers & conférences', cats: ['Conférence / Atelier'], color: '#C955E0' },
    { title: 'Transformez vos envies en énergie', kicker: 'Sport & loisirs', cats: ['Sport / Loisir'], color: '#5C96AB' },
    { title: 'À découvrir dans la vallée', kicker: 'Marchés, fêtes, guinguettes & expositions', cats: ['Guinguette', 'Marché', 'Fête & Célébration', 'Exposition', 'Autre'], color: '#C8A96E' },
  ];

  /* ── Outils ── */
  const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = () => day0(new Date());
  const isRec = e => e['Récurrence'] && e['Récurrence'] !== 'Aucune';
  const isActive = e => isRec(e) || (e['Date de fin'] ? new Date(e['Date de fin']) >= today() : (e.Date ? new Date(e.Date) >= today() : true));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const orgName = v => Array.isArray(v) ? v.join(', ') : String(v || '');
  const attUrl = a => a ? ((a.thumbnails && a.thumbnails.large) ? a.thumbnails.large.url : a.url) : null;
  const photoOf = e => attUrl(e.Photo && e.Photo[0]) || catOf(e)[1];
  const fullPhoto = e => (e.Photo && e.Photo[0] && e.Photo[0].url) || photoOf(e);
  const hour = e => e.Heure ? String(e.Heure).replace(':', 'h') : '';
  const fmt = (d, o) => new Date(d).toLocaleDateString('fr-FR', o).replace(/\./g, '');
  const whenOf = e => {
    if (!e.Date) return isRec(e) ? (e['Jour/Période'] || e['Période'] || e['Récurrence'] || '') : '';
    let s = fmt(e.Date, { weekday: 'short', day: 'numeric', month: 'short' });
    if (e.Heure) s += ' · ' + hour(e);
    return s;
  };
  const sortKey = e => e.Date ? Math.max(new Date(e.Date).getTime(), Date.now()) : 9e15;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const img = (src, alt = '') => { const i = new Image(); i.src = src; i.alt = alt; i.loading = 'lazy'; i.decoding = 'async'; return i; };
  const bg = (node, src) => { node.style.backgroundImage = src ? `url("${String(src).replace(/["\\\n]/g, '')}")` : ''; };
  // Titre sans coupure : les mots composés (Saint-Jean) restent entiers
  const title = (node, text) => {
    node.replaceChildren();
    String(text || '').split(/(\s+)/).forEach(w => { if (/\S-\S/.test(w)) node.appendChild(el('span', 'nw', w)); else node.appendChild(document.createTextNode(w)); });
    return node;
  };
  const tel = (tag, cls, text) => title(el(tag, cls), text);
  const initials = n => (String(n).split(/[\s'’-]+/).filter(w => w.length > 2).map(w => w[0]).join('').slice(0, 2) || String(n).slice(0, 2)).toUpperCase();
  const TINTS = ['#E4572E', '#C8A96E', '#5C96AB', '#8A4FB0'];
  const tintOf = n => TINTS[[...String(n)].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
  async function api(path, opt = {}) {
    const h = opt.body && !(opt.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {};
    const r = await fetch(API + path, { ...opt, headers: { Accept: 'application/json', ...h } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.error || ('Erreur ' + r.status)), { status: r.status });
    return d;
  }
  const ICON = {
    cal: '<path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    rep: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>',
    fb: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    web: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    tel: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
  };
  const icon = (k, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

  /* ── Mots entiers : on réduit la taille du titre plutôt que de couper un mot ── */
  function fit(node, min = 14) {
    if (!node) return;
    node.style.fontSize = '';
    if (!node.clientWidth) return;
    let s = parseFloat(getComputedStyle(node).fontSize), guard = 40;
    while (node.scrollWidth > node.clientWidth + 1 && s > min && guard--) { s = Math.max(min, s * 0.94); node.style.fontSize = s.toFixed(1) + 'px'; }
  }
  const fitAll = () => $$('.fit, .fcard-cap strong, .poster-t, .row-title, .propose-title, .page-title').forEach(n => fit(n, 12));
  let fitT = 0;
  window.addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(fitAll, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);

  /* ── J'y vais (cœur) : même mémoire que le site actuel ── */
  const liked = () => { try { return JSON.parse(localStorage.getItem('jyvais') || '[]'); } catch (_) { return []; } };
  const isLiked = id => liked().includes(id);
  let heartBinds = [];
  function syncHearts(e) {
    heartBinds.filter(b => b.e === e).forEach(({ btn }) => {
      btn.setAttribute('aria-pressed', String(isLiked(e.id)));
      const n = btn.querySelector('.heart-n'); if (n) n.textContent = e.Likes || 0;
      btn.setAttribute('aria-label', `J'y vais, ${e.Likes || 0} personne${(e.Likes || 0) > 1 ? 's' : ''}`);
    });
  }
  async function toggleLike(e) {
    const on = !isLiked(e.id);
    const arr = liked().filter(x => x !== e.id); if (on) arr.push(e.id);
    try { localStorage.setItem('jyvais', JSON.stringify(arr)); } catch (_) {}
    e.Likes = Math.max(0, (e.Likes || 0) + (on ? 1 : -1));
    syncHearts(e);
    try { const d = await api(`/events/${e.id}/like`, { method: 'POST', body: JSON.stringify({ delta: on ? 1 : -1 }) }); if (typeof d.Likes === 'number') { e.Likes = d.Likes; syncHearts(e); } } catch (_) {}
  }
  function bindHeart(sel, e) { // bouton fixe de la page, réattribué à un événement
    const old = $(sel), nb = old.cloneNode(true); old.replaceWith(nb);
    heartBinds = heartBinds.filter(b => b.btn.isConnected);
    heartBinds.push({ btn: nb, e });
    nb.addEventListener('click', () => toggleLike(e));
    syncHearts(e);
  }

  /* ── Fenêtres (fiche, profil, avis) ── */
  let openDlg = null, returnFocus = null;
  function openDialog(d) {
    if (openDlg && openDlg !== d) { openDlg.hidden = true; openDlg.classList.remove('in'); }
    else returnFocus = document.activeElement;
    openDlg = d;
    d.hidden = false;
    d.querySelector('[role="dialog"]').scrollTop = 0;
    requestAnimationFrame(() => d.classList.add('in'));
    document.body.classList.add('locked');
    d.querySelector('.x').focus({ preventScroll: true });
  }
  function closeDialog() {
    if (!openDlg) return;
    const d = openDlg; openDlg = null;
    d.classList.remove('in'); d.hidden = true;
    document.body.classList.remove('locked');
    if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
  }
  $$('.sheet').forEach(d => d.addEventListener('click', ev => { if (ev.target.closest('[data-close]')) closeDialog(); }));
  document.addEventListener('keydown', ev => {
    if (!openDlg) return;
    if (ev.key === 'Escape') { ev.preventDefault(); closeDialog(); return; }
    if (ev.key !== 'Tab') return;
    const f = [...openDlg.querySelectorAll('button, a[href], input, textarea, [tabindex="0"]')].filter(n => !n.closest('[hidden]') && n.offsetParent !== null);
    if (!f.length) return;
    if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
    else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
  });

  /* ── Données partagées ── */
  let ALL = [], UP = [], ORGAS = [];
  const findOrga = name => { const n = norm(orgName(name)); if (!n) return null; return ORGAS.find(o => norm(o.Nom) === n) || ORGAS.find(o => n.includes(norm(o.Nom)) || norm(o.Nom).includes(n)) || null; };
  const eventsOf = o => UP.filter(e => { const n = norm(orgName(e.Organisation)); return n && (n === norm(o.Nom) || n.includes(norm(o.Nom))); });

  /* ── Agenda : Google et fichier .ics ── */
  const pad = n => String(n).padStart(2, '0');
  function range(e) {
    if (!e.Date) return null;
    const d = new Date(e.Date);
    if (e.Heure) {
      const [h, m] = String(e.Heure).split(':').map(Number);
      const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 0, m || 0);
      const f = new Date(s.getTime() + 2 * 3600e3);
      const loc = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
      return { s: loc(s), f: loc(f), allDay: false };
    }
    const end = new Date(e['Date de fin'] || e.Date); end.setDate(end.getDate() + 1);
    const ymd = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}`;
    return { s: ymd(d), f: ymd(end), allDay: true };
  }
  const shareUrl = e => `${API}/e/${encodeURIComponent(e.id)}`;
  function calendar(e) {
    const r = range(e), where = [e.Lieu, e.Commune].filter(Boolean).join(', ');
    const g = $('#cal-google'), menu = $('#ev-cal').closest('.menu');
    menu.hidden = !r;
    if (!r) return;
    g.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(e.Titre || 'Événement') + '&dates=' + r.s + '/' + r.f + '&details=' + encodeURIComponent((e.Description || '').slice(0, 800) + '\n\n' + shareUrl(e)) + '&location=' + encodeURIComponent(where) + (r.allDay ? '' : '&ctz=Europe/Paris');
    $('#cal-ics').onclick = () => {
      const esc = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
      const dt = r.allDay ? `DTSTART;VALUE=DATE:${r.s}\r\nDTEND;VALUE=DATE:${r.f}` : `DTSTART;TZID=Europe/Paris:${r.s}\r\nDTEND;TZID=Europe/Paris:${r.f}`;
      const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//laSave//FR\r\nBEGIN:VEVENT\r\nUID:${e.id}@la-save.fr\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z\r\n${dt}\r\nSUMMARY:${esc(e.Titre)}\r\nLOCATION:${esc(where)}\r\nDESCRIPTION:${esc((e.Description || '').slice(0, 800))}\r\nURL:${shareUrl(e)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      a.download = (norm(e.Titre).replace(/ /g, '-') || 'evenement') + '.ics';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      closeCalMenu();
    };
  }
  const closeCalMenu = () => { $('#ev-cal-menu').hidden = true; $('#ev-cal').setAttribute('aria-expanded', 'false'); };
  $('#ev-cal').addEventListener('click', ev => { ev.stopPropagation(); const m = $('#ev-cal-menu'); m.hidden = !m.hidden; $('#ev-cal').setAttribute('aria-expanded', String(!m.hidden)); });
  document.addEventListener('click', ev => { if (!ev.target.closest('.menu')) closeCalMenu(); });
  $('#cal-google').addEventListener('click', closeCalMenu);

  /* ── Fiche événement ── */
  function openEvent(e) {
    const p = fullPhoto(e);
    bg($('#ev-blur'), p);
    const im = $('#ev-img'); im.hidden = !p; if (p) { im.src = p; im.alt = `Affiche : ${e.Titre || 'événement'}`; }
    $('#ev-media').classList.toggle('none', !p);
    const cat = $('#ev-cat'); cat.textContent = e['Catégorie'] || 'Événement'; cat.style.setProperty('--c', catOf(e)[0]);
    title($('#ev-title'), e.Titre || 'Événement');
    const facts = $('#ev-facts'); facts.replaceChildren();
    const fact = (k, main, sub) => { if (!main) return; const li = el('li'); li.innerHTML = icon(k, 18); const t = el('span'); t.appendChild(el('b', null, main)); if (sub) t.appendChild(el('small', null, sub)); li.appendChild(t); facts.appendChild(li); };
    if (e.Date) {
      const a = fmt(e.Date, { weekday: 'long', day: 'numeric', month: 'long' });
      const fin = e['Date de fin'] && e['Date de fin'] !== e.Date ? fmt(e['Date de fin'], { weekday: 'long', day: 'numeric', month: 'long' }) : '';
      fact('cal', fin ? `Du ${a} au ${fin}` : a.charAt(0).toUpperCase() + a.slice(1), e.Heure ? 'À ' + hour(e) : '');
    }
    if (isRec(e)) fact('rep', e['Jour/Période'] || e['Période'] || e['Récurrence'], e.Date ? '' : (e.Heure ? 'À ' + hour(e) : ''));
    fact('pin', e.Lieu || e.Commune, e.Lieu ? e.Commune : '');
    fact('tag', e.Tarif);
    const ob = $('#ev-org'), o = findOrga(e.Organisation), on = orgName(e.Organisation);
    ob.hidden = !on; ob.replaceChildren(); ob.disabled = !o; ob.onclick = null;
    if (on) {
      ob.appendChild(avatar(o || { Nom: on }, 'ev-org-av'));
      const t = el('span'); t.appendChild(el('small', null, 'Organisé par')); t.appendChild(el('b', null, o ? o.Nom : on)); ob.appendChild(t);
      if (o) { ob.insertAdjacentHTML('beforeend', icon('arrow', 16)); ob.onclick = () => openProfile(o); ob.setAttribute('aria-label', `Organisé par ${o.Nom}, voir le profil`); }
    }
    $('#ev-desc').textContent = e.Description || '';
    $('#ev-desc').hidden = !e.Description;
    bindHeart('#ev-heart', e);
    calendar(e); closeCalMenu();
    $('#ev-msg').textContent = '';
    $('#ev-share').onclick = async () => {
      const url = shareUrl(e);
      if (navigator.share) { try { await navigator.share({ title: e.Titre, text: `${e.Titre} — ${whenOf(e)}`, url }); return; } catch (err) { if (err.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(url); $('#ev-msg').textContent = 'Lien copié. Collez-le où vous voulez.'; }
      catch (_) { $('#ev-msg').textContent = url; }
    };
    openDialog($('#sheet'));
    fit($('#ev-title'), 20);
    try { fetch(`${API}/events/${e.id}/view`, { method: 'POST' }).catch(() => {}); } catch (_) {}
  }

  /* ── Profil organisateur ── */
  function avatar(o, cls) {
    const a = el('span', cls);
    const ph = attUrl(o.Photo && o.Photo[0]);
    if (ph) a.appendChild(img(ph)); else { a.textContent = initials(o.Nom); a.style.background = tintOf(o.Nom); }
    a.setAttribute('aria-hidden', 'true');
    return a;
  }
  function links(contact) {
    return String(contact || '').split('|').map(s => s.trim()).filter(Boolean).map(p => {
      let m;
      if ((m = p.match(/^IG:\s*(.+)$/i))) { const v = m[1].replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, ''); return { k: 'ig', label: 'Instagram', sub: '@' + v, href: `https://www.instagram.com/${encodeURIComponent(v)}/` }; }
      if ((m = p.match(/^FB:\s*(.+)$/i))) { const v = m[1]; const href = /^https?:/.test(v) ? v : `https://www.facebook.com/${encodeURIComponent(v.replace(/^@/, ''))}`; return { k: 'fb', label: 'Facebook', sub: href.replace(/^https?:\/\/(www\.)?facebook\.com\//, '').replace(/\/$/, ''), href }; }
      if (/instagram\.com/i.test(p)) { const href = /^https?:/.test(p) ? p : 'https://' + p; return { k: 'ig', label: 'Instagram', sub: '@' + href.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, ''), href }; }
      if (/facebook\.com|fb\.com/i.test(p)) { const href = /^https?:/.test(p) ? p : 'https://' + p; return { k: 'fb', label: 'Facebook', sub: href.replace(/^https?:\/\/(www\.)?(facebook|fb)\.com\//, '').replace(/\/$/, ''), href }; }
      if ((m = p.match(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i))) return { k: 'mail', label: 'E-mail', sub: p, href: 'mailto:' + p };
      if (/^\+?[\d .-]{9,}$/.test(p)) return { k: 'tel', label: 'Téléphone', sub: p, href: 'tel:' + p.replace(/[^\d+]/g, '') };
      const v = p.replace(/^Site:\s*/i, ''); if (!/\./.test(v)) return null;
      const href = /^https?:/.test(v) ? v : 'https://' + v;
      return { k: 'web', label: 'Site web', sub: href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), href };
    }).filter(l => l && /^(https:|mailto:|tel:)/.test(l.href));
  }
  function openProfile(o) {
    const av = $('#pro-avatar'); av.replaceChildren(avatar(o, 'pro-av'));
    title($('#pro-name'), o.Nom);
    const short = o['Description courte'] || '', long = o.Description || '';
    $('#pro-short').textContent = short; $('#pro-short').hidden = !short;
    $('#pro-desc').textContent = long; $('#pro-desc').hidden = !long;
    const ul = $('#pro-links'); ul.replaceChildren();
    links(o.Contact).forEach(l => {
      const li = el('li'), a = el('a');
      a.href = l.href; if (!/^(mailto|tel):/.test(l.href)) { a.target = '_blank'; a.rel = 'noopener'; }
      a.innerHTML = icon(l.k, 18);
      const t = el('span'); t.appendChild(el('b', null, l.label)); t.appendChild(el('small', null, l.sub)); a.appendChild(t);
      li.appendChild(a); ul.appendChild(li);
    });
    ul.hidden = !ul.children.length;
    const box = $('#pro-events'); box.replaceChildren();
    const mine = eventsOf(o);
    $('#pro-sub').textContent = mine.length ? 'Prochains rendez-vous' : 'Pas de rendez-vous annoncé pour le moment';
    mine.slice(0, 8).forEach(e => {
      const b = el('button', 'pro-ev'); b.type = 'button';
      const p = photoOf(e); const th = el('span', 'pro-ev-img'); if (p) th.appendChild(img(p)); b.appendChild(th);
      const t = el('span', 'pro-ev-t'); t.appendChild(el('small', null, [whenOf(e), e.Commune].filter(Boolean).join(' · '))); t.appendChild(tel('b', null, e.Titre || 'Événement')); b.appendChild(t);
      b.addEventListener('click', () => openEvent(e));
      box.appendChild(b);
    });
    openDialog($('#profile'));
    fit($('#pro-name'), 22);
  }

  /* ── En-tête qui se remplit au défilement ── */
  const top = $('#top');
  const onScroll = () => top.classList.toggle('solid', window.scrollY > 40 || top.classList.contains('on-page'));
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── 1. À la une ── */
  function buildHero(events) {
    let feats = events.filter(e => e['À la une'] && photoOf(e));
    if (feats.length < 4) feats = feats.concat(events.filter(e => !feats.includes(e) && photoOf(e))).slice(0, 6);
    const hero = $('.hero');
    if (!feats.length) { $$('.hero-arr, .hero-foot, #hero-open, #hero-heart').forEach(n => { n.hidden = true; }); return; }
    if (feats.length < 2) $$('.hero-arr, .hero-foot').forEach(n => { n.hidden = true; });
    $('#hero-total').textContent = String(feats.length).padStart(2, '0');
    let cur = 0, paused = motion.still, t0 = 0, raf = 0, hold = false;
    function show(i) {
      cur = (i + feats.length) % feats.length;
      const e = feats[cur], b = $('#hero-bg'), r = $('#hero-ref'), tx = $('.hero-text');
      b.classList.add('fade'); r.classList.add('fade'); tx.classList.add('fade');
      setTimeout(() => {
        bg(b, photoOf(e)); bg(r, photoOf(e));
        $('#hero-when').textContent = [whenOf(e), e.Commune].filter(Boolean).join(' · ');
        title($('#hero-title'), e.Titre || 'Événement');
        fit($('#hero-title'), 30);
        b.classList.remove('fade'); r.classList.remove('fade'); tx.classList.remove('fade');
      }, reduce ? 0 : 280);
      $('#hero-num').textContent = String(cur + 1).padStart(2, '0');
      bindHeart('#hero-heart', e);
    }
    function progress(ts) {
      if (!t0) t0 = ts;
      const k = Math.min(1, (ts - t0) / 7000);
      $('#hero-progress').style.width = (k * 100).toFixed(1) + '%';
      if (k >= 1) { t0 = 0; show(cur + 1); }
      raf = requestAnimationFrame(progress);
    }
    function restart() { cancelAnimationFrame(raf); t0 = 0; $('#hero-progress').style.width = '0%'; if (!paused && !hold && feats.length > 1) raf = requestAnimationFrame(progress); }
    $('#hero-open').addEventListener('click', () => openEvent(feats[cur]));
    $('#hero-prev').addEventListener('click', () => { show(cur - 1); restart(); });
    $('#hero-next').addEventListener('click', () => { show(cur + 1); restart(); });
    onMotion(p => { paused = p; restart(); });
    hero.addEventListener('focusin', ev => { if (keyFocus(ev.target)) { hold = true; restart(); } });
    hero.addEventListener('focusout', ev => { if (!hero.contains(ev.relatedTarget)) { hold = false; restart(); } });
    let sx = null;
    hero.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'mouse') sx = ev.clientX; });
    hero.addEventListener('pointerup', ev => { if (sx == null) return; const d = ev.clientX - sx; sx = null; if (Math.abs(d) > 50) { show(cur + (d < 0 ? 1 : -1)); restart(); } });
    show(0);
  }

  /* ── 2. Les rendez-vous des 30 prochains jours (carrousel) ── */
  let flowRender = () => {};
  function buildFlow(events) {
    const stage = $('#flow-stage');
    const limit = new Date(today()); limit.setDate(limit.getDate() + 30);
    const list = events.filter(e => e.Date && new Date(e.Date) <= limit && !['Conférence / Atelier', 'Sport / Loisir'].includes(e['Catégorie'])).slice(0, 16);
    if (!list.length) { stage.appendChild(el('p', 'empty', 'Aucun événement daté dans les 30 prochains jours.')); $('.flow-ctrl').hidden = true; return; }
    let cur = Math.min(2, list.length - 1);
    const cards = list.map((e, i) => {
      const c = el('div', 'fcard');
      c.setAttribute('role', 'button'); c.tabIndex = -1;
      c.setAttribute('aria-label', `${e.Titre || 'Événement'}, ${whenOf(e)}`);
      const inner = el('div', 'fcard-in');
      const p = photoOf(e); if (p) inner.appendChild(img(p));
      const cap = el('div', 'fcard-cap');
      cap.appendChild(el('small', null, [whenOf(e), e.Commune].filter(Boolean).join(' · ')));
      cap.appendChild(tel('strong', null, e.Titre || 'Événement'));
      inner.appendChild(cap);
      c.appendChild(inner);
      const ref = el('div', 'fcard-ref'); ref.setAttribute('aria-hidden', 'true'); bg(ref, p); c.appendChild(ref);
      c.addEventListener('click', () => { if (i === cur) openEvent(e); else { go(i); tick(); } });
      c.addEventListener('keydown', ev => { if (ev.target === c && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openEvent(e); } });
      stage.appendChild(c);
      return c;
    });
    function render() {
      const W = stage.clientWidth, cw = cards[0].offsetWidth;
      if (!W) return;
      const gap = Math.min(cw * 1.02, W / 4.2);
      cards.forEach((c, i) => {
        const o = i - cur, a = Math.abs(o);
        c.style.transform = `translateX(${(o * gap).toFixed(1)}px) translateZ(${(-a * 110).toFixed(0)}px) rotateY(${(Math.max(-1, Math.min(1, o)) * -38).toFixed(1)}deg) scale(${a ? 0.9 : 1})`;
        c.style.zIndex = String(100 - a);
        c.style.opacity = a > 2 ? '0' : (a === 2 ? '.5' : '1');
        c.style.filter = a ? 'brightness(.55)' : 'none';
        c.style.pointerEvents = a > 2 ? 'none' : 'auto';
        c.tabIndex = a === 0 ? 0 : -1;
        c.setAttribute('aria-hidden', a > 2 ? 'true' : 'false');
      });
      $('#flow-count').textContent = `${cur + 1} / ${cards.length}`;
    }
    flowRender = render;
    function go(i) { cur = (i + cards.length) % cards.length; render(); }
    $('#flow-prev').addEventListener('click', () => { go(cur - 1); tick(); });
    $('#flow-next').addEventListener('click', () => { go(cur + 1); tick(); });
    stage.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(cur - 1); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); go(cur + 1); }
    });
    let sx = null;
    stage.addEventListener('pointerdown', ev => { sx = ev.clientX; });
    stage.addEventListener('pointerup', ev => { if (sx == null) return; const d = ev.clientX - sx; sx = null; if (Math.abs(d) > 40) { go(cur + (d < 0 ? 1 : -1)); tick(); } });
    window.addEventListener('resize', render);
    render();
    // Défilement automatique : continue même sous la souris ; s'arrête seulement au clavier ou avec l'interrupteur
    let paused = motion.still, hold = false, timer = null;
    function tick() { clearTimeout(timer); if (paused || hold || cards.length < 2) return; timer = setTimeout(() => { go(cur + 1); tick(); }, 4500); }
    const sec = stage.closest('section');
    sec.addEventListener('focusin', ev => { if (keyFocus(ev.target)) { hold = true; tick(); } });
    sec.addEventListener('focusout', ev => { if (!sec.contains(ev.relatedTarget)) { hold = false; tick(); } });
    onMotion(p => { paused = p; tick(); });
  }

  /* ── 3. Les rubriques ── */
  function poster(e) {
    const b = el('div', 'poster'); b.setAttribute('role', 'button'); b.tabIndex = 0;
    b.setAttribute('aria-label', `${e.Titre || 'Événement'}, ${whenOf(e)}, ${e.Commune || ''}`);
    const pi = el('div', 'poster-img'); const p = photoOf(e); if (p) pi.appendChild(img(p));
    b.appendChild(pi);
    const tx = el('div', 'poster-tx');
    tx.appendChild(el('span', 'poster-date', whenOf(e)));
    tx.appendChild(tel('span', 'poster-t', e.Titre || 'Événement'));
    tx.appendChild(el('span', 'poster-c', e.Commune || e['Catégorie'] || ''));
    b.appendChild(tx);
    b.addEventListener('click', () => openEvent(e));
    b.addEventListener('keydown', ev => { if (ev.target === b && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openEvent(e); } });
    return b;
  }
  function buildRows(events) {
    const box = $('#rows');
    const known = RUBRIQUES.flatMap(r => r.cats);
    RUBRIQUES.map(r => ({ ...r, evs: events.filter(e => r.cats.includes(e['Catégorie']) || (r.cats.includes('Autre') && !known.includes(e['Catégorie']))) })).forEach((r, k) => {
      if (!r.evs.length) return;
      const sec = el('section', 'row-sec'); sec.setAttribute('aria-labelledby', 'rub-' + k);
      sec.style.setProperty('--c', r.color);
      const head = el('div', 'row-block');
      const t = el('div', 'row-block-text'); t.appendChild(el('p', 'row-kicker', r.kicker));
      const h = tel('h2', 'row-title', r.title); h.id = 'rub-' + k; t.appendChild(h); head.appendChild(t);
      const side = el('div', 'row-side');
      const all = el('button', 'see-all', `Voir tout (${r.evs.length})`); all.type = 'button'; all.setAttribute('aria-expanded', 'false');
      side.appendChild(all);
      const nav = el('div', 'row-nav');
      const mk = (lbl, d, dir) => { const b = el('button', 'circle sm'); b.type = 'button'; b.setAttribute('aria-label', lbl); b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="${d}"/></svg>`; b.addEventListener('click', () => track.scrollBy({ left: dir * track.clientWidth * .8, behavior: reduce ? 'auto' : 'smooth' })); return b; };
      nav.appendChild(mk(`Précédent : ${r.title}`, 'm15 5-7 7 7 7', -1)); nav.appendChild(mk(`Suivant : ${r.title}`, 'm9 5 7 7-7 7', 1));
      side.appendChild(nav); head.appendChild(side);
      const track = el('div', 'track'); r.evs.forEach(e => track.appendChild(poster(e)));
      all.addEventListener('click', () => { const o = sec.classList.toggle('open'); all.setAttribute('aria-expanded', String(o)); all.textContent = o ? 'Réduire' : `Voir tout (${r.evs.length})`; fitAll(); });
      sec.appendChild(head); sec.appendChild(track); box.appendChild(sec);
    });
  }

  /* ── 4. Organisateurs : défilement continu, grand au centre ── */
  function buildOrgs(orgas) {
    const row = $('#orgs-row'), sec = $('#organisateurs');
    let list = orgas.filter(o => o.Nom).slice(0, 30);
    if (!list.length) { sec.hidden = true; return; }
    while (list.length < 14) list = list.concat(list.map(o => ({ ...o, _dup: true })));
    const slots = []; let k = 0;
    const bubble = o => {
      const b = el('button', 'org'); b.type = 'button';
      if (o._dup) { b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); } else b.setAttribute('aria-label', `${o.Nom}, voir le profil`);
      const ph = attUrl(o.Photo && o.Photo[0]);
      if (ph) b.appendChild(img(ph)); else { b.appendChild(el('span', 'org-ini', initials(o.Nom))); b.style.background = tintOf(o.Nom); }
      b.appendChild(el('span', 'org-name', o.Nom));
      b.appendChild(el('span', 'org-cta', 'Voir le profil'));
      b.addEventListener('click', () => openProfile(o._dup ? ORGAS.find(x => x.id === o.id) || o : o));
      row.appendChild(b); return b;
    };
    while (k < list.length) {
      if (slots.length % 3 === 1 && k + 1 < list.length) { slots.push([bubble(list[k]), bubble(list[k + 1])]); k += 2; }
      else { slots.push([bubble(list[k])]); k++; }
    }
    const N = slots.length;
    const erf = x => { const t = 1 / (1 + .3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x < 0 ? -y : y; };
    let off = 0, last = 0, hold = false, paused = motion.still;
    function layout() {
      const W = row.clientWidth, H = row.clientHeight;
      if (!W) return;
      const mob = W < 720;
      const Smax = mob ? 170 : 250, Smin = mob ? 56 : 82, sig = mob ? 1.35 : 1.9, gap = mob ? 10 : 16;
      const X = u => (Smin + gap) * u + (Smax - Smin) * sig * Math.sqrt(Math.PI) / 2 * erf(u / sig);
      slots.forEach((sl, i) => {
        let u = ((i - off) % N + N) % N; if (u > N / 2) u -= N;
        const s = Smin + (Smax - Smin) * Math.exp(-((u / sig) ** 2));
        const x = W / 2 + X(u);
        if (sl.length === 1) {
          const b = sl[0]; b.style.setProperty('--sz', s.toFixed(1) + 'px');
          b.style.transform = `translate(${(x - s / 2).toFixed(1)}px, ${((H - s) / 2).toFixed(1)}px)`;
          b.classList.toggle('big', Math.abs(u) < .5);
        } else {
          const t = s * .47;
          sl.forEach((b, j) => { b.style.setProperty('--sz', t.toFixed(1) + 'px'); b.style.transform = `translate(${(x - t / 2).toFixed(1)}px, ${(H / 2 + (j ? s * .03 : -s * .03 - t)).toFixed(1)}px)`; b.classList.remove('big'); });
        }
      });
    }
    function frame(ts) {
      const dt = last ? Math.min(50, ts - last) : 16; last = ts;
      if (!paused && !hold && !openDlg) off += dt * 0.00028;
      layout();
      requestAnimationFrame(frame);
    }
    // Survol d'une photo : la ronde s'arrête pour qu'on puisse cliquer
    row.addEventListener('pointerover', ev => { if (ev.pointerType === 'mouse' && ev.target.closest('.org')) hold = true; });
    row.addEventListener('pointerout', ev => { if (ev.pointerType === 'mouse' && !(ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest('.org'))) hold = false; });
    row.addEventListener('focusin', ev => { if (!keyFocus(ev.target)) return; hold = true; const i = slots.findIndex(sl => sl.includes(ev.target)); if (i >= 0) off = i; });
    row.addEventListener('focusout', () => { hold = false; });
    onMotion(p => { paused = p; });
    requestAnimationFrame(frame);
  }

  /* ── Page « Partager » ── */
  function setupForm() {
    const dl = $('#communes-list'); COMMUNES.forEach(c => { const o = el('option'); o.value = c; dl.appendChild(o); });
    // Code organisateur
    const say = (node, txt, kind) => { node.textContent = txt || ''; node.className = 'form-msg' + (kind ? ' ' + kind : ''); };
    async function checkCode() {
      const code = $('#f-code').value.trim();
      if (!code) { say($('#code-msg'), 'Entrez votre code organisateur.', 'err'); $('#f-code').focus(); return; }
      say($('#code-msg'), 'Vérification…');
      try {
        const o = await api('/code', { method: 'POST', body: JSON.stringify({ code }) });
        $('#f-org').value = o.Nom || '';
        String(o.Contact || '').split('|').map(s => s.trim()).filter(Boolean).forEach(p => {
          if (/^IG:/i.test(p)) $('#f-ig').value = p.replace(/^IG:/i, '').trim();
          else if (/^FB:/i.test(p)) $('#f-fb').value = p.replace(/^FB:/i, '').trim();
          else if (/^Site:/i.test(p)) $('#f-site').value = p.replace(/^Site:/i, '').trim();
          else if (/instagram\.com/i.test(p)) $('#f-ig').value = p.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
          else if (/facebook\.com/i.test(p)) $('#f-fb').value = p;
          else if (/\./.test(p) && !/@/.test(p)) $('#f-site').value = p;
        });
        say($('#code-msg'), `Bonjour ${o.Nom} ! Vos informations sont remplies plus bas.`, 'ok');
        $('#code-box').classList.add('done');
      } catch (err) {
        say($('#code-msg'), err.status === 404 ? "Ce code n'est pas reconnu. Vérifiez-le, ou demandez-le à nouveau ci-dessous." : (err.status === 429 ? 'Trop d’essais. Réessayez dans quelques minutes.' : 'Vérification impossible pour le moment. Vous pouvez continuer sans code.'), 'err');
      }
    }
    $('#code-ok').addEventListener('click', checkCode);
    $('#f-code').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); checkCode(); } });
    let crMode = null;
    $$('[data-cr]').forEach(b => b.addEventListener('click', () => {
      const m = b.dataset.cr, box = $('#code-req');
      if (crMode === m && !box.hidden) { box.hidden = true; crMode = null; return; }
      crMode = m; box.hidden = false;
      $('#cr-nom-f').hidden = m === 'forgot'; $('#cr-msg-f').hidden = m === 'forgot';
      $('#cr-intro').textContent = m === 'forgot' ? "Indiquez l'adresse e-mail de votre structure : nous vous renvoyons votre code." : 'Votre structure organise régulièrement des événements ? Demandez un code : la mairie vous l’envoie après validation.';
      say($('#cr-out'), '');
      $('#cr-send').disabled = false;
      $('#cr-email').focus();
    }));
    $('#cr-send').addEventListener('click', async () => {
      const email = $('#cr-email').value.trim(), nom = $('#cr-nom').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) { say($('#cr-out'), 'Indiquez une adresse e-mail valide.', 'err'); $('#cr-email').focus(); return; }
      if (crMode === 'new' && !nom) { say($('#cr-out'), 'Indiquez le nom de votre structure.', 'err'); $('#cr-nom').focus(); return; }
      const btn = $('#cr-send'); btn.disabled = true; say($('#cr-out'), 'Envoi…');
      const ok = "C'est noté ! Si votre adresse correspond à un organisateur inscrit, votre code arrive dans quelques minutes.";
      try {
        const d = await api('/code/request', { method: 'POST', body: JSON.stringify({ email, nom: crMode === 'new' ? nom : '', message: crMode === 'new' ? $('#cr-message').value.trim() : '', website: $('#cr-website').value }) });
        say($('#cr-out'), crMode === 'forgot' ? ok : (d.message || ok), 'ok');
      } catch (err) {
        if (crMode === 'forgot' && err.status === 400 && /nom/i.test(err.message)) say($('#cr-out'), ok, 'ok'); // même réponse : on ne révèle pas les adresses connues
        else { say($('#cr-out'), err.status === 429 ? 'Trop de demandes. Réessayez plus tard.' : err.message, 'err'); btn.disabled = false; }
      }
    });

    // Affiche
    let photoUrl = '', uploading = false;
    $('#f-photo').addEventListener('change', async () => {
      const f = $('#f-photo').files[0]; if (!f) return;
      const out = $('#photo-msg');
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { say(out, 'Format non pris en charge : choisissez un JPG, un PNG ou un WebP.', 'err'); return; }
      if (f.size > 5 * 1024 * 1024) { say(out, 'Image trop lourde : 5 Mo maximum.', 'err'); return; }
      const im = $('#drop-img'); im.src = URL.createObjectURL(f); im.alt = 'Aperçu de l’affiche'; im.hidden = false; $('#drop-empty').hidden = true; $('#drop').classList.add('filled');
      uploading = true; photoUrl = ''; say(out, 'Envoi de l’affiche…');
      try {
        const fd = new FormData(); fd.append('image', f);
        const d = await api('/upload', { method: 'POST', body: fd });
        if (!d.url) throw new Error();
        photoUrl = d.url; say(out, 'Affiche ajoutée. Cliquez dessus pour la changer.', 'ok');
      } catch (_) { say(out, "L'affiche n'a pas pu être envoyée. Réessayez, ou envoyez l'événement sans affiche.", 'err'); }
      uploading = false;
    });

    // Tarifs rapides et récurrence
    $$('[data-tarif]').forEach(b => b.addEventListener('click', () => { $('#f-tarif').value = b.dataset.tarif; $$('[data-tarif]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
    $$('[data-tarif]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    $('#f-tarif').addEventListener('input', () => $$('[data-tarif]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.tarif === $('#f-tarif').value))));
    $('#f-rec').addEventListener('change', () => { $('#f-periode-f').hidden = $('#f-rec').value === 'Aucune'; });

    // Envoi
    const form = $('#ev-form');
    const err = (txt, ids = []) => {
      $$('[aria-invalid]').forEach(n => n.removeAttribute('aria-invalid'));
      ids.forEach(i => $(i).setAttribute('aria-invalid', 'true'));
      $('#form-err').textContent = txt || '';
      if (ids[0]) $(ids[0]).focus();
    };
    form.addEventListener('input', ev => { if (ev.target.hasAttribute('aria-invalid')) ev.target.removeAttribute('aria-invalid'); });
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const titre = $('#f-titre').value.trim(), cat = $('#f-cat').value, commune = $('#f-commune').value.trim();
      const miss = [!titre && '#f-titre', !cat && '#f-cat', !commune && '#f-commune'].filter(Boolean);
      if (miss.length) return err('Il manque ' + miss.map(i => ({ '#f-titre': 'le nom de l’événement', '#f-cat': 'la catégorie', '#f-commune': 'la commune' })[i]).join(', ') + '.', miss);
      const d1 = $('#f-date').value, d2 = $('#f-date-fin').value;
      if (d1 && d2 && d2 < d1) return err('La date de fin est avant la date de début.', ['#f-date-fin']);
      if (!$('#f-consent').checked) return err('Cochez la case d’accord pour que la mairie puisse publier votre événement.', ['#f-consent']);
      if (uploading) return err('L’affiche est encore en cours d’envoi, patientez une seconde.');
      err('');
      const fields = { 'Titre': titre, 'Catégorie': cat, 'Commune': commune };
      const put = (k, id) => { const v = $(id).value.trim(); if (v) fields[k] = v; };
      put('Date', '#f-date'); put('Date de fin', '#f-date-fin'); put('Heure', '#f-heure'); put('Lieu', '#f-lieu');
      put('Description', '#f-desc'); put('Tarif', '#f-tarif'); put('Organisation', '#f-org');
      if ($('#f-rec').value !== 'Aucune') { fields['Récurrence'] = $('#f-rec').value; put('Jour/Période', '#f-periode'); }
      const ig = $('#f-ig').value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/?$/, '').replace(/^@/, '');
      const fb = $('#f-fb').value.trim().replace(/^https?:\/\/(www\.)?(facebook|fb)\.com\//, '').replace(/\/?(\?.*)?$/, '').replace(/^@/, '');
      let site = $('#f-site').value.trim(); if (site && !/^https?:/.test(site)) site = 'https://' + site;
      const soc = [ig && 'IG:' + ig, fb && 'FB:' + fb, site && 'Site:' + site].filter(Boolean).join(' | ');
      if (soc) fields['Contact'] = soc;
      put('Contact privé', '#f-cprive'); put('Message privé', '#f-mprive');
      if (photoUrl) fields.photoUrl = photoUrl;
      if ($('#f-website').value) fields.website = $('#f-website').value;
      const btn = $('#f-send'); btn.disabled = true; btn.textContent = 'Envoi…';
      try {
        await api('/events', { method: 'POST', body: JSON.stringify(fields) });
        form.hidden = true; $('#code-box').hidden = true;
        const done = $('#form-done'); done.hidden = false; done.focus();
        done.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      } catch (e2) {
        err(e2.status === 429 ? 'Trop d’envois en peu de temps. Réessayez dans quelques minutes.' : `L'envoi n'a pas abouti (${e2.message}). Réessayez dans un instant.`);
      }
      btn.disabled = false; btn.textContent = 'Envoyer l’événement';
    });
    $('#form-again').addEventListener('click', () => {
      form.reset(); photoUrl = ''; $('#drop-img').hidden = true; $('#drop-empty').hidden = false; $('#drop').classList.remove('filled'); say($('#photo-msg'), '');
      $('#f-periode-f').hidden = true; $$('[data-tarif]').forEach(x => x.setAttribute('aria-pressed', 'false'));
      form.hidden = false; $('#code-box').hidden = false; $('#form-done').hidden = true; $('#f-titre').focus();
    });
  }

  /* ── Votre avis ── */
  function setupAvis() {
    const stars = $('#stars'); let note = 0;
    const btns = [1, 2, 3, 4, 5].map(n => {
      const b = el('button', 'star'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
      b.setAttribute('aria-label', `${n} sur 5`); b.tabIndex = n === 1 ? 0 : -1;
      b.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';
      b.addEventListener('click', () => set(n));
      b.addEventListener('keydown', ev => { if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') { ev.preventDefault(); set(Math.min(5, n + 1), true); } if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') { ev.preventDefault(); set(Math.max(1, n - 1), true); } });
      stars.appendChild(b); return b;
    });
    function set(n, focus) { note = n; btns.forEach((b, i) => { b.classList.toggle('on', i < n); b.setAttribute('aria-checked', String(i + 1 === n)); b.tabIndex = i + 1 === n ? 0 : -1; }); if (focus) btns[n - 1].focus(); }
    $('#avis-open').addEventListener('click', () => { $('#avis-out').textContent = ''; $('#avis-send').disabled = false; openDialog($('#avis')); });
    $('#avis-send').addEventListener('click', async () => {
      const out = $('#avis-out');
      if (!note) { out.className = 'form-msg err'; out.textContent = 'Choisissez une note de 1 à 5 étoiles.'; btns[0].focus(); return; }
      $('#avis-send').disabled = true; out.className = 'form-msg'; out.textContent = 'Envoi…';
      try {
        await api('/avis', { method: 'POST', body: JSON.stringify({ note, commentaire: $('#avis-txt').value.trim(), page: location.pathname + location.hash }) });
        out.className = 'form-msg ok'; out.textContent = 'Merci ! Votre avis a bien été transmis à la mairie.';
        $('#avis-txt').value = ''; set(0);
        btns.forEach(b => b.classList.remove('on')); btns[0].tabIndex = 0;
      } catch (err) { out.className = 'form-msg err'; out.textContent = err.status === 429 ? 'Vous avez déjà donné votre avis récemment. Merci !' : 'Envoi impossible pour le moment. Réessayez plus tard.'; $('#avis-send').disabled = false; }
    });
  }

  /* ── Navigation entre les pages ── */
  const LEGAL = { mentions: 'Mentions légales', confidentialite: 'Confidentialité', cookies: 'Cookies', accessibilite: 'Accessibilité' };
  const HOME_ANCHORS = ['rendez-vous', 'envies', 'organisateurs', 'top', 'contenu'];
  let pendingEvent = null;
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    let view = 'home';
    if (h === 'partager' || h === 'proposer') view = 'partager';
    else if (LEGAL[h]) view = 'legal';
    const was = $$('.view').find(v => !v.hidden);
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
    $$('[data-nav]').forEach(a => { if (a.dataset.nav === view && view !== 'home') a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    top.classList.toggle('on-page', view !== 'home');
    if (openDlg) closeDialog();
    if (view === 'legal') {
      Object.keys(LEGAL).forEach(k => { $('#tab-' + k).hidden = k !== h; const a = $(`[data-tab="${k}"]`); if (k === h) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      $('#legal-title').textContent = LEGAL[h];
      document.title = `${LEGAL[h]} — laSave`;
    } else if (view === 'partager') document.title = 'Ajouter un événement — laSave';
    else document.title = 'laSave — Sortir dans la vallée de la Save';
    const changed = was && was.id !== 'view-' + view;
    if (view === 'home') {
      flowRender(); fitAll();
      const m = h.match(/^event-(rec\w+)$/);
      if (m) { const e = ALL.find(x => x.id === m[1]); if (e) openEvent(e); else pendingEvent = m[1]; }
      else if (h && HOME_ANCHORS.includes(h)) { const t = document.getElementById(h); if (t) requestAnimationFrame(() => t.scrollIntoView({ behavior: changed || reduce ? 'auto' : 'smooth' })); }
      else if (changed || !h) window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
      if (changed) $('#contenu').focus({ preventScroll: true });
      fitAll();
    }
    onScroll();
  }
  window.addEventListener('hashchange', route);
  $('.top-logo').addEventListener('click', ev => { if (!location.hash || location.hash === '#') { ev.preventDefault(); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); } });

  /* ── Interrupteur des animations (pied de page) ── */
  function bindMotion() {
    const b = $('#motion');
    const paint = () => { b.textContent = motion.still ? 'Animations : désactivées' : 'Animations : activées'; b.setAttribute('aria-pressed', String(motion.still)); document.documentElement.classList.toggle('still', motion.still); };
    b.addEventListener('click', () => {
      motion.still = !motion.still;
      try { localStorage.setItem('lasave_motion', motion.still ? 'off' : 'on'); } catch (_) {}
      motion.subs.forEach(fn => fn(motion.still)); paint();
    });
    paint();
  }

  /* ── Démarrage ── */
  setupForm();
  setupAvis();
  bindMotion();
  route();
  (async () => {
    try { ALL = await api('/events'); } catch (e) { console.warn('events', e); }
    try { ORGAS = await api('/orgas'); } catch (e) { console.warn('orgas', e); }
    UP = ALL.filter(isActive).sort((a, b) => sortKey(a) - sortKey(b));
    buildHero(UP);
    buildFlow(UP);
    buildRows(UP);
    buildOrgs(ORGAS);
    fitAll();
    if (pendingEvent) { const e = ALL.find(x => x.id === pendingEvent); pendingEvent = null; if (e && !$('#view-home').hidden) openEvent(e); }
  })();
})();
