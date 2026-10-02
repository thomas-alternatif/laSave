/* laSave — kit de partage : story, visuel, message et invitation mail pour un événement */
(() => {
  'use strict';
  const API = 'https://go.la-save.fr';
  const SITE = 'https://la-save.fr';
  const $ = s => document.querySelector(s);
  const CATS = {
    'Concert': ['#FFA823', '/images/cat-concert.webp'], 'Festival': ['#FFA823', '/images/cat-festival.webp'], 'Spectacle': ['#FFA823', '/images/cat-festival.webp'],
    'Guinguette': ['#C8A96E', '/images/cat-guinguette.webp'], 'Fête & Célébration': ['#E4572E', '/images/cat-fete.webp'], 'Marché': ['#C8A96E', '/images/cat-marche.webp'],
    'Exposition': ['#C955E0', null], 'Conférence / Atelier': ['#C955E0', null], 'Sport / Loisir': ['#5C96AB', '/images/cat-sport.webp'],
  };
  const catOf = e => CATS[e['Catégorie']] || ['#C8A96E', null];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const d = iso => new Date(String(iso).slice(0, 10) + 'T12:00:00');
  const quand = e => {
    if (!e.Date) return e['Jour/Période'] || e['Période'] || '';
    const a = d(e.Date), b = e['Date de fin'] && e['Date de fin'] !== e.Date ? d(e['Date de fin']) : null;
    let t = b ? `Du ${a.getDate()}${a.getMonth() !== b.getMonth() ? ' ' + MOIS[a.getMonth()] : ''} au ${b.getDate()} ${MOIS[b.getMonth()]}`
              : cap(`${JOURS[a.getDay()]} ${a.getDate()} ${MOIS[a.getMonth()]}`);
    if (e.Heure) t += ` · ${String(e.Heure).replace(':', 'h')}`;
    return t;
  };
  const commune = v => { const t = String(v || '').trim(); return t && t === t.toUpperCase() ? t.toLowerCase().replace(/\s+/g, '-').replace(/(^|-)\S/g, m => m.toUpperCase()).replace(/-(Sur|De|Du|La|Le|Les|En)-/g, m => m.toLowerCase()) : t; };
  const ou = e => [e.Lieu, commune(e.Commune)].filter(Boolean).join(', ');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const toast = (() => { let t; return msg => { const n = $('#k-toast'); n.textContent = msg; n.classList.add('on'); clearTimeout(t); t = setTimeout(() => n.classList.remove('on'), 2400); }; })();

  /* ── Images ── */
  const load = src => new Promise((ok, ko) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = ko; i.src = src; });
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const cover = (c, img, W, H) => { const s = Math.max(W / img.width, H / img.height), w = img.width * s, h = img.height * s; c.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); };
  const hasStretch = (() => { try { const c = document.createElement('canvas').getContext('2d'); return 'fontStretch' in c; } catch (_) { return false; } })();
  const titleFont = px => hasStretch ? `800 ${px}px Archivo` : `700 ${px}px "Archivo Narrow"`;

  // Découpe un titre en lignes (mots entiers) et réduit la taille jusqu'à tenir dans maxLignes
  function fitTitle(c, text, maxW, start, min, maxLignes) {
    const words = String(text).toUpperCase().split(/\s+/);
    for (let px = start; px >= min; px -= 4) {
      c.font = titleFont(px); if (hasStretch) c.fontStretch = 'condensed';
      const lines = []; let cur = '';
      for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width <= maxW) cur = t; else { if (cur) lines.push(cur); cur = w; } }
      if (cur) lines.push(cur);
      if (lines.length <= maxLignes && lines.every(l => c.measureText(l).width <= maxW)) return { px, lines };
    }
    return { px: min, lines: [String(text).toUpperCase()] };
  }

  // Tampon blanc en relief, comme les thèmes du site
  function tampon(c, text, cx, y, px) {
    c.font = titleFont(px); if (hasStretch) c.fontStretch = 'condensed';
    const t = text.toUpperCase(), w = c.measureText(t).width + px * 1.2, h = px * 1.45, x = cx - w / 2, ep = px * .42;
    for (let i = ep; i > 0; i -= 1.5) { c.fillStyle = '#ffffff'; rr(c, x + i - 3, y + i - 3, w + 6, h + 6, px * .3); c.fill(); }
    for (let i = ep; i > 0; i -= 1.5) { c.fillStyle = '#0a0a0a'; rr(c, x + i, y + i, w, h, px * .26); c.fill(); }
    c.fillStyle = '#ffffff'; rr(c, x, y, w, h, px * .26); c.fill();
    c.lineWidth = px * .07; c.strokeStyle = '#0a0a0a'; c.stroke();
    c.fillStyle = '#0a0a0a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, cx, y + h / 2 + px * .05);
    return h + ep;
  }

  async function render(e, W, H, opts) {
    const cv = $('#cv'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const org = opts.orga || null;
    const [poster, logo, orgLogo] = await Promise.all([opts.photo ? load(opts.photo).catch(() => null) : null, load('../test7/logo.png').catch(() => null), org && org.logo ? load(org.logo).catch(() => null) : null]);
    const col = catOf(e)[0];
    // Fond : l'affiche floutée et assombrie
    c.fillStyle = '#050505'; c.fillRect(0, 0, W, H);
    if (poster) {
      c.save(); if ('filter' in c) c.filter = 'blur(60px) saturate(1.3)'; cover(c, poster, W * 1.2, H * 1.2); c.restore();
      c.fillStyle = 'filter' in c ? 'rgba(5,5,5,.55)' : 'rgba(5,5,5,.82)'; c.fillRect(0, 0, W, H);
    }
    const g = c.createLinearGradient(0, H * .45, 0, H); g.addColorStop(0, 'rgba(5,5,5,0)'); g.addColorStop(1, 'rgba(5,5,5,.92)'); c.fillStyle = g; c.fillRect(0, 0, W, H);

    // Mesures du bloc texte pour centrer l'ensemble
    const orgH = org ? (orgLogo ? opts.orgLogo : opts.info * 1.6) + 44 : 0;
    const infoPx = opts.info;
    // On réduit le titre tant que l'affiche n'a pas assez de place (et que rien ne déborde sur la pastille)
    let tl, lineH, blocTexte;
    for (let start = opts.title; ; start -= 8) {
      tl = fitTitle(c, e.Titre || 'Événement', W - 2 * opts.pad, Math.max(start, opts.titleMin), opts.titleMin, 3);
      lineH = tl.px * .98;
      blocTexte = opts.stamp * 1.9 + 34 + tl.lines.length * lineH + 26 + infoPx * 1.35 * 2.8 + orgH;
      if (opts.bottom - opts.top - blocTexte - 56 >= opts.posterH * .4 || start <= opts.titleMin) break;
    }
    let pw = 0, ph = 0;
    const place = opts.bottom - opts.top - blocTexte - 56;           // hauteur restante pour l'affiche
    if (poster) { const s = Math.min(opts.posterW / poster.width, Math.max(opts.posterH * .3, Math.min(opts.posterH, place)) / poster.height); pw = poster.width * s; ph = poster.height * s; }
    const total = (ph ? ph + 56 : 0) + blocTexte;
    let y = Math.max(opts.top, (opts.top + opts.bottom - total) / 2);

    // Logo
    if (logo) {
      const lw = opts.logo, lh = logo.height * lw / logo.width; c.drawImage(logo, (W - lw) / 2, opts.logoY, lw, lh);
      // Sous le logo, en petit
      const sp = Math.round(lw * .075);
      c.font = `600 ${sp}px "Instrument Sans", sans-serif`; if ('letterSpacing' in c) c.letterSpacing = `${Math.round(sp * .22)}px`;
      c.fillStyle = 'rgba(244,243,239,.72)'; c.textAlign = 'center'; c.textBaseline = 'top';
      c.fillText('AGENDA DE LA SAVE', W / 2, opts.logoY + lh + sp * .7);
      if ('letterSpacing' in c) c.letterSpacing = '0px';
    }

    // Affiche
    if (poster) {
      const x = (W - pw) / 2;
      c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 70; c.shadowOffsetY = 24; rr(c, x, y, pw, ph, 28); c.fillStyle = '#000'; c.fill(); c.restore();
      c.save(); rr(c, x, y, pw, ph, 28); c.clip(); c.drawImage(poster, x, y, pw, ph); c.restore();
      y += ph + 56;
    }
    // Tampon catégorie
    y += tampon(c, e['Catégorie'] || 'Événement', W / 2, y, opts.stamp) + 34;
    // Titre
    c.font = titleFont(tl.px); if (hasStretch) c.fontStretch = 'condensed';
    c.fillStyle = '#f4f3ef'; c.textAlign = 'center'; c.textBaseline = 'top';
    tl.lines.forEach((l, i) => c.fillText(l, W / 2, y + i * lineH));
    y += tl.lines.length * lineH + 26;
    // Infos
    if (hasStretch) c.fontStretch = 'normal';
    c.font = `600 ${infoPx}px "Instrument Sans", sans-serif`; c.fillStyle = col === '#C8A96E' ? '#e3c992' : col;
    c.fillText(quand(e), W / 2, y); y += infoPx * 1.35;
    c.font = `500 ${infoPx * .86}px "Instrument Sans", sans-serif`; c.fillStyle = '#d6d4ce';
    const lieu = ou(e), maxW = W - 2 * opts.pad;
    let lieuL = 0;
    if (lieu) {
      lieuL = 1;
      if (c.measureText(lieu).width <= maxW) c.fillText(lieu, W / 2, y);
      else { // sur deux lignes : le lieu, puis la commune
        const l1 = e.Lieu || lieu, l2 = commune(e.Commune);
        let a = l1; while (c.measureText(a).width > maxW && a.length > 10) a = a.slice(0, -2);
        c.fillText(a === l1 ? a : a.trim() + '…', W / 2, y); if (l2) { c.fillText(l2, W / 2, y + infoPx * 1.1); lieuL = 2; }
      }
    }

    y += lieuL * infoPx * 1.1;

    // Organisateur : logo rond + nom (si on le connaît)
    if (org) {
      y += 44;
      const nomPx = opts.info * .82, petitPx = opts.info * .56, L = orgLogo ? opts.orgLogo : 0, gap = L ? opts.orgLogo * .22 : 0;
      c.font = `600 ${nomPx}px "Instrument Sans", sans-serif`;
      let nom = org.name; while (c.measureText(nom).width > maxW - L - gap && nom.length > 8) nom = nom.slice(0, -2);
      if (nom !== org.name) nom = nom.trim() + '…';
      const tw = Math.max(c.measureText(nom).width, (c.font = `500 ${petitPx}px "Instrument Sans", sans-serif`, c.measureText('Organisé par').width));
      const x0 = (W - (L + gap + tw)) / 2, h = Math.max(L, nomPx + petitPx * 1.5), cy = y + h / 2;
      if (orgLogo) {
        c.save(); c.beginPath(); c.arc(x0 + L / 2, cy, L / 2, 0, Math.PI * 2); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); c.clip();
        const s2 = Math.max(L / orgLogo.width, L / orgLogo.height); c.drawImage(orgLogo, x0 + L / 2 - orgLogo.width * s2 / 2, cy - orgLogo.height * s2 / 2, orgLogo.width * s2, orgLogo.height * s2);
        c.restore();
        c.beginPath(); c.arc(x0 + L / 2, cy, L / 2, 0, Math.PI * 2); c.lineWidth = L * .04; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke();
      }
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      const tx = x0 + L + gap;
      c.font = `500 ${petitPx}px "Instrument Sans", sans-serif`; c.fillStyle = '#a3a19b'; c.fillText('Organisé par', tx, cy - nomPx * .2);
      c.font = `600 ${nomPx}px "Instrument Sans", sans-serif`; c.fillStyle = '#f4f3ef'; c.fillText(nom, tx, cy + nomPx * .9);
      c.textAlign = 'center'; c.textBaseline = 'top';
    }

    // Pastille orange en bas
    c.font = `600 ${opts.pill}px "Instrument Sans", sans-serif`;
    const pt = 'Toutes les infos sur la-save.fr', pwid = c.measureText(pt).width + opts.pill * 2.2, phh = opts.pill * 2.4, px0 = (W - pwid) / 2, py0 = opts.pillY;
    rr(c, px0, py0, pwid, phh, phh / 2); c.fillStyle = "#FFA823"; c.fill();
    c.fillStyle = '#141210'; c.textBaseline = 'middle'; c.fillText(pt, W / 2, py0 + phh / 2 + 1);

    return new Promise(ok => cv.toBlob(b => ok(b), 'image/png'));
  }


  /* ── Légende pour Instagram / Facebook ── */
  const hashtag = t => '#' + String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  function resume(txt, max = 220) {
    const t = String(txt || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (t.length <= max) return t;
    const coupe = t.slice(0, max), fin = Math.max(coupe.lastIndexOf('. '), coupe.lastIndexOf('! '), coupe.lastIndexOf('? '));
    return fin > 80 ? coupe.slice(0, fin + 1) : coupe.slice(0, coupe.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '…';
  }
  function legende(e, orga, url) {
    // Écrite comme un vrai message : une phrase, pas de liste ni d'émojis en série
    const q = quand(e).replace(' · ', ' à ');
    const quandTxt = q ? q.charAt(0).toLowerCase() + q.slice(1) : '';
    const lieuNom = String(e.Lieu || '').trim().replace(/^(Salle|Place|Maison|Église|Eglise|Parc|Gymnase|Stade|École|Ecole|Halle|Jardin|Bibliothèque|Médiathèque)\b/, m => m.toLowerCase());
    const lieu = [lieuNom, commune(e.Commune)].filter(Boolean).join(' à ');
    let phrase = String(e.Titre || '').trim();
    if (quandTxt) phrase += ` ${quandTxt}`;
    if (lieu) phrase += `, ${lieu}`;
    phrase += '.';
    const l = [phrase];
    if (e.Tarif) l.push(`${e.Tarif.charAt(0).toUpperCase() + e.Tarif.slice(1)}${/[.!?]$/.test(e.Tarif) ? '' : '.'}`);
    const r = resume(e.Description, 200);
    if (r) l.push('', r);
    l.push('', `Toutes les infos sur la-save.fr : ${url}`);
    const tags = [commune(e.Commune) && hashtag(commune(e.Commune)), '#ValleeDeLaSave'].filter(Boolean);
    l.push('', [...new Set(tags)].join(' '));
    return l.join('\n');
  }


  /* ── Page ── */
  const id = new URLSearchParams(location.search).get('id') || '';
  const state = {};

  function fail(msg) { $('#k-lead').textContent = ''; const n = $('#k-err'); n.textContent = msg; n.hidden = false; }

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (_) {
      const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select();
      const ok = document.execCommand('copy'); a.remove(); return ok;
    }
  }
  async function copyHtml(node, plain) {
    try {
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([node.innerHTML], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]);
        return true;
      }
    } catch (_) { /* repli ci-dessous */ }
    const r = document.createRange(); r.selectNodeContents(node); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const ok = document.execCommand('copy'); s.removeAllRanges(); return ok;
  }

  function mailHtml(e, photo, lien, orga) {
    const col = catOf(e)[0];
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;background:#0e0e0e;border-radius:22px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<tr><td style="padding:22px 24px 0;"><img src="${SITE}/test7/logo.png" width="96" alt="laSave" style="display:block;width:96px;height:auto;border:0;"><div style="margin-top:5px;font-size:9px;font-weight:700;letter-spacing:.2em;color:#a3a19b;">AGENDA DE LA SAVE</div></td></tr>
${photo ? `<tr><td style="padding:18px 24px 0;"><a href="${lien}"><img src="${esc(photo)}" width="472" alt="${esc(e.Titre)}" style="display:block;width:100%;max-width:472px;height:auto;border-radius:14px;border:0;"></a></td></tr>` : ''}
<tr><td style="padding:20px 24px 0;"><span style="display:inline-block;background:#ffffff;color:#0a0a0a;font-weight:800;font-size:12px;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px 4px;border-radius:5px;box-shadow:3px 3px 0 #0a0a0a,4px 4px 0 #ffffff;">${esc(e['Catégorie'] || 'Événement')}</span></td></tr>
<tr><td style="padding:14px 24px 0;font-family:'Arial Narrow','Helvetica Neue',Arial,sans-serif;font-size:32px;line-height:1;font-weight:800;text-transform:uppercase;color:#f4f3ef;">${esc(e.Titre)}</td></tr>
<tr><td style="padding:14px 24px 0;font-size:16px;font-weight:600;color:${col};">${esc(quand(e))}</td></tr>
${ou(e) ? `<tr><td style="padding:4px 24px 0;font-size:15px;color:#d6d4ce;">${esc(ou(e))}</td></tr>` : ''}
${e.Tarif ? `<tr><td style="padding:4px 24px 0;font-size:15px;color:#a3a19b;">${esc(e.Tarif)}</td></tr>` : ''}
${orga ? `<tr><td style="padding:20px 24px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${orga.logo ? `<td valign="middle" style="padding-right:12px;"><img src="${esc(orga.logo)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border-radius:99px;border:2px solid #ffffff;background:#ffffff;object-fit:cover;"></td>` : ''}<td valign="middle" style="font-size:12px;line-height:1.3;color:#a3a19b;">Organisé par<br><span style="font-size:15px;font-weight:700;color:#f4f3ef;">${esc(orga.name)}</span></td></tr></table></td></tr>` : ''}
<tr><td style="padding:22px 24px 26px;"><a href="${API}/venir/${(state.e && state.e.Lien) || id}?s=invitation" style="display:inline-block;background:#FFA823;color:#141210;font-weight:700;font-size:15px;text-decoration:none;padding:13px 24px;border-radius:99px;">Je viens</a> &nbsp;<a href="${lien}" style="display:inline-block;color:#f4f3ef;font-weight:700;font-size:15px;text-decoration:underline;padding:13px 6px;">Voir l’événement</a>${/^https:\/\//.test(e.Billetterie || '') ? ` &nbsp;<a href="${esc(e.Billetterie)}" style="display:inline-block;color:#f4f3ef;font-weight:700;font-size:15px;text-decoration:underline;padding:13px 6px;">Prendre ma place</a>` : ''}</td></tr>
</table>`;
  }

  // « Qui vient » : visible seulement avec la clé du lien reçu par mail (?k=…)
  async function loadVenir() {
    const k = new URLSearchParams(location.search).get('k');
    if (!k || !/^[A-Za-z0-9_-]{10,40}$/.test(k)) return;
    const box = $('#k-venir'); box.hidden = false;
    const go = async () => {
      let r; try { r = await fetch(`${API}/rsvp/${id}?k=${encodeURIComponent(k)}`).then(x => x.ok ? x.json() : null); } catch (_) { r = null; }
      const list = $('#k-venir-list');
      if (!r || !r.ok) { $('#k-venir-h').textContent = 'Liste indisponible'; list.innerHTML = ''; return; }
      const n = r.total, nr = r.reponses.length;
      $('#k-venir-h').textContent = n ? `${n} personne${n > 1 ? 's' : ''} ${n > 1 ? 'viennent' : 'vient'}` : 'Pas encore de réponse';
      $('#k-venir-n').textContent = nr ? `${nr} réponse${nr > 1 ? 's' : ''}` : '';
      list.innerHTML = r.reponses.map(x => `<li><b>${esc(x.prenom)}</b>${x.nb > 1 ? `<span>+ ${x.nb - 1}</span>` : ''}</li>`).join('');
    };
    $('#k-venir-r').addEventListener('click', async () => { await go(); toast('Liste actualisée'); });
    go();
  }

  async function init() {
    if (!/^rec[A-Za-z0-9]{14}$/.test(id)) return fail('Ce lien de partage est incomplet. Ouvrez-le depuis le mail de confirmation reçu à la publication.');
    let events;
    let orgas = [];
    try { [events, orgas] = await Promise.all([fetch(API + '/events').then(r => r.json()), fetch(API + '/orgas').then(r => r.json()).catch(() => [])]); } catch (_) { return fail('Impossible de charger l’agenda pour le moment. Réessayez dans un instant.'); }
    const e = (Array.isArray(events) ? events : []).find(x => x.id === id);
    if (!e) return fail('Cet événement n’est pas (ou plus) en ligne sur laSave.');
    state.e = e;
    // Organisateur : même rapprochement par le nom que sur le site
    const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const nomOrg = Array.isArray(e.Organisation) ? e.Organisation.join(', ') : String(e.Organisation || '').trim();
    const n = norm(nomOrg), list = Array.isArray(orgas) ? orgas : [];
    const o = n ? (list.find(x => norm(x.Nom) === n) || list.find(x => norm(x.Nom) && (n.includes(norm(x.Nom)) || norm(x.Nom).includes(n)))) : null;
    const oa = o && o.Photo && o.Photo[0];
    const orga = nomOrg || o ? { name: (o && o.Nom) || nomOrg, logo: oa ? ((oa.thumbnails && oa.thumbnails.large && oa.thumbnails.large.url) || oa.url) : '' } : null;
    const att = e.Photo && e.Photo[0];
    const photo = att ? ((att.thumbnails && att.thumbnails.large && att.thumbnails.large.url) || att.url) : (catOf(e)[1] ? SITE + catOf(e)[1] : '');
    const url = `${API}/e/${e.Lien || id}`, u = c => `${url}?s=${c}`, lien = u('invitation'); // ?s= : canal, pour les statistiques
    state.url = u('lien'); state.urlCopie = u('copie');
    stat('kit', new URLSearchParams(location.search).get('via') === 'qr' ? 'qr' : '');
    document.title = `Partager « ${e.Titre} » · laSave`;
    $('#k-lead').innerHTML = `Tout est prêt pour partager <b>${esc(e.Titre)}</b> partout, en deux clics.`;

    const lignes = [e.Titre, quand(e), ou(e), e.Tarif].filter(Boolean);
    state.legende = legende(e, orga, u('legende'));
    // Aperçus façon réseaux sociaux : compte de l'organisateur (pseudo Instagram s'il est connu)
    const ig = String((o && o.Contact) || e.Contact || '').split('|').map(x => x.trim()).find(x => /^IG:/i.test(x));
    const handle = ig ? ig.replace(/^IG:\s*/i, '').replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
      : (orga && orga.name ? orga.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '') : 'votre.compte');
    document.querySelectorAll('[data-handle]').forEach(n => { n.textContent = handle; });
    document.querySelectorAll('[data-av]').forEach(n => {
      if (orga && orga.logo) { const im = document.createElement('img'); im.src = orga.logo; im.alt = ''; n.appendChild(im); }
      else n.textContent = (orga && orga.name ? orga.name : 'L').trim().charAt(0).toUpperCase();
    });
    $('#ig-cap-txt').textContent = state.legende.split('\n')[0];
    state.message = `${lignes.join('\n')}\n\nToutes les infos : ${u('mail')}`;
    $('#k-legende').textContent = state.legende;
    $('#k-apercu').innerHTML = `${photo ? `<img src="${esc(photo)}" alt="" />` : ''}<div><small>la-save.fr</small><b>${esc(e.Titre)}</b><span>${esc([quand(e), commune(e.Commune)].filter(Boolean).join(' · '))}</span></div>`;
    $('#k-wa').href = 'https://wa.me/?text=' + encodeURIComponent(`*${e.Titre}*\n${lignes.slice(1).join('\n')}\n\nToutes les infos : ${u('wa')}`);
    $('#k-sms').href = 'sms:?&body=' + encodeURIComponent(`${lignes.join('\n')}\n\nToutes les infos : ${u('sms')}`);
    $('#k-mail').innerHTML = mailHtml(e, photo, lien, orga);
    // En-tête : affiche + fond flouté
    if (photo) {
      const bg = $('#k-bg'); bg.style.backgroundImage = `url("${photo.replace(/"/g, '%22')}")`; requestAnimationFrame(() => bg.classList.add('on'));
      $('#k-hero-img').src = photo; $('#k-hero-img').alt = `Affiche : ${e.Titre}`; $('#k-hero-poster').hidden = false;
    }
    $('#k-hero-cat').textContent = e['Catégorie'] || 'Événement';
    $('#k-hero-date').textContent = [quand(e).split(' · ')[0], commune(e.Commune)].filter(Boolean).join(' · ');
    $('#k-body').hidden = false;
    loadVenir();

    try { await document.fonts.load(titleFont(100)); await document.fonts.load('600 40px "Instrument Sans"'); } catch (_) { /* polices de secours */ }
    const story = await render(e, 1080, 1920, { photo, orga, orgLogo: 112, pad: 90, title: 132, titleMin: 72, info: 46, stamp: 34, posterW: 820, posterH: 900, top: 380, bottom: 1530, logo: 250, logoY: 235, pill: 34, pillY: 1580 });
    const post = await render(e, 1080, 1350, { photo, orga, orgLogo: 84, pad: 80, title: 96, titleMin: 56, info: 38, stamp: 28, posterW: 620, posterH: 560, top: 150, bottom: 1170, logo: 200, logoY: 60, pill: 28, pillY: 1215 });
    state.files = {};
    [['story', story, 'story-lasave.png'], ['post', post, 'publication-lasave.png']].forEach(([k, blob, name]) => {
      if (!blob) return;
      const u = URL.createObjectURL(blob);
      $('#img-' + k).src = u; $('#dl-' + k).href = u; $('#dl-' + k).download = name;
      state.files[k] = new File([blob], name, { type: 'image/png' });
    });
  }

  // Statistiques anonymes (aucune donnée personnelle) : ouverture du kit et boutons utilisés
  function stat(t, c) {
    try { const b = JSON.stringify({ t, id, c: c || '' }); if (!(navigator.sendBeacon && navigator.sendBeacon(API + '/stat', b))) fetch(API + '/stat', { method: 'POST', body: b, keepalive: true }); } catch (_) {}
  }
  document.addEventListener('click', async ev => {
    const lienWa = ev.target.closest('#k-wa, #k-sms'); if (lienWa) stat('kit_action', lienWa.id === 'k-wa' ? 'wa' : 'sms');
    const s = ev.target.closest('[data-share]'), cp = ev.target.closest('[data-copy]');
    if (s) {
      const k = s.dataset.share, e = state.e; if (!e) return;
      stat('kit_action', k === 'link' ? 'lien' : k);
      if (k === 'link') {
        if (navigator.share) { try { await navigator.share({ title: e.Titre, text: `${e.Titre} — ${quand(e)}`, url: state.url }); return; } catch (err) { if (err.name === 'AbortError') return; } }
        if (await copyText(state.url)) toast('Lien copié');
        return;
      }
      const f = state.files && state.files[k];
      if (!f) return toast('L’image est encore en préparation…');
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        // image seule, sans titre : avec un titre, certaines applis iPhone (Facebook, WhatsApp) n'envoient que le texte
        try { await navigator.share({ files: [f] }); } catch (err) { if (err.name !== 'AbortError') toast('Partage impossible, téléchargez l’image.'); }
      } else { $('#dl-' + k).click(); toast('Image téléchargée : publiez-la depuis votre téléphone.'); }
    }
    if (cp) {
      const k = cp.dataset.copy;
      if (k) stat('kit_action', k === 'url' ? 'copie' : k === 'legende' ? 'legende' : 'mail');
      if (k === 'url' && await copyText(state.urlCopie)) toast('Lien copié');
      if (k === 'legende' && await copyText(state.legende)) toast('Légende copiée');
      if (k === 'mail' && await copyHtml($('#k-mail'), state.message)) toast('Invitation copiée : collez-la dans un nouveau mail');
    }
  });

  // Sur ordinateur : on remplace « Partager » par un QR code qui ouvre ce kit sur le téléphone
  const mobile = window.matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!mobile) {
    document.querySelectorAll('[data-share="story"], [data-share="post"]').forEach(b => { b.hidden = true; });
    document.querySelectorAll('.k-desk').forEach(box => {
      box.hidden = false;
      try {
        const q = qrcode(0, 'M'); q.addData(location.href.replace(/([?&])via=[^&]*&?/, '$1').replace(/[?&]$/, '') + (location.search ? '&' : '?') + 'via=qr'); q.make();
        box.querySelector('.k-qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      } catch (_) { box.querySelector('.k-qr').remove(); }
    });
  }

  init();
})();
