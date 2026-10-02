/* laSave : page d'archive des affiches. Télécharge les affiches d'un statut dans un seul .zip (assemblé dans le navigateur). */
(() => {
  'use strict';
  const API = 'https://lasave-api.partage.workers.dev';
  const $ = s => document.querySelector(s);
  const KEY = 'lasave_admin'; // même session que l'administration du site
  const tok = () => { try { return sessionStorage.getItem(KEY) || ''; } catch (_) { return ''; } };
  const setTok = t => { try { sessionStorage.setItem(KEY, t); } catch (_) {} };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mo = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(n / 1e3)) + ' Ko';
  const fmtDate = d => d ? d.split('-').reverse().join('/') : 'sans date';
  let list = [];

  async function api(path, init = {}, raw = false) {
    const r = await fetch(API + path, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), Authorization: 'Bearer ' + tok() } });
    if (r.status === 401) { setTok(''); show(false); throw Object.assign(new Error('Session expirée, reconnectez-vous.'), { status: 401 }); }
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Erreur ' + r.status); }
    return raw ? r : r.json();
  }
  const show = ok => { $('#a-login').hidden = ok; $('#a-main').hidden = !ok; };

  /* ── connexion ── */
  $('#a-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = $('#a-err'); err.hidden = true;
    try {
      const r = await fetch(API + '/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pwd: $('#a-pwd').value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.token) throw new Error(d.error || 'Connexion impossible.');
      setTok(d.token); $('#a-pwd').value = ''; show(true); load();
    } catch (e) { err.textContent = e.message; err.hidden = false; }
  });

  /* ── liste ── */
  async function load() {
    $('#a-zip').disabled = true; $('#a-list').innerHTML = ''; $('#a-sum').textContent = 'Chargement…';
    try { list = await api('/admin/affiches?statut=' + encodeURIComponent($('#a-statut').value)); }
    catch (e) { $('#a-sum').textContent = e.message; return; }
    const nb = list.reduce((a, x) => a + x.fichiers.length, 0), poids = list.reduce((a, x) => a + x.fichiers.reduce((b, f) => b + f.taille, 0), 0);
    $('#a-sum').textContent = nb ? `${nb} affiche${nb > 1 ? 's' : ''} · ${mo(poids)}` : 'Aucune affiche';
    $('#a-list').innerHTML = list.map(x => `<li><time>${esc(fmtDate(x.date))}</time><b>${esc(x.titre || '(sans titre)')}</b><span class="a-n${x.fichiers.length ? '' : ' zero'}">${x.fichiers.length ? x.fichiers.length + ' fichier' + (x.fichiers.length > 1 ? 's' : '') : 'pas d’affiche'}</span></li>`).join('') || '<li><b>Aucun événement avec ce statut.</b></li>';
    $('#a-zip').disabled = !nb;
  }
  $('#a-statut').addEventListener('change', load);

  /* ── zip (sans compression) ── */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function makeZip(files) { // files : [{name, data: Uint8Array}]
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    const now = new Date(), dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)), dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate());
    for (const f of files) {
      const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, nm, f.data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      central.push(ch.buffer, nm);
      off += 30 + nm.length + sz;
    }
    const cdSize = central.reduce((a, b) => a + (b.byteLength ?? b.length), 0);
    const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  }
  const propre = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const ext = f => { const m = /\.([A-Za-z0-9]{2,5})$/.exec(f.nom || ''); return m ? m[1].toLowerCase() : (/png/.test(f.type) ? 'png' : /webp/.test(f.type) ? 'webp' : /pdf/.test(f.type) ? 'pdf' : 'jpg'); };

  $('#a-zip').addEventListener('click', async () => {
    const btn = $('#a-zip'), prog = $('#a-prog'); btn.disabled = true; prog.hidden = false;
    const todo = []; list.forEach(x => x.fichiers.forEach((f, i) => todo.push({ x, f, i })));
    const files = [], pris = new Set(); let fail = 0;
    for (let k = 0; k < todo.length; k++) {
      const { x, f, i } = todo[k];
      prog.textContent = `Téléchargement ${k + 1} sur ${todo.length}…`;
      try {
        const r = await api('/admin/affiche?u=' + encodeURIComponent(f.url), {}, true);
        const data = new Uint8Array(await r.arrayBuffer());
        let base = `${x.date || 'sans-date'} ${propre(x.titre) || 'affiche'}${x.fichiers.length > 1 ? ' (' + (i + 1) + ')' : ''}`, name = `${base}.${ext(f)}`, n = 2;
        while (pris.has(name.toLowerCase())) name = `${base} - ${n++}.${ext(f)}`;
        pris.add(name.toLowerCase()); files.push({ name, data });
      } catch (e) { if (e.status === 401) return; fail++; }
    }
    if (!files.length) { prog.textContent = 'Aucune affiche n’a pu être téléchargée. Rechargez la page et réessayez.'; btn.disabled = false; return; }
    prog.textContent = 'Création du fichier…';
    await new Promise(r => setTimeout(r, 30));
    const blob = makeZip(files), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `affiches-lasave-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    prog.textContent = `${files.length} affiche${files.length > 1 ? 's' : ''} dans le .zip (${mo(blob.size)}).` + (fail ? ` ${fail} n’${fail > 1 ? 'ont' : 'a'} pas pu être récupérée${fail > 1 ? 's' : ''}.` : '');
    btn.disabled = false;
  });

  if (tok()) { show(true); load().catch(() => {}); }
})();
