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
const F_CONF = 'Envoyer la confirmation', F_CONF_TXT = 'Confirmation par mail'; // champs Airtable du bouton « envoyer la confirmation »

// E-mails
const MAIL_FROM = { name: 'Agenda de laSave', email: 'agenda@la-save.fr' };
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
function publishedMail(f, id, k = '') {
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
  const kitUrl = `${SITE}/test13/kit.html?id=${id}${k ? '&k=' + k : ''}`; // page « kit de partage » (test13 pour l'instant)
  const msg = [titre, quand, ou, f.Tarif].filter(Boolean).join('\n') + `\n\nToutes les infos : ${PS('mailpub')}`;
  const msgWa = [`*${titre}*`, quand, ou, f.Tarif].filter(Boolean).join('\n') + `\n\nToutes les infos : ${PS('mailpub')}`;
  const btnApp = (h, ico, petit, nom, bg, fg) => `<td width="49%" valign="top" style="border-radius:14px;background:${bg};"><a href="${h}" style="display:block;padding:14px 14px;text-decoration:none;border-radius:14px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="padding-right:10px;"><img src="${SITE}/images/partage/${ico}.png" width="24" height="24" alt="" style="display:block;width:24px;height:24px;border:0;"></td><td valign="middle" style="font-family:${S};color:${fg};line-height:1.15;"><span style="font-size:11px;opacity:.85;">${petit}</span><br><span style="font-size:15px;font-weight:600;">${nom}</span></td></tr></table></a></td>`;

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
    <div style="padding-top:22px;">${gros('Partagez-le', 34, '#C955E0', true)}</div>
    <p style="margin:12px 0 0;font-family:${S};font-size:15px;line-height:1.6;color:#d6d4ce;">Plus il circule, plus il y aura de monde. Tout est prêt pour le partager en deux clics.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;background:#181818;border:1px solid #2c2c2c;border-radius:18px;"><tr><td style="padding:22px 22px 24px;">
      <div style="font-family:${S};font-size:16px;font-weight:600;line-height:1.4;color:${W};">Votre kit de partage</div>
      <p style="margin:8px 0 0;font-family:${S};font-size:14px;line-height:1.6;color:#d6d4ce;">Une story Instagram, un visuel avec sa légende, le lien avec l’aperçu de l’affiche et une invitation mail à copier-coller.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;"><tr><td style="border-radius:99px;background:#C955E0;"><a href="${kitUrl}" style="display:inline-block;padding:14px 26px;font-family:${S};font-size:15px;font-weight:600;color:#141210;text-decoration:none;border-radius:99px;">Ouvrir mon kit</a></td></tr></table>
    </td></tr></table>

    <p style="margin:26px 0 0;font-family:${S};font-size:12px;font-weight:600;color:${W};">Ou en un clic</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
      <tr>${btnApp(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(PS('mailpub'))}`, 'facebook', 'Partager sur', 'Facebook', '#1877F2', '#ffffff')}<td width="12" style="width:12px;font-size:0;line-height:0;">&nbsp;</td>${btnApp(`https://wa.me/?text=${encodeURIComponent(msgWa)}`, 'whatsapp', 'Envoyer sur', 'WhatsApp', '#128C7E', '#ffffff')}</tr>
      <tr><td colspan="3" height="10" style="font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr>${btnApp(`sms:?&body=${encodeURIComponent(msg)}`, 'sms', 'Envoyer par', 'SMS', '#262626', '#ffffff')}<td width="12" style="width:12px;font-size:0;line-height:0;">&nbsp;</td>${btnApp(`mailto:?subject=${encodeURIComponent(titre)}&body=${encodeURIComponent(msg)}`, 'mail', 'Envoyer par', 'E-mail', '#FFA823', '#141210')}</tr>
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
  await sendMail(env, { to, toName: f.Organisation, ...publishedMail(f, rec.id, await rsvpKey(env, rec.id)) });
  if (KV) await KV.put('mailpub:' + rec.id, new Date().toISOString());
}

/* ── Newsletter : les inscrits vont dans une liste Brevo (créée toute seule la première fois) ── */
const NL_NOM = 'Newsletter laSave';
const brevo = async (env, path, opts = {}) => {
  const r = await fetch('https://api.brevo.com/v3' + path, { ...opts, headers: { 'api-key': env.BREVO_KEY, 'Content-Type': 'application/json', Accept: 'application/json' } });
  const d = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('Brevo ' + r.status + ' ' + (d.code || '') + ' ' + (d.message || '')), { status: 502, brevo: r.status, code: d.code });
  return { status: r.status, d };
};
async function nlListe(env) {
  if (env.NEWSLETTER_LIST) return +env.NEWSLETTER_LIST;
  const k = KV && await KV.get('nl-liste'); if (k) return +k;
  let l = ((await brevo(env, '/contacts/lists?limit=50')).d.lists || []).find(x => x.name === NL_NOM);
  if (!l) {
    let dossier = ((await brevo(env, '/contacts/folders?limit=10')).d.folders || [])[0]?.id;
    if (!dossier) dossier = (await brevo(env, '/contacts/folders', { method: 'POST', body: JSON.stringify({ name: 'laSave' }) })).d.id;
    l = (await brevo(env, '/contacts/lists', { method: 'POST', body: JSON.stringify({ name: NL_NOM, folderId: dossier }) })).d;
  }
  if (KV) await KV.put('nl-liste', String(l.id));
  return +l.id;
}
const nlSig = async (env, email) => (await hmac(env, 'nl.' + email.toLowerCase())).slice(0, 24);
function bienvenueMail(stop) {
  const S = "'Instrument Sans','Helvetica Neue',Helvetica,Arial,sans-serif", D = "Archivo,'Arial Narrow','Helvetica Neue',Arial,sans-serif";
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Bienvenue dans la lettre de laSave</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..900&family=Instrument+Sans:wght@400;600&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#050505;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Chaque début de mois, les sorties de la vallée de la Save dans votre boîte mail.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050505;"><tr><td align="center" style="padding:30px 12px 44px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
  <tr><td style="padding:4px 6px 22px;"><a href="${SITE}"><img src="${SITE}/test7/logo.png" width="118" alt="laSave" style="display:block;width:118px;height:auto;border:0;"></a></td></tr>
  <tr><td style="background:#0e0e0e;border-radius:26px;padding:26px 26px 30px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-family:${S};font-size:12px;font-weight:600;color:#f4f3ef;">C’est noté</td><td align="right" style="font-family:${S};font-size:12px;color:#a3a19b;">La lettre de laSave</td></tr><tr><td colspan="2" style="padding-top:12px;border-bottom:1px solid #262626;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <div style="padding-top:26px;font-family:${D};font-stretch:75%;font-size:56px;line-height:.95;font-weight:800;text-transform:uppercase;color:#FFA823;">Bienvenue&nbsp;!</div>
    <p style="margin:18px 0 0;font-family:${S};font-size:16px;line-height:1.6;color:#d6d4ce;">Merci pour votre inscription. Chaque début de mois, vous recevrez les sorties de la vallée de la Save : concerts, fêtes, spectacles, marchés… et quelques nouvelles des villages.</p>
    <p style="margin:14px 0 0;font-family:${S};font-size:16px;line-height:1.6;color:#d6d4ce;">En attendant la prochaine lettre, tout l’agenda est déjà en ligne.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td style="border-radius:99px;background:#FFA823;"><a href="${SITE}" style="display:inline-block;padding:14px 26px;font-family:${S};font-size:15px;font-weight:600;color:#141210;text-decoration:none;border-radius:99px;">Voir l’agenda</a></td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:30px 16px 0;font-family:${S};font-size:12px;line-height:1.8;color:#77756f;">
    Mairie de Saint-Paul-sur-Save — Commission culture<br>
    <a href="${SITE}" style="color:#f4f3ef;text-decoration:none;font-weight:600;">la-save.fr</a><br>
    Vous recevez ce mail car vous vous êtes inscrit à la lettre de laSave.<br><a href="${stop}" style="color:#a3a19b;">Se désinscrire</a>
  </td></tr>
</table></td></tr></table></body></html>`;
  const text = `Bienvenue !\n\nMerci pour votre inscription à la lettre de laSave. Chaque début de mois, vous recevrez les sorties de la vallée de la Save.\n\nL'agenda : ${SITE}\n\nSe désinscrire : ${stop}`;
  return { subject: 'Bienvenue dans la lettre de laSave', html, text };
}
const pageSimple = (titre, texte) => new Response(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titre} · laSave</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#f4f3ef;font:16px/1.6 'Helvetica Neue',Arial,sans-serif;padding:24px;box-sizing:border-box;">
<main style="max-width:440px;text-align:center;"><h1 style="font-size:28px;margin:0 0 12px;">${titre}</h1><p style="color:#d6d4ce;margin:0 0 24px;">${texte}</p><a href="${SITE}" style="display:inline-block;padding:13px 24px;border-radius:99px;background:#FFA823;color:#141210;font-weight:600;text-decoration:none;">Retour à l’agenda</a></main></body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } });

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

