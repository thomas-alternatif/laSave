/**
 * laSave — API intermédiaire (Cloudflare Worker)
 *
 * Le site ne parle plus directement à Airtable : il passe par ce Worker,
 * qui garde les clés secrètes et ne renvoie que les champs publics.
 *
 * Secrets à définir dans Cloudflare (Settings → Variables and Secrets) :
 *   AIRTABLE_TOKEN  — jeton Airtable (lecture + écriture sur la base laSave)
 *   ADMIN_PWD       — mot de passe de l'espace admin
 *   IMGBB_KEY       — clé ImgBB pour l'envoi des affiches
 *   BREVO_KEY       — clé API Brevo pour l'envoi des e-mails (codes organisateurs)
 */

const BASE = 'appHgiuv0ClNd8qsV';
const T_EVENTS = 'tbl6Um2XQPq4JPxCg';
const T_ORGAS = 'tblgaldbDy7el5Qw1';
const T_AVIS = 'tbl1VfPYliWdORuzN';

const ALLOWED_ORIGINS = ['https://la-save.fr', 'https://www.la-save.fr', 'https://thomas-alternatif.github.io'];

// Champs visibles par le public (tout le reste, dont les contacts et messages privés, reste caché)
const EVENT_PUBLIC = ['Titre','Catégorie','Organisation','Description','Commune','Date','Date de fin','Heure','Lieu','Tarif','Contact','Récurrence','À la une','Période','Jour','Vues','Photo','Likes'];
const ORGA_PUBLIC = ['Nom','Description courte','Description','Photo','Contact','Ordre'];
// Champs acceptés depuis le formulaire « Ajouter un événement »
const EVENT_SUBMIT = ['Titre','Catégorie','Commune','Date','Date de fin','Heure','Lieu','Description','Tarif','Récurrence','Période','Organisation','Contact','Contact privé','Message privé'];
const ADMIN_STATUTS = ['Publié','Archivé','En attente'];

// E-mails
const MAIL_FROM = { name: 'laSave · Mairie de Saint-Paul-sur-Save', email: 'agenda@la-save.fr' };
const MAIL_ADMIN = 'agenda.de.la.save@gmail.com';
const SITE = 'https://la-save.fr';

/* ── utilitaires ── */
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined && obj[k] !== null && obj[k] !== '').map(k => [k, obj[k]]));
const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : v);
const isId = s => /^rec[A-Za-z0-9]{14}$/.test(s || '');

function cors(req) {
  const o = req.headers.get('Origin') || '';
  const ok = ALLOWED_ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  return {
    'Access-Control-Allow-Origin': ok ? o : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
const json = (req, data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(req), ...extra } });

async function at(env, path, init = {}) {
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d?.error?.message || d?.error?.type || `Airtable ${r.status}`), { status: r.status });
  return d;
}
async function listAll(env, table, params = '') {
  let out = [], offset = '';
  do {
    const d = await at(env, `${table}?pageSize=100${params}${offset ? `&offset=${offset}` : ''}`);
    out = out.concat(d.records || []);
    offset = d.offset || '';
  } while (offset);
  return out;
}

/* ── codes organisateurs ── */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I pour éviter les confusions
function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  const s = [...b].map(x => CODE_CHARS[x % CODE_CHARS.length]).join('');
  return `SAVE-${s.slice(0, 4)}-${s.slice(4)}`;
}
const isEmail = s => /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i.test(s || '');
const escH = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendMail(env, { to, toName, subject, html, text, replyTo }) {
  if (!env.BREVO_KEY) throw Object.assign(new Error("L'envoi d'e-mails n'est pas encore configuré."), { status: 503 });
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: MAIL_FROM, to: [{ email: to, name: toName || undefined }], subject, htmlContent: html, textContent: text, replyTo: { email: replyTo || MAIL_ADMIN } }),
  });
  if (!r.ok) throw Object.assign(new Error("L'e-mail n'a pas pu être envoyé."), { status: 502 });
}

