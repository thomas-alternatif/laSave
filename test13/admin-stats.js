/* laSave : tableau de bord, vue d'ensemble et statistiques détaillées */
(() => {
  'use strict';
  const L = window.LS;
  const { $, el, fr, pl, call, msg, court } = L;

  /* ── libellés ── */
  const CANAUX = { wa: 'WhatsApp', fb: 'Facebook', sms: 'SMS', mail: 'E-mail (kit)', invitation: 'Invitation par mail', lien: 'Partage direct (kit)', copie: 'Lien copié', legende: 'Légende Instagram / Facebook', story: 'Story', post: 'Visuel partagé', site: 'Bouton « Partager » du site', mailpub: 'Mail « C’est en ligne »', qr: 'QR code', '': 'Autre ou inconnu' };
  const SOURCES = { direct: 'Accès direct (favori, adresse tapée, appli)', partage: 'Lien partagé laSave', google: 'Google', facebook: 'Facebook / Messenger', instagram: 'Instagram', recherche: 'Autres moteurs de recherche', mairie: 'Site de la mairie, IntraMuros, Linktree', autre: 'Autres sites', interne: 'Navigation interne' };
  const KIT = { fb: 'Facebook', invitation: 'Invitation par mail', story: 'Partager en story', post: 'Partager le visuel', lien: 'Envoyer le lien', copie: 'Copier le lien', legende: 'Copier la légende', mail: 'Copier l’invitation mail', wa: 'WhatsApp', sms: 'SMS', qr: 'QR code' };
  const AGENDA = { google: 'Google Agenda', ics: 'Fichier calendrier (.ics)' };
  const VERSIONS = { site: 'Site en ligne', test: 'Version de test (test13)' };
  const TYPE_J = { admin: 'Actions', mail: 'Mails', cron: 'Nuit', erreur: 'Erreurs', securite: 'Sécurité' };

  const MET = {
    visites: ['Visites', r => r.type === 'visite' && r.id === 'site', 'Personnes venues sur le site (une par session)'],
    fiches: ['Fiches consultées', r => r.type === 'fiche', 'Événements ouverts sur le site'],
    clics: ['Clics sur liens partagés', r => r.type === 'lien', 'Personnes arrivées grâce à un partage'],
    apercus: ['Liens partagés', r => r.type === 'apercu', 'Liens collés dans une messagerie ou un réseau'],
    kits: ['Kits ouverts', r => r.type === 'kit', 'Organisateurs qui préparent un partage'],
    boutons: ['Boutons du kit', r => r.type === 'kit_action', 'Clics sur les boutons du kit'],
    jyvais: ['« J’y vais »', r => r.type === 'jyvais', 'Clics sur le bouton des fiches'],
    agenda: ['Ajouts au calendrier', r => r.type === 'agenda', 'Google Agenda ou fichier .ics'],
    lettre: ['Inscrits à la lettre', r => r.type === 'newsletter', 'Nouveaux inscrits sur la période'],
  };

  /* ── dates ── */
  const addJ = (iso, k) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
  const jours = (fin, n) => Array.from({ length: n }, (_, i) => addJ(fin, i - n + 1));
  const dow = iso => (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7; // 0 = lundi
  const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const heure = ms => new Date(ms).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const dec = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('fr-FR', { maximumFractionDigits: d });

  /* ── données ── */
  let cache = {};
  async function donnees(n) { // n derniers jours + les n précédents, pour comparer
    const k = Math.min(180, n * 2);
    if (!cache[k]) cache[k] = call('/admin/stats/brut?jours=' + k).catch(e => { delete cache[k]; throw e; });
    const d = await cache[k], fin = L.today();
    const cur = new Set(jours(fin, n)), prev = new Set(jours(addJ(fin, -n), n));
    return { ...d, n, fin, jours: jours(fin, n), cur: d.lignes.filter(r => cur.has(r.jour)).map(r => ({ ...r, n: +r.n || 0 })), prev: d.lignes.filter(r => prev.has(r.jour)).map(r => ({ ...r, n: +r.n || 0 })), rsvpCur: (d.rsvp || []).filter(r => cur.has(r.jour)), rsvpPrev: (d.rsvp || []).filter(r => prev.has(r.jour)), prevOk: d.jours >= n * 2 };
  }
  L.rend.reset = () => { cache = {}; };
  const somme = (rows, f) => rows.reduce((a, r) => a + (f(r) ? r.n : 0), 0);
  const serie = (d, cle) => { const m = Object.fromEntries(d.jours.map(j => [j, 0])); if (cle === 'jeviens') d.rsvpCur.forEach(r => { m[r.jour] += +r.n || 0; }); else d.cur.forEach(r => { if (MET[cle][1](r)) m[r.jour] += r.n; }); return d.jours.map(j => m[j]); };
  const jeViens = rs => rs.reduce((a, r) => a + (+r.n || 0), 0);
  const delta = (c, p) => { if (!c && !p) return ['', '']; if (!p) return ['nouveau', 'up']; const x = Math.round((c - p) / p * 100); return [x === 0 ? '= stable' : (x > 0 ? '▲ +' : '▼ −') + Math.abs(x) + ' %', x > 0 ? 'up' : x < 0 ? 'down' : '']; };

  /* ── composants ── */
  function kpi(n, titre, sous, c, p, prevOk) {
    const k = el('div', 'd-kpi'); k.append(el('b', '', fr(n)), el('span', '', titre));
    const [t, cls] = prevOk ? delta(c, p) : ['', '']; if (t) k.append(el('em', 'dl ' + cls, t));
    if (sous) k.append(el('small', '', sous)); return k;
  }
  const pas = m => { const t = Math.max(1, m) / 4, p = 10 ** Math.floor(Math.log10(t)); const s = [1, 2, 5, 10].map(x => x * p).find(x => x >= t); return s; };
  function barres(box, labels, vals, nom, W = 720, H = 190) {
    const X0 = 36, B = 24, T = 12, n = vals.length, st = pas(Math.max(...vals)), top = st * Math.max(1, Math.ceil(Math.max(...vals, 1) / st));
    const bw = (W - X0) / n, y = v => T + (H - B - T) * (1 - v / top), moy = vals.reduce((a, v) => a + v, 0) / n;
    let g = '';
    for (let v = 0; v <= top; v += st) g += `<line x1="${X0}" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${X0 - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`;
    const r = vals.map((v, i) => `<rect class="b" x="${(X0 + i * bw + Math.min(2, bw * .15)).toFixed(1)}" y="${y(v).toFixed(1)}" width="${Math.max(1, bw - Math.min(4, bw * .3)).toFixed(1)}" height="${(H - B - y(v)).toFixed(1)}" rx="${bw > 8 ? 2 : 0}"><title>${court(labels[i])} : ${fr(v)} ${nom}</title></rect>`).join('');
    const sp = Math.ceil(n / (W < 600 ? 5 : 7)); let xl = '';
    labels.forEach((j, i) => { if (i % sp === 0 && i + sp / 2 <= n) xl += `<text x="${(X0 + (i + .5) * bw).toFixed(1)}" y="${H - 6}" text-anchor="middle">${court(j).replace(/^\S+\s/, '')}</text>`; });
    const a = moy > 0 ? `<line class="avg" x1="${X0}" x2="${W}" y1="${y(moy).toFixed(1)}" y2="${y(moy).toFixed(1)}"/>` : '';
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${nom} par jour">${g}${r}${a}${xl}</svg>`;
    return moy;
  }
  function liste(box, items, vide, nom) { // barres horizontales [[libellé, n]]
    box.replaceChildren(); const l = items.filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]), tot = l.reduce((a, x) => a + x[1], 0);
    if (!l.length) { box.append(el('p', 'd-vide', vide)); return; }
    l.forEach(([k, n]) => { const row = el('div', 'row'), tr = el('div', 'tr'), i = el('i'); i.className = 'w-' + Math.max(1, Math.round(n / l[0][1] * 20)); tr.append(i); row.append(el('span', '', k), el('b', '', fr(n)), el('small', '', Math.round(n / tot * 100) + ' %'), tr); box.append(row); });
  }
  const parCanal = (rows, f, noms) => { const m = {}; rows.forEach(r => { if (f(r)) { const k = r.canal || ''; m[k] = (m[k] || 0) + r.n; } }); return Object.entries(m).map(([k, n]) => [noms[k] || k, n]); };
  const titreEv = id => { const e = L.ov.events.find(x => x.id === id); return e ? e : null; };

  /* ───────────── Vue d'ensemble ───────────── */
  function carte(cls, nombre, texte, bouton, action) {
    const li = el('li', cls); li.append(el('b', '', fr(nombre)), el('span', '', texte));
    if (bouton) { const b = el('button', 'd-btn sm', bouton); b.type = 'button'; b.addEventListener('click', action); li.append(b); }
    return li;
  }
  function pouls(ov) {
    const p = $('#v-pulse'); p.replaceChildren(); const pb = [];
    if (!ov.copie) pb.push('l’agenda n’a pas encore été copié'); else { const h = (Date.now() - Date.parse(ov.copie)) / 36e5; if (h > 25) pb.push(`l’agenda n’a pas été mis à jour depuis ${Math.round(h)} h`); }
    if (!ov.services.kv) pb.push('mémoire KV non reliée'); if (!ov.services.d1) pb.push('base D1 non reliée'); if (!ov.services.brevo) pb.push('clé Brevo manquante');
    const err = (ov.journal || []).filter(x => x.type === 'erreur' && Date.now() - x.t < 864e5).length;
    if (err) pb.push(pl(err, 'erreur dans les dernières 24 h', 'erreurs dans les dernières 24 h'));
    p.className = 'v-pulse ' + (pb.length ? 'ko' : 'ok');
    p.append(el('i'), el('span', '', pb.length ? 'À vérifier : ' + pb.join(', ') + '.' : `Tout fonctionne · agenda à jour ${ov.copie ? L.ilYa(Date.parse(ov.copie)) : ''}`));
    if (pb.length) { const a = el('a', '', 'Voir le système'); a.href = '#systeme'; p.append(a); }
  }
  async function rVue() {
    const ov = L.ov; if (!ov) return;
    $('#v-date').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).replace(/^./, c => c.toUpperCase());
    pouls(ov);
    // à traiter
    const todo = $('#v-todo'); todo.innerHTML = '';
    const nA = L.compte('attente'), nP = L.compte('passes');
    const conf = ov.events.filter(e => e.coche && /^En attente/.test(e.conf)).length;
    const sans = ov.events.filter(e => L.cle(e) === 'enligne' && !e.photo && !L.recur(e)).length;
    if (nA) todo.append(carte('', nA, nA > 1 ? 'événements attendent votre validation' : 'événement attend votre validation', 'Voir', () => L.aller('evenements', 'attente')));
    if (ov.codes) todo.append(carte('', ov.codes, ov.codes > 1 ? 'demandes de code organisateur' : 'demande de code organisateur', 'Voir', () => L.aller('organisateurs')));
    if (nP) todo.append(carte('', nP, nP > 1 ? 'événements passés encore en ligne' : 'événement passé encore en ligne', 'Archiver', () => L.aller('evenements', 'passes')));
    if (conf) todo.append(carte('info', conf, conf > 1 ? 'confirmations par mail en attente d’envoi' : 'confirmation par mail en attente d’envoi', 'Mettre le site à jour', () => L.aller('outils')));
    if (sans) todo.append(carte('info', sans, sans > 1 ? 'événements en ligne sans affiche' : 'événement en ligne sans affiche', 'Voir', () => L.aller('evenements', 'enligne')));
    if (!todo.children.length) { const li = el('li', 'calme'); li.append(el('span', '', 'Tout est à jour : rien à valider, rien à archiver.')); todo.append(li); }

    // 7 prochains jours
    const a = L.today(), b7 = addJ(a, 7);
    const next = ov.events.filter(e => L.cle(e) === 'enligne' && !L.recur(e) && e.date <= b7 && L.fin(e) >= a).sort((x, y) => (x.date < a ? a : x.date).localeCompare(y.date < a ? a : y.date));
    const ul = $('#v-next'); ul.innerHTML = '';
    if (!next.length) ul.append(el('li', 'd-vide', 'Rien de prévu dans les 7 prochains jours.'));
    next.forEach(e => {
      const li = el('li'), t = el('div'), v = L.venir(e.id), b = el('button', 'd-link', e.titre || '(sans titre)'); b.type = 'button'; b.addEventListener('click', () => L.rend.fiche(e));
      t.append(b, el('small', '', L.sous(e)));
      li.append(el('time', '', e.date < a ? 'En cours' : court(e.date)), t, el('span', 'd-venir' + (v ? ' on' : ''), v ? pl(v, 'personne vient', 'personnes viennent') : 'aucune réponse'));
      ul.append(li);
    });

    agendaChiffres(ov);

    // dernières actions
    const j = $('#v-journal'); j.innerHTML = '';
    if (!(ov.journal || []).length) j.append(el('li', 'd-vide', 'Aucune action enregistrée pour l’instant.'));
    (ov.journal || []).forEach(x => { const li = el('li', 'j-' + x.type); li.append(el('time', '', heure(x.t)), el('span', 'd-pill j-p', TYPE_J[x.type] || x.type), el('span', 'j-m', x.msg)); j.append(li); });

    // chiffres (statistiques)
    const kp = $('#v-kpis'); kp.replaceChildren(el('p', 'd-note', 'Chargement des chiffres…'));
    let d; try { d = await donnees(30); } catch (e) { kp.replaceChildren(el('p', 'd-note', 'Statistiques indisponibles : ' + e.message)); return; }
    kp.replaceChildren();
    const t = (cle, titre) => kpi(somme(d.cur, MET[cle][1]), titre || MET[cle][0], '', somme(d.cur, MET[cle][1]), somme(d.prev, MET[cle][1]), d.prevOk);
    kp.append(t('visites'), t('fiches'), t('clics', 'Clics sur les liens partagés'), t('kits'), t('jyvais'), kpi(jeViens(d.rsvpCur), '« Je viens » reçus', '', jeViens(d.rsvpCur), jeViens(d.rsvpPrev), d.prevOk), kpi(d.inscrits != null ? d.inscrits : somme(d.cur, MET.lettre[1]), d.inscrits != null ? 'Inscrits à la lettre' : 'Nouveaux inscrits', d.inscrits != null ? `dont ${fr(somme(d.cur, MET.lettre[1]))} sur la période` : '', 0, 0, false));
    const vals = serie(d, 'visites'), tot = vals.reduce((x, y) => x + y, 0);
    const moy = barres($('#v-chart'), d.jours, vals, 'visites', 480, 210);
    $('#v-chart-sum').textContent = `${fr(tot)} au total · ${dec(moy)} par jour`;
    // plus consultés
    const parId = {}; d.cur.forEach(r => { if (!/^rec/.test(r.id)) return; const o = parId[r.id] = parId[r.id] || { fiche: 0, lien: 0, jyvais: 0 }; if (r.type in o) o[r.type] += r.n; });
    const top = Object.entries(parId).map(([id, o]) => ({ id, ...o })).filter(o => o.fiche > 0).sort((x, y) => y.fiche - x.fiche).slice(0, 5);
    const tp = $('#v-top'); tp.innerHTML = '';
    if (!top.length) tp.append(el('li', '', 'Pas encore de données sur la période.'));
    top.forEach(o => { const e = titreEv(o.id), li = el('li'), b = el('button', 'd-link', e ? e.titre : 'Événement retiré'); b.type = 'button'; if (e) b.addEventListener('click', () => L.rend.fiche(e)); li.append(b, el('span', '', `${pl(o.fiche, 'fiche vue', 'fiches vues')} · ${pl(o.lien, 'clic', 'clics')} · ${fr(o.jyvais)} « J’y vais »`)); tp.append(li); });
  }
  const nettoie = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-’']/g, ' ').replace(/\s+/g, ' ').trim();
  function groupes(evs, f) {
    const m = {}; evs.forEach(e => { const v = f(e); if (!v) return; const k = nettoie(v), o = m[k] = m[k] || { n: 0, l: {} }; o.n++; o.l[v.trim()] = (o.l[v.trim()] || 0) + 1; });
    return Object.values(m).map(o => { const ls = Object.entries(o.l).sort((a, b) => (b[0] === b[0].toUpperCase()) - (a[0] === a[0].toUpperCase()) || b[1] - a[1]); return [ls.find(x => x[0] !== x[0].toUpperCase())?.[0] || ls[0][0].toLowerCase().replace(/^./, c => c.toUpperCase()), o.n]; });
  }
  function agendaChiffres(ov) {
    const w = $('#v-agenda'); w.replaceChildren();
    const en = ov.events.filter(e => L.cle(e) === 'enligne'), a = L.today();
    const reg = en.filter(L.recur).length, venir = en.filter(e => !L.recur(e) && e.date > a).length, cours = en.length - reg - venir;
    const ligne = (n, v, cls) => { const li = el('li'); li.append(el('span', '', n), el('span', cls || '', String(v))); return li; };
    const ul = el('ul', 'd-health');
    ul.append(ligne('Événements en ligne', en.length, 'ok'), ligne('À venir', venir), ligne('En cours aujourd’hui', cours), ligne('Activités régulières ou toute l’année', reg), ligne('À valider', L.compte('attente')), ligne('Archivés', L.compte('archives')), ligne('Refusés', L.compte('refuses')));
    w.append(ul);
    const bl = (t, items) => { const h = el('h3', 'd-h2', t), b = el('div', 'd-bars'); w.append(h, b); liste(b, items.sort((x, y) => y[1] - x[1]).slice(0, 6), 'Rien à afficher.'); };
    bl('Par commune', groupes(en, e => e.commune)); bl('Par catégorie', groupes(en, e => e.cat));
  }
  L.rend.vue = rVue;

  /* ───────────── Statistiques ───────────── */
  let periode = 30, metrique = 'visites', tri = { k: 'fiche', s: -1 }, qEv = '', toutEv = false, dCour = null;
  const PERIODES = [[7, '7 jours'], [30, '30 jours'], [90, '90 jours']];
  const KPI_STATS = ['visites', 'fiches', 'clics', 'apercus', 'kits', 'boutons', 'jyvais', 'agenda', 'lettre'];

  function enteteStats() {
    const c = $('#t-per'); c.replaceChildren();
    PERIODES.forEach(([n, nom]) => { const b = el('button', 'd-chip' + (periode === n ? ' on' : ''), nom); b.type = 'button'; b.setAttribute('role', 'tab'); b.addEventListener('click', () => { periode = n; rStats(); }); c.append(b); });
    const m = $('#t-metric'); m.replaceChildren();
    [...Object.keys(MET), 'jeviens'].forEach(k => { const b = el('button', 'd-chip' + (metrique === k ? ' on' : ''), k === 'jeviens' ? '« Je viens »' : MET[k][0]); b.type = 'button'; b.addEventListener('click', () => { metrique = k; rGraphique(); enteteStats(); }); m.append(b); });
  }
  const nomMet = k => k === 'jeviens' ? '« Je viens » (personnes)' : MET[k][0];
  function rGraphique() {
    const d = dCour; if (!d) return;
    const vals = serie(d, metrique), tot = vals.reduce((a, b) => a + b, 0);
    const moy = barres($('#t-chart'), d.jours, vals, nomMet(metrique));
    $('#t-chart-sum').textContent = `${nomMet(metrique)} · ${fr(tot)} au total · ${dec(moy)} par jour`;
    // jour de la semaine
    const s = Array(7).fill(0), c = Array(7).fill(0); d.jours.forEach((j, i) => { s[dow(j)] += vals[i]; c[dow(j)]++; });
    $('#t-wd-m').textContent = nomMet(metrique) + ', moyenne par jour';
    const box = $('#t-wd'); box.replaceChildren();
    const moyJ = s.map((v, i) => c[i] ? v / c[i] : 0), max = Math.max(...moyJ, 0);
    if (!max) { box.append(el('p', 'd-vide', 'Pas encore de données.')); return; }
    moyJ.forEach((v, i) => { const row = el('div', 'row'), tr = el('div', 'tr'), f = el('i'); f.className = 'w-' + Math.max(v ? 1 : 0, Math.round(v / max * 20)); tr.append(f); row.append(el('span', '', JOURS[i]), el('b', '', dec(v)), el('small', '', ''), tr); box.append(row); });
  }
  async function rStats() {
    enteteStats();
    const kp = $('#t-kpis'); kp.replaceChildren(el('p', 'd-note', 'Chargement des chiffres…'));
    let d; try { d = await donnees(periode); } catch (e) { kp.replaceChildren(el('p', 'd-err-l', e.status === 404 ? 'Le Worker n’est pas à jour : collez la dernière version dans Cloudflare.' : e.message)); return; }
    dCour = d;
    $('#t-txt').textContent = `Du ${court(d.jours[0])} au ${court(d.fin)}${d.prevOk ? ` · comparé aux ${periode} jours d’avant` : ' · pas assez d’historique pour comparer'}`;
    kp.replaceChildren();
    KPI_STATS.forEach(k => kp.append(kpi(somme(d.cur, MET[k][1]), MET[k][0], MET[k][2], somme(d.cur, MET[k][1]), somme(d.prev, MET[k][1]), d.prevOk)));
    kp.append(kpi(jeViens(d.rsvpCur), '« Je viens » reçus', 'Personnes inscrites depuis un mail d’invitation', jeViens(d.rsvpCur), jeViens(d.rsvpPrev), d.prevOk));
    rGraphique();

    // les bons réflexes (rapports entre les chiffres)
    const S = k => somme(d.cur, MET[k][1]), visitesDe = c => somme(d.cur, r => r.type === 'visite' && r.id === 'site' && r.canal === c);
    const rap = (nom, a, b, fmt) => ({ nom, v: b ? fmt(a / b) : '–' });
    const R = [
      rap('Fiches ouvertes par visite', S('fiches'), S('visites'), x => dec(x)),
      rap('« J’y vais » pour 100 fiches ouvertes', S('jyvais') * 100, S('fiches'), x => dec(x)),
      rap('Clics pour chaque lien partagé', S('clics'), S('apercus'), x => dec(x)),
      rap('Boutons utilisés par kit ouvert', S('boutons'), S('kits'), x => dec(x)),
      rap('Ajouts au calendrier pour 100 fiches', S('agenda') * 100, S('fiches'), x => dec(x)),
      rap('Visites arrivées par un lien partagé laSave', visitesDe('partage') * 100, S('visites'), x => Math.round(x) + ' %'),
      rap('Visites arrivées depuis Google', visitesDe('google') * 100, S('visites'), x => Math.round(x) + ' %'),
      rap('Visites sans passer par un lien (accès direct)', visitesDe('direct') * 100, S('visites'), x => Math.round(x) + ' %'),
    ];
    const ul = $('#t-ratios'); ul.replaceChildren(); R.forEach(r => { const li = el('li'); li.append(el('span', '', r.nom), el('span', '', r.v)); ul.append(li); });

    liste($('#t-sources'), parCanal(d.cur, r => r.type === 'visite' && r.id === 'site' && r.canal !== 'interne', SOURCES), 'Aucune visite enregistrée.');
    liste($('#t-versions'), [...Object.keys(VERSIONS)].map(k => [VERSIONS[k], somme(d.cur, r => r.type === 'visite' && r.id === k)]), 'Aucune visite enregistrée.');
    liste($('#t-canaux'), parCanal(d.cur, r => r.type === 'lien', CANAUX), 'Aucun clic sur un lien partagé pour l’instant.');
    liste($('#t-apercus'), parCanal(d.cur, r => r.type === 'apercu', CANAUX), 'Aucun lien partagé pour l’instant.');
    liste($('#t-kit'), parCanal(d.cur, r => r.type === 'kit_action', KIT), 'Aucun bouton du kit utilisé pour l’instant.');
    liste($('#t-cal'), parCanal(d.cur, r => r.type === 'agenda', AGENDA), 'Aucun ajout au calendrier pour l’instant.');
    $('#t-nl').textContent = d.inscrits != null ? `Lettre : ${fr(d.inscrits)} inscrit${d.inscrits > 1 ? 's' : ''} au total, ${fr(S('lettre'))} sur la période.` : `Lettre : ${fr(S('lettre'))} nouvel${S('lettre') > 1 ? 's' : ''} inscrit${S('lettre') > 1 ? 's' : ''} sur la période.`;
    tableEv(); jamaisOuverts(); tableJours();
  }

  /* événement par événement */
  const COLS = [['fiche', 'Fiches', 'fiche'], ['apercu', 'Liens partagés', 'apercu'], ['lien', 'Clics', 'lien'], ['kit', 'Kits', 'kit'], ['jyvais', 'J’y vais', 'jyvais'], ['agenda', 'Calendrier', 'agenda'], ['venir', 'Je viens']];
  function parEvenement() {
    const m = {}; dCour.cur.forEach(r => { if (!/^rec/.test(r.id)) return; const o = m[r.id] = m[r.id] || { id: r.id, fiche: 0, apercu: 0, lien: 0, kit: 0, jyvais: 0, agenda: 0 }; if (r.type in o) o[r.type] += r.n; });
    L.ov.events.forEach(e => { if (!m[e.id] && (L.cle(e) === 'enligne' || L.venir(e.id))) m[e.id] = { id: e.id, fiche: 0, apercu: 0, lien: 0, kit: 0, jyvais: 0, agenda: 0 }; });
    return Object.values(m).map(o => ({ ...o, e: titreEv(o.id), venir: L.venir(o.id) }));
  }
  function tableEv() {
    const t = $('#t-ev'); t.replaceChildren();
    const norm = s => nettoie(s);
    let rows = parEvenement().filter(o => !qEv || norm([o.e && o.e.titre, o.e && o.e.orga, o.e && o.e.commune].join(' ')).includes(norm(qEv)));
    rows.sort((a, b) => (b[tri.k] - a[tri.k]) * -tri.s || (b.fiche - a.fiche));
    const total = rows.length, vus = toutEv || qEv ? rows : rows.slice(0, 15);
    const hr = el('tr'); hr.append(el('th', '', 'Événement'));
    COLS.forEach(([k, nom]) => { const th = el('th', 'num'), b = el('button', 't-sort' + (tri.k === k ? ' on' : ''), nom + (tri.k === k ? (tri.s < 0 ? ' ↓' : ' ↑') : '')); b.type = 'button'; b.addEventListener('click', () => { tri = { k, s: tri.k === k ? -tri.s : -1 }; tableEv(); }); th.append(b); hr.append(th); });
    { const th0 = el('thead'); th0.append(hr); t.append(th0); }
    const tb = el('tbody');
    if (!vus.length) { const tr = el('tr'), td = el('td', 'd-vide', 'Aucun événement.'); td.colSpan = 8; tr.append(td); tb.append(tr); }
    vus.forEach(o => {
      const tr = el('tr'), td = el('td', 'ev'); const b = el('button', 'd-link', o.e ? o.e.titre : 'Événement retiré de la liste'); b.type = 'button'; if (o.e) b.addEventListener('click', () => L.rend.fiche(o.e));
      td.append(b, el('small', '', o.e ? [o.e.commune, L.dateTexte(o.e), o.e.statut].filter(Boolean).join(' · ') : o.id)); tr.append(td);
      COLS.forEach(([k]) => tr.append(el('td', 'num' + (o[k] ? '' : ' zero'), o[k] ? fr(o[k]) : '–')));
      tb.append(tr);
    });
    t.append(tb);
    const more = $('#t-more'); more.hidden = qEv || total <= 15; more.textContent = toutEv ? 'Réduire la liste' : `Voir les ${total} événements`;
  }
  $('#t-more').addEventListener('click', () => { toutEv = !toutEv; tableEv(); });
  $('#t-q').addEventListener('input', e => { qEv = e.target.value.trim(); tableEv(); });
  function jamaisOuverts() {
    const vus = new Set(dCour.cur.filter(r => r.type === 'fiche').map(r => r.id));
    const l = L.ov.events.filter(e => L.cle(e) === 'enligne' && !vus.has(e.id));
    $('#t-zero-n').textContent = `${l.length} sur ${L.ov.events.filter(e => L.cle(e) === 'enligne').length}`;
    const ul = $('#t-zero'); ul.replaceChildren();
    if (!l.length) ul.append(el('li', 'd-vide', 'Tous les événements en ligne ont été ouverts au moins une fois.'));
    l.slice(0, 60).forEach(e => { const li = el('li'), b = el('button', 'd-btn sm ghost', e.titre || '(sans titre)'); b.type = 'button'; b.addEventListener('click', () => L.rend.fiche(e)); li.append(b); ul.append(li); });
  }
  /* jour par jour */
  const CJ = [['visites', 'Visites'], ['fiches', 'Fiches'], ['clics', 'Clics'], ['apercus', 'Aperçus'], ['kits', 'Kits'], ['boutons', 'Boutons'], ['jyvais', 'J’y vais'], ['agenda', 'Calendrier'], ['lettre', 'Lettre'], ['jeviens', 'Je viens']];
  function tableJours() {
    const d = dCour, t = $('#t-days'); t.replaceChildren();
    const S = Object.fromEntries(CJ.map(([k]) => [k, serie(d, k)]));
    const hr = el('tr'); hr.append(el('th', '', 'Jour')); CJ.forEach(([, n]) => hr.append(el('th', 'num', n))); { const th0 = el('thead'); th0.append(hr); t.append(th0); }
    const tb = el('tbody'), tr0 = el('tr', 'tot'); tr0.append(el('td', '', 'Total')); CJ.forEach(([k]) => tr0.append(el('td', 'num', fr(S[k].reduce((a, b) => a + b, 0))))); tb.append(tr0);
    for (let i = d.jours.length - 1; i >= 0; i--) { const tr = el('tr'); tr.append(el('td', '', L.dj(d.jours[i]).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }))); CJ.forEach(([k]) => tr.append(el('td', 'num' + (S[k][i] ? '' : ' zero'), S[k][i] ? fr(S[k][i]) : '–'))); tb.append(tr); }
    t.append(tb);
  }
  /* rapport texte pour Claude */
  $('#t-copy').addEventListener('click', async () => {
    const d = dCour; if (!d) return;
    const o = [`# Statistiques laSave : ${d.jours[0]} → ${d.fin} (${periode} jours)`, '', '## Totaux (comparaison avec les ' + periode + ' jours d’avant)'];
    KPI_STATS.forEach(k => { const c = somme(d.cur, MET[k][1]), p = somme(d.prev, MET[k][1]); o.push(`- ${MET[k][0]} : ${c} (avant : ${p})`); });
    o.push(`- Je viens : ${jeViens(d.rsvpCur)} personnes (avant : ${jeViens(d.rsvpPrev)})`, d.inscrits != null ? `- Inscrits à la lettre au total : ${d.inscrits}` : '');
    const bloc = (t, items) => { o.push('', '## ' + t); const l = items.filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]); o.push(...(l.length ? l.map(x => `- ${x[0]} : ${x[1]}`) : ['aucun'])); };
    bloc('Provenance des visiteurs', parCanal(d.cur, r => r.type === 'visite' && r.id === 'site' && r.canal !== 'interne', SOURCES));
    bloc('Versions du site', Object.keys(VERSIONS).map(k => [VERSIONS[k], somme(d.cur, r => r.type === 'visite' && r.id === k)]));
    bloc('Clics sur liens partagés par canal', parCanal(d.cur, r => r.type === 'lien', CANAUX));
    bloc('Liens partagés (aperçus) par canal', parCanal(d.cur, r => r.type === 'apercu', CANAUX));
    bloc('Boutons du kit', parCanal(d.cur, r => r.type === 'kit_action', KIT));
    bloc('Calendrier', parCanal(d.cur, r => r.type === 'agenda', AGENDA));
    o.push('', '## Par événement : titre | statut | fiches | aperçus | clics | kits | j’y vais | calendrier | je viens');
    parEvenement().sort((a, b) => b.fiche - a.fiche).slice(0, 60).forEach(x => o.push([x.e ? x.e.titre : x.id, x.e ? x.e.statut : '-', x.fiche, x.apercu, x.lien, x.kit, x.jyvais, x.agenda, x.venir].join(' | ')));
    o.push('', '## Jour par jour : ' + ['jour', ...CJ.map(c => c[1])].join(' | '));
    const S = Object.fromEntries(CJ.map(([k]) => [k, serie(d, k)])); d.jours.forEach((j, i) => o.push([j, ...CJ.map(([k]) => S[k][i])].join(' | ')));
    const txt = o.join('\n');
    try { await navigator.clipboard.writeText(txt); msg('Chiffres copiés. Collez-les dans la conversation avec Claude.'); }
    catch (_) { const a = document.createElement('textarea'); a.value = txt; document.body.append(a); a.select(); const ok = document.execCommand('copy'); a.remove(); msg(ok ? 'Chiffres copiés.' : 'Copie impossible.', !ok); }
  });
  L.rend.stats = rStats;
})();