/* Mail « C'est en ligne » demandé depuis Airtable : part seulement si la case est cochée ET que l'événement est vraiment visible sur le site.
   Sinon la case reste cochée et le mail partira à la prochaine mise en ligne (/hook/refresh). */
async function tryConfirm(env, rec, liveEvents, lien = false) {
  const id = rec.id, f = rec.fields || {};
  const ecrire = async (texte, decoche) => {
    const fields = { [F_CONF_TXT]: texte }; if (decoche) fields[F_CONF] = false;
    try { await at(env, `${T_EVENTS}/${id}`, { method: 'PATCH', body: JSON.stringify({ fields }) }); }
    catch (e) { console.error('confirmation : écriture Airtable', e.message); }
    return { envoye: false, texte };
  };
  if (!lien && !f[F_CONF]) return { envoye: false, texte: "La case n'est pas cochée." };
  if (lien && f.Statut !== 'Publié') return { envoye: false, texte: "Pas envoyée : l'événement n'est pas encore publié (Statut = Publié)." };
  if (lien && !liveEvents.some(e => e.id === id)) return { envoye: false, texte: "Pas envoyée : l'événement n'apparaît pas encore sur le site, réessayez dans une minute." };
  if (f.Statut !== 'Publié' || !liveEvents.some(e => e.id === id)) return { ...(await ecrire("En attente : le mail partira dès que l'événement sera en ligne sur le site.", false)), attente: true };
  const to = firstEmail(f['Contact privé']);
  if (!isEmail(to)) return ecrire('Pas envoyée : aucune adresse e-mail dans « Contact privé ».', true);
  if (!env.BREVO_KEY) return ecrire("Pas envoyée : la clé d'envoi (Brevo) n'est pas configurée.", true);
  try {
    if (KV) { try { await keepPhotos([f], { n: 1 }); } catch {} }
    await sendMail(env, { to, toName: f.Organisation, ...publishedMail(f, id, await rsvpKey(env, id)) });
  } catch (e) { console.error('confirmation : envoi', e.message); return ecrire("Échec de l'envoi : décochez puis recochez la case pour réessayer.", true); }
  if (KV) await KV.put('mailpub:' + id, new Date().toISOString());
  const now = new Date(), tz = { timeZone: 'Europe/Paris' };
  const quand = `${now.toLocaleDateString('fr-FR', { ...tz, day: '2-digit', month: '2-digit', year: 'numeric' })} à ${now.toLocaleTimeString('fr-FR', { ...tz, hour: '2-digit', minute: '2-digit' })}`;
  const r = await ecrire(`Envoyée le ${quand} à ${to}`, true);
  return { ...r, envoye: true };
}
// Compteurs « J'y vais » / vues en attente de recopie dans Airtable
async function getCounts() { return (await KV.get('counts', 'json')) || {}; }
function withCounts(events, counts) {
  return events.map(e => counts[e.id] ? { ...e, Likes: counts[e.id].Likes ?? e.Likes, Vues: counts[e.id].Vues ?? e.Vues } : e);
}
// Tâche de nuit : recopie les compteurs (10 fiches par appel) puis relit Airtable
/* ── Récapitulatif « Qui vient » : un seul mail à l'organisateur, 2 jours avant, à partir de 5 personnes ── */
const RECAP_MIN = 5;
async function rsvpRecap(env) {
  if (!env.DB || !KV || !env.BREVO_KEY) return;
  await rsvpTable(env.DB);
  const jour = n => new Date(Date.now() + n * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  const [de, a] = [jour(1), jour(2)];
  const snap = (await KV.get('snap', 'json')) || {};
  const proches = (snap.events || []).filter(e => e.Date >= de && e.Date <= a);
  if (!proches.length) return;
  const sums = (await env.DB.prepare('SELECT ev, SUM(nb) AS total FROM rsvp GROUP BY ev HAVING SUM(nb) >= ?1').bind(RECAP_MIN).all()).results || [];
  for (const e of proches) {
    const sm = sums.find(x => x.ev === e.id);
    if (!sm || await KV.get('mailrsvp:' + e.id)) continue;
    try {
      const rec = await at(env, `${T_EVENTS}/${e.id}`), f = rec.fields || {};
      const to = firstEmail(f['Contact privé']);
      if (!to) continue;
      const rows = (await env.DB.prepare('SELECT prenom, nb FROM rsvp WHERE ev = ?1 ORDER BY at').bind(e.id).all()).results || [];
      await sendMail(env, { to, toName: f.Organisation, ...rsvpMail(f, e.id, sm.total, rows, await rsvpKey(env, e.id)) });
      await KV.put('mailrsvp:' + e.id, new Date().toISOString(), { expirationTtl: 40 * 86400 });
    } catch (err) { console.error('récap rsvp', e.id, err.message); }
  }
}
function rsvpMail(f, id, total, rows, k) {
  const titre = f.Titre || 'Votre événement', quand = quandTexte(f);
  const kitUrl = `${SITE}/test13/kit.html?id=${id}&k=${k}`;
  const S = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const noms = rows.slice(0, 40).map(r => escH(r.prenom) + (r.nb > 1 ? ` (+${r.nb - 1})` : ''));
  const reste = rows.length - noms.length;
  const subject = `${titre} : ${total} personnes viennent`;
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escH(subject)}</title></head>
<body bgcolor="#050505" style="margin:0;padding:0;background-color:#050505;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#050505" style="background-color:#050505;"><tr><td align="center" style="padding:30px 12px 44px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:4px 6px 20px;"><a href="${SITE}"><img src="${SITE}/test7/logo.png" width="118" alt="laSave" style="display:block;width:118px;height:auto;border:0;"></a></td></tr>
<tr><td bgcolor="#0e0e0e" style="background-color:#0e0e0e;border-radius:26px;padding:28px 26px 30px;font-family:${S};">
  <div style="font-size:12px;font-weight:600;color:#a3a19b;letter-spacing:.06em;text-transform:uppercase;">Point d’étape · ${escH(titre)}</div>
  <div style="margin-top:16px;font-size:44px;line-height:1;font-weight:800;color:#FFA823;">${total} personnes</div>
  <div style="margin-top:6px;font-size:20px;font-weight:700;color:#f4f3ef;">comptent venir.</div>
  <p style="margin:18px 0 0;font-size:16px;line-height:1.6;color:#d6d4ce;">Bonjour${f.Organisation ? ' ' + escH(f.Organisation) : ''}, c’est bientôt (${escH(quand.charAt(0).toLowerCase() + quand.slice(1))}). Voici qui a répondu « Je viens » depuis votre invitation :</p>
  <p style="margin:14px 0 0;font-size:16px;line-height:1.8;color:#f4f3ef;"><strong>${noms.join(' · ')}</strong>${reste > 0 ? ` <span style="color:#a3a19b;">et ${reste} autre${reste > 1 ? 's' : ''}</span>` : ''}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td bgcolor="#FFA823" style="background-color:#FFA823;border-radius:99px;"><a href="${kitUrl}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:600;color:#141210;text-decoration:none;border-radius:99px;">Voir la liste en direct</a></td></tr></table>
  <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#a3a19b;">C’est le seul mail que vous recevrez à ce sujet. La liste continue de se mettre à jour dans votre kit de partage.</p>
</td></tr>
<tr><td align="center" style="padding:26px 16px 0;font-family:${S};font-size:12px;line-height:1.8;color:#77756f;">Mairie de Saint-Paul-sur-Save — Commission culture<br><a href="${SITE}" style="color:#f4f3ef;text-decoration:none;font-weight:600;">la-save.fr</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `Bonjour${f.Organisation ? ' ' + f.Organisation : ''},

${titre} (${quand}) : ${total} personnes comptent venir.

${rows.slice(0, 40).map(r => r.prenom + (r.nb > 1 ? ` (+${r.nb - 1})` : '')).join(', ')}${reste > 0 ? ` et ${reste} autre(s)` : ''}

La liste en direct : ${kitUrl}

C'est le seul mail que vous recevrez à ce sujet.`;
  return { subject, html, text };
}