function codeMail(nom, code) {
  const n = escH(nom || 'Bonjour');
  const text = `Bonjour ${nom || ''},

Voici votre code organisateur laSave : ${code}

Pour proposer un événement :
1. Rendez-vous sur ${SITE}/#partager
2. Saisissez votre code dans « Espace organisateur »
3. Vos informations se remplissent automatiquement, il ne reste qu'à décrire l'événement.

Chaque proposition est relue par la mairie avant publication (sous 48 h).
Gardez ce code pour vous : il est propre à votre structure.

Mairie de Saint-Paul-sur-Save — Commission culture
${SITE}`;
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Votre code organisateur laSave</title></head>
<body style="margin:0;padding:0;background:#f3f5f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Votre code pour proposer vos événements sur l'agenda culturel de la vallée de la Save.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f5f5;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#16191a;">
  <tr><td style="padding:24px 32px 18px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding-right:14px;"><img src="${SITE}/images/logo-saint-paul.png" width="56" height="54" alt="Saint-Paul-sur-Save" style="display:block;border:0;"></td>
      <td><div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#5b6468;">Mairie de Saint-Paul-sur-Save</div>
          <div style="font-size:22px;font-weight:700;color:#16191a;line-height:1.2;">la<span style="color:#096c71;">Save</span></div></td>
    </tr></table>
  </td></tr>
  <tr><td style="font-size:0;line-height:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td height="5" style="background:#FFA823;width:33.3%;"></td><td height="5" style="background:#5C96AB;width:33.3%;"></td><td height="5" style="background:#B923FF;width:33.4%;"></td>
  </tr></table></td></tr>
  <tr><td style="padding:32px 32px 8px;">
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#16191a;">Votre code organisateur</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#3b4245;">Bonjour ${n},<br>voici le code qui vous permet de proposer vos événements sur <strong>laSave</strong>, l'agenda culturel de la vallée de la Save.</p>
  </td></tr>
  <tr><td align="center" style="padding:4px 32px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#e8f3f3;border:2px dashed #096c71;border-radius:12px;"><tr>
      <td style="padding:16px 22px;font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:700;letter-spacing:2px;white-space:nowrap;color:#096c71;">${escH(code)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 32px 8px;">
    <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#16191a;">Comment l'utiliser&nbsp;?</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:1.55;color:#3b4245;">
      <tr><td valign="top" style="padding:0 10px 8px 0;font-weight:700;color:#8a5200;">1.</td><td style="padding-bottom:8px;">Ouvrez la page « Partager » du site laSave.</td></tr>
      <tr><td valign="top" style="padding:0 10px 8px 0;font-weight:700;color:#8a5200;">2.</td><td style="padding-bottom:8px;">Saisissez ce code dans l'<strong>espace organisateur</strong> : vos informations se remplissent toutes seules.</td></tr>
      <tr><td valign="top" style="padding:0 10px 8px 0;font-weight:700;color:#8a5200;">3.</td><td style="padding-bottom:8px;">Décrivez votre événement et envoyez-le. La mairie le relit puis le publie sous 48&nbsp;h.</td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:16px 32px 28px;">
    <a href="${SITE}/#partager" style="display:inline-block;background:#096c71;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 26px;border-radius:10px;">Proposer un événement</a>
  </td></tr>
  <tr><td style="padding:0 32px 28px;"><p style="margin:0;font-size:13px;line-height:1.5;color:#5b6468;background:#f6f8f8;border-radius:10px;padding:12px 14px;">Ce code est propre à votre structure : ne le partagez qu'avec les personnes qui publient en son nom. Vous ne l'avez pas demandé&nbsp;? Ignorez simplement ce message.</p></td></tr>
  <tr><td style="background:#16191a;padding:20px 32px;font-size:12px;line-height:1.6;color:#c9d0d2;">
    Mairie de Saint-Paul-sur-Save — Commission culture<br>9 route de Cox, 31530 Saint-Paul-sur-Save<br>
    <a href="${SITE}" style="color:#FFA823;text-decoration:none;">la-save.fr</a>
  </td></tr>
</table>
</td></tr></table></body></html>`;
  return { subject: 'Votre code organisateur laSave', html, text };
}

async function findOrgaByEmail(env, email) {
  const f = encodeURIComponent(`LOWER({Email})='${email.toLowerCase().replace(/'/g, "\\'")}'`);
  const recs = await listAll(env, T_ORGAS, '&filterByFormula=' + f);
  return recs.find(r => r.fields['Statut code'] !== 'Refusé' && r.fields['Statut code'] !== 'Demandé') || null;
}
async function uniqueCode(env) {
  const all = await listAll(env, T_ORGAS);
  const taken = new Set(all.map(r => (r.fields.Code || '').trim().toUpperCase()));
  let c; do { c = newCode(); } while (taken.has(c));
  return c;
}
async function sendCodeTo(env, rec) {
  let code = (rec.fields.Code || '').trim();
  if (!code) code = await uniqueCode(env);
  const m = codeMail(rec.fields.Nom, code);
  await sendMail(env, { to: rec.fields.Email, toName: rec.fields.Nom, ...m });
  await at(env, `${T_ORGAS}/${rec.id}`, { method: 'PATCH', body: JSON.stringify({ fields: { Code: code, 'Statut code': 'Envoyé', 'Code envoyé le': new Date().toISOString() } }) });
}

