/* laSave — page de statistiques (réservée à la mairie) */
(() => {
  'use strict';
  const API = 'https://lasave-api.partage.workers.dev';
  const $ = s => document.querySelector(s);
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const fr = n => Math.round(n).toLocaleString('fr-FR');

  const CANAUX = {
    wa: 'WhatsApp', fb: 'Facebook', sms: 'SMS', mail: 'E-mail (kit)', invitation: 'Invitation mail',
    lien: 'Partage direct (kit)', copie: 'Lien copié', legende: 'Légende Instagram / Facebook', story: 'Story',
    site: 'Bouton « Partager » du site', mailpub: 'Mail de confirmation', qr: 'QR code', '': 'Autre / inconnu',
  };
  const SOURCES = { direct: 'Accès direct (favori, adresse tapée, appli)', interne: 'Navigation interne', partage: 'Lien partagé laSave', google: 'Google', facebook: 'Facebook / Messenger', instagram: 'Instagram', recherche: 'Autres moteurs de recherche', mairie: 'Site de la mairie, IntraMuros, Linktree', autre: 'Autres sites' };
  const KIT = { story: 'Partager en story', post: 'Partager le visuel', lien: 'Envoyer le lien', copie: 'Copier le lien', legende: 'Copier la légende', mail: 'Copier l’invitation mail', wa: 'WhatsApp', sms: 'SMS' };

  let token = '';
  try { token = sessionStorage.getItem('lasave_admin') || ''; } catch (_) {}
  let jours = 30, events = [];

  const call = async (path, opts = {}) => {
    const r = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(opts.headers || {}) } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.error || 'Erreur ' + r.status), { status: r.status });
    return d;
  };

  $('#s-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const msg = $('#s-msg'); msg.className = 's-msg'; msg.textContent = 'Connexion…';
    try {
      const d = await call('/admin/login', { method: 'POST', body: JSON.stringify({ pwd: $('#s-pwd').value }) });
      token = d.token; try { sessionStorage.setItem('lasave_admin', token); } catch (_) {}
      msg.textContent = ''; show();
    } catch (e) { msg.className = 's-msg err'; msg.textContent = e.status === 429 ? 'Trop d’essais, réessayez dans quelques minutes.' : e.message; }
  });

  $('#s-test').addEventListener('submit', async ev => {
    ev.preventDefault();
    const msg = $('#s-test-msg'), btn = ev.target.querySelector('button');
    msg.className = 's-msg'; msg.textContent = 'Envoi…'; btn.disabled = true;
    try {
      const d = await call('/admin/test-mail', { method: 'POST', body: JSON.stringify({ to: $('#s-test-mail').value.trim() }) });
      msg.textContent = `Envoyé${d.titre ? ` (avec « ${d.titre} »)` : ''}. Regardez aussi dans les spams.`;
    } catch (e) {
      msg.className = 's-msg err';
      msg.textContent = e.status === 404 && !e.message.includes('événement') ? 'Mettez à jour le code du Worker dans Cloudflare pour activer le test.' : e.message;
    } finally { btn.disabled = false; }
  });

  document.querySelectorAll('.s-tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.s-tabs button').forEach(x => x.classList.toggle('on', x === b));
    jours = +b.dataset.j; load();
  }));

  async function show() {
    $('#s-login').hidden = true; $('#s-body').hidden = false;
    try { events = await call('/events'); } catch (_) { events = []; }
    load();
  }

  async function load() {
    $('#s-periode-txt').textContent = `${jours} derniers jours`;
    $('#s-err').hidden = true;
    let d;
    try { d = await call('/admin/stats?jours=' + jours); }
    catch (e) {
      if (e.status === 401) { token = ''; try { sessionStorage.removeItem('lasave_admin'); } catch (_) {} $('#s-body').hidden = true; $('#s-login').hidden = false; return; }
      $('#s-err').textContent = e.message; $('#s-err').hidden = false; return;
    }
    render(d);
  }

  function render(d) {
    const dg = $('#s-diag');
    if (d.diag) { dg.hidden = false; dg.textContent = `Diagnostic : jeux de données trouvés chez Cloudflare → ${d.diag.tables.length ? d.diag.tables.join(', ') : 'aucun'} · lignes dans « lasave_stats » : ${d.diag.lignes}`; }
    else dg.hidden = true;
    const rows = d.parEvenement.map(r => ({ ...r, n: +r.n || 0 }));
    const somme = (f) => rows.filter(f).reduce((a, r) => a + r.n, 0);
    const kpi = [
      [somme(r => r.type === 'visite'), 'Visites', 'Personnes venues sur le site (une par session)'],
      [somme(r => r.type === 'fiche'), 'Fiches consultées', 'Événements ouverts sur le site'],
      [somme(r => r.type === 'apercu'), 'Liens partagés', 'Postés sur WhatsApp, Facebook, Messenger…'],
      [somme(r => r.type === 'lien'), 'Clics sur ces liens', 'Personnes arrivées grâce à un partage'],
      [somme(r => r.type === 'kit'), 'Kits ouverts', 'Organisateurs qui ont préparé un partage'],
      [somme(r => r.type === 'jyvais'), '« J’y vais »', 'Clics sur le bouton des fiches'],
      [somme(r => r.type === 'newsletter'), 'Inscrits à la lettre', d.inscrits != null ? `Nouveaux sur la période · ${fr(d.inscrits)} au total` : 'Nouveaux inscrits sur la période'],
    ];
    const k = $('#s-kpis'); k.replaceChildren();
    kpi.forEach(([n, t, s]) => { const c = el('div', 's-kpi'); c.append(el('b', null, fr(n)), el('span', null, t), el('small', null, s)); k.appendChild(c); });

    // Jour par jour
    const byDay = {};
    for (let i = jours - 1; i >= 0; i--) { const dt = new Date(Date.now() - i * 864e5); byDay[dt.toISOString().slice(0, 10)] = { a: 0, b: 0, v: 0 }; }
    d.parJour.forEach(r => { const key = String(r.jour).slice(0, 10); if (!byDay[key]) return; if (r.type === 'fiche') byDay[key].a += +r.n; if (r.type === 'lien') byDay[key].b += +r.n; if (r.type === 'visite') byDay[key].v += +r.n; });
    const max = Math.max(1, ...Object.values(byDay).map(v => Math.max(v.a, v.b, v.v)));
    const ch = $('#s-chart'); ch.replaceChildren();
    const keys = Object.keys(byDay), pas = Math.ceil(keys.length / 8);
    keys.forEach((key, i) => {
      const v = byDay[key], day = el('div', 's-day');
      const c = el('i', 'c'), a = el('i', 'a'), b = el('i', 'b');
      c.style.height = (v.v / max * 100) + '%'; a.style.height = (v.a / max * 100) + '%'; b.style.height = (v.b / max * 100) + '%';
      const dt = new Date(key + 'T12:00:00');
      day.title = `${dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} : ${v.v} visites, ${v.a} fiches vues, ${v.b} clics sur des liens partagés`;
      day.append(c, a, b);
      if (i % pas === 0) day.appendChild(el('small', null, dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '')));
      ch.appendChild(day);
    });

    // Provenance des visiteurs
    bars($('#s-sources'), rows.filter(r => r.type === 'visite' && r.canal !== 'interne'), r => r.canal || 'autre', SOURCES, 'Pas encore de visite enregistrée.');
    // Canaux (clics sur les liens partagés)
    bars($('#s-canaux'), rows.filter(r => r.type === 'lien'), r => r.canal || '', CANAUX, 'Aucun clic sur un lien partagé pour l’instant.');
    // Kit : boutons utilisés
    bars($('#s-kit'), rows.filter(r => r.type === 'kit_action'), r => r.canal || '', KIT, 'Aucun bouton du kit utilisé pour l’instant.');

    // Événements
    const parId = {};
    rows.forEach(r => { if (!r.id) return; const o = parId[r.id] = parId[r.id] || { fiche: 0, apercu: 0, lien: 0, kit: 0, jyvais: 0 }; if (r.type in o) o[r.type] += r.n; });
    const liste = Object.entries(parId).map(([id, o]) => ({ id, ...o, e: events.find(e => e.id === id) }))
      .sort((x, y) => (y.fiche + y.lien) - (x.fiche + x.lien)).slice(0, 25);
    const t = $('#s-table'); t.replaceChildren();
    if (!liste.length) { const tr = el('tr'); const td = el('td', 's-empty', 'Pas encore de données sur cette période.'); td.colSpan = 6; tr.appendChild(td); t.appendChild(tr); return; }
    const hr = el('tr'); ['Événement', 'Fiches vues', 'Liens partagés', 'Clics', 'Kits ouverts', 'J’y vais'].forEach(h => hr.appendChild(el('th', null, h))); t.appendChild(hr);
    liste.forEach(x => {
      const tr = el('tr'), td = el('td');
      td.append(el('b', null, x.e ? x.e.Titre : 'Événement retiré de l’agenda'), el('small', null, x.e ? [x.e.Commune, x.e.Date ? new Date(x.e.Date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''].filter(Boolean).join(' · ') : x.id));
      tr.appendChild(td);
      [x.fiche, x.apercu, x.lien, x.kit, x.jyvais].forEach(n => tr.appendChild(el('td', null, fr(n))));
      t.appendChild(tr);
    });
  }

  function bars(box, rows, key, noms, vide) {
    const agg = {};
    rows.forEach(r => { const k = key(r); agg[k] = (agg[k] || 0) + r.n; });
    const list = Object.entries(agg).sort((a, b) => b[1] - a[1]);
    box.replaceChildren();
    if (!list.length) { box.appendChild(el('p', 's-empty', vide)); return; }
    const max = list[0][1];
    list.forEach(([k, n]) => {
      const row = el('div', 's-bar'), bar = el('div'), fill = el('i');
      fill.style.width = (n / max * 100) + '%'; bar.appendChild(fill);
      row.append(el('span', null, noms[k] || k), el('b', null, fr(n)), bar);
      box.appendChild(row);
    });
  }

  if (token) show();
})();