async function nightly(env) {
  if (!KV) return;
  try { await rsvpRecap(env); } catch (e) { console.error('récap rsvp', e.message); }
  const counts = await getCounts();
  const ids = Object.keys(counts).filter(id => isId(id) && !id.startsWith('recTMP')); // recTMP… : fiches de l'export de dépannage
  for (let i = 0; i < ids.length; i += 10) {
    const records = ids.slice(i, i + 10).map(id => ({ id, fields: pick(counts[id], ['Likes', 'Vues']) }));
    try { await at(env, T_EVENTS, { method: 'PATCH', body: JSON.stringify({ records }) }); } catch (e) { console.error('recopie compteurs', e.message); return; }
  }
  await buildSnap(env);
  await KV.delete('counts');
  try { if (env.DB) { await rsvpTable(env.DB); await env.DB.prepare('DELETE FROM rsvp WHERE fin < ?1').bind(new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)).run(); } } catch (e) { console.error('purge rsvp', e.message); }
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
const STAT_TYPES = ['lien', 'apercu', 'kit', 'kit_action', 'fiche', 'jyvais', 'visite', 'newsletter', 'agenda'];
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


/* ── « Je viens » : réponses des invités (D1, table rsvp) ──
   Un invité ouvre la page depuis l'invitation mail, laisse son prénom et le nombre de personnes.
   Seul l'organisateur (lien de son kit, avec clé) peut voir la liste. Effacé 7 jours après l'événement. */
