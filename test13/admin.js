/* laSave : tableau de bord de la mairie */
(() => {
  'use strict';
  const API = 'https://go.la-save.fr';
  const SITE = 'https://la-save.fr';
  const AIRTABLE = 'https://airtable.com/appHgiuv0ClNd8qsV/tbl6Um2XQPq4JPxCg';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const fr = n => Math.round(n || 0).toLocaleString('fr-FR');
  const pl = (n, un, plus) => `${fr(n)} ${n > 1 ? plus : un}`;
  const KEY = 'lasave_admin'; // même session que l'administration du site et les statistiques
  let token = ''; try { token = sessionStorage.getItem(KEY) || ''; } catch (_) {}
  const saveToken = t => { token = t; try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch (_) {} };

  let ov = null, filtre = null, q = '';

  /* ── réseau ── */
  async function call(path, opts = {}, raw = false) {
    const r = await fetch(API + path, { ...opts, headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(opts.headers || {}) } });
    if (r.status === 401 && path.startsWith('/admin/') && path !== '/admin/login') { saveToken(''); showApp(false); throw Object.assign(new Error('Session expirée, reconnectez-vous.'), { status: 401 }); }
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw Object.assign(new Error(d.error || 'Erreur ' + r.status), { status: r.status }); }
    return raw ? r : r.json();
  }

  /* ── dates ── */
  const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  const dj = iso => new Date(iso + 'T12:00:00');
  const court = iso => dj(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\.$/, '');
  const longue = () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  const ilYa = ms => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 2 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : m < 2880 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} jours`; };

  /* ── classement des événements ── */
  const recur = e => (e.rec && e.rec !== 'Aucune') || !e.date;
  const fin = e => e.fin || e.date;
  const passe = e => !recur(e) && fin(e) && fin(e) < today();
  const cle = e => e.statut === 'Publié' ? (passe(e) ? 'passes' : 'enligne') : e.statut === 'Archivé' ? 'archives' : e.statut === 'Refusé' ? 'refuses' : 'attente';
  const FILTRES = [['attente', 'À valider'], ['enligne', 'En ligne'], ['passes', 'À archiver'], ['archives', 'Archivés'], ['refuses', 'Refusés'], ['tous', 'Tous']];
  const compte = k => ov.events.filter(e => k === 'tous' || cle(e) === k).length;
  const dateTexte = e => !e.date ? 'Toute l’année' : court(e.date) + (e.fin && e.fin !== e.date ? ' → ' + court(e.fin) : '');
  const sous = e => [e.orga, e.commune].filter(Boolean).join(' · ');
  const venir = id => (ov.rsvp && ov.rsvp[id] && ov.rsvp[id].total) || 0;

  /* ── messages ── */
  let tMsg;
  function msg(texte, err = false) {
    const m = $('#d-msg'); m.textContent = texte; m.className = 'd-msg' + (err ? ' err' : ''); m.hidden = false;
    clearTimeout(tMsg); tMsg = setTimeout(() => { m.hidden = true; }, err ? 9000 : 6000);
  }

  /* ── connexion ── */
  function showApp(ok) { $('#d-login').hidden = ok; $('#d-app').hidden = !ok; if (!ok) { const sh = $('#d-sheet'); if (sh) sh.hidden = true; document.body.classList.remove('lock'); } } // session perdue : on ferme aussi la fiche ouverte
  $('#d-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = $('#d-err'); err.hidden = true;
    try {
      const d = await call('/admin/login', { method: 'POST', body: JSON.stringify({ pwd: $('#d-pwd').value }) });
      if (!d.token) throw new Error('Connexion impossible.');
      saveToken(d.token); $('#d-pwd').value = ''; await start();
    } catch (e) { err.textContent = e.message; err.hidden = false; }
  });
  $('#d-logout').addEventListener('click', () => { saveToken(''); ov = null; showApp(false); });
  $('#d-reload').addEventListener('click', async () => { await charger(true); msg('Données actualisées.'); });

  /* ── chargement ── */
  async function charger(frais = false) {
    $('#d-reload').disabled = true;
    try {
      ov = await call('/admin/overview' + (frais ? '?frais=1' : ''));
      if (frais && window.LS) LS.rend.reset && LS.rend.reset();
    } catch (e) { if (e.status !== 401) msg(e.message, true); }
    $('#d-reload').disabled = false;
    if (!ov) return;
    if (!filtre) filtre = compte('attente') ? 'attente' : 'enligne';
    $('#d-sync').textContent = ov.copie ? `Agenda mis à jour ${ilYa(Date.parse(ov.copie))} · ${pl(ov.enLigne, 'événement en ligne', 'événements en ligne')}` : 'Agenda pas encore copié';
    const nA = compte('attente') + compte('passes');
    const b = $('#b-ev'); b.textContent = nA; b.hidden = !nA;
    const bo = $('#b-org'); bo.textContent = ov.codes; bo.hidden = !ov.codes;
    afficher();
  }

  /* ── navigation ── */
  const TITRES = { vue: 'Vue d’ensemble', evenements: 'Événements', organisateurs: 'Organisateurs', stats: 'Statistiques', archives: 'Archives', outils: 'Outils', systeme: 'Système', raccourcis: 'Raccourcis' };
  function section() { const h = location.hash.slice(1); return TITRES[h] ? h : 'vue'; }
  function afficher() {
    if (!ov) return;
    const s = section();
    $$('.d-sec').forEach(x => { x.hidden = x.id !== 's-' + s; });
    $$('#d-nav a').forEach(a => { const on = a.dataset.s === s; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
    document.title = TITRES[s] + ' · Tableau de bord · laSave';
    const actif = $('#d-nav a.on'); if (actif) { const nav = $('#d-nav'); nav.scrollLeft = actif.offsetLeft - (nav.clientWidth - actif.offsetWidth) / 2; }
    ({ vue: () => LS.rend.vue && LS.rend.vue(), evenements: rEvenements, organisateurs: rOrgas, stats: () => LS.rend.stats && LS.rend.stats(), archives: rArchives, outils: () => {}, systeme: () => LS.rend.systeme && LS.rend.systeme(), raccourcis: () => LS.rend.raccourcis && LS.rend.raccourcis() })[s]();
  }
  window.addEventListener('hashchange', () => { afficher(); window.scrollTo({ top: 0 }); });
  const aller = (h, f) => { if (f) { filtre = f; q = ''; $('#e-q').value = ''; } if (location.hash === '#' + h) afficher(); else location.hash = h; };

  /* ── actions sur les événements ── */
  async function changer(e, statut, bouton) {
    if (bouton) bouton.disabled = true;
    try {
      await call(`/admin/events/${e.id}`, { method: 'PATCH', body: JSON.stringify({ Statut: statut }) });
      e.statut = statut;
      msg({ Publié: `« ${e.titre} » est publié. L’agenda se met à jour dans la minute.${e.contact ? ' Le mail « C’est en ligne » part à l’organisateur.' : ''}`, Archivé: `« ${e.titre} » est archivé.`, Refusé: `« ${e.titre} » est refusé.`, 'En attente': `« ${e.titre} » est remis en attente.` }[statut]);
      return true;
    } catch (er) { if (er.status !== 401) msg(er.message, true); if (bouton) bouton.disabled = false; return false; }
  }

  /* ── événements ── */
  function rEvenements() {
    const chips = $('#e-chips'); chips.innerHTML = '';
    FILTRES.forEach(([k, nom]) => {
      const b = el('button', 'd-chip' + (filtre === k ? ' on' : ''), nom); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', filtre === k);
      b.append(Object.assign(el('i'), { textContent: compte(k) }));
      b.addEventListener('click', () => { filtre = k; rEvenements(); });
      chips.append(b);
    });
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    let liste = ov.events.filter(e => (filtre === 'tous' || cle(e) === filtre) && (!q || norm([e.titre, e.orga, e.commune, e.cat].join(' ')).includes(norm(q))));
    const futur = filtre === 'enligne' || filtre === 'attente';
    liste.sort((x, y) => futur ? (x.date || '9999').localeCompare(y.date || '9999') : (y.date || '').localeCompare(x.date || ''));

    // action groupée : archiver tous les événements passés
    const bulk = $('#e-bulk'); bulk.innerHTML = '';
    const passes = ov.events.filter(e => cle(e) === 'passes');
    if (filtre === 'passes' && passes.length) {
      bulk.hidden = false;
      bulk.append(el('span', '', `${pl(passes.length, 'événement passé est encore en ligne', 'événements passés sont encore en ligne')}. L’archivage les retire de l’agenda ; rien n’est supprimé.`));
      const b = el('button', 'd-btn main sm', `Archiver les ${passes.length}`); b.type = 'button'; let sur = false;
      b.addEventListener('click', async () => {
        if (!sur) { sur = true; b.textContent = 'Confirmer l’archivage'; setTimeout(() => { sur = false; b.textContent = `Archiver les ${passes.length}`; }, 5000); return; }
        b.disabled = true; let n = 0;
        for (const e of passes) { b.textContent = `Archivage… ${n + 1}/${passes.length}`; if (!(await changer(e, 'Archivé'))) break; n++; }
        if (n < passes.length) msg(`${pl(n, 'événement archivé', 'événements archivés')} sur ${passes.length} : l’archivage s’est arrêté, réessayez.`, true); else msg(`${pl(n, 'événement archivé', 'événements archivés')}.`);
        await charger(true);
      });
      bulk.append(b);
    } else bulk.hidden = true;

    const ul = $('#e-list'); ul.innerHTML = '';
    if (!liste.length) { ul.append(el('li', 'd-vide', q ? 'Aucun événement ne correspond à cette recherche.' : 'Aucun événement ici.')); return; }
    const h = el('li', 'col-h'); ['Date', 'Événement', 'Statut', 'J’y vais', 'Je viens', ''].forEach(t => h.append(el('span', '', t))); ul.append(h);
    liste.forEach(e => {
      const li = el('li'), t = el('div', 't'), k = cle(e);
      const tb = el('button', 'd-link', e.titre || '(sans titre)'); tb.type = 'button'; tb.title = 'Ouvrir la fiche'; tb.addEventListener('click', () => LS.rend.fiche && LS.rend.fiche(e));
      t.append(tb, el('small', '', sous(e)));
      const pillTxt = k === 'passes' ? 'Passé' : e.statut || 'En attente', pill = el('span', 'd-pill p-' + pillTxt.replace(/\s/g, ''), pillTxt);
      const v = venir(e.id), acts = el('div', 'acts');
      const bt = (txt, cls, fn) => { const b = el('button', 'd-btn sm ' + cls, txt); b.type = 'button'; b.addEventListener('click', async () => { if (await changer(e, fn, b)) { await recompter(); } }); return b; };
      if (k === 'attente') acts.append(bt('Publier', 'ok', 'Publié'), bt('Refuser', 'warn', 'Refusé'));
      else if (k === 'enligne') acts.append(bt('Archiver', '', 'Archivé'));
      else if (k === 'passes') acts.append(bt('Archiver', 'main', 'Archivé'));
      else if (k === 'archives') acts.append(bt('Remettre en ligne', '', 'Publié'));
      else if (k === 'refuses') acts.append(bt('Remettre en attente', '', 'En attente'));
      if (k === 'enligne') { const a = el('a', 'd-btn sm ghost', 'Fiche'); a.href = `${SITE}/#event-${e.id}`; a.target = '_blank'; a.rel = 'noopener'; acts.append(a); }
      const at = el('a', 'd-btn sm ghost', 'Airtable'); at.href = `${AIRTABLE}/${e.id}`; at.target = '_blank'; at.rel = 'noopener'; acts.append(at);
      li.append(el('time', '', dateTexte(e)), t, el('span', '', ''), el('span', 'num', e.likes ? fr(e.likes) : '–'), el('span', 'num' + (v ? ' on' : ''), v ? fr(v) : '–'), acts);
      li.children[2].append(pill);
      ul.append(li);
    });
  }
  async function recompter() { // après une action : les compteurs et la liste suivent, sans relire Airtable
    const nA = compte('attente') + compte('passes'); const b = $('#b-ev'); b.textContent = nA; b.hidden = !nA;
    rEvenements();
  }
  $('#e-q').addEventListener('input', ev => { q = ev.target.value.trim(); rEvenements(); });

  /* ── organisateurs ── */
  const ORGAS = 'https://airtable.com/appHgiuv0ClNd8qsV/tblgaldbDy7el5Qw1';
  function rOrgas() {
    const ul = $('#o-list'); ul.innerHTML = '';
    const dem = ov.orgas.filter(o => o.statutCode === 'Demandé');
    if (!dem.length) ul.append(el('li', 'd-vide', 'Aucune demande de code en attente.'));
    const envoi = (o, act, ok, b) => async () => {
      b.disabled = true;
      try { await call(`/admin/orgas/${o.id}/${act}`, { method: 'POST' }); o.statutCode = act === 'refuse' ? 'Refusé' : 'Envoyé'; ov.codes = ov.orgas.filter(x => x.statutCode === 'Demandé').length; const bo = $('#b-org'); bo.textContent = ov.codes; bo.hidden = !ov.codes; msg(ok); rOrgas(); }
      catch (e) { b.disabled = false; msg(e.message, true); }
    };
    dem.forEach(r => {
      const li = el('li'), t = el('div', 't'); t.append(el('b', '', r.nom || '(sans nom)'), el('small', '', r.email || 'pas d’adresse'));
      const acts = el('div', 'acts'), a = el('button', 'd-btn sm ok', 'Envoyer le code'), c = el('button', 'd-btn sm warn', 'Refuser'); a.type = c.type = 'button';
      a.addEventListener('click', envoi(r, 'send-code', `Code envoyé à ${r.nom}.`, a)); c.addEventListener('click', envoi(r, 'refuse', `Demande de ${r.nom} refusée.`, c));
      acts.append(a, c); li.append(t, acts); if (r.msg) li.append(el('p', 'msg', r.msg)); ul.append(li);
    });
    const all = $('#o-all'); all.innerHTML = '';
    const liste = ov.orgas.filter(o => o.statutCode !== 'Demandé').sort((x, y) => String(x.nom || '').localeCompare(String(y.nom || ''), 'fr'));
    $('#o-n').textContent = `(${liste.length})`;
    if (!liste.length) all.append(el('li', 'd-vide', 'Aucun organisateur.'));
    liste.forEach(o => {
      const li = el('li'), t = el('div', 't'); t.append(el('b', '', o.nom || '(sans nom)'), el('small', '', [o.email || 'pas d’adresse', o.code ? 'code ' + o.code : 'pas de code'].join(' · ')));
      const acts = el('div', 'acts');
      const p1 = el('span', 'd-pill ' + (o.publie ? 'p-Publié' : 'p-Archivé'), o.publie ? 'Affiché sur le site' : 'Masqué'); acts.append(p1);
      if (o.statutCode) acts.append(el('span', 'd-pill ' + (o.statutCode === 'Refusé' ? 'p-Refusé' : 'p-Enattente'), 'Code : ' + o.statutCode.toLowerCase()));
      if (o.email) { const b = el('button', 'd-btn sm', 'Renvoyer le code'); b.type = 'button'; b.addEventListener('click', envoi(o, 'send-code', `Code renvoyé à ${o.nom}.`, b)); acts.append(b); }
      const a = el('a', 'd-btn sm ghost', 'Airtable'); a.href = `${ORGAS}/${o.id}`; a.target = '_blank'; a.rel = 'noopener'; acts.append(a);
      li.append(t, acts); all.append(li);
    });
  }

  /* ── archives : sauvegarde des affiches ── */
  let listeAff = [];
  const mo = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(n / 1e3)) + ' Ko';
  async function rArchives() {
    const zip = $('#a-zip'); zip.disabled = true; $('#a-sum').textContent = 'Chargement…';
    try { listeAff = await call('/admin/affiches?statut=' + encodeURIComponent($('#a-statut').value)); } catch (e) { $('#a-sum').textContent = e.message; return; }
    const nb = listeAff.reduce((a, x) => a + x.fichiers.length, 0), poids = listeAff.reduce((a, x) => a + x.fichiers.reduce((b, f) => b + f.taille, 0), 0);
    $('#a-sum').textContent = nb ? `${pl(listeAff.filter(x => x.fichiers.length).length, 'événement', 'événements')} · ${pl(nb, 'affiche', 'affiches')} · ${mo(poids)}` : 'Aucune affiche pour ce statut.';
    zip.disabled = !nb;
  }
  $('#a-statut').addEventListener('change', rArchives);
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function faireZip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0, cd = 0;
    const n = new Date(), dt = (n.getHours() << 11) | (n.getMinutes() << 5) | (n.getSeconds() >> 1), dd = ((n.getFullYear() - 1980) << 9) | ((n.getMonth() + 1) << 5) | n.getDate();
    for (const f of files) {
      const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true);
      parts.push(lh.buffer, nm, f.data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      central.push(ch.buffer, nm); cd += 46 + nm.length; off += 30 + nm.length + sz;
    }
    const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cd, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  }
  const propre = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const ext = f => { const m = /\.([A-Za-z0-9]{2,5})$/.exec(f.nom || ''); return m ? m[1].toLowerCase() : /png/.test(f.type) ? 'png' : /webp/.test(f.type) ? 'webp' : /pdf/.test(f.type) ? 'pdf' : 'jpg'; };
  $('#a-zip').addEventListener('click', async () => {
    const btn = $('#a-zip'), prog = $('#a-prog'); btn.disabled = true; prog.hidden = false;
    const todo = []; listeAff.forEach(x => x.fichiers.forEach((f, i) => todo.push({ x, f, i })));
    const files = [], pris = new Set(); let rate = 0;
    for (let k = 0; k < todo.length; k++) {
      const { x, f, i } = todo[k]; prog.textContent = `Téléchargement ${k + 1} sur ${todo.length}…`;
      try {
        const r = await call('/admin/affiche?u=' + encodeURIComponent(f.url), {}, true), data = new Uint8Array(await r.arrayBuffer());
        const base = `${x.date || 'sans-date'} ${propre(x.titre) || 'affiche'}${x.fichiers.length > 1 ? ' (' + (i + 1) + ')' : ''}`; let name = `${base}.${ext(f)}`, n = 2;
        while (pris.has(name.toLowerCase())) name = `${base} - ${n++}.${ext(f)}`;
        pris.add(name.toLowerCase()); files.push({ name, data });
      } catch (e) { if (e.status === 401) return; rate++; }
    }
    if (!files.length) { prog.textContent = 'Aucune affiche n’a pu être téléchargée. Actualisez et réessayez.'; btn.disabled = false; return; }
    prog.textContent = 'Création du fichier…'; await new Promise(r => setTimeout(r, 30));
    const blob = faireZip(files), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `affiches-lasave-${today()}.zip`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    prog.textContent = `${pl(files.length, 'affiche', 'affiches')} dans le .zip (${mo(blob.size)}).` + (rate ? ` ${pl(rate, 'n’a pas pu être récupérée', 'n’ont pas pu être récupérées')}.` : '');
    btn.disabled = false;
  });

  /* ── outils ── */
  $('#u-cache').addEventListener('click', async ev => {
    const b = ev.currentTarget; b.disabled = true;
    try { await call('/admin/cache-clear', { method: 'POST' }); msg('Caches vidés. L’agenda se relira au prochain passage.'); await charger(true); }
    catch (e) { msg(e.message, true); }
    b.disabled = false;
  });
  $('#u-refresh').addEventListener('click', async ev => {
    const b = ev.currentTarget; b.disabled = true;
    try { const d = await call('/hook/refresh', { method: 'POST' }); msg(d.message || 'Site mis à jour.'); await charger(true); }
    catch (e) { msg(e.status === 429 ? 'Trop de demandes, réessayez dans quelques minutes.' : e.message, true); }
    b.disabled = false;
  });
  $('#u-test').addEventListener('click', async ev => {
    const b = ev.currentTarget, to = $('#u-to').value.trim(); if (!to) { msg('Indiquez une adresse e-mail.', true); return; }
    b.disabled = true;
    try { const d = await call('/admin/test-mail', { method: 'POST', body: JSON.stringify({ to }) }); msg(`Mail de test envoyé à ${to}${d.titre ? ' (événement : ' + d.titre + ')' : ''}.`); }
    catch (e) { msg(e.message, true); }
    b.disabled = false;
  });

  window.LS = { $, $$, el, fr, pl, call, msg, today, court, ilYa, dj, SITE, API, AIRTABLE, compte, passe, fin, recur, FILTRES, charger, changer, cle, recur, venir, sous, dateTexte, recompter, aller, get ov() { return ov; }, rend: {} };

  async function start() { showApp(true); await charger(); }
  if (token) start().catch(() => showApp(false));
})();
