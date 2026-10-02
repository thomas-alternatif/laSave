/* laSave : tableau de bord, pages Système, Raccourcis et fiche d'un événement */
(() => {
  'use strict';
  const L = window.LS;
  const { $, el, fr, pl, call, msg, SITE, API } = L;

  const parisHeure = ms => new Date(ms).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const iso = s => (s ? parisHeure(Date.parse(s)) : '–');
  const lien = (txt, href, cls = 'd-btn sm') => { const a = el('a', cls, txt); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; };

  /* ───────────── Raccourcis ───────────── */
  const AT = 'https://airtable.com/appHgiuv0ClNd8qsV', CFW = 'https://dash.cloudflare.com/?to=/:account/workers', GH = 'https://github.com/thomas-alternatif/laSave';
  const GROUPES = [
    ['Le site', [
      ['Accueil', `${SITE}/`, 'La page publique'],
      ['Proposer un événement', `${SITE}/#partager`, 'Le formulaire des organisateurs'],
      ['Site de test (test13)', `${SITE}/test13/`, 'La nouvelle version, pas encore en ligne'],
      ['Kit de partage', `${SITE}/test13/kit.html`, 'Page d’un organisateur (ajouter ?id=…)'],
      ['Statistiques détaillées', 'stats.html', 'Visiteurs, canaux, boutons du kit'],
      ['Lettre d’information', 'newsletter.html', 'Écrire et envoyer la lettre'],
      ['Sauvegarde des affiches', 'archive.html', 'Télécharger les affiches en .zip'],
      ['Copie de secours', `${SITE}/data/seed.json`, 'Export utilisé si Airtable est bloqué'],
    ]],
    ['Données (Airtable)', [
      ['Ouvrir la base', AT, 'Toute la base laSave'],
      ['Événements', `${AT}/tbl6Um2XQPq4JPxCg`, 'La table des événements'],
      ['Propositions à valider', `${AT}/tbl6Um2XQPq4JPxCg/viwCiOhdUjqqYZGIV`, 'Vue grille « Propositions »'],
      ['Calendrier', `${AT}/tbl6Um2XQPq4JPxCg/viwovCZ6vtYv6lE2x`, 'Vue calendrier des événements'],
      ['Organisateurs', `${AT}/tblgaldbDy7el5Qw1`, 'Codes, mails, demandes'],
      ['Avis', `${AT}/tbl1VfPYliWdORuzN`, 'Avis reçus par le site'],
      ['Automatisations', `${AT}/workflow`, 'Mail « nouvelle proposition » et rappels'],
      ['Jetons d’accès', 'https://airtable.com/create/tokens', 'La clé que le Worker utilise'],
    ]],
    ['Serveur (Cloudflare)', [
      ['Worker lasave-api', `${CFW}/services/view/lasave-api/production`, 'Le cerveau du site'],
      ['Journaux en direct', `${CFW}/services/view/lasave-api/production/observability/logs`, 'Erreurs et appels en temps réel'],
      ['Variables et déclencheurs', `${CFW}/services/view/lasave-api/production/settings`, 'Clés secrètes, liaisons, tâche de nuit'],
      ['Mémoire KV (lasave-cache)', 'https://dash.cloudflare.com/?to=/:account/workers/kv/namespaces/11ad5ae7b845425eac8e5361aa4b871d', 'Copie de l’agenda, compteurs'],
      ['Base D1 lasave-stats', 'https://dash.cloudflare.com/?to=/:account/workers/d1/databases/8d8b10fc-648b-4085-becd-6a9c71e7bbfe', 'Statistiques et « Je viens »'],
      ['Base D1 lasave_stats', 'https://dash.cloudflare.com/?to=/:account/workers/d1/databases/ff606747-eb8e-4cdc-bf13-017f566b4070', 'La plus ancienne, sans doute inutilisée'],
      ['Tous les Workers', `${CFW}-and-pages`, 'Dont le Worker « lasave »'],
    ]],
    ['Code (GitHub)', [
      ['Dépôt laSave', GH, 'Tout le code du site'],
      ['Dernières modifications', `${GH}/commits/main`, 'Qui a changé quoi, quand'],
      ['Dossier test13', `${GH}/tree/main/test13`, 'La version de test'],
      ['Code du Worker', `${GH}/blob/main/worker/lasave-api.js`, 'Le fichier à coller dans Cloudflare'],
      ['Publication du site', `${GH}/actions`, 'État des mises en ligne (GitHub Pages)'],
      ['Réglages Pages', `${GH}/settings/pages`, 'Domaine la-save.fr'],
    ]],
    ['Mails', [
      ['Brevo', 'https://app.brevo.com/', 'Envoi des mails et de la lettre'],
      ['Contacts Brevo', 'https://app.brevo.com/contact', 'Inscrits à la lettre'],
      ['Boîte agenda@ (Zoho)', 'https://mail.zoho.eu/', 'Réponses des organisateurs'],
      ['Écrire à agenda@', 'mailto:agenda@la-save.fr', 'Adresse d’envoi du site'],
    ]],
    ['Vérifier que ça marche', [
      ['Santé de l’API', `${API}/health`, 'Doit répondre « ok: true »'],
      ['Agenda (données publiques)', `${API}/events`, 'Ce que voit le site'],
      ['Organisateurs publics', `${API}/orgas`, 'Les associations affichées'],
      ['Mettre le site à jour', `${API}/lien/maj`, 'Page de relecture pour Airtable'],
      ['Hébergement des affiches (ImgBB)', 'https://imgbb.com/', 'Où partent les affiches envoyées'],
    ]],
  ];
  L.rend.raccourcis = () => {
    const g = $('#r-grid'); if (g.dataset.ok) return; g.dataset.ok = '1';
    GROUPES.forEach(([nom, items]) => {
      const sec = el('section', 'd-group'); sec.append(el('h2', 'd-h2', nom));
      const ul = el('ul', 'd-tiles');
      items.forEach(([t, href, d]) => {
        const li = el('li'), a = el('a'); a.href = href; if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
        a.append(el('b', '', t), el('small', '', d)); li.append(a); ul.append(li);
      });
      sec.append(ul); g.append(sec);
    });
  };

  /* ───────────── Fiche d'un événement ───────────── */
  const CHAMPS = [['Titre', 'text'], ['Date', 'date'], ['Date de fin', 'date'], ['Heure', 'text'], ['Lieu', 'text'], ['Commune', 'commune'], ['Catégorie', 'cat'], ['Organisation', 'text'], ['Tarif', 'text'], ['Contact', 'text'], ['Billetterie', 'text'], ['Contact privé', 'text'], ['Message aux organisateurs', 'area'], ['Description', 'area'], ['À la une', 'check']];
  const fermer = () => { $('#d-sheet').hidden = true; document.body.classList.remove('lock'); };
  $('#d-sheet').addEventListener('click', e => { if (e.target.id === 'd-sheet') fermer(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#d-sheet').hidden) fermer(); });
  const texte = v => Array.isArray(v) ? v.map(x => (x && typeof x === 'object') ? (x.filename || x.name || x.url || JSON.stringify(x)) : x).join(', ') : (v && typeof v === 'object') ? JSON.stringify(v) : String(v);

  L.rend.fiche = async e => {
    const box = $('#d-sheet-box'); box.replaceChildren(el('p', 'd-vide', 'Chargement de la fiche…'));
    $('#d-sheet').hidden = false; document.body.classList.add('lock');
    let d; try { d = await call('/admin/event/' + e.id); } catch (er) { box.replaceChildren(el('p', 'd-vide', er.message)); return; }
    const f = d.champs, k = L.cle(e);
    const tete = el('div', 'sh-tete'), x = el('button', 'd-btn sm ghost', 'Fermer'); x.type = 'button'; x.addEventListener('click', fermer);
    const h = el('div'); h.append(el('h2', '', f.Titre || '(sans titre)'), el('p', 'd-sub', [L.dateTexte(e), L.sous(e)].filter(Boolean).join(' · ')));
    tete.append(h, x);
    const pillTxt = k === 'passes' ? 'Passé' : f.Statut || 'En attente';
    const ligne1 = el('div', 'sh-ligne'); ligne1.append(el('span', 'd-pill p-' + pillTxt.replace(/\s/g, ''), pillTxt), el('span', 'd-note', d.enLigne ? 'Visible sur le site' : 'Pas visible sur le site'));
    // actions de statut
    const acts = el('div', 'sh-ligne');
    const st = (txt, cls, s) => { const b = el('button', 'd-btn sm ' + cls, txt); b.type = 'button'; b.addEventListener('click', async () => { if (await L.changer(e, s, b)) { L.recompter(); fermer(); } }); acts.append(b); };
    if (k === 'attente') { st('Publier', 'ok', 'Publié'); st('Refuser', 'warn', 'Refusé'); }
    else if (k === 'enligne' || k === 'passes') st('Archiver', k === 'passes' ? 'main' : '', 'Archivé');
    else if (k === 'archives') st('Remettre en ligne', '', 'Publié');
    else if (k === 'refuses') st('Remettre en attente', '', 'En attente');
    // liens
    const liens = el('div', 'sh-ligne');
    liens.append(lien('Airtable', d.airtable), lien('Kit organisateur', d.kit), lien("Page de partage", d.partage || `${API}/e/${e.id}`), lien('Ajout au calendrier', `${API}/ics/${e.id}`), lien('Formulaire « Je viens »', `${API}/venir/${e.id}`));
    if (d.enLigne) liens.append(lien('Fiche sur le site', `${SITE}/#event-${e.id}`));
    // chiffres
    const total = d.reponses.reduce((a, r) => a + (+r.nb || 0), 0), att = d.compteursEnAttente || {};
    const chiffres = el('div', 'd-kpis sh-kpis');
    [[(f.Likes || 0) + (att.Likes || 0), '« J’y vais »'], [(f.Vues || 0) + (att.Vues || 0), 'Vues'], [total, 'Personnes qui viennent']].forEach(([n, t]) => { const c = el('div', 'd-kpi'); c.append(el('b', '', fr(n)), el('span', '', t)); chiffres.append(c); });
    // mails
    const mails = el('ul', 'sh-liste');
    const m1 = el('li'); m1.append(el('span', '', 'Mail « C’est en ligne »'), el('b', d.mailPublication ? 'ok' : '', d.mailPublication ? 'envoyé ' + iso(d.mailPublication) : f['Contact privé'] ? 'pas encore envoyé' : 'pas d’adresse de contact'));
    const m2 = el('li'); m2.append(el('span', '', 'Mail récapitulatif « Qui vient »'), el('b', d.mailRecap ? 'ok' : '', d.mailRecap ? 'envoyé ' + iso(d.mailRecap) : 'pas envoyé'));
    const m3 = el('li'); m3.append(el('span', '', 'Confirmation par mail (case Airtable)'), el('b', '', f['Envoyer la confirmation'] ? 'case cochée · ' + (f['Confirmation par mail'] || 'en attente') : 'case non cochée'));
    mails.append(m1, m2, m3);
    // formulaire de modification
    const form = el('form', 'sh-form'); form.noValidate = true;
    const dl1 = el('datalist'); dl1.id = 'dl-commune'; const dl2 = el('datalist'); dl2.id = 'dl-cat';
    [...new Set(L.ov.events.map(v => v.commune).filter(Boolean))].sort().forEach(v => dl1.append(Object.assign(el('option'), { value: v })));
    [...new Set(L.ov.events.map(v => v.cat).filter(Boolean))].sort().forEach(v => dl2.append(Object.assign(el('option'), { value: v })));
    const inputs = {};
    CHAMPS.forEach(([nom, type]) => {
      const lab = el('label', 'sh-champ' + (type === 'area' ? ' large' : '') + (type === 'check' ? ' case' : '')); const idc = 'f-' + nom.replace(/\W/g, '');
      lab.setAttribute('for', idc); let inp;
      if (type === 'area') { inp = el('textarea'); inp.rows = nom === 'Description' ? 6 : 3; inp.value = f[nom] || ''; }
      else if (type === 'check') { inp = el('input'); inp.type = 'checkbox'; inp.checked = !!f[nom]; }
      else { inp = el('input'); inp.type = type === 'date' ? 'date' : 'text'; inp.value = f[nom] || ''; if (type === 'commune') inp.setAttribute('list', 'dl-commune'); if (type === 'cat') inp.setAttribute('list', 'dl-cat'); }
      inp.id = idc; inputs[nom] = [inp, type];
      if (type === 'check') lab.append(inp, el('span', '', nom)); else lab.append(el('span', '', nom), inp);
      form.append(lab);
    });
    const barre = el('div', 'sh-ligne large'), save = el('button', 'd-btn main', 'Enregistrer les modifications'); save.type = 'submit';
    barre.append(save, el('span', 'd-note', 'Commune et catégorie doivent déjà exister dans Airtable.')); form.append(barre, dl1, dl2);
    form.addEventListener('submit', async ev => {
      ev.preventDefault(); const champs = {};
      for (const [nom, [inp, type]] of Object.entries(inputs)) {
        const nouv = type === 'check' ? inp.checked : inp.value.trim(), ancien = type === 'check' ? !!f[nom] : String(f[nom] || '').trim();
        if (nouv !== ancien) champs[nom] = nouv;
      }
      if (!Object.keys(champs).length) { msg('Aucune modification.'); return; }
      save.disabled = true;
      try { await call(`/admin/event/${e.id}/fields`, { method: 'POST', body: JSON.stringify({ fields: champs }) }); msg('Modifications enregistrées. L’agenda se met à jour dans la minute.'); fermer(); await L.charger(true); }
      catch (er) { msg(er.message, true); save.disabled = false; }
    });
    // réponses « Je viens »
    const rep = el('ul', 'sh-liste');
    if (!d.reponses.length) rep.append(Object.assign(el('li'), { textContent: 'Aucune réponse pour le moment.' }));
    d.reponses.forEach(r => { const li = el('li'); li.append(el('span', '', r.prenom), el('b', '', r.nb > 1 ? pl(r.nb, 'personne', 'personnes') : '1 personne')); rep.append(li); });
    // tous les champs
    const det = el('details', 'd-det'); det.append(el('summary', '', 'Tous les champs Airtable'));
    const dl = el('dl', 'sh-champs'); Object.keys(f).sort().forEach(n => { dl.append(el('dt', '', n), el('dd', '', texte(f[n]))); });
    dl.append(el('dt', '', 'Identifiant'), el('dd', '', d.id), el('dt', '', 'Créé le'), el('dd', '', iso(d.cree)));
    det.append(dl);
    const sec = (t, ...n) => { const s = el('section', 'sh-sec'); s.append(el('h3', 'd-h2', t), ...n); return s; };
    box.replaceChildren(tete, ligne1, acts, liens, chiffres, sec('Mails', mails), sec('Modifier', form), sec('Qui vient', rep), det);
    box.scrollTop = 0;
  };

  /* ───────────── Système ───────────── */
  let diag = null, filtreJ = 'tous';
  const OPTION = new Set(['STATS', 'CF_ACCOUNT_ID', 'CF_STATS_TOKEN', 'NEWSLETTER_LIST']);
  const NOMS_LIAISON = { AIRTABLE_TOKEN: 'Clé Airtable', ADMIN_PWD: 'Mot de passe admin', IMGBB_KEY: 'Clé ImgBB (affiches)', BREVO_KEY: 'Clé Brevo (mails)', LASAVE: 'Mémoire KV', DB: 'Base D1', STATS: 'Analytics Engine (ancien)', CF_ACCOUNT_ID: 'Compte Cloudflare (ancien)', CF_STATS_TOKEN: 'Jeton statistiques (ancien)', NEWSLETTER_LIST: 'Liste newsletter (variable)' };
  const COMMENT = [
    'Le site est en HTML/JS simple, hébergé par GitHub Pages (dépôt thomas-alternatif/laSave, domaine la-save.fr). La version de test est dans le dossier test13.',
    'Le site ne parle jamais à Airtable directement : il passe par le Worker Cloudflare « lasave-api », qui garde les clés secrètes.',
    'Airtable (gratuit) n’autorise que 1 000 appels par mois : le Worker garde une copie de l’agenda dans KV et ne relit Airtable qu’à la nuit, à la publication, ou sur demande.',
    'Chaque nuit à 4 h UTC : mail récapitulatif « Qui vient », recopie des « J’y vais » et vues dans Airtable, relecture de l’agenda, nettoyage des réponses anciennes.',
    'Les statistiques et les réponses « Je viens » sont dans la base D1 (SQLite) ; les compteurs en attente de recopie sont dans KV.',
    'Les mails partent par Brevo depuis agenda@la-save.fr. Le mail « C’est en ligne » part quand un événement est publié et qu’un Contact privé existe.',
    'Pour changer le Worker : modifier lasave-api.js, le coller dans Cloudflare (Edit code, tout remplacer, Deploy). Pour le site : pousser sur GitHub, en ligne en une minute.',
  ];

  function carte(titre, lignes, err) {
    const c = el('section', 'd-card d-sys'); c.append(el('h2', 'd-h2 in', titre));
    if (err) { c.append(el('p', 'd-err-l', 'Impossible de lire : ' + err)); return c; }
    const ul = el('ul', 'd-health');
    lignes.forEach(([n, v, etat]) => { if (v === undefined) return; const li = el('li'); li.append(el('span', '', n), el('span', etat || '', String(v))); ul.append(li); });
    c.append(ul); return c;
  }
  const oui = (v, a = 'oui', b = 'non') => v ? [a, 'ok'] : [b, 'ko'];
  const ligneOk = (n, v, a, b) => { const [t, e] = oui(v, a, b); return [n, t, e]; };

  function rendreCartes(d) {
    const g = $('#sy-grid'); g.innerHTML = '';
    g.append(carte('Version et liaisons', [
      ['Version du Worker', d.version], ['Heure à Paris', d.parisHeure],
      ...Object.entries(d.liaisons).map(([k, v]) => [NOMS_LIAISON[k] || k, v ? 'reliée' : OPTION.has(k) ? 'absente (facultatif)' : 'MANQUANTE', v ? 'ok' : OPTION.has(k) ? '' : 'ko']),
    ]));
    const c = d.copie;
    g.append(carte('Copie de l’agenda', c.erreur ? [] : c.presente ? [
      ['Mise à jour', `il y a ${c.ageMinutes} min`, c.ageMinutes > 1500 ? 'ko' : 'ok'], ['Événements en ligne', c.evenements], ['Organisateurs affichés', c.organisateurs], ['Avec affiche', `${c.avecPhoto} sur ${c.evenements + c.organisateurs}`],
      ['Relecture demandée', c.aRelire ? 'oui, au prochain passage' : 'non'], ['Issue de la copie de secours', c.depuisExport ? 'OUI' : 'non', c.depuisExport ? 'ko' : ''], ['Affiches en cours de copie', c.photosEnAttente ? 'oui' : 'non'],
    ] : [['Copie', 'absente', 'ko']], c.erreur));
    const n = d.nuit;
    g.append(carte('Mise à jour de nuit', n.erreur ? [] : [['Dernier passage', n.derniere ? iso(n.derniere) : 'jamais vu', n.derniere ? '' : 'ko'], ['Durée', n.dureeMs != null ? Math.round(n.dureeMs / 1000) + ' s' : undefined], ['Problème signalé', n.erreur || 'aucun', n.erreur ? 'ko' : 'ok'], ['Prochain passage', 'chaque jour à 4 h UTC (6 h en été)']], n.erreur));
    const a = d.airtable;
    const cardA = carte('Airtable', a.erreur ? [] : [
      ['Appels ce mois-ci', `${fr(a.appelsCeMois)} sur ${fr(a.quotaMois)}`, a.appelsCeMois > 800 ? 'ko' : a.appelsCeMois > 500 ? '' : 'ok'],
      ...Object.entries(a.evenementsParStatut).map(([s, v]) => ['Événements « ' + s + ' »', v]),
      ['Publiés mais passés', a.publiesPasses, a.publiesPasses ? 'ko' : 'ok'], ['En ligne sans affiche', a.sansAffiche], ['Organisateurs', a.organisateurs], ['Demandes de code', a.demandesDeCode], ['Confirmations en attente', a.confirmationsEnAttente], ['Dernière lecture', iso(a.lectureLe)],
    ], a.erreur);
    if (!a.erreur) { const bar = el('div', 'd-bar-q'); const i = el('i'); i.className = 'q-' + Math.min(10, Math.round(a.appelsCeMois / a.quotaMois * 10)); bar.append(i); cardA.insertBefore(bar, cardA.querySelector('ul')); }
    g.append(cardA);
    const b = d.brevo;
    g.append(carte('Mails (Brevo)', b.erreur ? [] : b.configuree ? [['Compte', b.compte || '–'], ...(b.forfaits || []).map(p => ['Forfait ' + p.type, p.credits != null ? fr(p.credits) + ' crédits' + (p.periode ? ' / ' + p.periode : '') : '–']), ['Liste newsletter', b.listeNewsletter || 'pas encore créée'], ['Inscrits', b.inscrits != null ? fr(b.inscrits) : '–']] : [['Brevo', 'clé manquante', 'ko']], b.erreur));
    const k = d.kv;
    g.append(carte('Mémoire KV', k.erreur ? [] : [['Clés', fr(k.cles)], ['Compteurs en attente de recopie', k.compteursEnAttente], ...Object.entries(k.groupes).sort((x, y) => y[1].nombre - x[1].nombre).map(([nom, v]) => [nom.replace(/:$/, ' …'), v.nombre])], k.erreur));
    const q = d.d1;
    g.append(carte('Base D1', q.erreur ? [] : !q.reliee ? [['Base', 'non reliée', 'ko']] : [...Object.entries(q.lignesParTable).map(([t, v]) => ['Lignes dans « ' + t + ' »', fr(v)]), ['Statistiques', q.stats && q.stats.du ? `du ${q.stats.du} au ${q.stats.au}` : 'vides'], ...Object.entries((q.stats && q.stats.parType) || {}).map(([t, v]) => ['· ' + t, fr(v)]), ['« Je viens »', `${fr(q.rsvp.personnes)} personnes sur ${fr(q.rsvp.evenements)} événements`]], q.erreur));
  }

  const TYPES = { tous: 'Tout', admin: 'Actions', mail: 'Mails', cron: 'Nuit', erreur: 'Erreurs', securite: 'Sécurité' };
  function rendreJournal(d) {
    const j = d.journal || [], chips = $('#sy-jchips'); chips.innerHTML = '';
    $('#sy-jn').textContent = `${j.length} dernières lignes`;
    Object.entries(TYPES).forEach(([t, nom]) => {
      const nb = t === 'tous' ? j.length : j.filter(x => x.type === t).length;
      const b = el('button', 'd-chip' + (filtreJ === t ? ' on' : ''), nom); b.type = 'button'; b.append(Object.assign(el('i'), { textContent: nb }));
      b.addEventListener('click', () => { filtreJ = t; rendreJournal(d); }); chips.append(b);
    });
    const ul = $('#sy-journal'); ul.innerHTML = '';
    const l = j.filter(x => filtreJ === 'tous' || x.type === filtreJ);
    if (!l.length) ul.append(el('li', 'd-vide', 'Rien à signaler.'));
    l.forEach(x => { const li = el('li', 'j-' + x.type); li.append(el('time', '', parisHeure(x.t)), el('span', 'd-pill j-p', TYPES[x.type] || x.type), el('span', 'j-m', x.msg + (x.ip ? ' (' + x.ip + ')' : '') + (x.status ? ' [' + x.status + ']' : ''))); ul.append(li); });
  }

  /* rapport texte pour Claude */
  function rapport(d) {
    const ov = L.ov, o = [];
    const J = v => JSON.stringify(v);
    o.push('# Rapport laSave — ' + d.parisHeure + ' (Paris)', `Version du Worker : ${d.version}`, '');
    o.push('## Comment le site fonctionne', ...COMMENT.map(x => '- ' + x), '', '## Liaisons du Worker', J(d.liaisons), '', '## Configuration', J(d.configuration), '');
    ['copie', 'nuit', 'airtable', 'kv', 'd1', 'brevo'].forEach(k => o.push('## ' + k, J(d[k]), ''));
    o.push('## Erreurs récentes', ...(d.erreursRecentes.length ? d.erreursRecentes.map(x => `- ${parisHeure(x.t)} [${x.type}] ${x.msg}`) : ['aucune']), '');
    o.push(`## Journal (${d.journal.length} lignes)`, ...d.journal.slice(0, 60).map(x => `- ${parisHeure(x.t)} [${x.type}] ${x.msg}${x.ip ? ' ip ' + x.ip : ''}`), '');
    if (ov) {
      const dem = x => (x.date || 'sans date') + (x.fin && x.fin !== x.date ? '→' + x.fin : '');
      o.push(`## Événements (${ov.events.length}) : id | statut | classe | date | titre | commune | likes | vues | affiche | contact | je viens`);
      ov.events.slice().sort((a, b) => (a.statut || '').localeCompare(b.statut || '') || (a.date || '').localeCompare(b.date || '')).forEach(e => o.push([e.id, e.statut, L.cle(e), dem(e), e.titre, e.commune, e.likes, e.vues, e.photo ? 'affiche' : 'sans affiche', e.contact ? 'contact' : '-', L.venir(e.id) || 0].join(' | ')));
      o.push('', `## Organisateurs (${ov.orgas.length}) : id | nom | statut code | affiché | a un code | a un mail`);
      ov.orgas.forEach(g => o.push([g.id, g.nom, g.statutCode || '-', g.publie ? 'affiché' : 'masqué', g.code ? 'oui' : 'non', g.email ? 'oui' : 'non'].join(' | ')));
      o.push('');
    }
    o.push('## Adresses de l’API', ...d.routes.map(x => '- ' + x), '', '## Contexte pour Claude', '- Thomas (conseiller municipal de Saint-Paul-sur-Save) construit laSave. Réponses en français simple, concis. Ne jamais lui demander de mot de passe ni de clé. Dépôt local : ~/Downloads/lasave-tmp (ne rien mettre d’autre sur son ordinateur). Le Worker se colle à la main dans Cloudflare.');
    return o.join('\n');
  }
  const copier = async txt => { try { await navigator.clipboard.writeText(txt); return true; } catch (_) { const t = $('#sy-rapport'); const d = t.closest('details'); d.open = true; t.focus(); t.select(); try { return document.execCommand('copy'); } catch (__) { return false; } } };

  async function charger() {
    const g = $('#sy-grid'); g.replaceChildren(el('p', 'd-note', 'Lecture du système…'));
    $('#sy-copy').disabled = true;
    try { diag = await call('/admin/diag'); } catch (e) { g.replaceChildren(el('p', 'd-err-l', e.status === 404 ? 'Le Worker n’est pas à jour : collez la dernière version dans Cloudflare.' : e.message)); return; }
    rendreCartes(diag); rendreJournal(diag);
    $('#sy-rapport').value = rapport(diag); $('#sy-copy').disabled = false;
    const how = $('#sy-how'), rt = $('#sy-routes');
    how.innerHTML = ''; COMMENT.forEach(t => how.append(el('li', '', t)));
    rt.innerHTML = ''; diag.routes.forEach(t => rt.append(el('li', 'mono', t)));
  }
  L.rend.systeme = () => { if (!diag) charger(); };
  $('#sy-reload').addEventListener('click', () => { diag = null; charger(); });
  $('#sy-copy').addEventListener('click', async () => { if (!diag) return; msg((await copier($('#sy-rapport').value)) ? 'Rapport copié. Collez-le dans la conversation avec Claude.' : 'Copie impossible : sélectionnez le texte du rapport et copiez-le.', false); });

  /* console KV */
  $('#kv-go').addEventListener('click', async () => {
    const ul = $('#kv-list'); ul.replaceChildren(el('li', 'd-vide', 'Chargement…')); $('#kv-val').hidden = true;
    try {
      const d = await call('/admin/kv'); ul.innerHTML = '';
      const ordre = d.cles.slice().sort((a, b) => a.nom.localeCompare(b.nom));
      if (!ordre.length) ul.append(el('li', 'd-vide', 'Aucune clé.'));
      ordre.slice(0, 400).forEach(c => {
        const li = el('li'), b = el('button', 'd-link mono', c.nom); b.type = 'button';
        b.addEventListener('click', async () => {
          const pre = $('#kv-val'); pre.hidden = false; pre.textContent = 'Chargement…';
          try { const v = await call('/admin/kv?cle=' + encodeURIComponent(c.nom)); let t = v.valeur; try { t = JSON.stringify(JSON.parse(t), null, 2); } catch (_) {} pre.textContent = `${v.cle} · ${fr(v.taille)} caractères${v.tronque ? ' (début affiché)' : ''}\n\n${t}`; pre.scrollIntoView({ block: 'nearest' }); }
          catch (e) { pre.textContent = e.message; }
        });
        li.append(b, el('small', '', c.expire ? 'expire ' + parisHeure(c.expire * 1000) : 'permanent')); ul.append(li);
      });
      if (ordre.length > 400) ul.append(el('li', 'd-vide', `… et ${ordre.length - 400} autres clés.`));
    } catch (e) { ul.replaceChildren(el('li', 'd-vide', e.message)); }
  });

  /* console D1 */
  const PRE = [['Tables', "SELECT name FROM sqlite_master WHERE type='table'"], ['Visites par jour', "SELECT jour, SUM(n) AS visites FROM stats WHERE type='visite' GROUP BY jour ORDER BY jour DESC LIMIT 30"], ['Par type', 'SELECT type, SUM(n) AS total FROM stats GROUP BY type'], ['Je viens', 'SELECT ev, prenom, nb, fin FROM rsvp ORDER BY at DESC LIMIT 50'], ['Structure stats', 'PRAGMA table_info(stats)']];
  PRE.forEach(([n, q]) => { const b = el('button', 'd-chip', n); b.type = 'button'; b.addEventListener('click', () => { $('#sql-q').value = q; $('#sql-run').click(); }); $('#sql-pre').append(b); });
  $('#sql-run').addEventListener('click', async () => {
    const out = $('#sql-out'), info = $('#sql-info'); out.replaceChildren(); info.textContent = 'Requête en cours…';
    try {
      const d = await call('/admin/sql', { method: 'POST', body: JSON.stringify({ q: $('#sql-q').value }) });
      info.textContent = pl(d.lignes.length, 'ligne', 'lignes');
      if (!d.lignes.length) return;
      const t = el('table', 'd-table'), tr = el('tr'); d.colonnes.forEach(c => tr.append(el('th', '', c))); { const th0 = el('thead'); th0.append(tr); t.append(th0); }
      const tb = el('tbody'); d.lignes.forEach(r => { const x = el('tr'); d.colonnes.forEach(c => x.append(el('td', '', r[c] == null ? '' : String(r[c])))); tb.append(x); }); t.append(tb); out.append(t);
    } catch (e) { info.textContent = e.message; }
  });
  $('#sql-q').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) $('#sql-run').click(); });
})();
