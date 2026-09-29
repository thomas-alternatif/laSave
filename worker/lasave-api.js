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
 *   BREVO_KEY       — clé API Brevo pour l'envoi des e-mails (codes organisateurs, mails de publication)
 *
 * Liaison KV à ajouter (Settings → Bindings → KV namespace) :
 *   LASAVE          — espace de stockage « lasave-cache »
 * Déclencheur planifié (Settings → Triggers → Cron) : 0 4 * * *  (une fois par nuit)
 *
 * Pourquoi : la formule gratuite d'Airtable n'autorise que 1 000 appels par mois.
 * Le site ne lit donc plus Airtable à chaque visite : le Worker garde une copie
 * (événements publiés, organisateurs, codes) dans KV et ne la met à jour que
 * la nuit, quand l'admin publie ou archive un événement, ou sur demande.
 * Les « J'y vais » et les vues sont comptés dans KV et recopiés dans Airtable la nuit.
 */

const BASE = 'appHgiuv0ClNd8qsV';
const T_EVENTS = 'tbl6Um2XQPq4JPxCg';
const T_ORGAS = 'tblgaldbDy7el5Qw1';
const T_AVIS = 'tbl1VfPYliWdORuzN';

const ALLOWED_ORIGINS = ['https://la-save.fr', 'https://www.la-save.fr', 'https://thomas-alternatif.github.io'];

// Champs visibles par le public (tout le reste, dont les contacts et messages privés, reste caché)
// « Message aux organisateurs » (Airtable) : mot privé de la mairie, ajouté au mail de publication, jamais affiché sur le site
const EVENT_PUBLIC = ['Titre','Catégorie','Organisation','Description','Commune','Date','Date de fin','Heure','Lieu','Tarif','Contact','Récurrence','À la une','Période','Jour','Vues','Photo','Likes','Billetterie'];
const ORGA_PUBLIC = ['Nom','Description courte','Description','Photo','Contact','Ordre'];
// Champs acceptés depuis le formulaire « Ajouter un événement »
const EVENT_SUBMIT = ['Titre','Catégorie','Commune','Date','Date de fin','Heure','Lieu','Description','Tarif','Récurrence','Période','Organisation','Contact','Contact privé','Message privé','Billetterie'];
const ADMIN_STATUTS = ['Publié','Archivé','En attente'];

// E-mails
const MAIL_FROM = { name: 'laSave · Mairie de Saint-Paul-sur-Save', email: 'agenda@la-save.fr' };
const MAIL_ADMIN = 'agenda@la-save.fr';
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
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>Votre code organisateur laSave</title></head>
<body style="margin:0;padding:0;background:#08111e;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Votre code pour proposer vos événements sur laSave, l'agenda festif et culturel de la vallée de la Save.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#08111e;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td align="center" style="padding:6px 24px 26px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:700;letter-spacing:-.5px;color:#e8e8e8;line-height:1;">la<span style="color:#c8a96e;">Save</span></div>
    <div style="margin-top:8px;font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#9aa3ad;">Agenda festif &amp; culturel</div>
  </td></tr>
  <tr><td style="background:#121a26;border:1px solid #243041;border-radius:16px;overflow:hidden;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td height="4" style="font-size:0;line-height:0;background:#c8a96e;">&nbsp;</td></tr>
      <tr><td style="padding:34px 34px 6px;">
        <div style="font-size:11px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#c8a96e;margin-bottom:12px;">Espace organisateur</div>
        <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;font-weight:700;color:#ffffff;">Votre code est prêt</h1>
        <p style="margin:0 0 22px;font-size:16px;line-height:1.65;color:#c3cad2;">Bonjour ${n},<br>voici votre code pour proposer vos événements sur <strong style="color:#ffffff;">laSave</strong>, l'agenda festif et culturel de la vallée de la Save.</p>
      </td></tr>
      <tr><td align="center" style="padding:0 34px 26px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#0b121c;border:1px solid #c8a96e;border-radius:12px;"><tr>
          <td style="padding:16px 30px;font-family:'Courier New',Courier,monospace;font-size:26px;font-weight:700;letter-spacing:3px;white-space:nowrap;color:#c8a96e;">${escH(code)}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:0 34px 6px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:1.6;color:#c3cad2;">
          <tr><td valign="top" style="padding:0 12px 10px 0;font-family:Georgia,serif;font-size:17px;font-weight:700;color:#c8a96e;">1</td><td style="padding-bottom:10px;">Ouvrez la page <strong style="color:#fff;">Partager</strong> sur la-save.fr.</td></tr>
          <tr><td valign="top" style="padding:0 12px 10px 0;font-family:Georgia,serif;font-size:17px;font-weight:700;color:#c8a96e;">2</td><td style="padding-bottom:10px;">Saisissez ce code : vos informations se remplissent toutes seules.</td></tr>
          <tr><td valign="top" style="padding:0 12px 10px 0;font-family:Georgia,serif;font-size:17px;font-weight:700;color:#c8a96e;">3</td><td style="padding-bottom:10px;">Décrivez votre événement et envoyez-le : la mairie le relit puis le publie sous 48&nbsp;h.</td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:18px 34px 30px;">
        <a href="${SITE}/#partager" style="display:inline-block;background:#c8a96e;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 30px;border-radius:99px;">+ Proposer un événement</a>
      </td></tr>
      <tr><td style="padding:0 34px 30px;"><p style="margin:0;font-size:13px;line-height:1.55;color:#8d97a3;border-top:1px solid #243041;padding-top:18px;">Ce code est propre à votre structure : partagez-le seulement avec les personnes qui publient en son nom. Vous ne l'avez pas demandé&nbsp;? Ignorez simplement ce message.</p></td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:24px 24px 0;font-size:12px;line-height:1.7;color:#7d8793;">
    <img src="${SITE}/images/logo-saint-paul.png" width="44" height="42" alt="Saint-Paul-sur-Save" style="display:block;margin:0 auto 10px;border:0;border-radius:8px;">
    Mairie de Saint-Paul-sur-Save — Commission culture<br>9 route de Cox, 31530 Saint-Paul-sur-Save · <a href="${SITE}" style="color:#c8a96e;text-decoration:none;">la-save.fr</a>
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
// Mots trop génériques pour servir de code (« Association Les Amis… » → AMIS)
const CODE_SKIP = new Set(['LE','LA','LES','L','DE','DU','DES','D','ET','AU','AUX','UN','UNE','THE','ASSOCIATION','ASSO','COMITE','CLUB','COMPAGNIE','CIE','AMICALE','COLLECTIF','GROUPE','FOYER','ECOLE','MAIRIE','SAINT','ST']);
function codeFromName(nom) {
  const words = String(nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  return words.find(w => w.length >= 3 && !CODE_SKIP.has(w)) || words.find(w => w.length >= 2) || 'SAVE';
}
async function uniqueCode(env, nom) {
  const all = await listAll(env, T_ORGAS);
  const taken = new Set(all.map(r => (r.fields.Code || '').trim().toUpperCase()));
  const base = codeFromName(nom).slice(0, 16);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) if (!taken.has(base + i)) return base + i; // ALTERNATIF2, ALTERNATIF3…
  let c; do { c = newCode(); } while (taken.has(c));
  return c;
}
async function sendCodeTo(env, rec) {
  let code = (rec.fields.Code || '').trim();
  if (!code) code = await uniqueCode(env, rec.fields.Nom); // un code déjà connu n'est jamais remplacé
  const m = codeMail(rec.fields.Nom, code);
  await sendMail(env, { to: rec.fields.Email, toName: rec.fields.Nom, ...m });
  await at(env, `${T_ORGAS}/${rec.id}`, { method: 'PATCH', body: JSON.stringify({ fields: { Code: code, 'Statut code': 'Envoyé', 'Code envoyé le': new Date().toISOString() } }) });
}