/* ── limiteur anti-abus : N requêtes max par fenêtre, par adresse IP ── */
async function tooMany(req, bucket, max, windowSec) {
  const ip = req.headers.get('CF-Connecting-IP') || 'inconnu';
  const key = new Request(`https://rl.lasave.local/${bucket}/${encodeURIComponent(ip)}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  const n = hit ? Number(await hit.text()) || 0 : 0;
  if (n >= max) return true;
  await cache.put(key, new Response(String(n + 1), { headers: { 'Cache-Control': `max-age=${windowSec}` } }));
  return false;
}
const slowDown = req => json(req, { error: 'Trop de tentatives, réessayez dans quelques minutes.' }, 429);

/* ── session admin : jeton signé HMAC, valable 12 h ── */
async function hmac(env, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.ADMIN_PWD + '|' + env.AIRTABLE_TOKEN), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
}
async function makeToken(env) { const exp = Date.now() + 12 * 3600e3; return `${exp}.${await hmac(env, 'admin.' + exp)}`; }
async function checkToken(env, req) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/, '');
  const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return sig === await hmac(env, 'admin.' + exp);
}
function sameText(a, b) { // comparaison à temps constant
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}

/* ── routes ── */
async function route(req, env, ctx) {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;
  const body = async () => { try { return await req.json(); } catch { return {}; } };

  // Événements publiés (mis en cache 60 s au bord du réseau Cloudflare)
  if (m === 'GET' && p === '/events') {
    const cache = caches.default, key = new Request(url.origin + '/events');
    let res = await cache.match(key);
    if (!res) {
      const recs = await listAll(env, T_EVENTS, '&filterByFormula=' + encodeURIComponent("{Statut}='Publié'"));
      res = new Response(JSON.stringify(recs.map(r => ({ id: r.id, ...pick(r.fields, EVENT_PUBLIC) }))),
        { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
      ctx.waitUntil(cache.put(key, res.clone()));
    }
    return new Response(res.body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60', ...cors(req) } });
  }

  // Page de partage : aperçu (titre, image) pour Facebook/WhatsApp puis redirection vers le site
  let sm;
  if (m === 'GET' && (sm = p.match(/^\/e\/(rec[A-Za-z0-9]{14})$/))) {
    const id = sm[1], home = 'https://la-save.fr';
    let ev = null;
    try { const r = await at(env, `${T_EVENTS}/${id}`); if (r.fields.Statut === 'Publié') ev = r.fields; } catch {}
    if (!ev) return Response.redirect(home, 302);
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const titre = ev.Titre || 'Événement', commune = ev.Commune || '', cat = ev['Catégorie'] || '';
    const desc = (ev.Description || '').slice(0, 200) || `${cat} à ${commune}`;
    const photo = ev.Photo?.[0]?.thumbnails?.large?.url || ev.Photo?.[0]?.url || `${home}/images/hero-chapiteau.webp`;
    const back = `${home}/#event-${id}`;
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta property="og:type" content="website"/><meta property="og:url" content="${esc(req.url)}"/>
<meta property="og:title" content="${esc(titre)}"/><meta property="og:description" content="${esc(desc)}"/>
<meta property="og:image" content="${esc(photo)}"/><meta property="og:site_name" content="laSave — Agenda festif &amp; culturel"/>
<meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${esc(titre)}"/>
<meta name="twitter:description" content="${esc(desc)}"/><meta name="twitter:image" content="${esc(photo)}"/>
<meta name="description" content="${esc(desc)}"/><title>${esc(titre)} — laSave</title>
<meta http-equiv="refresh" content="0; url=${esc(back)}"/>
<style>body{font-family:-apple-system,sans-serif;background:#08111e;color:#e8e8e8;display:grid;place-items:center;min-height:100vh;margin:0;padding:2rem}a{color:#c8a96e}</style>
</head><body><p>${esc(titre)} — <a href="${esc(back)}">voir l’événement sur laSave →</a></p></body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  }

  // Organisateurs publiés (sans leur code membre)
  if (m === 'GET' && p === '/orgas') {
    const recs = await listAll(env, T_ORGAS, '&filterByFormula=' + encodeURIComponent('{Publié}=1') + '&sort[0][field]=Ordre&sort[0][direction]=asc');
    return json(req, recs.map(r => ({ id: r.id, ...pick(r.fields, ORGA_PUBLIC) })), 200, { 'Cache-Control': 'public, max-age=120' });
  }

  // Vérification d'un code membre : ne renvoie que l'organisateur correspondant
  if (m === 'POST' && p === '/code') {
    if (await tooMany(req, 'code', 10, 600)) return slowDown(req);
    const code = String((await body()).code || '').trim().toUpperCase().slice(0, 40);
    if (!code) return json(req, { error: 'Code manquant' }, 400);
    const recs = await listAll(env, T_ORGAS);
    const o = recs.find(r => (r.fields.Code || '').trim().toUpperCase() === code && !['Demandé', 'Refusé'].includes(r.fields['Statut code']));
    if (!o) return json(req, { error: 'Code non reconnu' }, 404);
    return json(req, { id: o.id, ...pick(o.fields, ORGA_PUBLIC) });
  }

  // Demande de code organisateur (réponse identique dans tous les cas : on ne révèle pas quelles adresses sont connues)
  if (m === 'POST' && p === '/code/request') {
    if (await tooMany(req, 'coderq', 4, 3600)) return slowDown(req);
    const b = await body();
    const ok = json(req, { ok: true, message: "C'est noté ! Si votre adresse correspond à un organisateur déjà inscrit, votre code arrive dans quelques minutes. Sinon, la mairie étudie votre demande et vous l'envoie après validation." });
    if (b.website) return ok; // pot de miel anti-robot
    const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
    const nom = clip(String(b.nom || '').trim(), 120);
    if (!isEmail(email)) return json(req, { error: 'Adresse e-mail invalide.' }, 400);
    if (await tooMany(req, 'coderq-' + email, 3, 86400)) return ok;
    const known = await findOrgaByEmail(env, email);
    if (known) { ctx.waitUntil(sendCodeTo(env, known).catch(e => console.error('envoi code', e))); return ok; }
    if (!nom) return json(req, { error: 'Indiquez le nom de votre structure.' }, 400);
    // Nouvelle demande (sans doublon) + alerte à la mairie
    const f = encodeURIComponent(`AND(LOWER({Email})='${email.replace(/'/g, "\\'")}',{Statut code}='Demandé')`);
    const dup = await listAll(env, T_ORGAS, '&filterByFormula=' + f);
    if (!dup.length) {
      const message = clip(String(b.message || '').trim(), 1500);
      await at(env, T_ORGAS, { method: 'POST', body: JSON.stringify({ fields: { Nom: nom, Email: email, 'Message demande': message || undefined, 'Statut code': 'Demandé', 'Publié': false } }) });
      ctx.waitUntil(sendMail(env, {
        to: MAIL_ADMIN, subject: `Demande de code organisateur : ${nom}`, replyTo: email,
        text: `${nom} (${email}) demande un code organisateur.\n\n${message}\n\nValider : ${SITE}/#admin`,
        html: `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#16191a;line-height:1.6"><p><strong>${escH(nom)}</strong> (${escH(email)}) demande un code organisateur sur laSave.</p>${message ? `<blockquote style="margin:0 0 16px;padding:10px 14px;background:#f6f8f8;border-left:4px solid #FFA823">${escH(message)}</blockquote>` : ''}<p><a href="${SITE}/#admin" style="display:inline-block;background:#096c71;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px">Valider ou refuser dans l'admin</a></p></div>`,
      }).catch(e => console.error('alerte mairie', e)));
    }
    return ok;
  }

  // Nouvel événement proposé (toujours « En attente »)
  if (m === 'POST' && p === '/events') {
    if (await tooMany(req, 'submit', 5, 3600)) return slowDown(req);
    const b = await body();
    if (b.website) return json(req, { ok: true }); // pot de miel anti-robot
    if (b['Jour/Période'] && !b['Période']) b['Période'] = b['Jour/Période'];
    const fields = pick(b, EVENT_SUBMIT);
    for (const k in fields) fields[k] = clip(fields[k], k === 'Description' || k === 'Message privé' ? 5000 : 300);
    if (!fields.Titre || !fields['Catégorie'] || !fields.Commune) return json(req, { error: 'Titre, catégorie et commune sont obligatoires.' }, 400);
    if (typeof b.photoUrl === 'string' && /^https:\/\/(i\.)?ibb\.co\//.test(b.photoUrl)) fields.Photo = [{ url: b.photoUrl }];
    fields.Statut = 'En attente';
    const d = await at(env, T_EVENTS, { method: 'POST', body: JSON.stringify({ fields }) });
    return json(req, { ok: true, id: d.id }, 201);
  }

  // Compteur de vues / likes (calculés côté serveur)
  let mm;
  if (m === 'POST' && (mm = p.match(/^\/events\/(rec\w+)\/(view|like)$/))) {
    const [, id, what] = mm;
    if (!isId(id)) return json(req, { error: 'id' }, 400);
    if (await tooMany(req, `${what}-${id}`, what === 'like' ? 4 : 10, 3600)) return slowDown(req);
    const field = what === 'view' ? 'Vues' : 'Likes';
    const delta = what === 'view' ? 1 : ((await body()).delta === -1 ? -1 : 1);
    let cur;
    try { cur = await at(env, `${T_EVENTS}/${id}`); } catch { return json(req, { error: 'Événement introuvable' }, 404); }
    if (cur.fields.Statut !== 'Publié') return json(req, { error: 'Événement introuvable' }, 404);
    const n = Math.max(0, (cur.fields[field] || 0) + delta);
    await at(env, `${T_EVENTS}/${id}`, { method: 'PATCH', body: JSON.stringify({ fields: { [field]: n } }) });
    return json(req, { [field]: n });
  }

  // Avis visiteurs
  if (m === 'POST' && p === '/avis') {
    if (await tooMany(req, 'avis', 5, 3600)) return slowDown(req);
    const b = await body();
    const note = Math.round(Number(b.note));
    if (!(note >= 1 && note <= 5)) return json(req, { error: 'Note invalide' }, 400);
    const fields = { Titre: `${note}★ — ${new Date().toLocaleDateString('fr-FR')}`, Note: note, Page: clip(String(b.page || '/'), 200), 'Date envoi': new Date().toISOString() };
    if (b.commentaire) fields.Commentaire = clip(String(b.commentaire), 3000);
    await at(env, T_AVIS, { method: 'POST', body: JSON.stringify({ fields }) });
    return json(req, { ok: true }, 201);
  }

  // Envoi d'affiche vers ImgBB (la clé reste ici)
  if (m === 'POST' && p === '/upload') {
    if (await tooMany(req, 'upload', 10, 3600)) return slowDown(req);
    const fd = await req.formData();
    const file = fd.get('image');
    if (!file || typeof file === 'string') return json(req, { error: 'Image manquante' }, 400);
    if (file.size > 12 * 1024 * 1024) return json(req, { error: 'Image trop lourde (12 Mo max)' }, 413);
    const out = new FormData(); out.append('image', file);
    const r = await fetch(`https://api.imgbb.com/1/upload?key=${env.IMGBB_KEY}`, { method: 'POST', body: out });
    const d = await r.json().catch(() => ({}));
    if (!d?.success) return json(req, { error: 'Échec de l’envoi' }, 502);
    return json(req, { url: d.data.url });
  }

  /* ── Admin ── */
  if (m === 'POST' && p === '/admin/login') {
    if (await tooMany(req, 'login', 8, 900)) return slowDown(req);
    const pwd = String((await body()).pwd || '');
    if (!env.ADMIN_PWD || !sameText(pwd, env.ADMIN_PWD)) {
      await new Promise(r => setTimeout(r, 800)); // ralentit les essais au hasard
      return json(req, { error: 'Mot de passe incorrect' }, 401);
    }
    return json(req, { token: await makeToken(env) });
  }
  if (p.startsWith('/admin/')) {
    if (!(await checkToken(env, req))) return json(req, { error: 'Session expirée, reconnectez-vous.' }, 401);
    if (m === 'GET' && p === '/admin/events') {
      const statut = url.searchParams.get('statut');
      if (!ADMIN_STATUTS.includes(statut)) return json(req, { error: 'statut' }, 400);
      const recs = await listAll(env, T_EVENTS, '&filterByFormula=' + encodeURIComponent(`{Statut}='${statut}'`));
      return json(req, recs); // l'admin voit tous les champs, y compris privés
    }
    if (m === 'GET' && p === '/admin/code-requests') {
      const recs = await listAll(env, T_ORGAS, '&filterByFormula=' + encodeURIComponent("{Statut code}='Demandé'"));
      return json(req, recs.map(r => ({ id: r.id, Nom: r.fields.Nom, Email: r.fields.Email, Message: r.fields['Message demande'] || '' })));
    }
    if (m === 'POST' && (mm = p.match(/^\/admin\/orgas\/(rec\w+)\/(send-code|refuse)$/))) {
      if (!isId(mm[1])) return json(req, { error: 'Requête invalide' }, 400);
      let rec; try { rec = await at(env, `${T_ORGAS}/${mm[1]}`); } catch { return json(req, { error: 'Organisateur introuvable' }, 404); }
      if (mm[2] === 'refuse') {
        await at(env, `${T_ORGAS}/${rec.id}`, { method: 'PATCH', body: JSON.stringify({ fields: { 'Statut code': 'Refusé' } }) });
        return json(req, { ok: true });
      }
      if (!isEmail(rec.fields.Email)) return json(req, { error: "Cet organisateur n'a pas d'adresse e-mail valide." }, 400);
      await sendCodeTo(env, rec);
      return json(req, { ok: true });
    }
    if (m === 'PATCH' && (mm = p.match(/^\/admin\/events\/(rec\w+)$/))) {
      const statut = (await body()).Statut;
      if (!isId(mm[1]) || !ADMIN_STATUTS.includes(statut)) return json(req, { error: 'Requête invalide' }, 400);
      try { await at(env, `${T_EVENTS}/${mm[1]}`); } catch { return json(req, { error: 'Événement introuvable' }, 404); }
      await at(env, `${T_EVENTS}/${mm[1]}`, { method: 'PATCH', body: JSON.stringify({ fields: { Statut: statut } }) });
      await caches.default.delete(new Request(url.origin + '/events'));
      return json(req, { ok: true });
    }
  }

  if (p === '/' || p === '/health') return json(req, { ok: true, service: 'laSave API' });
  return json(req, { error: 'Introuvable' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    try { return await route(req, env, ctx); }
    catch (e) {
      console.error(e);
      if (e.status === 503 || (e.status === 502 && /e-mail/.test(e.message))) return json(req, { error: e.message }, e.status);
      return json(req, { error: 'Le service est momentanément indisponible, réessayez plus tard.' }, 502);
    }
  },
};
