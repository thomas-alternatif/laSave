/* laSave — test13 : site complet (accueil, fiches, organisateurs, partager, pages d'information) */
(() => {
  'use strict';
  const API = 'https://go.la-save.fr', PART = 'https://partage.la-save.fr'; // go = échanges du site avec l'API · partage = liens vus par le public
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
    { title: "Envie d'une belle soirée ?", kicker: 'Concerts, spectacles & festivals', stamp: ['Concerts, spectacles', '& festivals'], cats: ['Concert', 'Spectacle', 'Festival'], color: '#FFA823' },
    { title: 'Et si vous vous lanciez ?', kicker: 'Ateliers & conférences', stamp: ['Ateliers', '& conférences'], cats: ['Conférence / Atelier'], color: '#C955E0' },
    { title: 'Transformez vos envies en énergie', kicker: 'Sport & loisirs', stamp: ['Sport', '& loisirs'], cats: ['Sport / Loisir'], color: '#5C96AB' },
    { title: 'À découvrir dans la vallée', kicker: 'Marchés, fêtes, guinguettes & expositions', stamp: ['Marchés, fêtes,', 'guinguettes & expositions'], cats: ['Guinguette', 'Marché', 'Fête & Célébration', 'Exposition', 'Autre'], color: '#C8A96E' },
  ];

  /* ── Outils ── */
  const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = () => day0(new Date());
  const isRec = e => e['Récurrence'] && e['Récurrence'] !== 'Aucune';
  // Événement qui se répète mais dont la date de départ est passée : on n'affiche plus la vieille date, seulement le rythme (« chaque samedi… »)
  const stale = e => isRec(e) && e.Date && new Date(e.Date + 'T12:00:00') < today();
  const isActive = e => isRec(e) || (e['Date de fin'] ? new Date(e['Date de fin']) >= today() : (e.Date ? new Date(e.Date) >= today() : true));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const orgName = v => Array.isArray(v) ? v.join(', ') : String(v || '');
  const attUrl = a => a ? ((a.thumbnails && a.thumbnails.large) ? a.thumbnails.large.url : a.url) : null;
  const photoOf = e => attUrl(e.Photo && e.Photo[0]) || catOf(e)[1];
  const fullPhoto = e => (e.Photo && e.Photo[0] && e.Photo[0].url) || photoOf(e);
  const hour = e => e.Heure ? String(e.Heure).replace(':', 'h') : '';
  const fmt = (d, o) => new Date(d).toLocaleDateString('fr-FR', o).replace(/\./g, '');
  const whenOf = e => {
    if (!e.Date || stale(e)) return isRec(e) ? (e['Jour/Période'] || e['Période'] || e['Récurrence'] || '') : '';
    let s = fmt(e.Date, { weekday: 'short', day: 'numeric', month: 'short' });
    if (e.Heure) s += ' · ' + hour(e);
    return s;
  };
  const sortKey = e => e.Date && !stale(e) ? Math.max(new Date(e.Date).getTime(), Date.now()) : 9e15;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const img = (src, alt = '') => { const i = new Image(); i.src = src; i.alt = alt; i.loading = 'lazy'; i.decoding = 'async'; return i; };
  const bg = (node, src) => { node.style.backgroundImage = src ? `url("${String(src).replace(/["\\\n]/g, '')}")` : ''; };
  // Titre sans coupure : les mots composés (Saint-Jean) restent entiers
  const title = (node, text) => {
    node.replaceChildren();
    String(text || '').replace(/ ([?!:;»])/g, '\u00a0$1').replace(/(«) /g, '$1\u00a0').split(/(\s+)/).forEach(w => { if (/\S-\S/.test(w)) node.appendChild(el('span', 'nw', w)); else node.appendChild(document.createTextNode(w)); });
    return node;
  };
  const tel = (tag, cls, text) => title(el(tag, cls), text);
  const initials = n => (String(n).split(/[\s'’-]+/).filter(w => w.length > 2).map(w => w[0]).join('').slice(0, 2) || String(n).slice(0, 2)).toUpperCase();
  const TINTS = ['#E4572E', '#C8A96E', '#5C96AB', '#8A4FB0'];
  const tintOf = n => TINTS[[...String(n)].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
  async function api(path, opt = {}) {
    const h = opt.body && !(opt.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {};
    let r; try { r = await fetch(API + path, { ...opt, headers: { Accept: 'application/json', ...h } }); } catch (_) { throw Object.assign(new Error('Connexion impossible : vérifiez votre réseau.'), { status: 0 }); }
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
      const n = btn.querySelector('.heart-n'); if (n) { n.textContent = e.Likes || 0; n.hidden = (e.Likes || 0) < 3; } // un « 0 » décourage : le nombre n'apparaît qu'à partir de 3
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
  const shareUrl = e => `${PART}/${e.Lien ? encodeURIComponent(e.Lien) : "e/" + encodeURIComponent(e.id)}`;
  const gcalUrl = (e, r = range(e)) => 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(e.Titre || 'Événement') + '&dates=' + r.s + '/' + r.f + '&details=' + encodeURIComponent((e.Description || '').slice(0, 800) + '\n\n' + shareUrl(e)) + '&location=' + encodeURIComponent([e.Lieu, e.Commune].filter(Boolean).join(', ')) + (r.allDay ? '' : '&ctz=Europe/Paris');
  // Ajout direct à l'agenda du téléphone : Calendrier sur iPhone (fichier .ics), Google Agenda sur Android
  const isApple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function addToPhone(e) {
    if (!range(e)) return;
    if (!isApple && /Android/i.test(navigator.userAgent)) {
      try { navigator.sendBeacon(API + '/stat', new Blob([JSON.stringify({ t: 'agenda', id: e.id, c: 'google' })], { type: 'text/plain' })); } catch (_) {}
      window.open(gcalUrl(e), '_blank', 'noopener');
    } else location.href = `${PART}/ics/${encodeURIComponent(e.Lien || e.id)}`;
  }
  let curEvent = null;
  function calendar(e) {
    const r = range(e), where = [e.Lieu, e.Commune].filter(Boolean).join(', ');
    const g = $('#cal-google'), menu = $('#ev-cal').closest('.menu');
    menu.hidden = !r;
    if (!r) return;
    g.href = gcalUrl(e, r);
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
  const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  $('#ev-cal').addEventListener('click', ev => { ev.stopPropagation(); if (touch && curEvent) { addToPhone(curEvent); return; } const m = $('#ev-cal-menu'); m.hidden = !m.hidden; $('#ev-cal').setAttribute('aria-expanded', String(!m.hidden)); });
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
    curEvent = e; calendar(e); closeCalMenu();
    $('#ev-msg').textContent = '';
    // Billetterie (Festik ou autre) : bouton « Prendre ma place » si l'événement a un lien
    const tk = $('#ev-ticket'), link = String(e.Billetterie || '').trim();
    tk.hidden = !/^https:\/\//.test(link);
    if (!tk.hidden) { tk.href = link; tk.setAttribute('aria-label', `Prendre ma place pour ${e.Titre || 'cet événement'} (ouvre la billetterie)`); }
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
  function openProfile(o, from) {
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
    const d = $('#profile'), card = d.querySelector('.pro');
    const game = !motion.still && !reduce;
    d.classList.toggle('game', game);
    [...card.children].filter(n => !n.classList.contains('x')).forEach((n, i) => n.style.setProperty('--d', (0.42 + i * 0.07).toFixed(2) + 's'));
    [...ul.children, ...box.children].forEach((n, i) => n.style.setProperty('--d', (0.62 + i * 0.05).toFixed(2) + 's'));
    openDialog(d);
    if (game) {
      const r = card.getBoundingClientRect();
      const f = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null;
      card.style.setProperty('--ox', (f ? f.left + f.width / 2 - (r.left + r.width / 2) : 0).toFixed(0) + 'px');
      card.style.setProperty('--oy', (f ? f.top + f.height / 2 - (r.top + r.height / 2) : 0).toFixed(0) + 'px');
      card.style.setProperty('--os', (f ? Math.max(.08, f.width / r.width) : .2).toFixed(3));
    }
    fit($('#pro-name'), 22);
  }

  /* ── En-tête qui se remplit au défilement ── */
  const top = $('#top');
  const onScroll = () => top.classList.toggle('solid', window.scrollY > 40 || top.classList.contains('on-page'));
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── 1. À la une ── */
  function buildHero(events) {
    // Seuls les événements cochés « À la une » passent ici ; si aucun n'est coché, on montre les 3 prochains pour ne pas laisser la une vide
    let feats = events.filter(e => e['À la une'] && photoOf(e));
    if (!feats.length) feats = events.filter(e => photoOf(e)).slice(0, 3);
    const hero = $('.hero');
    if (!feats.length) { $$('.hero-arr, .hero-foot, #hero-open, #hero-heart').forEach(n => { n.hidden = true; }); return; }
    if (feats.length < 2) $$('.hero-arr, .hero-foot').forEach(n => { n.hidden = true; });
    $('#hero-total').textContent = String(feats.length).padStart(2, '0');
    let cur = 0, paused = motion.still, t0 = 0, raf = 0, hold = false;
    const HERO_MS = 4500; // temps entre deux événements
    // Un point par événement : le point doré est celui qu'on voit ; on peut cliquer pour y aller
    const dots = $('#hero-dots'), dotEls = feats.map((e, i) => {
      const b = el('button'); b.type = 'button'; b.setAttribute('aria-label', `Événement ${i + 1} sur ${feats.length} : ${e.Titre || 'Événement'}`);
      b.appendChild(el('i')); b.addEventListener('click', () => { show(i); restart(); }); dots.appendChild(b); return b;
    });
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
      dotEls.forEach((d, k) => { d.classList.toggle('on', k === cur); if (k === cur) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
      bindHeart('#hero-heart', e);
    }
    function progress(ts) {
      if (!t0) t0 = ts;
      if (ts - t0 >= HERO_MS) { t0 = 0; show(cur + 1); }
      raf = requestAnimationFrame(progress);
    }
    function restart() { cancelAnimationFrame(raf); t0 = 0; if (!paused && !hold && feats.length > 1) raf = requestAnimationFrame(progress); }
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
    const list = events.filter(e => e.Date && new Date(e.Date + 'T12:00:00') <= limit && !stale(e) && !['Conférence / Atelier', 'Sport / Loisir'].includes(e['Catégorie'])).slice(0, 16);
    if (!list.length) { stage.appendChild(el('p', 'empty', 'Aucun événement daté dans les 30 prochains jours.')); $('.flow-ctrl').hidden = true; return; }
    let cur = Math.min(2, list.length - 1), chipSync = null;
    const cards = list.map((e, i) => {
      const c = el('div', 'fcard');
      c.setAttribute('role', 'button'); c.tabIndex = -1;
      c.setAttribute('aria-label', `${e.Titre || 'Événement'}, ${whenOf(e)}`);
      const inner = el('div', 'fcard-in');
      const p = photoOf(e); if (p) inner.appendChild(img(p));
      const cap = el('div', 'fcard-cap');
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
      showDate(list[cur]);
      if (chipSync) chipSync();
    }
    // Date de l'événement du milieu, sous la carte : les lettres remontent une à une
    let lastDate = '';
    function showDate(e) {
      const box = $('#flow-date'); if (!box || !e || !e.Date) return;
      const d = new Date(e.Date + 'T12:00:00'), t0 = today(); t0.setHours(12);
      const n = Math.round((d - t0) / 864e5), fin = e['Date de fin'] ? new Date(e['Date de fin'] + 'T12:00:00') : null;
      const rel = n < 0 ? (fin && fin >= t0 ? 'En ce moment' : '') : n === 0 ? 'Aujourd’hui' : n === 1 ? 'Demain' : `Dans ${n} jours`;
      const jour = d.toLocaleDateString('fr-FR', { weekday: 'long' });
      const mois = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const key = [e.id, rel, jour, d.getDate(), mois, e.Heure || '', e.Commune || ''].join('|');
      if (key === lastDate) return; lastDate = key;
      // Petite page de calendrier (mois + jour) qui se tourne, et le jour de la semaine à côté
      const cal = el('span', 'fd-cal'); cal.setAttribute('aria-hidden', 'true');
      cal.append(el('span', 'fd-m', mois), el('span', 'fd-d', String(d.getDate())));
      const txt = el('span', 'fd-txt');
      txt.append(el('b', null, jour), el('small', null, [e.Heure ? hour(e) : '', rel].filter(Boolean).join(' · ')));
      if (e.Commune) txt.appendChild(el('small', 'fd-lieu', e.Commune));
      const sr = el('span', 'sr', `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'long' })}`);
      // Sur téléphone, toute la date est un bouton qui ouvre directement l'agenda : Calendrier (Apple) ou Google Agenda, avec leurs couleurs
      const os = !touch ? '' : isApple ? 'apple' : /Android/i.test(navigator.userAgent) ? 'google' : 'other';
      box.dataset.os = os;
      if (os) {
        const app = { apple: 'Calendrier', google: 'Google Agenda', other: 'mon agenda' }[os];
        const act = el('span', 'fd-act', `Ajouter à ${app}`);
        txt.appendChild(act);
        const tap = el('button', 'fd-tap'); tap.type = 'button';
        tap.setAttribute('aria-label', `Ajouter « ${e.Titre || 'cet événement'} » à ${app}`);
        tap.append(cal, txt);
        tap.addEventListener('click', ev => { ev.stopPropagation(); act.textContent = 'Ouverture…'; tap.classList.add('ok'); addToPhone(e); setTimeout(() => { act.textContent = `Ajouter à ${app}`; tap.classList.remove('ok'); }, 1800); });
        box.replaceChildren(tap, sr);
      } else box.replaceChildren(cal, txt, sr);
      play();
    }
    // Rejoue l'effet quand la date arrive à l'écran (sinon il se joue hors de vue)
    function play() { const box = $('#flow-date'); if (!box) return; box.classList.remove('go'); void box.offsetWidth; box.classList.add('go'); }
    if ('IntersectionObserver' in window && $('#flow-date')) {
      let vu = false;
      new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting && !vu) { vu = true; play(); } else if (!x.isIntersecting) vu = false; }), { threshold: .6 }).observe($('#flow-date'));
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
    // Raccourcis « Ce week-end » / « Gratuit » : le carrousel saute au prochain événement concerné (un clic de plus passe au suivant)
    {
      const t0 = today(), dow = t0.getDay(), fin = new Date(t0); fin.setDate(fin.getDate() + ((7 - dow) % 7));
      const weekend = e => {
        const d = new Date(e.Date + 'T12:00:00'); if (d < t0 || d > fin) return false;
        const w = d.getDay(); return w === 6 || w === 0 || (w === 5 && parseInt(String(e.Heure || '0'), 10) >= 17);
      };
      const free = e => /^\s*(gratuit|entr[ée]e libre|libre)\b/i.test(String(e.Tarif || ''));
      const sets = { weekend: list.map((e, i) => weekend(e) ? i : -1).filter(i => i >= 0), free: list.map((e, i) => free(e) ? i : -1).filter(i => i >= 0) };
      const bar = $('#qpick'), btns = $$('#qpick .qchip');
      if (bar && btns.length) {
        let any = false;
        btns.forEach(b => {
          const s = sets[b.dataset.q] || [];
          if (!s.length) { b.hidden = true; return; }
          any = true; b.querySelector('b').textContent = s.length;
          b.addEventListener('click', () => { const nxt = s.find(i => i > cur) ?? s[0]; go(nxt); tick(); });
        });
        bar.hidden = !any;
        chipSync = () => btns.forEach(b => { const s = sets[b.dataset.q] || []; b.setAttribute('aria-pressed', String(s.includes(cur))); });
      }
    }
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
    if (/^https:\/\//.test(String(e.Billetterie || ''))) pi.appendChild(el('span', 'tix', 'Billets'));
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
      if (r.evs.length <= 3) sec.classList.add('few');
      sec.style.setProperty('--c', r.color);
      const head = el('div', 'row-block');
      const t = el('div', 'row-block-text');
      // Tampon façon « Cinéma Cinéma » : pavés noirs penchés, qui peuvent déborder du rectangle
      const st = el('p', 'stamp'); st.setAttribute('aria-label', r.kicker); const sp = el('span', null, r.kicker); sp.setAttribute('aria-hidden', 'true'); st.appendChild(sp); t.appendChild(st);
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
      // Quand tout tient déjà à l'écran, « Voir tout » et les flèches ne servent à rien : on les cache
      const fits = () => sec.classList.toggle('fits', !sec.classList.contains('open') && track.scrollWidth <= track.clientWidth + 4);
      if ('ResizeObserver' in window) new ResizeObserver(fits).observe(track); else fits();
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
      if (ph) { const i = img(ph); i.draggable = false; b.appendChild(i); } else { b.appendChild(el('span', 'org-ini', initials(o.Nom))); b.style.background = tintOf(o.Nom); }
      b.appendChild(el('span', 'org-name', o.Nom));
      b.addEventListener('click', () => openProfile(o._dup ? ORGAS.find(x => x.id === o.id) || o : o, b));
      row.appendChild(b); return b;
    };
    while (k < list.length) {
      if (slots.length % 3 === 1 && k + 1 < list.length) { slots.push([bubble(list[k]), bubble(list[k + 1])]); k += 2; }
      else { slots.push([bubble(list[k])]); k++; }
    }
    const N = slots.length;
    const erf = x => { const t = 1 / (1 + .3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x < 0 ? -y : y; };
    let off = 0, last = 0, hold = false, paused = motion.still, vel = 0, goal = null, drag = null, moved = false;
    const unit = () => row.clientWidth < 720 ? 100 : 150; // pixels pour passer d'une bulle à la suivante
    const hover = window.matchMedia('(hover: hover)').matches;
    // Effet « balles » : chaque bulle suit sa place avec un ressort (elle dépasse un peu puis se cale),
    // rebondit doucement sur place, et s'écrase légèrement quand elle change de taille
    let clock = 0;
    function place(b, tx, ty, ts, dt, i) {
      const k = Math.min(2, dt / 16);
      if (b._x == null || Math.abs(tx - b._x) > row.clientWidth * .5) { b._x = tx; b._s = ts; b._vx = 0; b._vs = 0; } // passage d'un bord à l'autre : pas de ressort
      b._x += (tx - b._x) * (1 - Math.pow(.84, k)); if (Math.abs(tx - b._x) < .05) b._x = tx; b._vx = 0; // glisse doucement vers sa place, sans rebond
      b._s += (ts - b._s) * (1 - Math.pow(.86, k)); if (Math.abs(ts - b._s) < .05) b._s = ts; b._vs = 0;
      const sz = Math.max(8, b._s);
      const hop = still() ? 0 : Math.sin(clock * .0011 + i * 1.9) * sz * .03; // flottement lent, comme en apesanteur
      const squash = 0;
      b.style.setProperty('--sz', sz.toFixed(1) + 'px');
      b.style.transform = `translate(${(b._x - sz / 2).toFixed(1)}px, ${(ty - sz / 2 - hop).toFixed(1)}px) scale(var(--hs, 1))`; // --hs : léger grossissement au survol (voir style.css)
    }
    const still = () => motion.still || reduce;
    function layout(dt) {
      const W = row.clientWidth, H = row.clientHeight;
      if (!W) return;
      const mob = W < 720;
      // Bulles presque collées les unes aux autres
      const Smax = mob ? 176 : 262, Smin = mob ? 70 : 104, sig = mob ? 1.3 : 1.8, gap = mob ? 2 : 3;
      const X = u => (Smin + gap) * u + (Smax - Smin) * sig * Math.sqrt(Math.PI) / 2 * erf(u / sig);
      slots.forEach((sl, i) => {
        let u = ((i - off) % N + N) % N; if (u > N / 2) u -= N;
        const s = Smin + (Smax - Smin) * Math.exp(-((u / sig) ** 2));
        const x = W / 2 + X(u);
        if (sl.length === 1) {
          place(sl[0], x, H / 2, s, dt, i);
          sl[0].classList.toggle('big', Math.abs(u) < .5);
        } else {
          const t = s * .56; // deux bulles en quinconce, serrées l'une contre l'autre
          sl.forEach((b, j) => { const d = j ? 1 : -1; place(b, x + d * t * .4, H / 2 + d * (t * .47 + gap / 2), t, dt, i * 2 + j); b.classList.remove('big'); });
        }
      });
    }
    function frame(ts) {
      const dt = last ? Math.min(50, ts - last) : 16; last = ts; const over = hover && row.matches(':hover'); if (!hold && !over && !paused && !drag) clock += dt; // le flottement s'arrête sous la souris
      if (goal != null) { off += (goal - off) * Math.min(1, dt * .012); if (Math.abs(goal - off) < .002) { off = goal; goal = null; } }
      else if (!drag && Math.abs(vel) > 1e-5) { off += vel * dt; vel *= Math.pow(.93, dt / 16); }
      else if (!paused && !hold && !over && !drag && !openDlg) off += dt * 0.00028;
      layout(dt);
      requestAnimationFrame(frame);
    }
    // Souris sur la ronde : elle s'arrête, pour viser tranquillement même les petites photos
    row.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse') hold = true; });
    row.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') hold = false; });
    // Glisser (souris ou doigt) pour faire défiler, avec un peu d'élan au lâcher
    row.addEventListener('pointerdown', ev => { if (ev.button) return; drag = { x: ev.clientX, off, lx: ev.clientX, t: performance.now() }; moved = false; vel = 0; goal = null; });
    window.addEventListener('pointermove', ev => {
      if (!drag) return;
      const dx = ev.clientX - drag.x;
      if (!moved && Math.abs(dx) > 6) { moved = true; row.classList.add('dragging'); }
      if (!moved) return;
      const now = performance.now();
      off = drag.off - dx / unit();
      vel = -(ev.clientX - drag.lx) / unit() / Math.max(8, now - drag.t);
      drag.lx = ev.clientX; drag.t = now;
    });
    const endDrag = () => { if (!drag) return; drag = null; row.classList.remove('dragging'); if (Math.abs(vel) > .004) vel = Math.sign(vel) * .004; };
    window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', endDrag);
    row.addEventListener('click', ev => { if (moved) { ev.stopPropagation(); ev.preventDefault(); moved = false; } }, true);
    // Molette : horizontale (pavé tactile) ou Maj + molette
    row.addEventListener('wheel', ev => {
      const d = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : (ev.shiftKey ? ev.deltaY : 0);
      if (!d) return;
      ev.preventDefault(); goal = null; vel = 0; off += d / unit();
    }, { passive: false });
    // Flèches discrètes
    $('#orgs-prev').addEventListener('click', () => { vel = 0; goal = Math.round(goal ?? off) - 1; });
    $('#orgs-next').addEventListener('click', () => { vel = 0; goal = Math.round(goal ?? off) + 1; });
    row.addEventListener('focusin', ev => { if (!keyFocus(ev.target)) return; hold = true; const i = slots.findIndex(sl => sl.includes(ev.target)); if (i >= 0) goal = i; });
    row.addEventListener('focusout', ev => { if (!row.contains(ev.relatedTarget)) hold = false; });
    onMotion(p => { paused = p; });
    requestAnimationFrame(frame);
  }

  /* ── Page « Partager » ── */
  function setupForm() {
    // Choix de la commune : recherche tolérante (tirets, accents, « st » pour « saint »), la commune de la mairie en premier
    {
      const inp = $('#f-commune'), ul = $('#communes-list'); let act = -1, shown = [];
      const key = s => norm(s).replace(/\bst\b/g, 'saint').replace(/\bste\b/g, 'sainte');
      const HOME = 'Saint-Paul-sur-Save';
      const close = () => { ul.hidden = true; inp.setAttribute('aria-expanded', 'false'); act = -1; };
      const pick = c => { inp.value = c; close(); inp.dispatchEvent(new Event('input', { bubbles: true })); };
      const paint = () => { [...ul.children].forEach((li, i) => { li.classList.toggle('on', i === act); li.setAttribute('aria-selected', String(i === act)); }); };
      const open = () => {
        const q = key(inp.value), ws = q.split(' ').filter(Boolean);
        shown = COMMUNES.filter(c => { const k = key(c); return ws.every(w => k.includes(w)); })
          .sort((a, b) => (key(b).startsWith(q) - key(a).startsWith(q)) || (b === HOME) - (a === HOME) || a.localeCompare(b, 'fr'));
        if (!q) shown.sort((a, b) => (b === HOME) - (a === HOME) || a.localeCompare(b, 'fr'));
        ul.replaceChildren(...shown.map((c, i) => { const li = el('li', '', c); li.setAttribute('role', 'option'); li.addEventListener('mousedown', ev => { ev.preventDefault(); pick(c); }); return li; }));
        ul.hidden = !shown.length; inp.setAttribute('aria-expanded', String(!!shown.length)); act = -1;
      };
      inp.addEventListener('input', open); inp.addEventListener('focus', open);
      inp.addEventListener('blur', () => { close(); const k = key(inp.value); const m = COMMUNES.find(c => key(c) === k); if (m) inp.value = m; });
      inp.addEventListener('keydown', ev => {
        if (ul.hidden && ev.key === 'ArrowDown') { open(); return; }
        if (ul.hidden) return;
        if (ev.key === 'ArrowDown') { ev.preventDefault(); act = (act + 1) % shown.length; paint(); }
        else if (ev.key === 'ArrowUp') { ev.preventDefault(); act = (act - 1 + shown.length) % shown.length; paint(); }
        else if (ev.key === 'Enter' && act >= 0) { ev.preventDefault(); pick(shown[act]); }
        else if (ev.key === 'Escape') { close(); }
      });
    }
    // Code organisateur
    const say = (node, txt, kind) => { node.textContent = txt || ''; node.className = 'form-msg' + (kind ? ' ' + kind : ''); };
    let memberCode = '';
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
        memberCode = code;
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

    /* Formulaire en trois temps : une partie à la fois (sans JavaScript, tout reste affiché) */
    const parts = [...form.querySelectorAll(':scope > fieldset')];
    let stepNow = 0;
    const nav = el('div', 'wiz-nav'), bPrev = el('button', 'wiz-prev', 'Retour'), bNext = el('button', 'glow glass wiz-next');
    bPrev.type = 'button'; bNext.type = 'button';
    bNext.innerHTML = '<span class="glow-t">Continuer</span><svg class="glow-i" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    nav.append(bPrev, bNext);
    const bar = el('nav', 'wiz-bar'); bar.setAttribute('aria-label', 'Étapes du formulaire');
    const barBtns = parts.map((fs, i) => {
      const b = el('button', 'wiz-dot'); b.type = 'button';
      const lg = fs.querySelector('legend'), name = lg ? lg.textContent.replace(/^\d+/, '').trim() : 'Étape ' + (i + 1);
      b.appendChild(el('i', null, String(i + 1)));
      b.appendChild(el('span', null, name));
      b.setAttribute('aria-label', `Étape ${i + 1} sur ${parts.length} : ${name}`);
      b.addEventListener('click', () => { if (i < stepNow) wizGo(i); else if (i > stepNow) { for (let k = stepNow; k < i; k++) if (!wizCheck(k)) return wizGo(k, false); wizGo(i); } });
      bar.appendChild(b); return b;
    });
    form.insertBefore(bar, form.firstChild);
    form.insertBefore(nav, form.querySelector('.submit-row'));
    function wizGo(i, focus = true) {
      stepNow = Math.max(0, Math.min(parts.length - 1, i));
      form.classList.add('wiz');
      form.classList.toggle('at-last', stepNow === parts.length - 1);
      parts.forEach((fs, k) => { fs.classList.toggle('cur', k === stepNow); });
      barBtns.forEach((b, k) => { b.classList.toggle('on', k === stepNow); b.classList.toggle('done', k < stepNow); if (k === stepNow) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      bPrev.hidden = stepNow === 0; bNext.hidden = stepNow === parts.length - 1;
      $('#form-err').textContent = '';
      if (focus) {
        const lg = parts[stepNow].querySelector('legend'); if (lg) { lg.tabIndex = -1; lg.focus({ preventScroll: true }); }
        bar.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      }
    }
    // Vérifie la partie affichée avant de passer à la suivante
    function wizCheck(k) {
      if (k === 0) {
        const titre = $('#f-titre').value.trim(), cat = $('#f-cat').value, commune = $('#f-commune').value.trim();
        const miss = [!titre && '#f-titre', !cat && '#f-cat', !commune && '#f-commune'].filter(Boolean);
        if (miss.length) { err('Il manque ' + miss.map(i => ({ '#f-titre': 'le nom de l’événement', '#f-cat': 'la catégorie', '#f-commune': 'la commune' })[i]).join(', ') + '.', miss); return false; }
        const d1 = $('#f-date').value, d2 = $('#f-date-fin').value;
        if (d1 && d2 && d2 < d1) { err('La date de fin est avant la date de début.', ['#f-date-fin']); return false; }
        if (uploading) { err('L’affiche est encore en cours d’envoi, patientez une seconde.'); return false; }
      }
      if (k === 1) {
        const bil = $('#f-billet').value.trim();
        if (bil && !/^https:\/\/[^\s]+\.[^\s]+/.test(bil)) { err('Le lien de billetterie doit commencer par https://', ['#f-billet']); return false; }
      }
      err(''); return true;
    }
    const wizNext = () => { if (wizCheck(stepNow)) wizGo(stepNow + 1); };
    bNext.addEventListener('click', wizNext);
    bPrev.addEventListener('click', () => wizGo(stepNow - 1));

    const err = (txt, ids = []) => {
      if (ids[0]) { const k = parts.findIndex(fs => fs.contains($(ids[0]))); if (k >= 0 && k !== stepNow) wizGo(k, false); }
      $$('[aria-invalid]').forEach(n => n.removeAttribute('aria-invalid'));
      ids.forEach(i => $(i).setAttribute('aria-invalid', 'true'));
      $('#form-err').textContent = txt || '';
      if (ids[0]) $(ids[0]).focus();
    };
    wizGo(0, false);

    form.addEventListener('input', ev => { if (ev.target.hasAttribute('aria-invalid')) ev.target.removeAttribute('aria-invalid'); });
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      if (stepNow < parts.length - 1) return wizNext(); // touche Entrée : on passe à la partie suivante
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
      const bil = $('#f-billet').value.trim();
      if (bil) { if (!/^https:\/\/[^\s]+\.[^\s]+/.test(bil)) return err('Le lien de billetterie doit commencer par https://', ['#f-billet']); fields['Billetterie'] = bil; }
      if ($('#f-rec').value !== 'Aucune') { fields['Récurrence'] = $('#f-rec').value; put('Jour/Période', '#f-periode'); }
      const ig = $('#f-ig').value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/?$/, '').replace(/^@/, '');
      const fb = $('#f-fb').value.trim().replace(/^https?:\/\/(www\.)?(facebook|fb)\.com\//, '').replace(/\/?(\?.*)?$/, '').replace(/^@/, '');
      let site = $('#f-site').value.trim(); if (site && !/^https?:/.test(site)) site = 'https://' + site;
      const soc = [ig && 'IG:' + ig, fb && 'FB:' + fb, site && 'Site:' + site].filter(Boolean).join(' | ');
      if (soc) fields['Contact'] = soc;
      put('Contact privé', '#f-cprive'); put('Message privé', '#f-mprive');
      if (memberCode) fields.code = memberCode; // la mairie retrouve l'e-mail de la structure pour la prévenir à la publication
      if (photoUrl) fields.photoUrl = photoUrl;
      if ($('#f-website').value) fields.website = $('#f-website').value;
      const btn = $('#f-send'), bt = btn.querySelector('.glow-t'); btn.disabled = true; bt.textContent = 'Envoi…';
      try {
        await api('/events', { method: 'POST', body: JSON.stringify(fields) });
        form.hidden = true; $('#code-box').hidden = true;
        const done = $('#form-done'); done.hidden = false; done.focus();
        done.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      } catch (e2) {
        err(e2.status === 429 ? 'Trop d’envois en peu de temps. Réessayez dans quelques minutes.' : `L'envoi n'a pas abouti (${e2.message}). Réessayez dans un instant.`);
      }
      btn.disabled = false; bt.textContent = 'Envoyer l’événement';
    });
    $('#form-again').addEventListener('click', () => {
      form.reset(); photoUrl = ''; $('#drop-img').hidden = true; $('#drop-empty').hidden = false; $('#drop').classList.remove('filled'); say($('#photo-msg'), '');
      $('#f-periode-f').hidden = true; $$('[data-tarif]').forEach(x => x.setAttribute('aria-pressed', 'false'));
      form.hidden = false; $('#code-box').hidden = false; $('#form-done').hidden = true; wizGo(0, false); memberCode = ''; $('#f-code').value = ''; say($('#code-msg'), ''); $('#code-box').classList.remove('done'); { const cr = $('#code-req'); if (cr) cr.hidden = true; } $('#f-titre').focus();
    });
  }

  /* ── Lettre du mois : inscription à la newsletter ── */
  function setupLettre() {
    const form = $('#nl-form'); if (!form) return;
    const input = $('#nl-email'), msg = $('#nl-msg'), btn = $('#nl-send'), bt = btn.querySelector('.glow-t');
    const say = (t, cls) => { msg.textContent = t; msg.className = 'lettre-msg' + (cls ? ' ' + cls : ''); };
    input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); if (msg.classList.contains('err')) say(''); });
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) { input.setAttribute('aria-invalid', 'true'); input.focus(); return say('Vérifiez votre adresse e-mail, elle semble incomplète.', 'err'); }
      btn.disabled = true; bt.textContent = 'Inscription…'; say('');
      try {
        const d = await api('/newsletter', { method: 'POST', body: JSON.stringify({ email, website: $('#nl-website').value, src: location.pathname.includes('/test') ? 'test' : 'site' }) });
        $('#lettre').classList.add('inscrit');
        say(d.nouveau === false ? 'Vous êtes déjà inscrit, à bientôt dans votre boîte mail !' : 'C’est noté ! Un mail de bienvenue vient de partir (pensez à regarder dans les spams).', 'ok');
      } catch (e) {
        say(e.status === 429 ? 'Trop d’essais en peu de temps, réessayez dans quelques minutes.' : e.message, 'err');
      }
      btn.disabled = false; bt.textContent = 'Je m’inscris';
    });
  }

  /* ── Votre avis ── */
  function setupAvis() {
    const stars = $('#stars'); if (!stars) return;
    let note = 0;
    const MOTS = ['Touchez une étoile', 'Pas terrible', 'Bof', 'Pas mal', 'Bien !', 'Génial !'];
    const btns = [1, 2, 3, 4, 5].map(n => {
      const b = el('button', 'star'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
      b.setAttribute('aria-label', `${n} sur 5`); b.tabIndex = n === 1 ? 0 : -1;
      b.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';
      b.addEventListener('click', () => set(n));
      b.addEventListener('mouseenter', () => paint(n)); b.addEventListener('mouseleave', () => paint(note));
      b.addEventListener('keydown', ev => { if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') { ev.preventDefault(); set(Math.min(5, n + 1), true); } if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') { ev.preventDefault(); set(Math.max(1, n - 1), true); } });
      stars.appendChild(b); return b;
    });
    const paint = n => { btns.forEach((b, i) => b.classList.toggle('on', i < n)); $('#av-word').textContent = MOTS[n]; };
    function set(n, focus) {
      note = n; paint(n);
      btns.forEach((b, i) => { b.setAttribute('aria-checked', String(i + 1 === n)); b.tabIndex = i + 1 === n ? 0 : -1; });
      if (focus) btns[n - 1].focus();
      $('#av-more').hidden = !n; $('#avis-out').textContent = '';
    }
    $('#avis-send').addEventListener('click', async () => {
      const out = $('#avis-out'), btn = $('#avis-send');
      if (!note) return;
      btn.disabled = true; out.className = 'av-out'; out.textContent = 'Envoi…';
      try {
        await api('/avis', { method: 'POST', body: JSON.stringify({ note, commentaire: $('#avis-txt').value.trim(), page: location.pathname + location.hash }) });
        $('#avis-card').classList.add('merci'); out.className = 'av-out ok'; out.textContent = 'Merci ! Votre avis a bien été transmis à la mairie.';
        $('#avis-txt').value = ''; $('#av-more').hidden = true;
      } catch (err) { out.className = 'av-out err'; out.textContent = err.status === 429 ? 'Vous avez déjà donné votre avis récemment. Merci !' : 'Envoi impossible pour le moment. Réessayez plus tard.'; }
      btn.disabled = false;
    });
  }

  /* ── Avis directement dans la carte de l'accueil : on touche une étoile, un mot si on veut, on envoie ── */
  function setupAvisCard() {
    const form = $('#ac-form'); if (!form) return;
    const box = $('#ac-stars'), more = $('#ac-more'), msg = $('#ac-msg'), btn = $('#ac-send'), q = $('#ac-q');
    const MOTS = ['Comment trouvez-vous laSave ?', 'Pas terrible', 'Peut mieux faire', 'Pas mal', 'Très bien', 'Génial !'];
    let note = 0;
    const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>';
    // Au survol, seules les étoiles changent (changer le texte ferait bouger les étoiles sous le doigt)
    const paint = n => btns.forEach((b, i) => b.classList.toggle('on', i < n));
    const btns = [1, 2, 3, 4, 5].map(n => {
      const b = el('button', 'ac-star'); b.type = 'button'; b.innerHTML = star;
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false'); b.setAttribute('aria-label', `${n} sur 5`); b.tabIndex = n === 1 ? 0 : -1;
      b.addEventListener('click', () => pick(n));
      b.addEventListener('mouseenter', () => paint(n)); b.addEventListener('mouseleave', () => paint(note));
      b.addEventListener('keydown', ev => { if (/Right|Up/.test(ev.key)) { ev.preventDefault(); pick(Math.min(5, n + 1), true); } if (/Left|Down/.test(ev.key)) { ev.preventDefault(); pick(Math.max(1, n - 1), true); } });
      box.appendChild(b); return b;
    });
    function pick(n, focus) {
      note = n; paint(n); q.textContent = MOTS[n];
      btns.forEach((b, i) => { b.setAttribute('aria-checked', String(i + 1 === n)); b.tabIndex = i + 1 === n ? 0 : -1; });
      more.hidden = false; msg.textContent = ''; msg.className = 'ac-msg';
      if (focus) btns[n - 1].focus();
    }
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); if (!note) return;
      btn.disabled = true; msg.className = 'ac-msg'; msg.textContent = 'Envoi…';
      try {
        await api('/avis', { method: 'POST', body: JSON.stringify({ note, commentaire: $('#ac-txt').value.trim(), page: location.pathname + '#accueil' }) });
        form.classList.add('ac-ok'); more.hidden = true; q.textContent = 'Merci !';
        msg.textContent = 'Votre avis est bien arrivé à la mairie.';
        btns.forEach(b => { b.disabled = true; b.onmouseenter = null; });
        box.replaceWith(box.cloneNode(true)); // étoiles figées sur la note donnée
      } catch (e) {
        msg.className = 'ac-msg err';
        msg.textContent = e.status === 429 ? 'Vous avez déjà donné votre avis récemment. Merci !' : 'Envoi impossible pour le moment, réessayez plus tard.';
      }
      btn.disabled = false;
    });
  }

  /* ── Page « Tout l'agenda » : liste par jour avec filtres ── */
  const AG = { when: 'all', commune: '', cat: '', free: false };
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (k, n) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
  const isFree = e => /^\s*(gratuit|entr[ée]e libre|libre)\b/i.test(String(e.Tarif || ''));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const evStart = e => stale(e) ? '' : String(e.Date || '').slice(0, 10);
  const evEnd = e => { const s = evStart(e), f = String(e['Date de fin'] || '').slice(0, 10); return f && f > s ? f : s; };
  function agRange(w) {
    const t = ymd(new Date()), dow = new Date(t + 'T12:00:00').getDay(); // 0 = dimanche
    if (w === 'today') return [t, t];
    if (w === 'week') return [t, addDays(t, 6)];
    if (w === 'month') { const d = new Date(); return [t, ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))]; }
    if (w === 'weekend') { const sun = addDays(t, (7 - dow) % 7), fri = addDays(sun, -2); return [fri > t ? fri : t, sun]; }
    return null;
  }
  function agMatch(e, rng) {
    if (AG.commune && e.Commune !== AG.commune) return false;
    if (AG.cat && e['Catégorie'] !== AG.cat) return false;
    if (AG.free && !isFree(e)) return false;
    if (!rng) return true;
    const s = evStart(e); if (!s) return false; // les rendez-vous réguliers sans date n'apparaissent que dans « Tout »
    if (!(s <= rng[1] && evEnd(e) >= rng[0])) return false;
    if (AG.when === 'weekend' && s === evEnd(e) && new Date(s + 'T12:00:00').getDay() === 5 && (parseInt(e.Heure, 10) || 0) < 17) return false; // le vendredi compte à partir de 17 h
    return true;
  }
  function agItem(e) {
    const li = el('li'), b = el('button', 'ag-item'); b.type = 'button';
    const th = el('span', 'ag-thumb'); th.setAttribute('aria-hidden', 'true'); bg(th, photoOf(e)); b.appendChild(th);
    const m = el('span', 'ag-main');
    const s = evStart(e), en = evEnd(e);
    let when = e.Date ? hour(e) : (e['Jour/Période'] || e['Période'] || e['Récurrence'] || '');
    if (s && en > s) when += (when ? ' · ' : '') + 'jusqu’au ' + fmt(en, { day: 'numeric', month: 'short' });
    if (when) m.appendChild(el('span', 'ag-time', when));
    m.appendChild(tel('b', 'ag-name', e.Titre || 'Événement'));
    const meta = [e.Commune, e.Tarif].filter(Boolean).join(' · ');
    if (meta) m.appendChild(el('span', 'ag-meta', meta));
    b.appendChild(m);
    const c = el('span', 'ag-cat', e['Catégorie'] || ''); c.style.setProperty('--c', catOf(e)[0]); if (e['Catégorie']) b.appendChild(c);
    b.addEventListener('click', () => openEvent(e));
    li.appendChild(b); return li;
  }
  function agFill(sel, items, label) {
    sel.replaceChildren(new Option(label, ''));
    items.forEach(([v, n]) => sel.appendChild(new Option(`${v} (${n})`, v)));
  }
  function agSetup() {
    const count = key => { const m = new Map(); UP.forEach(e => { const v = e[key]; if (v) m.set(v, (m.get(v) || 0) + 1); }); return m; };
    agFill($('#ag-commune'), [...count('Commune')].sort((a, b) => a[0].localeCompare(b[0], 'fr')), 'Toutes les communes');
    const cats = count('Catégorie'), order = Object.keys(CATS);
    agFill($('#ag-cat'), [...cats].sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99)), 'Toutes les catégories');
    $$('#view-agenda [data-w]').forEach(b => b.addEventListener('click', () => { AG.when = b.dataset.w; renderAgenda(); }));
    $('#ag-commune').addEventListener('change', ev => { AG.commune = ev.target.value; renderAgenda(); });
    $('#ag-cat').addEventListener('change', ev => { AG.cat = ev.target.value; renderAgenda(); });
    $('#ag-free').addEventListener('click', () => { AG.free = !AG.free; renderAgenda(); });
    $('#ag-reset').addEventListener('click', () => { Object.assign(AG, { when: 'all', commune: '', cat: '', free: false }); $('#ag-commune').value = ''; $('#ag-cat').value = ''; renderAgenda(); });
  }
  function renderAgenda() {
    const root = $('#ag-list'); if (!root || !Array.isArray(UP)) return;
    const rng = agRange(AG.when), t = ymd(new Date());
    // Trois familles : les sorties ponctuelles (jour par jour), puis ce qui dure (expos, festivals de plusieurs jours), puis les rendez-vous qui reviennent
    const dated = [], multi = [], reg = [];
    UP.forEach(e => { if (!agMatch(e, rng)) return; (isRec(e) || !evStart(e) ? reg : evEnd(e) > evStart(e) ? multi : dated).push(e); });
    const k = e => { const s = evStart(e); return s < t ? t : s; };
    dated.sort((a, b) => k(a).localeCompare(k(b)) || (parseInt(a.Heure, 10) || 0) - (parseInt(b.Heure, 10) || 0) || String(a.Titre).localeCompare(String(b.Titre), 'fr'));
    multi.sort((a, b) => evEnd(a).localeCompare(evEnd(b)) || String(a.Titre).localeCompare(String(b.Titre), 'fr'));
    reg.sort((a, b) => String(a.Titre).localeCompare(String(b.Titre), 'fr'));
    root.replaceChildren();
    const section = (heading, list) => {
      const s = el('section', 'ag-day'); s.appendChild(el('h2', 'ag-day-t', heading));
      const ul = el('ul', 'ag-items'); list.forEach(e => ul.appendChild(agItem(e))); s.appendChild(ul); root.appendChild(s);
    };
    const groups = new Map(); dated.forEach(e => { const g = k(e); (groups.get(g) || groups.set(g, []).get(g)).push(e); });
    groups.forEach((list, g) => {
      let hd = cap(fmt(g + 'T12:00:00', { weekday: 'long', day: 'numeric', month: 'long' }));
      if (g === t) hd = 'Aujourd’hui · ' + hd; else if (g === addDays(t, 1)) hd = 'Demain · ' + hd;
      section(hd, list);
    });
    if (multi.length) section('Sur plusieurs jours', multi);
    if (reg.length) section('Rendez-vous réguliers', reg);
    const n = dated.length + multi.length + reg.length;
    if (!n) {
      const p = el('p', 'ag-empty', 'Rien ne correspond à ces filtres pour le moment. '); const r = el('button', 'ag-reset', 'Tout effacer'); r.type = 'button';
      r.addEventListener('click', () => $('#ag-reset').click()); p.appendChild(r); root.appendChild(p);
    }
    $('#ag-count').textContent = `${n} événement${n > 1 ? 's' : ''}`;
    $$('#view-agenda [data-w]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.w === AG.when)));
    $('#ag-free').setAttribute('aria-pressed', String(AG.free));
    $('#ag-reset').hidden = AG.when === 'all' && !AG.commune && !AG.cat && !AG.free;
    const l = $('#ag-lede'); if (l) l.textContent = `${UP.length} événement${UP.length > 1 ? 's' : ''} à venir dans la vallée de la Save, jour après jour.`;
  }

  /* ── Navigation entre les pages ── */
  const LEGAL = { mentions: 'Mentions légales', confidentialite: 'Confidentialité', cookies: 'Cookies', accessibilite: 'Accessibilité' };
  const HOME_ANCHORS = ['rendez-vous', 'envies', 'organisateurs', 'lettre', 'top', 'contenu'];
  let pendingEvent = null;
  function route() {
    let h = location.hash.slice(1); try { h = decodeURIComponent(h); } catch (_) {} // une adresse tronquée (…%) ne doit pas bloquer tout le site
    let view = 'home';
    if (h === 'partager' || h === 'proposer') view = 'partager';
    else if (h === 'agenda') view = 'agenda';
    else if (LEGAL[h]) view = 'legal';
    const was = $$('.view').find(v => !v.hidden);
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
    $$('[data-nav]').forEach(a => { if (a.dataset.nav === view && view !== 'home') a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    top.classList.toggle('on-page', view !== 'home');
    if (openDlg) closeDialog();
    if (view === 'legal') {
      Object.keys(LEGAL).forEach(k => { $('#tab-' + k).hidden = k !== h; const a = $(`[data-tab="${k}"]`); if (k === h) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      $('#legal-title').textContent = LEGAL[h];
      document.title = `${LEGAL[h]} · laSave`;
    } else if (view === 'agenda') document.title = 'Tout l’agenda · laSave';
    else if (view === 'partager') document.title = 'Proposer un événement · laSave';
    else document.title = 'laSave · Agenda de la Save';
    const changed = was && was.id !== 'view-' + view;
    if (view === 'agenda') renderAgenda();
    if (view === 'home') {
      flowRender(); fitAll();
      const m = h.match(/^event-(rec\w+)$/);
      if (m) { const e = ALL.find(x => x.id === m[1]); if (e) openEvent(e); else pendingEvent = m[1]; }
      else if (h && HOME_ANCHORS.includes(h)) { const t = document.getElementById(h); if (t) requestAnimationFrame(() => t.scrollIntoView({ behavior: changed || reduce ? 'auto' : 'smooth' })); }
      else if (changed || !h) window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
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

  /* ── Ouverture du site pendant le chargement ── */
  const intro = $('#intro'), introT0 = performance.now();
  let introDone = false;
  function endIntro() {
    if (introDone || !intro) return; introDone = true;
    const quick = motion.still || reduce;
    const wait = quick ? 0 : Math.max(0, 1300 - (performance.now() - introT0));
    setTimeout(() => {
      intro.classList.add('done');
      setTimeout(() => {
        if (goLettre && $('#view-home').hidden === false) $('#lettre').scrollIntoView({ behavior: 'instant' });
        else if ($('#view-home').hidden === false && !/^#event-/.test(location.hash) && !HOME_ANCHORS.includes(location.hash.slice(1))) window.scrollTo({ top: 0, behavior: 'instant' });
        intro.classList.add('out'); document.body.classList.remove('intro-on');
        setTimeout(() => intro.remove(), quick ? 350 : 1300);
      }, quick ? 0 : 380);
    }, wait);
  }
  setTimeout(endIntro, 4500); // au pire, on n'attend pas plus

  /* ── Barre du haut : la section visible est soulignée ── */
  (function spy() {
    const links = $$('[data-spy]'); if (!links.length || !('IntersectionObserver' in window)) return;
    const seen = new Map();
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => seen.set(en.target.id, en.isIntersecting ? en.intersectionRatio : 0));
      let best = null, max = 0; seen.forEach((r, id) => { if (r > max) { max = r; best = id; } });
      links.forEach(a => { if (a.dataset.spy === best && max > 0) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    }, { threshold: [0, .15, .3, .5], rootMargin: '-30% 0px -40% 0px' });
    links.forEach(a => { const t = document.getElementById(a.dataset.spy); if (t) io.observe(t); });
  })();


  /* ── Apparition douce des sections au défilement (ordinateur) ──
     Les éléments ne sont masqués que par la feuille de style, sur grand écran et si les animations sont permises ;
     chaque groupe se révèle quand il entre dans l'écran, puis les classes sont retirées (le style normal reprend). */
  function setupReveal() {
    if (reduce || !('IntersectionObserver' in window)) return;
    // kind : '' (monte en fondu), fade (fondu seul), wipe (balayage de gauche à droite), pop (petit grossissement), zoom (monte en grossissant)
    const mark = (n, delay, kind) => { if (!n) return null; n.classList.add('rv'); if (kind) n.classList.add('rv-' + kind); n.style.setProperty('--d', delay + 's'); return n; };
    const groups = [];
    const add = (trigger, items) => { items = items.filter(Boolean); if (trigger && items.length) groups.push({ trigger, items }); };
    add($('#rendez-vous'), [mark($('#flow-title'), 0), mark($('#qpick'), .18, 'fade'), mark($('#flow-stage'), .3, 'fade'), mark($('.flow-ctrl'), .5, 'fade'), mark($('.epi'), .9, 'wipe')]);
    $$('#rows .row-sec').forEach(sec => add(sec, [
      mark(sec.querySelector('.row-block'), 0, 'wipe'), mark(sec.querySelector('.row-title'), .28), mark(sec.querySelector('.stamp'), .6, 'pop'),
      ...[...sec.querySelectorAll('.track > *')].slice(0, 6).map((c, i) => mark(c, .4 + i * .09, 'zoom'))]));
    add($('#organisateurs'), [mark($('#orgs-title'), 0), mark($('#orgs-row'), .2, 'zoom'), mark($('.orgs-ctrl'), .5, 'fade')]);
    add($('.bento'), [...$$('.bento > .bx').map((b, i) => mark(b, i * .14, 'zoom')), mark($('.bx-head'), .4, 'wipe'), mark($('.bx-head .row-title'), .68), mark($('.bx-head .stamp'), .95, 'pop')]);
    add($('#avis-line'), [mark($('#avis-line'), 0, 'fade')]);
    add($('.foot'), [mark($('.foot'), 0, 'fade')]);
    groups.forEach(g => { g.wait = Math.max(...g.items.map(n => parseFloat(n.style.getPropertyValue('--d')) || 0)); });
    const clean = g => g.items.forEach(n => { [...n.classList].filter(c => c === 'in' || c.startsWith('rv')).forEach(c => n.classList.remove(c)); });
    const reveal = (g, anim) => {
      io.unobserve(g.trigger);
      if (anim) { g.items.forEach(n => n.classList.add('in')); setTimeout(() => clean(g), g.wait * 1000 + 2000); } else clean(g);
    };
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      const g = groups.find(x => x.trigger === en.target); if (!g) return;
      if (en.isIntersecting) reveal(g, true);
      else if (en.boundingClientRect.top < 0) reveal(g, false); // déjà dépassé (lien direct plus bas) : on l'affiche sans effet
    }), { rootMargin: '0px 0px -20% 0px' });
    groups.forEach(g => io.observe(g.trigger));
    // un saut de page (lien direct, « Newsletter » dans le menu) peut dépasser des sections sans qu'elles aient été vues : on les affiche sans effet
    let raf = 0;
    const sweep = () => { raf = 0; groups.filter(g => g.items.some(n => n.classList.contains('rv') && !n.classList.contains('in'))).forEach(g => { if (g.trigger.getBoundingClientRect().bottom < 0) reveal(g, false); }); };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(sweep); }, { passive: true });
    document.documentElement.classList.add('rv-on');
  }

  /* ── Démarrage : toujours ouvrir sur « À la une » ── */
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (_) {}
  const goLettre = location.hash === '#lettre'; // lien direct vers l'inscription à la lettre (depuis un mail, une affiche…)
  { const h0 = location.hash.slice(1); if (HOME_ANCHORS.includes(h0)) history.replaceState(null, '', location.pathname + location.search); }
  window.scrollTo({ top: 0, behavior: 'instant' });
  setupForm();
  setupAvis();
  setupAvisCard();
  setupLettre();
  bindMotion();
  { const sk = $('.skip'); if (sk) sk.addEventListener('click', ev => { ev.preventDefault(); $('#contenu').focus(); }); } // « Aller au contenu » ne doit pas changer de page
  route();
  (async () => {
    let loadErr = false;
    try { ALL = await api('/events'); } catch (e) { console.warn('events', e); loadErr = true; }
    if (!Array.isArray(ALL)) { ALL = []; loadErr = true; }
    // « Agenda mis à jour le … » : signe de fraîcheur dans le pied de page
    api('/health').then(d => {
      const t = d && d.copie && new Date(d.copie), n = $('#foot-maj');
      if (!n || !t || isNaN(t)) return;
      n.textContent = ' · Agenda mis à jour le ' + t.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
      n.hidden = false;
    }).catch(() => {});
    try { ORGAS = await api('/orgas'); } catch (e) { console.warn('orgas', e); }
    if (!Array.isArray(ORGAS)) ORGAS = [];
    UP = ALL.filter(isActive).sort((a, b) => sortKey(a) - sortKey(b));
    buildHero(UP);
    buildFlow(UP);
    if (loadErr) { const st = $('#flow-stage'); st.textContent = ''; st.appendChild(el('p', 'empty', 'Impossible de charger l’agenda pour le moment. Vérifiez votre connexion puis rechargez la page.')); const fc = $('.flow-ctrl'); if (fc) fc.hidden = true; }
    buildRows(UP);
    buildOrgs(ORGAS);
    agSetup(); renderAgenda();
    // vrais chiffres dans les titres de section
    { const n = UP.length, o = (ORGAS || []).length, ka = $('#kick-agenda'), ko = $('#kick-orgs');
      if (ka && n >= 3) ka.textContent = `${n} événements à venir dans la vallée`;
      if (ko && o >= 3) ko.textContent = `${o} associations et organisateurs`; }
    fitAll();
    setupReveal();
    endIntro();
    if (pendingEvent) { const e = ALL.find(x => x.id === pendingEvent); pendingEvent = null; if (e && !$('#view-home').hidden) openEvent(e); }
  })();
})();