let rsvpOk = false;
async function rsvpTable(db) {
  if (rsvpOk) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS rsvp (ev TEXT NOT NULL, cle TEXT NOT NULL, prenom TEXT NOT NULL, nb INTEGER NOT NULL, fin TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (ev, cle))').run();
  rsvpOk = true;
}
const rsvpKey = async (env, id) => (await hmac(env, 'rsvp.' + id)).slice(0, 20);
const parisJour = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
const MAX_REPONSES = 300;
function venirPage(ev, id, { err = '', prenom = '', nb = 1 } = {}) {
  const quand = quandTexte(ev), ou = [ev.Lieu, ev.Commune].filter(Boolean).join(', ');
  const opts = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}"${i + 1 === nb ? ' selected' : ''}>${i + 1}</option>`).join('');
  const css = "font-family:'Helvetica Neue',Arial,sans-serif;";
  const champ = `display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:13px 14px;border-radius:12px;border:1.5px solid #3a3a3a;background:#181818;color:#f4f3ef;font-size:16px;${css}`;
  return new Response(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Je viens · ${escH(ev.Titre)} · laSave</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#f4f3ef;font:16px/1.6 'Helvetica Neue',Arial,sans-serif;padding:20px;box-sizing:border-box;">
<main style="width:100%;max-width:440px;background:#0e0e0e;border-radius:26px;padding:28px 26px 30px;">
<p style="margin:0;font-size:12px;font-weight:600;color:#a3a19b;letter-spacing:.06em;text-transform:uppercase;">laSave · Agenda de la Save</p>
<h1 style="margin:14px 0 4px;font-size:30px;line-height:1.1;text-transform:uppercase;">${escH(ev.Titre)}</h1>
<p style="margin:0;color:#FFA823;font-weight:600;">${escH(quand)}</p>
${ou ? `<p style="margin:2px 0 0;color:#d6d4ce;">${escH(ou)}</p>` : ''}
<h2 style="margin:26px 0 4px;font-size:20px;">Vous venez ?</h2>
<p style="margin:0 0 16px;color:#d6d4ce;font-size:15px;">Dites-le à l’organisateur, ça l’aide à préparer l’accueil.</p>
${err ? `<p style="margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#2a1410;color:#ffd9cf;font-size:15px;">${escH(err)}</p>` : ''}
<form method="post" action="${API_ORIGIN}/venir/${id}">
<label style="display:block;font-size:14px;font-weight:600;">Votre prénom<input name="prenom" required maxlength="40" autocomplete="given-name" value="${escH(prenom)}" style="${champ}"></label>
<label style="display:block;margin-top:14px;font-size:14px;font-weight:600;">Combien de personnes, vous compris ?<select name="nb" style="${champ}">${opts}</select></label>
<div style="position:absolute;left:-9999px;" aria-hidden="true"><label>Ne pas remplir<input name="site" tabindex="-1" autocomplete="off"></label></div>
<button type="submit" style="margin-top:22px;width:100%;padding:15px 24px;border:0;border-radius:99px;background:#FFA823;color:#141210;font-size:16px;font-weight:700;cursor:pointer;${css}">Je viens</button>
</form>
<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#a3a19b;">Votre prénom et le nombre de personnes ne sont visibles que par l’organisateur. Rien d’autre n’est gardé, tout est effacé une semaine après l’événement.</p>
</main></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } });
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

  // « Je viens » : page et envoi du formulaire (invitation mail)
  const vm = p.match(/^\/venir\/(rec[A-Za-z0-9]{14})$/);
  if (vm && (m === 'GET' || m === 'POST')) {
    const id = vm[1];
    if (!KV || !env.DB) return pageSimple('Bientôt disponible', 'Cette page n’est pas encore activée.');
    const ev = ((await getSnap(env, ctx)).events || []).find(e => e.id === id);
    if (!ev) return pageSimple('Événement introuvable', 'Cet événement n’est pas (ou plus) en ligne sur laSave.');
    if ((ev['Date de fin'] || ev.Date || '9999') < parisJour()) return pageSimple('Événement passé', 'Cet événement a déjà eu lieu.');
    if (m === 'GET') return venirPage(ev, id);
    let fd; try { fd = await req.formData(); } catch { return venirPage(ev, id, { err: 'Le formulaire n’a pas pu être lu, réessayez.' }); }
    if (String(fd.get('site') || '')) return pageSimple('C’est noté', 'Merci !'); // piège à robots : on fait semblant
    const prenom = String(fd.get('prenom') || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const nb = Math.min(10, Math.max(1, parseInt(fd.get('nb'), 10) || 1));
    if (!prenom) return venirPage(ev, id, { err: 'Indiquez votre prénom.', nb });
    if (await tooMany(req, 'venir', 10, 3600)) return pageSimple('Trop de tentatives', 'Réessayez dans une heure.');
    await rsvpTable(env.DB);
    const cle = prenom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const deja = await env.DB.prepare('SELECT 1 AS x FROM rsvp WHERE ev = ?1 AND cle = ?2').bind(id, cle).first();
    if (!deja) {
      const tot = await env.DB.prepare('SELECT COUNT(*) AS n FROM rsvp WHERE ev = ?1').bind(id).first();
      if ((tot?.n || 0) >= MAX_REPONSES) return pageSimple('Réponses closes', 'Le nombre maximum de réponses est atteint.');
    }
    await env.DB.prepare('INSERT INTO rsvp (ev, cle, prenom, nb, fin, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT (ev, cle) DO UPDATE SET prenom = ?3, nb = ?4, at = ?6')
      .bind(id, cle, prenom, nb, ev['Date de fin'] || ev.Date || parisJour(), new Date().toISOString()).run();
    return new Response(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>C’est noté · laSave</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#f4f3ef;font:16px/1.6 'Helvetica Neue',Arial,sans-serif;padding:24px;box-sizing:border-box;">
<main style="max-width:440px;text-align:center;"><h1 style="font-size:30px;margin:0 0 12px;">C’est noté !</h1>
<p style="color:#d6d4ce;margin:0 0 6px;">Merci ${escH(prenom)}, l’organisateur sait que vous venez${nb > 1 ? ` à ${nb}` : ''}.</p>
<p style="color:#a3a19b;margin:0 0 26px;font-size:15px;">${escH(ev.Titre)} · ${escH(quandTexte(ev))}</p>
<a href="${API_ORIGIN}/ics/${id}" style="display:inline-block;padding:13px 24px;border-radius:99px;background:#FFA823;color:#141210;font-weight:600;text-decoration:none;">Ajouter à mon agenda</a>
<p style="margin:18px 0 0;"><a href="${SITE}/#event-${id}" style="color:#f4f3ef;font-weight:600;">Voir la fiche de l’événement</a></p></main></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } });
  }
  // « Qui vient » : liste vue par l'organisateur (lien du kit, avec clé)
  const rm = p.match(/^\/rsvp\/(rec[A-Za-z0-9]{14})$/);
  if (m === 'GET' && rm) {
    const id = rm[1];
    if (!env.DB) return json(req, { ok: true, total: 0, reponses: [] }, 200, { 'Cache-Control': 'no-store' });
    if (!sameText(String(url.searchParams.get('k') || ''), await rsvpKey(env, id))) return json(req, { error: 'Lien non valide.' }, 403);
    await rsvpTable(env.DB);
    const rows = (await env.DB.prepare('SELECT prenom, nb FROM rsvp WHERE ev = ?1 ORDER BY at').bind(id).all()).results || [];
    return json(req, { ok: true, total: rows.reduce((a, r) => a + r.nb, 0), reponses: rows }, 200, { 'Cache-Control': 'no-store' });
  }

  // Fichier agenda (.ics) d'un événement : sur iPhone, il s'ouvre directement dans Calendrier
  let sm;
  if (m === 'GET' && (sm = p.match(/^\/ics\/(rec[A-Za-z0-9]{14})$/))) {
    const id = sm[1];
    let ev = null;
    if (KV) { const snap = await getSnap(env, ctx).catch(() => null); ev = snap && snap.events.find(e => e.id === id) || null; }
    else { try { const r = await at(env, `${T_EVENTS}/${id}`); if (r.fields.Statut === 'Publié') ev = r.fields; } catch {} }
    if (!ev || !/^\d{4}-\d{2}-\d{2}$/.test(ev.Date || '')) return Response.redirect(SITE, 302);
    const ymd = s => s.replace(/-/g, ''), pad = n => String(n).padStart(2, '0');
    let dt;
    const hm = String(ev.Heure || '').match(/^(\d{1,2})[:h](\d{2})?/);
    if (hm) {
      const s = new Date(`${ev.Date}T${pad(hm[1])}:${hm[2] || '00'}:00Z`), f = new Date(s.getTime() + 2 * 3600e3);
      const loc = x => `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}00`;
      dt = `DTSTART;TZID=Europe/Paris:${loc(s)}\r\nDTEND;TZID=Europe/Paris:${loc(f)}`;
    } else {
      const end = new Date((ev['Date de fin'] || ev.Date) + 'T12:00:00Z'); end.setUTCDate(end.getUTCDate() + 1);
      dt = `DTSTART;VALUE=DATE:${ymd(ev.Date)}\r\nDTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`;
    }
    const esc = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
    const where = [ev.Lieu, ev.Commune].filter(Boolean).join(', ');
    const lien = `${API_ORIGIN}/e/${id}?s=site`;
    const tz = 'BEGIN:VTIMEZONE\r\nTZID:Europe/Paris\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\nTZNAME:CEST\r\nDTSTART:19700329T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nTZNAME:CET\r\nDTSTART:19701025T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n';
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//laSave//FR\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n${hm ? tz : ''}BEGIN:VEVENT\r\nUID:${id}@la-save.fr\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z\r\n${dt}\r\nSUMMARY:${esc(ev.Titre || 'Événement')}\r\nLOCATION:${esc(where)}\r\nDESCRIPTION:${esc(String(ev.Description || '').slice(0, 800) + '\n\n' + lien)}\r\nURL:${lien}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    stat(env, 'agenda', id, 'ics');
    return new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `inline; filename="lasave-${id}.ics"`, 'Cache-Control': 'public, max-age=300' } });
  }

  // Page de partage : aperçu (titre, image) pour Facebook/WhatsApp puis redirection vers le site
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
    if (b.t === 'agenda' && isId(b.id)) stat(env, 'agenda', b.id, b.c === 'google' ? 'google' : 'ics');
    // Visite du site (une par session) : page « site » ou « test », et provenance
    if (b.t === 'visite' && ['site', 'test'].includes(b.id)) stat(env, 'visite', b.id, SOURCES.includes(b.c) ? b.c : 'autre');
    return new Response(null, { status: 204, headers: cors(req) });
  }

  // Newsletter : inscription (une adresse e-mail, rien d'autre)
  if (m === 'POST' && p === '/newsletter') {
    const b = await body();
    if (b.website) return json(req, { ok: true }); // pot de miel anti-robot
    const email = String(b.email || '').trim().toLowerCase();
    if (!isEmail(email)) return json(req, { error: 'Cette adresse e-mail ne semble pas valide.' }, 400);
    if (await tooMany(req, 'nl', 5, 3600)) return slowDown(req);
    if (!env.BREVO_KEY) return json(req, { error: 'Les inscriptions ouvrent très bientôt.' }, 503);
    let r;
    try { r = await brevo(env, '/contacts', { method: 'POST', body: JSON.stringify({ email, listIds: [await nlListe(env)], updateEnabled: true }) }); }
    catch (e) { console.error('newsletter', e.message); return json(req, { error: 'L’inscription n’a pas marché, réessayez dans un moment.' }, 502); }
    const nouveau = r.status === 201;
    if (nouveau) {
      stat(env, 'newsletter', 'site', ['site', 'test'].includes(b.src) ? b.src : 'site');
      const stop = `${API_ORIGIN}/newsletter/stop?e=${encodeURIComponent(email)}&t=${await nlSig(env, email)}`;
      ctx.waitUntil(sendMail(env, { to: email, ...bienvenueMail(stop), replyTo: 'contact@la-save.fr' }).catch(e => console.error('bienvenue', e.message)));
    }
    return json(req, { ok: true, nouveau });
  }
  // Newsletter : désinscription en un clic (lien signé dans les mails)
  if (m === 'GET' && p === '/newsletter/stop') {
    const email = String(url.searchParams.get('e') || '').toLowerCase();
    if (!isEmail(email) || url.searchParams.get('t') !== await nlSig(env, email)) return pageSimple('Lien incomplet', 'Ce lien de désinscription n’est pas valide. Écrivez-nous à contact@la-save.fr et on s’en occupe.');
    try { await brevo(env, `/contacts/lists/${await nlListe(env)}/contacts/remove`, { method: 'POST', body: JSON.stringify({ emails: [email] }) }); }
    catch (e) { if (e.brevo !== 400 && e.brevo !== 404) return pageSimple('Oups', 'La désinscription n’a pas marché. Réessayez plus tard, ou écrivez-nous à contact@la-save.fr.'); }
    return pageSimple('C’est fait', 'Vous ne recevrez plus la lettre de laSave. L’agenda reste bien sûr ouvert à tous.');
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

  /* ── Bouton Airtable « Envoyer la confirmation » ──
     Une automatisation Airtable appelle cette adresse quand la case est cochée sur une fiche. Aucun mot de passe :
     on relit la fiche dans Airtable, et le mail ne part que si la case y est bien cochée et l'événement publié. */
  // Liens cliquables depuis une fiche Airtable (champs formule) : pas besoin d'automatisation Airtable payante
  if (m === 'GET' && (p === '/lien/maj' || p === '/lien/confirmer')) {
    if (!KV) return pageSimple('Indisponible', 'Le stockage du site n’est pas relié.');
    if (await tooMany(req, 'lien', 60, 3600)) return pageSimple('Doucement', 'Trop de demandes, réessayez dans quelques minutes.');
    const id = String(url.searchParams.get('id') || '');
    if (p === '/lien/confirmer' && !isId(id)) return pageSimple('Lien incomplet', 'Ce lien n’est pas valide.');
    let snap = (await KV.get('snap', 'json')) || {};
    const relire = async () => { // relit Airtable (une seule fois à la fois)
      if (await KV.get('lock')) return false;
      await KV.put('lock', '1', { expirationTtl: 60 });
      snap = await buildSnap(env); return true;
    };
    try { await relire(); } catch (e) { return pageSimple('Airtable injoignable', 'Réessayez dans un instant. Détail : ' + (e && e.status ? e.status + ' · ' : '') + String((e && e.message) || e).slice(0, 160)); }
    if (p === '/lien/maj') {
      let envoyes = 0;
      try { const att = await listAll(env, T_EVENTS, '&filterByFormula=' + encodeURIComponent("AND({Envoyer la confirmation},{Statut}='Publié')")); for (const rec of att) { if ((await tryConfirm(env, rec, snap.events || [])).envoye) envoyes++; } } catch {}
      return pageSimple('Site mis à jour', 'L’agenda est à jour.' + (envoyes ? ` ${envoyes} confirmation(s) envoyée(s).` : '') + ' Vous pouvez fermer cet onglet.');
    }
    let rec; try { rec = await at(env, `${T_EVENTS}/${id}`); } catch { return pageSimple('Introuvable', 'Cet événement n’existe pas.'); }
    const deja = await KV.get('mailpub:' + id);
    if (deja) return pageSimple('Déjà envoyée', 'La confirmation est déjà partie le ' + new Date(deja).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) + '.');
    const r = await tryConfirm(env, rec, snap.events || [], true);
    return pageSimple(r.envoye ? 'Confirmation envoyée' : 'Pas envoyée', r.texte + ' Vous pouvez fermer cet onglet.');
  }
  // Relecture d'Airtable demandée par l'automatisation Airtable (Statut passé à « Publié »). Sans mot de passe : ne fait que rafraîchir la copie publique.
  if (m === 'POST' && p === '/hook/refresh') {
    if (!KV) return json(req, { error: 'Stockage KV non relié' }, 400);
    if (await tooMany(req, 'hookrefresh', 60, 3600)) return slowDown(req);
    if (await KV.get('lock')) return json(req, { ok: true, message: 'Relecture déjà en cours.' });
    await KV.put('lock', '1', { expirationTtl: 60 });
    let snap; try { snap = await buildSnap(env); } catch (e) { return json(req, { ok: false, error: 'Airtable injoignable, réessayez.' }, 502); }
    let envoyes = 0; // confirmations cochées qui attendaient la mise en ligne
    try {
      const att = await listAll(env, T_EVENTS, '&filterByFormula=' + encodeURIComponent("AND({Envoyer la confirmation},{Statut}='Publié')"));
      for (const rec of att) { if ((await tryConfirm(env, rec, snap.events)).envoye) envoyes++; }
    } catch (e) { console.error('confirmations en attente', e.message); }
    return json(req, { ok: true, events: snap.events.length, message: envoyes ? `Site mis à jour, ${envoyes} confirmation(s) envoyée(s).` : 'Site mis à jour.' });
  }
  if (m === 'POST' && p === '/hook/confirm') {
    if (await tooMany(req, 'hookconf', 40, 3600)) return slowDown(req);
    const id = String((await body()).id || '');
    if (!isId(id)) return json(req, { error: 'Requête invalide' }, 400);
    let rec; try { rec = await at(env, `${T_EVENTS}/${id}`); } catch { return json(req, { error: 'Événement introuvable' }, 404); }
    if (!(rec.fields || {})[F_CONF]) return json(req, { ok: false, error: "La case n'est pas cochée." }, 409);
    let live = KV ? ((await KV.get('snap', 'json')) || {}).events || [] : [];
    // publié dans Airtable mais pas encore sur le site : on relit Airtable maintenant
    if (rec.fields.Statut === 'Publié' && KV && !live.some(e => e.id === id) && !(await KV.get('lock'))) {
      await KV.put('lock', '1', { expirationTtl: 60 });
      try { live = (await buildSnap(env)).events; } catch (e) { console.error('relecture Airtable', e.message); }
    }
    const r = await tryConfirm(env, rec, live);
    return json(req, { ok: r.envoye || !!r.attente, message: r.texte }, r.envoye || r.attente ? 200 : 422);
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
    // Affiches à sauvegarder : liste (avec les liens frais d'Airtable) puis téléchargement d'un fichier par le Worker
    if (m === 'GET' && p === '/admin/affiches') {
      const statut = url.searchParams.get('statut');
      if (!ADMIN_STATUTS.includes(statut)) return json(req, { error: 'statut' }, 400);
      const recs = await listAll(env, T_EVENTS, '&filterByFormula=' + encodeURIComponent(`{Statut}='${statut}'`) + '&fields%5B%5D=Titre&fields%5B%5D=Date&fields%5B%5D=Photo');
      return json(req, recs.map(r => ({
        id: r.id, titre: r.fields.Titre || '', date: r.fields.Date || '',
        fichiers: (r.fields.Photo || []).map(a => ({ nom: a.filename || 'affiche', url: a.url, taille: a.size || 0, type: a.type || '' })),
      })).sort((a, b) => String(a.date).localeCompare(String(b.date))), 200, { 'Cache-Control': 'no-store' });
    }
    if (m === 'GET' && p === '/admin/affiche') {
      let h; try { h = new URL(url.searchParams.get('u') || ''); } catch { return json(req, { error: 'lien' }, 400); }
      if (h.protocol !== 'https:' || !/(^|\.)airtableusercontent\.com$/.test(h.hostname)) return json(req, { error: 'lien' }, 400);
      const r = await fetch(h.href);
      if (!r.ok) return json(req, { error: 'Fichier introuvable (lien expiré ?), rechargez la liste.' }, 502);
      return new Response(r.body, { headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/octet-stream', 'Cache-Control': 'no-store', ...cors(req) } });
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
    // Mail de test : le vrai mail « C'est en ligne » avec un événement publié, envoyé à l'adresse choisie
    if (m === 'POST' && p === '/admin/test-mail') {
      if (!env.BREVO_KEY) return json(req, { error: "La clé Brevo n'est pas configurée." }, 500);
      const b = await body(), to = String(b.to || '').trim();
      if (!isEmail(to)) return json(req, { error: 'Adresse e-mail invalide.' }, 400);
      const list = KV ? (await getSnap(env, ctx)).events : [];
      const auj = new Date().toISOString().slice(0, 10);
      const ev = list.find(e => e.id === b.id) || list.find(e => e.Photo?.length && (e.Date || '') >= auj) || list.find(e => e.Photo?.length) || list[0];
      if (!ev) return json(req, { error: 'Aucun événement publié pour faire le test.' }, 404);
      const f = { ...ev, 'Message aux organisateurs': "Ceci est un mail de test : c'est ce que reçoit un organisateur quand son événement est publié." };
      const mail = publishedMail(f, ev.id, await rsvpKey(env, ev.id));
      await sendMail(env, { to, ...mail, subject: '[Test] ' + mail.subject });
      return json(req, { ok: true, titre: ev.Titre || '' });
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
        // Nombre total d'inscrits à la newsletter (liste Brevo), si elle existe déjà
        let inscrits = null;
        try { const id = env.NEWSLETTER_LIST || (KV && await KV.get('nl-liste')); if (id && env.BREVO_KEY) { const d = (await brevo(env, `/contacts/lists/${id}`)).d; inscrits = d.uniqueSubscribers ?? d.totalSubscribers ?? null; } } catch {}
        return json(req, { jours, parEvenement: a.results || [], parJour: b.results || [], source: 'd1', inscrits });
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