/* ── limiteur anti-abus : N requêtes max par fenêtre, par adresse IP ── */
let KV = null; // liaison KV (null tant qu'elle n'est pas ajoutée dans Cloudflare)
async function tooMany(req, bucket, max, windowSec) {
  const ip = req.headers.get('CF-Connecting-IP') || 'inconnu';
  // Envois (formulaire, avis, codes, connexion) : compteur dans KV, fiable même sur workers.dev
  if (KV && !/^(like|view)-/.test(bucket)) {
    const k = `rl:${bucket}:${ip}`;
    const n = Number(await KV.get(k)) || 0;
    if (n >= max) return true;
    await KV.put(k, String(n + 1), { expirationTtl: Math.max(60, windowSec) });
    return false;
  }
  const key = new Request(`https://rl.lasave.local/${bucket}/${encodeURIComponent(ip)}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  const n = hit ? Number(await hit.text()) || 0 : 0;
  if (n >= max) return true;
  await cache.put(key, new Response(String(n + 1), { headers: { 'Cache-Control': `max-age=${windowSec}` } }));
  return false;
}
const slowDown = req => json(req, { error: 'Trop de tentatives, réessayez dans quelques minutes.' }, 429);

/* ── Mail « votre événement est en ligne », envoyé une seule fois à la publication ── */
const firstEmail = s => (String(s || '').match(/[^\s@<>"',;:|()]{1,64}@[^\s@<>"',;:|()]{1,190}\.[a-z]{2,}/i) || [])[0] || '';
const MOT_AUTEUR = 'Thomas'; // signe le « Message aux organisateurs » dans le mail de publication
const M_MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const M_JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
function quandTexte(f) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(f.Date || '')) return f['Période'] || '';
  const a = new Date(f.Date.slice(0, 10) + 'T12:00:00Z'), fin = f['Date de fin'] && f['Date de fin'] !== f.Date ? new Date(f['Date de fin'].slice(0, 10) + 'T12:00:00Z') : null;
  let t = fin ? `Du ${a.getUTCDate()}${a.getUTCMonth() !== fin.getUTCMonth() ? ' ' + M_MOIS[a.getUTCMonth()] : ''} au ${fin.getUTCDate()} ${M_MOIS[fin.getUTCMonth()]}`
              : `${M_JOURS[a.getUTCDay()]} ${a.getUTCDate()} ${M_MOIS[a.getUTCMonth()]}`;
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (f.Heure) t += ` à ${String(f.Heure).replace(':', 'h')}`;
  return t;
}
function publishedMail(f, id) {
  const lien = `${SITE}/#event-${id}`, partage = `${API_ORIGIN}/e/${id}`, PS = c => `${partage}?s=${c}`;
  const titre = f.Titre || 'Votre événement', quand = quandTexte(f), ou = [f.Lieu, f.Commune].filter(Boolean).join(', ');
  const ph = Array.isArray(f.Photo) && f.Photo[0] ? (f.Photo[0].thumbnails?.large?.url || f.Photo[0].url) : '';
  const S = "'Instrument Sans','Helvetica Neue',Helvetica,Arial,sans-serif", D = "Archivo,'Arial Narrow','Helvetica Neue',Arial,sans-serif";
  const W = '#f4f3ef', G = '#a3a19b', P = '#0e0e0e', L = '#262626';
  const gros = (t, px, c = W, large = false) => `<div style="font-family:${D};font-stretch:${large ? '125%' : '75%'};font-size:${px}px;line-height:.95;font-weight:800;text-transform:uppercase;letter-spacing:${large ? '.01em' : '-.01em'};color:${c};">${t}</div>`;
  const ep = Array.from({ length: 8 }, (_, i) => `${(i + 1) * .05}em ${(i + 1) * .05}em 0 #0a0a0a`).join(',');
  const tampon = t => `<span style="display:inline-block;font-family:${D};font-stretch:75%;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;background:#ffffff;color:#0a0a0a;border-radius:.26em;padding:.28em .6em .2em;box-shadow:0 0 0 .06em #0a0a0a,${ep},.4em .4em 0 .06em #ffffff;">${escH(t)}</span>`;
  const btnOr = (h, t) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:99px;background:#FFA823;"><a href="${h}" style="display:inline-block;padding:14px 26px;font-family:${S};font-size:15px;font-weight:600;color:#141210;text-decoration:none;border-radius:99px;">${t}</a></td></tr></table>`;
  const btnVerre = (h, t) => `<td style="padding:0 8px 8px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:99px;background:#1a1a1a;border:1.5px solid rgba(255,255,255,.3);"><a href="${h}" style="display:inline-block;padding:11px 16px;font-family:${S};font-size:14px;font-weight:600;color:${W};text-decoration:none;border-radius:99px;white-space:nowrap;">${t}</a></td></tr></table></td>`;
  const meta = (g, d) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-family:${S};font-size:12px;font-weight:600;color:${W};">${g}</td><td align="right" style="font-family:${S};font-size:12px;color:${G};">${d}</td></tr><tr><td colspan="2" style="padding-top:12px;border-bottom:1px solid ${L};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
  const info = rows => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">${rows.filter(r => r[1]).map(([k, v]) => `<tr><td valign="top" style="padding:3px 14px 3px 0;font-family:${S};font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${G};">${k}</td><td style="padding:3px 0;font-family:${S};font-size:14px;line-height:1.4;color:${W};">${escH(v)}</td></tr>`).join('')}</table>`;
  const mot = String(f['Message aux organisateurs'] || '').trim().slice(0, 3000);
  const qui = f.Organisation ? `Bonjour ${escH(f.Organisation)},` : 'Bonjour,';
  const kitUrl = `${SITE}/test13/kit.html?id=${id}`; // page « kit de partage » (test13 pour l'instant)
  const msg = [titre, quand, ou, f.Tarif].filter(Boolean).join('\n') + `\n\nToutes les infos : ${PS('mailpub')}`;
  const msgWa = [`*${titre}*`, quand, ou, f.Tarif].filter(Boolean).join('\n') + `\n\nToutes les infos : ${PS('mailpub')}`;
  const btnApp = (h, ico, petit, nom, bg, fg) => `<td width="50%" valign="top" style="border-radius:14px;background:${bg};"><a href="${h}" style="display:block;padding:14px 14px;text-decoration:none;border-radius:14px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="padding-right:10px;"><img src="${SITE}/images/partage/${ico}.png" width="24" height="24" alt="" style="display:block;width:24px;height:24px;border:0;"></td><td valign="middle" style="font-family:${S};color:${fg};line-height:1.15;"><span style="font-size:11px;opacity:.85;">${petit}</span><br><span style="font-size:15px;font-weight:600;">${nom}</span></td></tr></table></a></td>`;

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>Votre événement est en ligne</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..900&family=Instrument+Sans:wght@400;600&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#050505;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escH(titre)} est maintenant visible sur l’agenda de la vallée de la Save.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050505;"><tr><td align="center" style="padding:30px 12px 44px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
  <tr><td style="padding:4px 6px 22px;"><a href="${SITE}"><img src="${SITE}/test7/logo.png" width="118" alt="laSave" style="display:block;width:118px;height:auto;border:0;"></a></td></tr>

  <tr><td style="padding:0 0 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${P};border-radius:26px;"><tr><td style="padding:26px 26px 30px;">
    ${meta('Bonne nouvelle', 'Publication')}
    <div style="padding-top:26px;">${gros('C’est en ligne&nbsp;!', 64, '#FFA823')}</div>
    <p style="margin:18px 0 0;font-family:${S};font-size:16px;line-height:1.6;color:#d6d4ce;">${qui}<br>votre événement a été relu par la mairie. Il est maintenant visible par tous sur laSave, l’agenda de la vallée de la Save.${mot ? ` ${escH(MOT_AUTEUR)} vous a laissé un petit message juste en dessous.` : ''}</p>
  </td></tr></table></td></tr>

  ${mot ? `<tr><td style="padding:0 0 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#5C96AB;border-radius:26px;"><tr><td style="padding:24px 26px 26px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-family:${S};font-size:12px;font-weight:600;color:#ffffff;">Message de ${escH(MOT_AUTEUR)}</td><td align="right" style="font-family:${S};font-size:12px;color:#ffffff;opacity:.8;">À lire</td></tr><tr><td colspan="2" style="padding-top:12px;border-bottom:1px solid #ffffff;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <p style="margin:18px 0 0;font-family:${S};font-size:16px;line-height:1.6;color:#ffffff;">${escH(mot).replace(/\n/g, '<br>')}</p>
  </td></tr></table></td></tr>` : ''}

  <tr><td style="padding:0 0 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${P};border-radius:26px;"><tr><td style="padding:26px 26px 30px;">
    ${meta('Votre événement', escH(f.Commune || ''))}
    ${ph ? `<a href="${lien}"><img src="${escH(ph)}" width="548" alt="${escH(titre)}" style="display:block;width:100%;max-width:548px;height:auto;border-radius:16px;border:0;margin-top:22px;"></a>` : ''}
    <div style="padding-top:22px;">${tampon(f['Catégorie'] || 'Événement')}</div>
    <div style="padding-top:16px;">${gros(escH(titre), 40)}</div>
    ${info([['Quand', quand], ['Où', ou], ['Prix', f.Tarif || '']])}
    <div style="padding-top:24px;">${btnOr(lien, 'Voir mon événement')}</div>
  </td></tr></table></td></tr>

  <tr><td style="padding:0 0 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${P};border-radius:26px;"><tr><td style="padding:26px 26px 28px;">
    ${meta('Faites-le connaître', 'Partage')}
    <div style="padding-top:22px;">${gros('Partagez-le', 34, '#B923FF', true)}</div>
    <p style="margin:12px 0 0;font-family:${S};font-size:15px;line-height:1.6;color:#d6d4ce;">Plus il circule, plus il y aura de monde. On vous a préparé de quoi le partager partout, en deux clics.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;background:#B923FF;border-radius:18px;"><tr><td style="padding:22px 22px 24px;">
      <div style="font-family:${S};font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#ffffff;opacity:.8;">Votre kit de partage</div>
      <div style="margin-top:8px;">${gros('Tout est prêt', 30, '#ffffff')}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
        ${[['Une story Instagram', 'prête à publier'], ['Un visuel', 'pour Instagram et Facebook, avec sa légende'], ['Le lien', 'à envoyer par message, avec l’aperçu de l’affiche'], ['Une invitation mail', 'mise en forme, à copier-coller']]
          .map(([k, v]) => `<tr><td valign="top" style="padding:3px 10px 3px 0;font-family:${S};font-size:15px;font-weight:700;color:#ffffff;">✓</td><td style="padding:3px 0;font-family:${S};font-size:15px;line-height:1.45;color:#ffffff;"><strong>${k}</strong> ${v}</td></tr>`).join('')}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;"><tr><td style="border-radius:99px;background:#141210;"><a href="${kitUrl}" style="display:inline-block;padding:14px 26px;font-family:${S};font-size:15px;font-weight:600;color:#f4f3ef;text-decoration:none;border-radius:99px;">Ouvrir mon kit de partage</a></td></tr></table>
    </td></tr></table>

    <p style="margin:24px 0 0;font-family:${S};font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${G};">Ou directement</p>
    <p style="margin:10px 0 8px;font-family:${S};font-size:13px;color:${G};">Votre lien s’affichera comme ceci :</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#181818;border:1px solid #2c2c2c;border-radius:14px;"><tr>
      ${ph ? `<td width="84" valign="top" style="padding:12px 0 12px 12px;"><img src="${escH(ph)}" width="72" alt="" style="display:block;width:72px;height:auto;border-radius:8px;border:0;"></td>` : ''}
      <td valign="top" style="padding:12px 14px;">
        <div style="font-family:${S};font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${G};">la-save.fr</div>
        <div style="margin-top:3px;font-family:${S};font-size:15px;font-weight:600;line-height:1.3;color:${W};">${escH(titre)}</div>
        <div style="margin-top:3px;font-family:${S};font-size:13px;line-height:1.4;color:${G};">${escH([quand, f.Commune].filter(Boolean).join(' · '))}</div>
      </td>
    </tr></table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
      <tr>${btnApp(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(PS('mailpub'))}`, 'facebook', 'Partager sur', 'Facebook', '#1877F2', '#ffffff')}<td width="10" style="font-size:0;">&nbsp;</td>${btnApp(`https://wa.me/?text=${encodeURIComponent(msgWa)}`, 'whatsapp', 'Envoyer sur', 'WhatsApp', '#128C7E', '#ffffff')}</tr>
      <tr><td colspan="3" height="10" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr>${btnApp(`sms:?&body=${encodeURIComponent(msg)}`, 'sms', 'Envoyer par', 'SMS', '#262626', '#ffffff')}<td width="10" style="font-size:0;">&nbsp;</td>${btnApp(`mailto:?subject=${encodeURIComponent(titre)}&body=${encodeURIComponent(msg)}`, 'mail', 'Envoyer par', 'E-mail', '#FFA823', '#141210')}</tr>
    </table>

  </td></tr></table></td></tr>

  <tr><td style="padding:6px 20px 0;font-family:${S};font-size:14px;line-height:1.6;color:#d6d4ce;">Une erreur ou un changement ? <strong style="color:${W};">Répondez simplement à ce mail</strong>, la mairie s’occupe de la correction.</td></tr>

  <tr><td align="center" style="padding:30px 16px 0;font-family:${S};font-size:12px;line-height:1.8;color:#77756f;">
    Mairie de Saint-Paul-sur-Save — Commission culture<br>
    <a href="${SITE}" style="color:${W};text-decoration:none;font-weight:600;">la-save.fr</a> &nbsp;/&nbsp; <a href="https://linktr.ee/mairiesaintpaulsursave" style="color:${W};text-decoration:none;font-weight:600;">Suivez-nous</a><br>
    Vous recevez ce mail car vous avez proposé cet événement sur laSave.
  </td></tr>
</table>
</td></tr></table></body></html>`;

  const text = `${f.Organisation ? `Bonjour ${f.Organisation},` : 'Bonjour,'}

Votre événement a été relu par la mairie : il est maintenant en ligne sur laSave.
${mot ? `\nMessage de ${MOT_AUTEUR} :\n${mot}\n` : ''}
${titre}
${quand}${ou ? '\n' + ou : ''}${f.Tarif ? '\n' + f.Tarif : ''}

Voir l'événement : ${lien}
Votre kit de partage (story Instagram, visuel, invitation) : ${kitUrl}
Lien à partager : ${partage}

Une erreur ou un changement ? Répondez simplement à ce mail.

Mairie de Saint-Paul-sur-Save — ${SITE}`;
  return { subject: `C’est en ligne : ${titre}`, html, text };
}
async function notifyPublished(env, rec) {
  const f = rec.fields || {}, to = firstEmail(f['Contact privé']);
  if (!isEmail(to) || !env.BREVO_KEY) return;
  if (KV && await KV.get('mailpub:' + rec.id)) return;           // déjà prévenu (republication, etc.)
  if (KV) { try { await keepPhotos([f], { n: 1 }); } catch {} }  // l'affiche doit rester visible dans le mail
  await sendMail(env, { to, toName: f.Organisation, ...publishedMail(f, rec.id) });
  if (KV) await KV.put('mailpub:' + rec.id, new Date().toISOString());
}

/* ── copie locale des données (KV) : quelques appels Airtable par jour au lieu d'un par visite ── */
const SNAP_MAX_AGE = 24 * 3600e3;   // au-delà, on relit Airtable (en arrière-plan)
const DIRTY_DELAY = 60e3;           // après une publication, on relit au plus une fois par minute

// Les liens des photos Airtable expirent au bout de 2 h : on garde une copie de chaque photo dans KV
const API_ORIGIN = 'https://lasave-api.partage.workers.dev';
async function keepPhotos(list, budget) {
  for (const item of list) {
    if (!Array.isArray(item.Photo)) continue;
    const out = [];
    for (const a of item.Photo) {
      if (!a || !a.id) { out.push(a); continue; }
      const key = 'img:' + a.id, mine = `${API_ORIGIN}/img/${a.id}`;
      let have = !!(await KV.get(key + ':ok'));
      if (!have && budget.n > 0) {
        budget.n--;
        try {
          const src = a.thumbnails?.large?.url || a.url;
          const r = await fetch(src);
          const type = r.headers.get('Content-Type') || 'image/jpeg';
          const buf = await r.arrayBuffer();
          if (r.ok && /^image\//.test(type) && buf.byteLength < 20 * 1024 * 1024) {
            await KV.put(key, buf, { metadata: { type } });
            await KV.put(key + ':ok', '1');
            have = true;
          }
        } catch (e) { console.error('photo', a.id, e.message); }
      }
      out.push(have ? { id: a.id, url: mine, thumbnails: { large: { url: mine } } } : a);
    }
    item.Photo = out;
  }
}
async function buildSnap(env) {
  const evs = await listAll(env, T_EVENTS, '&filterByFormula=' + encodeURIComponent("{Statut}='Publié'"));
  const orgs = await listAll(env, T_ORGAS, '&sort[0][field]=Ordre&sort[0][direction]=asc');
  const snap = {
    at: Date.now(), dirty: false,
    events: evs.map(r => ({ id: r.id, ...pick(r.fields, EVENT_PUBLIC) })),
    orgas: orgs.filter(r => r.fields['Publié']).map(r => ({ id: r.id, ...pick(r.fields, ORGA_PUBLIC) })),
  };
  // Au plus 35 nouvelles photos par passage (limite de Cloudflare) ; les suivantes au passage d'après
  const budget = { n: 35 };
  await keepPhotos(snap.events, budget);
  await keepPhotos(snap.orgas, budget);
  if (budget.n <= 0) snap.dirty = true; // il reste des photos à copier : on repasse dans une minute
  // Codes organisateurs : gardés à part, jamais renvoyés tels quels
  const codes = {};
  orgs.forEach(r => { const c = (r.fields.Code || '').trim().toUpperCase(); if (c && !['Demandé', 'Refusé'].includes(r.fields['Statut code'])) codes[c] = { id: r.id, ...pick(r.fields, ORGA_PUBLIC) }; });
  await KV.put('snap', JSON.stringify(snap));
  await KV.put('codes', JSON.stringify(codes));
  return snap;
}
// Dépannage : si Airtable est bloqué et qu'aucune copie n'existe, on part d'un export publié sur le site
async function loadSeed() {
  try {
    const r = await fetch(`${SITE}/data/seed.json`, { cf: { cacheTtl: 0 } });
    if (!r.ok) return null;
    const d = await r.json();
    return { at: Date.now(), dirty: false, seed: true, photosPending: true, events: d.events || [], orgas: d.orgas || [] };
  } catch { return null; }
}
async function finishSeedPhotos() { // copie des photos de l'export, 40 par passage
  if (await KV.get('photolock')) return;
  await KV.put('photolock', '1', { expirationTtl: 60 });
  const snap = await KV.get('snap', 'json');
  if (!snap || !snap.photosPending) return;
  const budget = { n: 40 };
  await keepPhotos(snap.events, budget);
  await keepPhotos(snap.orgas, budget);
  if (budget.n > 0) snap.photosPending = false;
  await KV.put('snap', JSON.stringify(snap));
  await KV.delete('photolock');
}
async function getSnap(env, ctx) {
  let snap = await KV.get('snap', 'json');
  if (!snap) { // première fois : il faut attendre Airtable
    try { return await buildSnap(env); }
    catch (e) { snap = await loadSeed(); if (!snap) throw e; await KV.put('snap', JSON.stringify(snap)); }
  }
  if (snap.photosPending) ctx.waitUntil(finishSeedPhotos().catch(e => console.error('photos export', e.message)));
  const age = Date.now() - snap.at;
  if (age > SNAP_MAX_AGE || (snap.dirty && age > DIRTY_DELAY)) {
    ctx.waitUntil((async () => { // une seule relecture à la fois
      if (await KV.get('lock')) return;
      await KV.put('lock', '1', { expirationTtl: 60 });
      try { await buildSnap(env); } catch (e) { console.error('relecture Airtable', e.message); }
    })());
  }
  return snap; // en cas de panne Airtable, on continue de servir la dernière copie
}
async function markDirty() { const snap = await KV.get('snap', 'json'); if (snap) { snap.dirty = true; await KV.put('snap', JSON.stringify(snap)); } }
// Compteurs « J'y vais » / vues en attente de recopie dans Airtable
async function getCounts() { return (await KV.get('counts', 'json')) || {}; }
function withCounts(events, counts) {
  return events.map(e => counts[e.id] ? { ...e, Likes: counts[e.id].Likes ?? e.Likes, Vues: counts[e.id].Vues ?? e.Vues } : e);
}
// Tâche de nuit : recopie les compteurs (10 fiches par appel) puis relit Airtable
async function nightly(env) {
  if (!KV) return;
  const counts = await getCounts();
  const ids = Object.keys(counts).filter(id => isId(id) && !id.startsWith('recTMP')); // recTMP… : fiches de l'export de dépannage
  for (let i = 0; i < ids.length; i += 10) {
    const records = ids.slice(i, i + 10).map(id => ({ id, fields: pick(counts[id], ['Likes', 'Vues']) }));
    try { await at(env, T_EVENTS, { method: 'PATCH', body: JSON.stringify({ records }) }); } catch (e) { console.error('recopie compteurs', e.message); return; }
  }
  await buildSnap(env);
  await KV.delete('counts');
}

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

/* ── Statistiques (Workers Analytics Engine, liaison « STATS ») ──
   Chaque ligne : blob1 = type, blob2 = id de l'événement, blob3 = canal / détail. Aucune donnée personnelle. */
const STAT_TYPES = ['lien', 'apercu', 'kit', 'kit_action', 'fiche', 'jyvais', 'visite'];
const SOURCES = ['direct', 'interne', 'partage', 'google', 'facebook', 'instagram', 'recherche', 'mairie', 'autre'];
const CANAUX = ['wa', 'sms', 'fb', 'mail', 'lien', 'copie', 'legende', 'story', 'post', 'site', 'mailpub', 'invitation', 'qr'];
const ROBOTS = /facebookexternalhit|facebookcatalog|WhatsApp|Twitterbot|TelegramBot|Slackbot|Discordbot|LinkedInBot|Pinterest|SkypeUriPreview|Applebot|iMessage|Googlebot|bingbot|redditbot|vkShare|Embedly|Viber/i;
let CTX = null; // contexte de la requête en cours (pour écrire les stats sans ralentir la réponse)
let tableOk = false;
async function statsTable(db) {
  if (tableOk) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS stats (jour TEXT NOT NULL, type TEXT NOT NULL, id TEXT NOT NULL, canal TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (jour, type, id, canal))').run();
  tableOk = true;
}
function stat(env, type, id = '', canal = '') {
  if (!STAT_TYPES.includes(type)) return;
  id = String(id).slice(0, 20); canal = String(canal).slice(0, 20);
  // Base D1 (liaison « DB ») : un compteur par jour, type, événement et canal
  if (env.DB) {
    const jour = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10); // jour à l'heure de Paris (à peu près)
    const w = (async () => { await statsTable(env.DB); await env.DB.prepare('INSERT INTO stats (jour, type, id, canal, n) VALUES (?1, ?2, ?3, ?4, 1) ON CONFLICT (jour, type, id, canal) DO UPDATE SET n = n + 1').bind(jour, type, id, canal).run(); })().catch(e => console.error('stats D1', e.message));
    if (CTX) CTX.waitUntil(w);
    return;
  }
  try { if (env.STATS) env.STATS.writeDataPoint({ indexes: [type], blobs: [type, id, canal], doubles: [1] }); } catch {}
}
async function statsSql(env, sql) {
  if (!env.CF_ACCOUNT_ID || !env.CF_STATS_TOKEN) throw Object.assign(new Error('Statistiques pas encore configurées : il manque CF_ACCOUNT_ID ou CF_STATS_TOKEN dans les secrets du serveur.'), { status: 503, expose: true });
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID.trim()}/analytics_engine/sql`, { method: 'POST', headers: { Authorization: `Bearer ${env.CF_STATS_TOKEN.trim()}` }, body: sql });
  const t = await r.text();
  if (!r.ok) {
    let why = `réponse ${r.status} de Cloudflare : ${t.replace(/\s+/g, ' ').slice(0, 300)}`;
    if (r.status === 401 || r.status === 403) {
      // Diagnostic : le jeton est-il valide en lui-même ?
      let etat = 'inconnu';
      try { const v = await (await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers: { Authorization: `Bearer ${env.CF_STATS_TOKEN.trim()}` } })).json(); etat = v.success ? `valide (${v.result && v.result.status})` : `refusé (${(v.errors && v.errors[0] && v.errors[0].message) || 'erreur'})`; } catch {}
      why = `accès refusé (${r.status}). Jeton : ${etat}. Longueur du jeton : ${env.CF_STATS_TOKEN.trim().length} caractères, ID du compte : ${env.CF_ACCOUNT_ID.trim().length} caractères. Détail : ${t.replace(/\s+/g, ' ').slice(0, 200)}`;
    }
    else if (/unknown table|does not exist|lasave_stats/i.test(t)) why = 'aucune donnée encore enregistrée (la liaison STATS vers le jeu de données « lasave_stats » est-elle ajoutée ?).';
    throw Object.assign(new Error('Lecture des statistiques impossible : ' + why), { status: 502, expose: true });
  }
  let d; try { d = JSON.parse(t); } catch { throw Object.assign(new Error('Réponse inattendue de Cloudflare : ' + t.slice(0, 200)), { status: 502, expose: true }); }
  return d.data || [];
}

