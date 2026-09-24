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

  // Organisateurs publiés (sans leur code membre)
  if (m === 'GET' && p === '/orgas') {
    const recs = await listAll(env, T_ORGAS, '&filterByFormula=' + encodeURIComponent('{Publié}=1') + '&sort[0][field]=Ordre&sort[0][direction]=asc');
    return json(req, recs.map(r => ({ id: r.id, ...pick(r.fields, ORGA_PUBLIC) })), 200, { 'Cache-Control': 'public, max-age=120' });
  }

  // Vérification d'un code membre : ne renvoie que l'organisateur correspondant
  if (m === 'POST' && p === '/code') {
    const code = String((await body()).code || '').trim().toUpperCase().slice(0, 40);
    if (!code) return json(req, { error: 'Code manquant' }, 400);
    const recs = await listAll(env, T_ORGAS);
    const o = recs.find(r => (r.fields.Code || '').trim().toUpperCase() === code);
    if (!o) return json(req, { error: 'Code non reconnu' }, 404);
    return json(req, { id: o.id, ...pick(o.fields, ORGA_PUBLIC) });
  }

  // Nouvel événement proposé (toujours « En attente »)
  if (m === 'POST' && p === '/events') {
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
    const field = what === 'view' ? 'Vues' : 'Likes';
    const delta = what === 'view' ? 1 : ((await body()).delta === -1 ? -1 : 1);
    const cur = await at(env, `${T_EVENTS}/${id}`);
    if (cur.fields.Statut !== 'Publié') return json(req, { error: 'introuvable' }, 404);
    const n = Math.max(0, (cur.fields[field] || 0) + delta);
    await at(env, `${T_EVENTS}/${id}`, { method: 'PATCH', body: JSON.stringify({ fields: { [field]: n } }) });
    return json(req, { [field]: n });
  }

  // Avis visiteurs
  if (m === 'POST' && p === '/avis') {
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
    if (m === 'PATCH' && (mm = p.match(/^\/admin\/events\/(rec\w+)$/))) {
      const statut = (await body()).Statut;
      if (!isId(mm[1]) || !ADMIN_STATUTS.includes(statut)) return json(req, { error: 'Requête invalide' }, 400);
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
    catch (e) { return json(req, { error: e.message || 'Erreur serveur' }, e.status && e.status < 500 ? e.status : 500); }
  },
};