/* ── routes ── */
async function route(req, env, ctx) {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const m = req.method;
  const body = async () => { try { return await req.json(); } catch { return {}; } };

  // Événements publiés (mis en cache 60 s au bord du réseau Cloudflare)
  if (m === 'GET' && p === '/events' && KV) {
    const snap = await getSnap(env, ctx);
    return json(req, withCounts(snap.events, await getCounts()), 200, { 'Cache-Control': 'public, max-age=60' });
  }
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
    const canal = CANAUX.includes(url.searchParams.get('s')) ? url.searchParams.get('s') : '';
    // Un robot d'aperçu (WhatsApp, Facebook…) = le lien vient d'être posté ; sinon = quelqu'un a cliqué
    stat(env, ROBOTS.test(req.headers.get('User-Agent') || '') ? 'apercu' : 'lien', id, canal);
    let ev = null;
    if (KV) { const snap = await getSnap(env, ctx).catch(() => null); ev = snap && snap.events.find(e => e.id === id) || null; }
    else { try { const r = await at(env, `${T_EVENTS}/${id}`); if (r.fields.Statut === 'Publié') ev = r.fields; } catch {} }
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

  // Photos gardées dans KV
  let im;
  if (m === 'GET' && KV && (im = p.match(/^\/img\/(att[A-Za-z0-9]{14})$/))) {
    const { value, metadata } = await KV.getWithMetadata('img:' + im[1], { type: 'arrayBuffer' });
    if (!value) return new Response('Introuvable', { status: 404 });
    return new Response(value, { headers: { 'Content-Type': metadata?.type || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' } });
  }

  // Organisateurs publiés (sans leur code membre)
  if (m === 'GET' && p === '/orgas' && KV) {
    const snap = await getSnap(env, ctx);
    return json(req, snap.orgas, 200, { 'Cache-Control': 'public, max-age=120' });
  }
  if (m === 'GET' && p === '/orgas') {
    const recs = await listAll(env, T_ORGAS, '&filterByFormula=' + encodeURIComponent('{Publié}=1') + '&sort[0][field]=Ordre&sort[0][direction]=asc');
    return json(req, recs.map(r => ({ id: r.id, ...pick(r.fields, ORGA_PUBLIC) })), 200, { 'Cache-Control': 'public, max-age=120' });
  }

  // Vérification d'un code membre : ne renvoie que l'organisateur correspondant
  if (m === 'POST' && p === '/code') {
    if (await tooMany(req, 'code', 10, 600)) return slowDown(req);
    const code = String((await body()).code || '').trim().toUpperCase().slice(0, 40);
    if (!code) return json(req, { error: 'Code manquant' }, 400);
    if (KV) {
      let codes = await KV.get('codes', 'json');
      if (!codes) { await getSnap(env, ctx); codes = (await KV.get('codes', 'json')) || {}; }
      if (codes[code]) return json(req, codes[code]);
      // Code tout juste créé dans Airtable ? On relit une fois (au plus toutes les 10 min)
      if (!(await KV.get('codes-recheck'))) {
        await KV.put('codes-recheck', '1', { expirationTtl: 600 });
        try { await buildSnap(env); codes = (await KV.get('codes', 'json')) || {}; if (codes[code]) return json(req, codes[code]); } catch {}
      }
      return json(req, { error: 'Code non reconnu' }, 404);
    }
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
        html: `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#16191a;line-height:1.6"><p><strong>${escH(nom)}</strong> (${escH(email)}) demande un code organisateur sur laSave.</p>${message ? `<blockquote style="margin:0 0 16px;padding:10px 14px;background:#f6f8f8;border-left:4px solid #FFA823">${escH(message)}</blockquote>` : ''}<p><a href="${SITE}/#admin" style="display:inline-block;background:#c8a96e;color:#ffffff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px">Valider ou refuser dans l'admin</a></p></div>`,
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
    if (fields.Billetterie && !/^https:\/\/[^\s<>"']+$/.test(fields.Billetterie)) delete fields.Billetterie; // lien de billetterie : https uniquement
    fields.Statut = 'En attente';
    // Proposé avec un code organisateur et sans e-mail : on reprend l'e-mail de la structure (pour le mail de publication)
    const code = String(b.code || '').trim().toUpperCase().slice(0, 40);
    if (code && KV && !firstEmail(fields['Contact privé'])) {
      try {
        const o = ((await KV.get('codes', 'json')) || {})[code];
        if (o && isId(o.id)) { const r = await at(env, `${T_ORGAS}/${o.id}`); if (isEmail(r.fields.Email)) fields['Contact privé'] = [fields['Contact privé'], r.fields.Email].filter(Boolean).join(' · '); }
      } catch (e) { console.error('e-mail organisateur', e.message); }
    }
    let d;
    try { d = await at(env, T_EVENTS, { method: 'POST', body: JSON.stringify({ fields }) }); }
    catch (e) { // colonne « Billetterie » pas encore créée dans Airtable : on enregistre quand même le reste
      if (!fields.Billetterie || !/Billetterie|UNKNOWN_FIELD/i.test(e.message)) throw e;
      delete fields.Billetterie;
      d = await at(env, T_EVENTS, { method: 'POST', body: JSON.stringify({ fields }) });
    }
    return json(req, { ok: true, id: d.id }, 201);
  }

  // Statistiques envoyées par le site et le kit de partage (pas de données personnelles)
  if (m === 'POST' && p === '/stat') {
    const b = await body();
    const type = ['kit', 'kit_action'].includes(b.t) ? b.t : null;
    if (type && isId(b.id)) stat(env, type, b.id, CANAUX.includes(b.c) ? b.c : '');
    // Visite du site (une par session) : page « site » ou « test », et provenance
    if (b.t === 'visite' && ['site', 'test'].includes(b.id)) stat(env, 'visite', b.id, SOURCES.includes(b.c) ? b.c : 'autre');
    return new Response(null, { status: 204, headers: cors(req) });
  }

  // Compteur de vues / likes (calculés côté serveur)
  let mm;
  if (m === 'POST' && (mm = p.match(/^\/events\/(rec\w+)\/(view|like)$/))) {
    const [, id, what] = mm;
    if (!isId(id)) return json(req, { error: 'id' }, 400);
    if (await tooMany(req, `${what}-${id}`, what === 'like' ? 4 : 10, 3600)) return slowDown(req);
    const field = what === 'view' ? 'Vues' : 'Likes';
    stat(env, what === 'view' ? 'fiche' : 'jyvais', id);
    const delta = what === 'view' ? 1 : ((await body()).delta === -1 ? -1 : 1);
    if (KV) { // compté dans KV, recopié dans Airtable la nuit
      const snap = await getSnap(env, ctx);
      const ev = snap.events.find(e => e.id === id);
      if (!ev) return json(req, { error: 'Événement introuvable' }, 404);
      const counts = await getCounts();
      const c = counts[id] || { Likes: ev.Likes || 0, Vues: ev.Vues || 0 };
      c[field] = Math.max(0, (c[field] || 0) + delta);
      counts[id] = c;
      await KV.put('counts', JSON.stringify(counts));
      return json(req, { [field]: c[field] });
    }
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
      let rec;
      try { rec = await at(env, `${T_EVENTS}/${mm[1]}`, { method: 'PATCH', body: JSON.stringify({ fields: { Statut: statut } }) }); }
      catch (e) { if (e.status === 404) return json(req, { error: 'Événement introuvable' }, 404); throw e; }
      if (statut === 'Publié') ctx.waitUntil(notifyPublished(env, rec).catch(e => console.error('mail publication', e)));
      await caches.default.delete(new Request(url.origin + '/events'));
      if (KV) await markDirty(); // le site se met à jour dans la minute
      return json(req, { ok: true });
    }
    // Statistiques des N derniers jours
    if (m === 'GET' && p === '/admin/stats') {
      const jours = Math.min(90, Math.max(1, parseInt(url.searchParams.get('jours'), 10) || 30));
      if (env.DB) {
        await statsTable(env.DB);
        const depuis = new Date(Date.now() + 2 * 3600e3 - (jours - 1) * 864e5).toISOString().slice(0, 10);
        const [a, b] = await Promise.all([
          env.DB.prepare("SELECT type, id, canal, SUM(n) AS n FROM stats WHERE jour >= ?1 AND NOT (type = 'visite' AND id = 'test') GROUP BY type, id, canal").bind(depuis).all(),
          env.DB.prepare("SELECT jour, type, SUM(n) AS n FROM stats WHERE jour >= ?1 AND NOT (type = 'visite' AND id = 'test') GROUP BY jour, type ORDER BY jour").bind(depuis).all(),
        ]);
        return json(req, { jours, parEvenement: a.results || [], parJour: b.results || [], source: 'd1' });
      }
      const where = `WHERE timestamp > NOW() - INTERVAL '${jours}' DAY`;
      const [parEvenement, parJour] = await Promise.all([
        statsSql(env, `SELECT blob1 AS type, blob2 AS id, blob3 AS canal, SUM(_sample_interval) AS n FROM lasave_stats ${where} GROUP BY type, id, canal`),
        statsSql(env, `SELECT toStartOfDay(timestamp) AS jour, blob1 AS type, SUM(_sample_interval) AS n FROM lasave_stats ${where} GROUP BY jour, type ORDER BY jour`),
      ]);
      // Diagnostic si rien n'est trouvé : jeux de données existants et nombre total de lignes
      let diag = null;
      if (!parEvenement.length) {
        diag = { tables: [], lignes: null };
        try { diag.tables = (await statsSql(env, 'SHOW TABLES')).map(t => t.dataset || t.name || Object.values(t)[0]); } catch (e) { diag.tables = ['? ' + e.message.slice(0, 120)]; }
        try { diag.lignes = +((await statsSql(env, 'SELECT count() AS n FROM lasave_stats'))[0] || {}).n || 0; } catch (e) { diag.lignes = 'erreur : ' + e.message.slice(0, 160); }
      }
      return json(req, { jours, parEvenement, parJour, diag });
    }
    // Relecture immédiate d'Airtable (après une modification faite directement dans Airtable)
    if (m === 'POST' && p === '/admin/refresh') {
      if (!KV) return json(req, { error: 'Stockage KV non relié' }, 400);
      const snap = await buildSnap(env);
      return json(req, { ok: true, events: snap.events.length, orgas: snap.orgas.length });
    }
  }

  if (p === '/' || p === '/health') {
    const snap = KV ? await KV.get('snap', 'json') : null;
    return json(req, { ok: true, service: 'laSave API', kv: !!KV, statsD1: !!env.DB, stats: !!env.STATS, statsLecture: !!(env.CF_ACCOUNT_ID && env.CF_STATS_TOKEN), copie: snap ? new Date(snap.at).toISOString() : null, evenements: snap ? snap.events.length : null });
  }
  return json(req, { error: 'Introuvable' }, 404);
}

export default {
  async scheduled(event, env, ctx) {
    KV = env.LASAVE || null;
    ctx.waitUntil(nightly(env));
  },
  async fetch(req, env, ctx) {
    KV = env.LASAVE || null; CTX = ctx;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    try { return await route(req, env, ctx); }
    catch (e) {
      console.error(e);
      if (e.expose || e.status === 503 || (e.status === 502 && /e-mail/.test(e.message))) return json(req, { error: e.message }, e.status || 502);
      return json(req, { error: 'Le service est momentanément indisponible, réessayez plus tard.' }, 502);
    }
  },
};
