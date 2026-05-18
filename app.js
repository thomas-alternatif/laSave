/* ── CONFIG ── */
const IG_B64="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";
const FB_B64="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";


  const AT_TOKEN='patRv7hhMKwMbLtBO.f5f8251ad0b08fd5267257eec47c07ee79e7d44bacf538be0ecdffcdda2c7ea2';
  const AT_BASE='appHgiuv0ClNd8qsV',AT_TABLE='tbl6Um2XQPq4JPxCg';
  const AT_URL=`https://api.airtable.com/v0/${AT_BASE}/${AT_TABLE}`;
  const HEADS={'Authorization':`Bearer ${AT_TOKEN}`,'Content-Type':'application/json'};
  const AGENDA_EMAIL='agenda.de.la.save@gmail.com';
  const COMMUNES=['Aussonne','Beaupuy','Bellegarde-Sainte-Marie','Bouconne','Brignemont','Cabanac-Séguenville','Caubiac','Cox','Daux','Drudas','Garac','Le Grès','Lévignac','Lagraulet-Saint-Nicolas','Larra','Launac','Laréole','Le Burgaud','Mérenvielle','Menville','Merville','Mondonville','Montaigut-sur-Save','Pelleport','Pradère-les-Bourguets','Puysségur','Saint-Cézert','Saint-Paul-sur-Save','Seilh','Thil','Vignaux'].sort();

  /* Icônes Apple Calendar et Google Calendar (ancienne version exacte) */
  const APPLE_SVG='<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="13" rx="2" fill="#f5f5f7"/><rect x="1" y="2" width="14" height="4.5" rx="2" fill="#ff3b30"/><rect x="1" y="5" width="14" height="1.5" fill="#ff3b30"/><rect x="3.5" y="8.5" width="2" height="2" rx="0.4" fill="#1a1a1a"/><rect x="7" y="8.5" width="2" height="2" rx="0.4" fill="#1a1a1a"/><rect x="10.5" y="8.5" width="2" height="2" rx="0.4" fill="#1a1a1a"/><rect x="3.5" y="11.5" width="2" height="1.5" rx="0.4" fill="#1a1a1a"/><rect x="7" y="11.5" width="2" height="1.5" rx="0.4" fill="#1a1a1a"/></svg>';
  const GCAL_SVG='<svg width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="13" rx="1.5" fill="white"/><rect x="1" y="2" width="14" height="4" rx="1.5" fill="#4285f4"/><rect x="1" y="4.5" width="14" height="1.5" fill="#4285f4"/><line x1="5.5" y1="2" x2="5.5" y2="5.5" stroke="white" stroke-width="1.2"/><line x1="10.5" y1="2" x2="10.5" y2="5.5" stroke="white" stroke-width="1.2"/><rect x="3" y="7.5" width="2.5" height="2.5" rx="0.3" fill="#34a853"/><rect x="6.75" y="7.5" width="2.5" height="2.5" rx="0.3" fill="#fbbc04"/><rect x="10.5" y="7.5" width="2.5" height="2.5" rx="0.3" fill="#ea4335"/><rect x="3" y="11" width="2.5" height="2" rx="0.3" fill="#ea4335"/><rect x="6.75" y="11" width="2.5" height="2" rx="0.3" fill="#34a853"/></svg>';

  const CAT_META={
    'Concert':             {color:'#F5A623',emoji:'🎸',fallback:'images/cat-concert.webp'},
    'Festival':            {color:'#5dd470',emoji:'🎪',fallback:'images/cat-festival.webp'},
    'Marché':              {color:'#4db8f0',emoji:'🛍️',fallback:'images/cat-marche.webp'},
    'Exposition':          {color:'#f07850',emoji:'🎨',fallback:null},
    'Spectacle':           {color:'#c060f0',emoji:'🎭',fallback:null},
    'Sport / Loisir':      {color:'#4dcab8',emoji:'⚽',fallback:'images/cat-sport.webp'},
    'Guinguette':          {color:'#ffa820',emoji:'🍷',fallback:'images/cat-guinguette.webp'},
    'Fête & Célébration':  {color:'#ff5080',emoji:'🎉',fallback:'images/cat-fete.webp'},
    'Conférence / Atelier':{color:'#c8a96e',emoji:'🎓',fallback:null},
    'Autre':               {color:'#c8a96e',emoji:'📅',fallback:null}
  };

  /* ── ÉTAT ── */
  let allEvents=[],viewMode=localStorage.getItem('lsv')||'grid',currentCat='all',currentSearch='',sugIdx=-1;
  let orgasMap={}; // map nom → fiche organisateur (chargée depuis Airtable)

  /* ── UTILS ── */
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const esc=s=>s==null?'':String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>(s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const fmtDate=iso=>{if(!iso)return'';const d=new Date(iso);return isNaN(d)?iso:d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})};
  const fmtShort=iso=>{if(!iso)return'';const d=new Date(iso);return isNaN(d)?iso:d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})};
  const isSoon=iso=>{if(!iso)return false;const diff=(new Date(iso)-new Date())/(864e5);return diff>=0&&diff<=7};
  const isFut=iso=>{if(!iso)return true;return new Date(iso)>=new Date(new Date().toDateString())};
  // Un événement est "actif" si sa date de fin n'est pas passée (ou s'il n'a pas de date de fin mais que sa date de début est future)
  const isActive=ev=>{
    const dateFin=ev['Date de fin'];
    const date=ev['Date'];
    const isRec=ev['Récurrence']&&ev['Récurrence']!=='Aucune';
    if(isRec)return true;
    if(dateFin)return isFut(dateFin); // multi-jours : garder si date de fin pas passée
    if(date)return isFut(date);       // ponctuel : garder si date pas passée
    return true;
  };
  const getPhoto=ev=>{if(ev.Photo&&ev.Photo[0]){const a=ev.Photo[0];return(a.thumbnails&&a.thumbnails.large)?a.thumbnails.large.url:a.url}return null};

  /* ── FETCH AIRTABLE ── */
  async function fetchEvents(){
    const filter=encodeURIComponent("{Statut}='Publié'"),url=`${AT_URL}?filterByFormula=${filter}&pageSize=100`;
    let records=[],offset='';
    try{
      do{const u=offset?`${url}&offset=${offset}`:url;const r=await fetch(u,{headers:HEADS});if(!r.ok)throw Error(''+r.status);const d=await r.json();records=records.concat(d.records||[]);offset=d.offset||'';}while(offset);
      return records.map(r=>({id:r.id,...r.fields}));
    }catch(e){console.error(e);return[]}
  }
  async function trackView(id){
    try{const r=await fetch(`${AT_URL}/${id}`,{headers:HEADS});if(!r.ok)return;const d=await r.json();const v=d.fields['Vues']||0;await fetch(`${AT_URL}/${id}`,{method:'PATCH',headers:HEADS,body:JSON.stringify({fields:{'Vues':v+1}})});}catch(e){}
  }

  /* ── CALENDRIER ── */
  function buildDates(ev){
    if(!ev.Date)return null;
    const s=new Date(ev.Date);
    if(ev.Heure){const[h,m]=ev.Heure.split(':').map(Number);s.setHours(h||0,m||0,0);}
    let e=ev['Date de fin']?new Date(ev['Date de fin']):new Date(s);
    if(ev.Heure)e.setHours(s.getHours()+2,s.getMinutes(),0);else if(!ev['Date de fin'])e.setDate(e.getDate()+1);
    const f=d=>d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
    return{s:f(s),e:f(e)};
  }
  function gcalUrl(ev){
    const d=buildDates(ev);
    const p=new URLSearchParams({action:'TEMPLATE',text:ev.Titre||'',details:ev.Description||'',location:[ev.Lieu,ev.Commune].filter(Boolean).join(', ')});
    if(d)p.set('dates',`${d.s}/${d.e}`);
    return'https://calendar.google.com/calendar/render?'+p;
  }
  function genICS(ev){
    const d=buildDates(ev);if(!d){alert('Date manquante.');return;}
    const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//laSave//FR','BEGIN:VEVENT',`UID:${ev.id}@la-save.fr`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,`DTSTART:${d.s}`,`DTEND:${d.e}`,`SUMMARY:${(ev.Titre||'').replace(/\n/g,'\\n')}`,`DESCRIPTION:${(ev.Description||'').replace(/\n/g,'\\n')}`,`LOCATION:${[ev.Lieu,ev.Commune].filter(Boolean).join(', ')}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
    const blob=new Blob([ics],{type:'text/calendar'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${(ev.Titre||'evenement').replace(/[^a-z0-9]/gi,'_')}.ics`;a.click();URL.revokeObjectURL(url);
  }

  /* ── PARTAGE ── */
  let shareEvt=null;
  function openShareModal(ev){
    shareEvt=ev;
    const urlWorker=`https://lasave.partage.workers.dev/${ev.id}`;
    const urlDirect=`https://la-save.fr/#event-${ev.id}`;
    const titre=ev.Titre||'Événement';
    const desc=(ev.Description||'').slice(0,100)||(ev.Commune||'');

    // Web Share API — panneau natif iOS/Android
    if(navigator.share){
      navigator.share({
        title: titre,
        url: urlWorker
      }).catch(()=>{});
      return;
    }

    // Fallback desktop — panneau custom
    const descSub=`${ev.Commune||''}${ev.Date?' — '+fmtShort(ev.Date):''}`;
    $('#share-sub').textContent=titre+(descSub?' · '+descSub:'');
    $('#share-copy-url').textContent=urlDirect;
    const grid=$('#share-grid');
    grid.innerHTML=`
      <button class="share-opt" onclick="doShare('whatsapp','${esc(titre)}','${esc(urlWorker)}')" type="button">
        <span class="share-opt-ico"><svg width="26" height="26" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.998 0C5.372 0 0 5.373 0 12.001c0 2.117.556 4.103 1.528 5.83L0 24l6.335-1.661A11.947 11.947 0 0012 24c6.628 0 12-5.372 12-12 0-6.627-5.372-12.001-12-12.001zm0 21.985a9.96 9.96 0 01-5.073-1.387l-.362-.216-3.758.986 1.003-3.66-.237-.377A9.955 9.955 0 012.015 12C2.015 6.481 6.48 2.015 12 2.015S21.985 6.481 21.985 12c0 5.52-4.466 9.985-9.987 9.985z"/></svg></span>
        WhatsApp
      </button>
      <button class="share-opt" onclick="doShare('facebook','${esc(titre)}','${esc(urlDirect)}')" type="button">
        <span class="share-opt-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg></span>
        Facebook
      </button>
      <button class="share-opt" onclick="doShare('instagram','${esc(titre)}','${esc(urlDirect)}')" type="button">
        <span class="share-opt-ico" style="background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);border:none;"><svg width="22" height="22" viewBox="0 0 24 24" fill="white"><rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="white" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="white"/></svg></span>
        Instagram
      </button>
      <button class="share-opt" onclick="doShare('sms','${esc(titre)}','${esc(urlDirect)}')" type="button">
        <span class="share-opt-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5dd470" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
        Message
      </button>
    `;
    $('#share-modal').classList.add('open');
    document.body.style.overflow='hidden';
  }
  function closeShareModal(){$('#share-modal').classList.remove('open');document.body.style.overflow='';}
  function doShare(platform,titre,url){
    const maps={
      whatsapp:`https://wa.me/?text=${encodeURIComponent(titre+' — '+url)}`,
      facebook:`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      instagram:null,
      sms:`sms:?body=${encodeURIComponent(titre+' — '+url)}`
    };
    if(platform==='instagram'){
      navigator.clipboard.writeText(titre+' '+url).then(()=>alert('Lien copié ! Collez-le dans votre message Instagram.')).catch(()=>{});
      return;
    }
    if(maps[platform])window.open(maps[platform],'_blank','noopener,width=600,height=500');
  }

  /* ── CARDS ── */
  function buildCard(ev){
    const cat=ev['Catégorie']||'Autre',m=CAT_META[cat]||CAT_META['Autre'];
    const photo=getPhoto(ev),soon=isSoon(ev.Date),featured=ev['À la une'],vues=ev.Vues||0;
    const isRec=ev['Récurrence']&&ev['Récurrence']!=='Aucune';
    const dateStr=ev.Date?fmtDate(ev.Date):(isRec?(ev['Jour/Période']||ev['Récurrence']):'');

    const card=document.createElement('article');
    card.className='card';card.dataset.cat=cat;
    card.setAttribute('aria-label',`${ev.Titre||'Événement'}, ${ev.Commune||''}`);

    let imgHtml;
    if(photo)imgHtml=`<img src="${esc(photo)}" alt="" loading="lazy" />`;
    else if(m.fallback)imgHtml=`<img src="${m.fallback}" alt="" loading="lazy" style="filter:brightness(.7) saturate(.75);" />`;
    else imgHtml=`<div class="card-img-placeholder" style="background:linear-gradient(135deg,${m.color}28,${m.color}0e);" aria-hidden="true">${m.emoji}</div>`;

    card.innerHTML=`
      <div class="card-img">
        ${imgHtml}
        <span class="card-cat-badge" style="background:${m.color}28;color:${m.color};">${esc(cat)}</span>
        ${featured?'<span class="badge-featured">À la une</span>':''}
        ${soon?'<span class="badge-soon">Bientôt</span>':''}
        ${vues>0?`<span class="badge-vues"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> ${vues}</span>`:''}
      </div>
      <div class="card-body">
        ${ev.Organisation && orgasMap[ev.Organisation] ? `
        <div class="card-orga" data-orga="${esc(ev.Organisation)}">
          <div class="card-orga-avatar">${
            orgasMap[ev.Organisation].photo
              ? `<img src="${esc(orgasMap[ev.Organisation].photo)}" alt="${esc(ev.Organisation)}" loading="lazy"/>`
              : `<span style="color:hsl(${ev.Organisation.split('').reduce((a,c)=>a+c.charCodeAt(0),0)%360},45%,55%)">${ev.Organisation.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</span>`
          }</div>
          <span class="card-orga-name">${esc(ev.Organisation)}</span>
        </div>` : ''}
        <h3 class="card-title">${esc(ev.Titre||'Sans titre')}</h3>
        <div class="card-commune" style="color:${m.color}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${esc(ev.Commune||'')}${ev.Lieu?`<span style="color:var(--text-muted);font-weight:400;"> · ${esc(ev.Lieu)}</span>`:''}
        </div>
        <div class="card-date">
          <span class="card-dot" style="background:${m.color}" aria-hidden="true"></span>
          ${esc(dateStr)}${ev.Heure?` · ${esc(ev.Heure)}`:''}
        </div>
        ${isRec?`<div class="rec-badge" style="color:${m.color};border-color:${m.color}35;background:${m.color}0d;">🔁 ${esc(ev['Récurrence'])}</div>`:''}
      </div>
      <div class="card-foot">
        <span class="card-price">${ev.Tarif?`<strong>${esc(ev.Tarif)}</strong>`:''}</span>
        <div class="card-actions">
          <button class="btn-card-more" type="button" aria-label="En savoir plus sur ${esc(ev.Titre||'')}">En savoir plus</button>
          <button class="btn-share" type="button" title="Partager" aria-label="Partager cet événement">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
      </div>
    `;

    // Clic sur la card entière (sauf boutons) → modale
    card.addEventListener('click',e=>{
      if(e.target.closest('.btn-share,.btn-card-more'))return;
      // Clic sur le logo organisateur → ouvrir profil
      const orgaEl=e.target.closest('.card-orga');
      if(orgaEl&&orgasMap[orgaEl.dataset.orga]){
        e.stopPropagation();
        const o=orgasMap[orgaEl.dataset.orga];
        openOrgaModal({...o,ateliers:allEvents.filter(ev=>ev.Organisation===o.nom)});
        return;
      }
      openModal(ev);
    });
    card.querySelector('.btn-card-more').addEventListener('click',()=>openModal(ev));
    card.querySelector('.btn-share').addEventListener('click',e=>{e.stopPropagation();openShareModal(ev)});
    return card;
  }

  function renderEvents(){
    const c=$('#events-container');c.innerHTML='';
    const filtered=allEvents.filter(ev=>{
      if(!isActive(ev))return false;
      if(currentCat!=='all'&&ev['Catégorie']!==currentCat)return false;
      if(currentSearch){const q=norm(currentSearch);const h=norm([ev.Titre,ev.Commune,ev.Lieu,ev['Catégorie'],ev.Description,ev.Organisation].filter(Boolean).join(' '));if(!h.includes(q))return false;}
      return true;
    }).sort((a,b)=>{const da=a.Date?new Date(a.Date):new Date('9999-12-31'),db=b.Date?new Date(b.Date):new Date('9999-12-31');return da-db});
    if(!filtered.length)c.innerHTML='<div class="empty-state">Aucun événement ne correspond.</div>';
    else filtered.forEach(ev=>c.appendChild(buildCard(ev)));
    c.classList.toggle('list',viewMode==='list');
    $('#event-count').textContent=`${filtered.length} événement${filtered.length>1?'s':''}`;
    // Fond catégorie dynamique
    const bg=$('#cat-bg');
    if(currentCat!=='all'){const m=CAT_META[currentCat];if(m&&m.fallback){bg.style.backgroundImage=`url(${m.fallback})`;bg.classList.add('on');}else bg.classList.remove('on');}
    else bg.classList.remove('on');
  }

  /* ── MODALE ── */
  function openModal(ev){
    const cat=ev['Catégorie']||'Autre',m=CAT_META[cat]||CAT_META['Autre'],photo=getPhoto(ev);
    const mc=$('.modal-cat-pill');mc.textContent=cat;mc.style.background=m.color+'28';mc.style.color=m.color;
    $('#modal-title').textContent=ev.Titre||'Sans titre';
    let photoEl=$('.modal-photo');
    if(photo){if(!photoEl){photoEl=document.createElement('img');photoEl.className='modal-photo';$('.modal').insertBefore(photoEl,$('.modal-head'));}photoEl.src=photo;photoEl.alt=`Affiche : ${ev.Titre||''}`;photoEl.onclick=()=>{$('#lightbox-img').src=photo;$('#lightbox-img').alt=ev.Titre||'';$('#lightbox').classList.add('open');};}
    else if(photoEl)photoEl.remove();
    const mi=[];
    if(ev.Date)mi.push(`<span class="modal-meta-item">📅 <strong>${fmtDate(ev.Date)}</strong>${ev['Date de fin']?' → '+fmtDate(ev['Date de fin']):''}</span>`);
    if(ev.Heure)mi.push(`<span class="modal-meta-item">🕐 <strong>${esc(ev.Heure)}</strong></span>`);
    if(ev.Commune)mi.push(`<span class="modal-meta-item">📍 <strong>${esc(ev.Commune)}</strong>${ev.Lieu?' — '+esc(ev.Lieu):''}</span>`);
    if(ev.Tarif)mi.push(`<span class="modal-meta-item">💰 <strong>${esc(ev.Tarif)}</strong></span>`);
    if(ev['Récurrence']&&ev['Récurrence']!=='Aucune')mi.push(`<span class="modal-meta-item">↻ <strong>${esc(ev['Récurrence'])}</strong>${ev['Jour/Période']?' — '+esc(ev['Jour/Période']):''}</span>`);
    $('#modal-meta').innerHTML=mi.join('');
    $('#modal-desc').textContent=ev.Description||'';
    const org=$('#modal-org');
    if(ev.Organisation||ev.Contact){
      let h='';
      if(ev.Organisation)h+=`<div class="modal-org-label">Organisé par</div><div class="modal-org-name">${esc(ev.Organisation)}</div>`;
      if(ev.Contact){
        const parts=ev.Contact.split('|').map(s=>s.trim()).filter(Boolean);

        // Icônes brand sans ID dupliqué (gradient en inline unique)
        const icoIG=`<img src="data:image/png;base64,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" width="18" height="18" alt="Instagram" style="border-radius:4px;display:block;">`;
                const icoFB=`<img src="data:image/png;base64,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" width="18" height="18" alt="Facebook" style="border-radius:50%;display:block;">`;
        const icoWeb=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.8" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20M12 2c-2.5 3-4 6.5-4 10s1.5 7 4 10M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10"/>
        </svg>`;

        h+=`<div class="modal-org-socials">`;
        parts.forEach(part=>{
          let ico=icoWeb, label='', href='';
          const p=part.trim();

          // Détection par préfixe structuré IG: / FB: / Site:
          if(/^IG:/i.test(p)){
            const val=p.replace(/^IG:/i,'').trim().replace('@','');
            ico=icoIG; label='@'+val;
            href=`https://www.instagram.com/${val}/`;

          } else if(/^FB:/i.test(p)||/^Facebook:/i.test(p)){
            const val=p.replace(/^(FB|Facebook):/i,'').trim();
            ico=icoFB;
            href=val.startsWith('http')?val:`https://www.facebook.com/${val}`;
            label=href.replace(/^https?:\/\/(www\.)?facebook\.com\//,'').replace(/\/$/,'');

          } else if(/^(Instagram:|instagram\.com)/i.test(p)||p.includes('instagram.com')){
            // URL instagram directe ou préfixe "Instagram:"
            const val=p.replace(/^Instagram:/i,'').trim();
            ico=icoIG;
            if(val.startsWith('http')){
              href=val;
              label='@'+val.replace(/^https?:\/\/(www\.)?instagram\.com\//,'').replace(/\/$/,'');
            } else {
              const handle=val.replace('@','');
              href=`https://www.instagram.com/${handle}/`;
              label='@'+handle;
            }

          } else if(p.includes('facebook.com')||/^(Facebook:|fb\.com)/i.test(p)){
            // URL facebook directe
            ico=icoFB;
            href=p.startsWith('http')?p:'https://'+p;
            label=href.replace(/^https?:\/\/(www\.)?(facebook|fb)\.com\//,'').replace(/\/$/,'');

          } else if(/^Site:/i.test(p)){
            const val=p.replace(/^Site:/i,'').trim();
            ico=icoWeb;
            href=val.startsWith('http')?val:'https://'+val;
            label=href.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'');

          } else {
            // URL brute ou texte libre
            href=p.startsWith('http')?p:'https://'+p;
            label=href.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'');
          }

          h+=`<a href="${esc(href)}" target="_blank" rel="noopener" class="modal-org-social">
            <span class="modal-org-social-ico">${ico}</span>
            <span>${esc(label)}</span>
          </a>`;
        });
        h+=`</div>`;
      }
      org.innerHTML=h; org.style.display='block';
    } else org.style.display='none';
    $('#modal-foot').innerHTML=`
      <span class="modal-foot-label">Agenda</span>
      <button class="cal-btn" id="modal-apple-btn" type="button">${APPLE_SVG} Apple / Outlook</button>
      <a class="cal-btn" href="${gcalUrl(ev)}" target="_blank" rel="noopener">${GCAL_SVG} Google Calendar</a>
      <button class="cal-btn" onclick="openShareModal(window.__modalEv)" type="button" style="margin-left:auto;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Partager
      </button>
    `;
    window.__modalEv=ev;
    $('#modal-apple-btn').onclick=()=>genICS(ev);
    $('#modal-overlay').classList.add('open');document.body.style.overflow='hidden';
    if(ev.id)trackView(ev.id);
  }
  function closeModal(){$('#modal-overlay').classList.remove('open');document.body.style.overflow='';}

  /* ── SLIDER ── */
  let slideIdx=0,slideTimer=null,feats=[];
  function setupSlider(events){
    feats=events.filter(e=>e['À la une']&&getPhoto(e)&&(isFut(e.Date)||(e['Récurrence']&&e['Récurrence']!=='Aucune'))).slice(0,5);
    const wrap=$('#slider-wrap');
    if(!feats.length){wrap.style.display='none';return;}
    wrap.style.display='';renderSlider();
  }
  function renderSlider(){
    const c=$('#featured-container');
    let th='<span class="ns-num" id="ns-num"></span>';
    feats.forEach((_,i)=>th+=`<div class="ns-th${i===slideIdx?' on':''}" data-i="${i}"><img src="${getPhoto(feats[i])}" alt="" loading="lazy"/></div>`);
    c.innerHTML=`<div id="ns-bg"></div><div id="ns-prog"></div><div class="ns-top-shadow"></div><div id="ns-content"></div><button class="ns-arr ns-prev" type="button" aria-label="Précédent">‹</button><button class="ns-arr ns-next" type="button" aria-label="Suivant">›</button><div class="ns-thumbs">${th}</div>`;
    $('.ns-prev').onclick=()=>goSlide(slideIdx-1);
    $('.ns-next').onclick=()=>goSlide(slideIdx+1);
    $$('.ns-th').forEach(t=>t.onclick=()=>goSlide(+t.dataset.i));
    showSlide(slideIdx);startSlideTimer();
  }
  function showSlide(i){
    if(i<0)i=feats.length-1;if(i>=feats.length)i=0;slideIdx=i;
    const ev=feats[i],m=CAT_META[ev['Catégorie']]||CAT_META['Autre'];
    const bg=$('#ns-bg');bg.style.backgroundImage=`url(${getPhoto(ev)})`;bg.classList.remove('z');setTimeout(()=>bg.classList.add('z'),50);
    const cnt=$('#ns-content');
    cnt.innerHTML=`<div class="ns-ey"><span class="ns-pill" style="background:${m.color}28;color:${m.color}">${esc(ev['Catégorie']||'')}</span></div><h2 class="ns-t">${esc(ev.Titre||'')}</h2><div class="ns-bar" style="background:${m.color}"></div><div class="ns-m">${ev.Date?`<span>📅 ${fmtDate(ev.Date)}</span><span class="ns-s"></span>`:''} ${ev.Commune?`<span>📍 ${esc(ev.Commune)}</span>`:''}</div>${ev.Organisation?`<div class="ns-org">par <strong>${esc(ev.Organisation)}</strong></div>`:''}${ev.Description?`<p class="ns-desc">${esc(ev.Description)}</p>`:''}<button class="ns-cta" type="button">Voir l'événement →</button>`;
    cnt.querySelector('.ns-cta').onclick=()=>openModal(ev);
    requestAnimationFrame(()=>cnt.querySelectorAll('.ns-t,.ns-bar,.ns-m,.ns-org,.ns-desc,.ns-cta').forEach(el=>el.classList.add('in')));
    $$('.ns-th').forEach((t,j)=>t.classList.toggle('on',j===slideIdx));
    const n=$('#ns-num');if(n)n.textContent=`${slideIdx+1} / ${feats.length}`;
    startProg();
  }
  function goSlide(i){clearTimeout(slideTimer);showSlide(i);startSlideTimer();}
  function startSlideTimer(){clearTimeout(slideTimer);slideTimer=setTimeout(()=>goSlide(slideIdx+1),7000);}
  function startProg(){const p=$('#ns-prog');if(!p)return;p.style.transition='none';p.style.width='0%';requestAnimationFrame(()=>{p.style.transition='width 7s linear';p.style.width='100%';});}

  /* ── STATS HERO ── */
  function updateStats(){
    const fut=allEvents.filter(e=>isFut(e.Date)||(e['Récurrence']&&e['Récurrence']!=='Aucune'));
    const soon=allEvents.filter(e=>isSoon(e.Date));
    if(fut.length){$('#stat-total').textContent=fut.length;$('#hero-stats').style.display='flex';}
    if(soon.length){$('#stat-soon').textContent=soon.length;$('#stat-soon-wrap').style.display='flex';}
  }

  /* ── JSON-LD ── */
  function injectJsonLd(events){
    const list=events.filter(e=>e.Date&&isFut(e.Date)&&e.Titre).slice(0,30).map(e=>{
      const o={'@context':'https://schema.org','@type':'Event','name':e.Titre,'startDate':e.Heure?`${e.Date}T${e.Heure}:00`:e.Date,'eventStatus':'https://schema.org/EventScheduled','eventAttendanceMode':'https://schema.org/OfflineEventAttendanceMode','location':{'@type':'Place','name':e.Lieu||e.Commune||'Vallée de la Save','address':{'@type':'PostalAddress','addressLocality':e.Commune||'Saint-Paul-sur-Save','addressRegion':'Haute-Garonne','addressCountry':'FR'}}};
      if(e['Date de fin'])o.endDate=e['Date de fin'];
      if(e.Description)o.description=e.Description;
      const p=getPhoto(e);if(p)o.image=p;
      if(e.Organisation)o.organizer={'@type':'Organization','name':e.Organisation};
      if(e.Tarif){const f=/gratuit|libre/i.test(e.Tarif);o.offers={'@type':'Offer','price':f?'0':e.Tarif,'priceCurrency':'EUR','availability':'https://schema.org/InStock'};}
      return o;
    });
    $('#jsonld-events').textContent=JSON.stringify(list,null,2);
  }

  /* ── AUTOCOMPLÉTION ── */
  function buildSug(query){
    const box=$('#suggest-box'),input=$('#s-input');
    if(!query||query.length<2){box.classList.remove('open');input.setAttribute('aria-expanded','false');return;}
    const q=norm(query),secs=[];
    const cm=Object.keys(CAT_META).filter(c=>norm(c).includes(q)).slice(0,3);
    if(cm.length)secs.push({label:'Catégories',items:cm.map(c=>{const n=allEvents.filter(e=>e['Catégorie']===c&&(isFut(e.Date)||(e['Récurrence']&&e['Récurrence']!=='Aucune'))).length;return{t:'cat',v:c,label:c,meta:`${n} événement${n>1?'s':''}`,color:CAT_META[c].color,emoji:CAT_META[c].emoji};})});
    const cs={};allEvents.forEach(e=>{if(e.Commune&&(isFut(e.Date)||(e['Récurrence']&&e['Récurrence']!=='Aucune')))cs[e.Commune]=(cs[e.Commune]||0)+1;});
    const cml=Object.keys(cs).filter(c=>norm(c).includes(q)).sort((a,b)=>cs[b]-cs[a]).slice(0,4);
    if(cml.length)secs.push({label:'Communes',items:cml.map(c=>({t:'commune',v:c,label:c,meta:`${cs[c]} événement${cs[c]>1?'s':''}`,color:'#4db8f0',emoji:'📍'}))});
    const em=allEvents.filter(e=>{const h=norm([e.Titre,e.Description,e.Lieu,e.Organisation].filter(Boolean).join(' '));return h.includes(q)&&(isFut(e.Date)||(e['Récurrence']&&e['Récurrence']!=='Aucune'));}).slice(0,6);
    if(em.length)secs.push({label:'Événements',items:em.map(e=>{const mm=CAT_META[e['Catégorie']]||CAT_META['Autre'];const ds=e.Date?fmtShort(e.Date):'';return{t:'event',v:e.id,ev:e,label:e.Titre,meta:`${e.Commune||''}${ds?' · '+ds:''}`,color:mm.color,emoji:mm.emoji};})});
    if(!secs.length){box.innerHTML='<div class="sug-section"><div class="sug-label">Aucun résultat</div></div>';box.classList.add('open');return;}
    let html='',idx=0;const flat=[];
    secs.forEach(s=>{html+=`<div class="sug-section"><div class="sug-label">${s.label}</div>`;s.items.forEach(item=>{const hl=hlMatch(item.label,query);html+=`<div class="sug-item" data-idx="${idx}"><div class="sug-ico" style="background:${item.color}20;color:${item.color}">${item.emoji}</div><div class="sug-text"><span class="sug-name">${hl}</span><span class="sug-meta">${esc(item.meta)}</span></div></div>`;flat.push(item);idx++;});html+='</div>';});
    box.innerHTML=html;box.classList.add('open');input.setAttribute('aria-expanded','true');sugIdx=-1;
    $$('.sug-item',box).forEach((el,i)=>{el.addEventListener('click',()=>pickSug(flat[i]));el.addEventListener('mouseenter',()=>{$$('.sug-item',box).forEach(s=>s.classList.remove('on'));el.classList.add('on');sugIdx=i;});});
    box._flat=flat;
  }
  function hlMatch(text,query){if(!query)return esc(text);const nt=norm(text),nq=norm(query),i=nt.indexOf(nq);if(i<0)return esc(text);return esc(text.slice(0,i))+'<mark>'+esc(text.slice(i,i+query.length))+'</mark>'+esc(text.slice(i+query.length));}
  function pickSug(item){
    const input=$('#s-input'),box=$('#suggest-box');box.classList.remove('open');input.setAttribute('aria-expanded','false');
    if(item.t==='cat'){input.value='';currentSearch='';$('#s-clear').classList.remove('on');setCat(item.v);}
    else if(item.t==='commune'){input.value=item.v;currentSearch=item.v;$('#s-clear').classList.add('on');renderEvents();}
    else openModal(item.ev);
  }
  function handleSugKey(e){
    const box=$('#suggest-box');if(!box.classList.contains('open')||!box._flat)return;
    if(e.key==='ArrowDown'){e.preventDefault();sugIdx=Math.min(sugIdx+1,box._flat.length-1);updSug();}
    else if(e.key==='ArrowUp'){e.preventDefault();sugIdx=Math.max(sugIdx-1,0);updSug();}
    else if(e.key==='Enter'){e.preventDefault();if(sugIdx>=0&&box._flat[sugIdx])pickSug(box._flat[sugIdx]);else{currentSearch=e.target.value;box.classList.remove('open');renderEvents();}}
    else if(e.key==='Escape'){box.classList.remove('open');e.target.blur();}
  }
  function updSug(){const box=$('#suggest-box');$$('.sug-item',box).forEach((el,i)=>{el.classList.toggle('on',i===sugIdx);if(i===sugIdx)el.scrollIntoView({block:'nearest'});});}

  /* ── DROPDOWN CATÉGORIES ── */
  function buildCatMenu(){
    const menu=$('#cat-menu');
    const cats=['all',...Object.keys(CAT_META)];
    menu.innerHTML=cats.map(c=>{
      const cnt=c==='all'?allEvents.filter(e=>isFut(e.Date)||(e['Récurrence']&&e['Récurrence']!=='Aucune')).length:allEvents.filter(e=>e['Catégorie']===c&&(isFut(e.Date)||(e['Récurrence']&&e['Récurrence']!=='Aucune'))).length;
      const color=c==='all'?'var(--gold)':(CAT_META[c]||CAT_META['Autre']).color;
      const label=c==='all'?'Toutes catégories':c;
      return`<button class="cat-opt${c===currentCat?' on':''}" data-c="${esc(c)}" type="button"><span class="cat-opt-dot" style="background:${color}"></span><span>${esc(label)}</span><span class="cat-opt-cnt">${cnt}</span></button>`;
    }).join('');
    $$('.cat-opt',menu).forEach(btn=>btn.addEventListener('click',()=>{setCat(btn.dataset.c);closeDD();}));
  }
  function setCat(cat){
    currentCat=cat;
    const lbl=$('#cat-label'),dot=$('#cat-dot');
    if(cat==='all'){lbl.textContent='Toutes catégories';dot.style.background='var(--gold)';}
    else{lbl.textContent=cat;dot.style.background=(CAT_META[cat]||CAT_META['Autre']).color;}
    buildCatMenu();renderEvents();
  }
  function openDD(){$('#cat-dd').classList.add('open');$('#cat-btn').setAttribute('aria-expanded','true');}
  function closeDD(){$('#cat-dd').classList.remove('open');$('#cat-btn').setAttribute('aria-expanded','false');}

  /* ── FORMULAIRE ── */
  function setupForm(){
    const inp=$('#f-commune'),box=$('#commune-sug');
    inp.addEventListener('input',()=>{const q=norm(inp.value);if(q.length<2){box.style.display='none';return;}const m=COMMUNES.filter(c=>norm(c).includes(q)).slice(0,6);if(!m.length){box.style.display='none';return;}box.innerHTML=m.map(c=>`<div data-v="${esc(c)}">${esc(c)}</div>`).join('');box.style.display='block';box.querySelectorAll('div').forEach(d=>d.addEventListener('click',()=>{inp.value=d.dataset.v;box.style.display='none';}));});
    inp.addEventListener('blur',()=>setTimeout(()=>box.style.display='none',200));
    $('#f-recurrence').addEventListener('change',e=>$('#f-periode-group').style.display=e.target.value!=='Aucune'?'block':'none');
    $('#agenda-form').addEventListener('submit',async e=>{
      e.preventDefault();
      const titre=$('#f-titre').value.trim(),cat=$('#f-cat').value,commune=$('#f-commune').value.trim();
      if(!titre||!cat||!commune){alert('Titre, catégorie et commune sont obligatoires.');return;}
      if(!$('#f-consent').checked){alert("Merci d'accepter les conditions de traitement.");return;}
      const btn=$('#submit-btn');btn.disabled=true;const orig=btn.innerHTML;btn.textContent='Envoi…';
      const fields={'Titre':titre,'Catégorie':cat,'Commune':commune,'Statut':'En attente'};
      if($('#f-date').value)fields['Date']=$('#f-date').value;
      if($('#f-date-fin').value)fields['Date de fin']=$('#f-date-fin').value;
      if($('#f-heure').value)fields['Heure']=$('#f-heure').value;
      if($('#f-lieu').value)fields['Lieu']=$('#f-lieu').value;
      if($('#f-desc').value)fields['Description']=$('#f-desc').value;
      if($('#f-tarif').value)fields['Tarif']=$('#f-tarif').value;
      if($('#f-recurrence').value!=='Aucune'){fields['Récurrence']=$('#f-recurrence').value;if($('#f-periode').value)fields['Jour/Période']=$('#f-periode').value;}
      if($('#f-org').value)fields['Organisation']=$('#f-org').value;
      // Normalisation des liens sociaux
      function normalizeIG(v){
        v=v.trim();
        if(!v)return'';
        // Extraire le handle depuis n'importe quel format
        v=v.replace(/^https?:\/\/(www\.)?instagram\.com\//,'').replace(/\/?$/,'').replace(/^@/,'').trim();
        return v;
      }
      function normalizeFB(v){
        v=v.trim();
        if(!v)return'';
        // URL complète → extraire le slug
        v=v.replace(/^https?:\/\/(www\.)?(facebook|fb)\.com\//,'').replace(/\/?(\?.*)?$/,'').replace(/^@/,'').trim();
        return v;
      }
      function normalizeSite(v){
        v=v.trim();
        if(!v)return'';
        if(!v.startsWith('http'))v='https://'+v;
        return v;
      }
      const igVal=normalizeIG($('#f-insta').value);
      const fbVal=normalizeFB($('#f-fb').value);
      const siteVal=normalizeSite($('#f-site').value);
      const soc=[igVal&&'IG:'+igVal, fbVal&&'FB:'+fbVal, siteVal&&'Site:'+siteVal].filter(Boolean).join(' | ');
      if(soc)fields['Contact']=soc;
      if($('#f-contact-prive').value)fields['Contact privé']=$('#f-contact-prive').value;
      if($('#f-message-prive').value)fields['Message privé']=$('#f-message-prive').value;
      try{
        const res=await fetch(AT_URL,{method:'POST',headers:HEADS,body:JSON.stringify({fields})});
        if(!res.ok)throw Error('Erreur '+res.status);
        $('#agenda-form').style.display='none';$('#success-msg').style.display='block';
        $('#success-msg').scrollIntoView({behavior:'smooth',block:'center'});
      }catch(err){alert('Erreur : '+err.message);btn.disabled=false;btn.innerHTML=orig;}
    });
  }

  /* ── NAVIGATION ── */
  window.showSection=function(name,el){
    $$('.section').forEach(s=>s.classList.remove('active'));const t=$('#section-'+name);if(t)t.classList.add('active');
    if(el){$$('.nav-btn').forEach(b=>b.classList.remove('active'));el.classList.add('active');}
    window.scrollTo({top:0,behavior:'smooth'});
  };
  window.openLegalTab=function(name){
    $$('.legal-tab').forEach(t=>{const on=t.dataset.tab===name;t.classList.toggle('on',on);t.setAttribute('aria-selected',on?'true':'false');});
    $$('.legal-content').forEach(c=>c.classList.toggle('on',c.id==='tab-'+name));
  };
  window.toggleBlock=function(btn){
    const body=btn.closest('.form-block').querySelector('.form-block-body');
    const col=body.classList.toggle('collapsed');
    const span=btn.querySelector('span');if(span)span.textContent=col?'Afficher':'Masquer';
    btn.setAttribute('aria-expanded',col?'false':'true');
  };

  /* ── INIT ── */
  async function init(){
    // Search
    const input=$('#s-input'),clear=$('#s-clear');let timer;
    input.addEventListener('input',e=>{const v=e.target.value;clear.classList.toggle('on',v.length>0);clearTimeout(timer);timer=setTimeout(()=>{buildSug(v);currentSearch=v.length>=2?v:'';renderEvents();},150);});
    input.addEventListener('keydown',handleSugKey);
    input.addEventListener('focus',()=>{if(input.value.length>=2)buildSug(input.value);});
    clear.addEventListener('click',()=>{input.value='';currentSearch='';clear.classList.remove('on');$('#suggest-box').classList.remove('open');renderEvents();input.focus();});
    document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap')){$('#suggest-box').classList.remove('open');$('#s-input').setAttribute('aria-expanded','false');}});
    // Cat dropdown
    $('#cat-btn').addEventListener('click',e=>{e.stopPropagation();$('#cat-dd').classList.contains('open')?closeDD():openDD();});
    document.addEventListener('click',e=>{if(!e.target.closest('#cat-dd'))closeDD();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDD();});
    // View toggle
    $$('.view-btn').forEach(btn=>btn.addEventListener('click',()=>{viewMode=btn.dataset.view;localStorage.setItem('lsv',viewMode);$$('.view-btn').forEach(b=>b.classList.toggle('on',b===btn));renderEvents();}));
    $$('.view-btn').forEach(b=>b.classList.toggle('on',b.dataset.view===viewMode));
    // Legal tabs
    $$('.legal-tab').forEach(t=>t.addEventListener('click',()=>openLegalTab(t.dataset.tab)));
    // Modale
    $('#modal-close').addEventListener('click',closeModal);
    $('#modal-overlay').addEventListener('click',e=>{if(e.target===$('#modal-overlay'))closeModal();});
    // Lightbox
    $('#lightbox-close').addEventListener('click',()=>$('#lightbox').classList.remove('open'));
    $('#lightbox').addEventListener('click',e=>{if(e.target===$('#lightbox'))$('#lightbox').classList.remove('open');});
    // Partage
    $('#share-close').addEventListener('click',closeShareModal);
    $('#share-modal').addEventListener('click',e=>{if(e.target===$('#share-modal'))closeShareModal();});
    $('#share-copy-btn').addEventListener('click',()=>{
      const url=$('#share-copy-url').textContent;
      navigator.clipboard.writeText(url).then(()=>{const btn=$('#share-copy-btn');btn.textContent='Copié !';setTimeout(()=>btn.textContent='Copier',2000);}).catch(()=>{});
    });
    // Escape global
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        if($('#lightbox').classList.contains('open'))$('#lightbox').classList.remove('open');
        else if($('#share-modal').classList.contains('open'))closeShareModal();
        else if($('#orga-modal-overlay').classList.contains('open'))closeOrgaModal();
        else if($('#modal-overlay').classList.contains('open'))closeModal();
      }
    });
    // Scroll
    const scrollBtn=$('#scroll-top'),hdr=$('#main-header');
    window.addEventListener('scroll',()=>{const y=window.scrollY;hdr.classList.toggle('scrolled',y>50);scrollBtn.classList.toggle('on',y>600);});
    scrollBtn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
    // Email
    const pEl=$('#mail-agenda-photo');if(pEl)pEl.textContent=AGENDA_EMAIL;
    setupForm();
    // Modale organisateur
    $('#orga-modal-close').addEventListener('click',closeOrgaModal);
    $('#orga-modal-overlay').addEventListener('click',e=>{if(e.target===$('#orga-modal-overlay'))closeOrgaModal();});

    // Fetch & render
    allEvents=await fetchEvents();
    const orgas=await fetchOrganisateurs();
    buildCatMenu();setupSlider(allEvents);renderEvents();
    buildMobileCats(allEvents);
    buildOrganisateurs(orgas, allEvents);
    updateStats();injectJsonLd(allEvents);
    setupAdmin();

    // Ouvrir un événement depuis un lien partagé (#event-ID)
    const sharedHash = window.location.hash;
    if(sharedHash.startsWith('#event-')){
      const sharedId = sharedHash.replace('#event-','');
      const sharedEv = allEvents.find(e => e.id === sharedId);
      if(sharedEv) openModal(sharedEv);
    }

    // Ouverture automatique d'un événement si hash #event-ID dans l'URL
    const hash = window.location.hash;
    if(hash.startsWith('#event-')){
      const id = hash.replace('#event-','');
      const ev = allEvents.find(e => e.id === id);
      if(ev) setTimeout(()=>openModal(ev), 300);
    }
  }
  document.addEventListener('DOMContentLoaded',init);

  /* ── ATELIERS & ORGANISATEURS ── */
  const CAT_ATELIERS=['Atelier / Cours','Conférence / Atelier'];

  function buildMobileCats(events){
    const wrap=$('#mobile-cats');
    if(!wrap)return;
    // Afficher uniquement sur mobile
    if(window.innerWidth>700){wrap.style.display='none';return;}
    wrap.style.display='flex';

    const cats=['all',...Object.keys(CAT_META).filter(c=>
      events.some(e=>e['Catégorie']===c&&isActive(e))
    )];

    wrap.innerHTML=cats.map(c=>{
      const color=c==='all'?'var(--gold)':(CAT_META[c]||CAT_META['Autre']).color;
      const label=c==='all'?'Tout':c;
      return`<button class="mobile-cat-pill${c===currentCat?' on':''}" data-c="${esc(c)}" type="button">
        ${c!=='all'?`<span class="mobile-cat-dot" style="background:${color}"></span>`:''}
        ${esc(label)}
      </button>`;
    }).join('');

    $$('.mobile-cat-pill',wrap).forEach(btn=>btn.addEventListener('click',()=>{
      setCat(btn.dataset.c);
      // Mettre à jour les pills actives
      $$('.mobile-cat-pill',wrap).forEach(b=>b.classList.toggle('on',b===btn));
    }));
  }

  function buildAteliers(events){
    const ateliers=events.filter(e=>CAT_ATELIERS.includes(e['Catégorie'])&&e.Organisation);
    const wrap=$('#ateliers-wrap');
    if(!ateliers.length){wrap.style.display='none';return;}
    const orgas={};
    ateliers.forEach(e=>{
      const nom=e.Organisation;
      if(!orgas[nom])orgas[nom]={nom,ateliers:[],photo:null,commune:e.Commune||''};
      if(!orgas[nom].photo&&e.Photo&&e.Photo[0])orgas[nom].photo=e.Photo[0].thumbnails?.large?.url||e.Photo[0].url;
      orgas[nom].ateliers.push(e);
    });
    const list=Object.values(orgas).sort((a,b)=>a.nom.localeCompare(b.nom));
    $('#ateliers-count').textContent=`${list.length} organisateur${list.length>1?'s':''}`;
    const stories=$('#ateliers-stories');
    stories.innerHTML='';
    list.forEach(orga=>{
      const item=document.createElement('div');
      item.className='story-item';
      item.setAttribute('role','button');item.setAttribute('tabindex','0');
      item.setAttribute('aria-label',`${orga.nom} — ${orga.ateliers.length} atelier${orga.ateliers.length>1?'s':''}`);
      const initiales=orga.nom.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const couleur=`hsl(${orga.nom.split('').reduce((a,c)=>a+c.charCodeAt(0),0)%360},45%,55%)`;
      item.innerHTML=`
        <div class="story-ring">
          <div class="story-inner">
            ${orga.photo?`<img src="${esc(orga.photo)}" alt="${esc(orga.nom)}" loading="lazy"/>`:`<div class="story-inner-placeholder" style="background:${couleur}22;color:${couleur};font-family:'Playfair Display',serif;font-weight:700;font-size:18px;">${initiales}</div>`}
          </div>
        </div>
        <span class="story-label">${esc(orga.nom)}</span>
        <span class="story-nb">${orga.ateliers.length} atelier${orga.ateliers.length>1?'s':''}</span>`;
      const open=()=>openOrgaModal(orga);
      item.addEventListener('click',open);
      item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')open();});
      stories.appendChild(item);
    });
    wrap.style.display='';
  }

  function openOrgaModal(orga){
    const initiales=orga.nom.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const couleur=`hsl(${orga.nom.split('').reduce((a,c)=>a+c.charCodeAt(0),0)%360},45%,55%)`;
    const av=$('#orga-modal-avatar');
    av.innerHTML=orga.photo?`<img src="${esc(orga.photo)}" alt="${esc(orga.nom)}"/>`:`<span style="color:${couleur};font-family:'Playfair Display',serif;font-weight:700;">${initiales}</span>`;
    $('#orga-modal-name').textContent=orga.nom;
    $('#orga-modal-meta').textContent=`${orga.ateliers.length?orga.ateliers.length+' atelier'+(orga.ateliers.length>1?'s':''):''}${orga.commune?' · '+orga.commune:''}`;
    const body=$('#orga-modal-body');
    let html='';

    // Description courte
    if(orga.descCourte) html+=`<p style="font-size:14px;color:var(--text-sub);margin-bottom:1rem;font-style:italic;">${esc(orga.descCourte)}</p>`;

    // Description longue
    if(orga.desc) html+=`<div style="font-size:14px;color:var(--text-sub);line-height:1.75;margin-bottom:1.5rem;padding-bottom:1.5rem;border-bottom:1px solid var(--border);white-space:pre-wrap;">${esc(orga.desc)}</div>`;

    // Contact
    if(orga.contact){
      const parts=orga.contact.split('|').map(s=>s.trim()).filter(Boolean);
      const icoIG=`<img src="data:image/png;base64,${IG_B64}" width="18" height="18" alt="Instagram" style="border-radius:4px;display:block;">`;
      const icoFB=`<img src="data:image/png;base64,${FB_B64}" width="18" height="18" alt="Facebook" style="border-radius:50%;display:block;">`;
      const icoWeb=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c-2.5 3-4 6.5-4 10s1.5 7 4 10M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10"/></svg>`;
      html+=`<div class="modal-org-socials" style="margin-bottom:1.5rem;padding-bottom:1.5rem;border-bottom:1px solid var(--border);">`;
      parts.forEach(p=>{
        let ico=icoWeb,label='',href='';
        if(/^IG:/i.test(p)){
          const val=p.replace(/^IG:/i,'').trim().replace('@','');
          ico=icoIG;label='@'+val;href=`https://www.instagram.com/${val}/`;
        } else if(/^FB:/i.test(p)){
          const val=p.replace(/^FB:/i,'').trim();
          ico=icoFB;href=val.startsWith('http')?val:`https://www.facebook.com/${val}`;
          label=href.replace(/^https?:\/\/(www\.)?facebook\.com\//,'').replace(/\/$/,'');
        } else if(p.includes('instagram.com')){
          ico=icoIG;href=p.startsWith('http')?p:'https://'+p;
          label='@'+href.replace(/^https?:\/\/(www\.)?instagram\.com\//,'').replace(/\/$/,'');
        } else if(p.includes('facebook.com')){
          ico=icoFB;href=p.startsWith('http')?p:'https://'+p;
          label=href.replace(/^https?:\/\/(www\.)?facebook\.com\//,'').replace(/\/$/,'');
        } else if(/^Site:/i.test(p)){
          const val=p.replace(/^Site:/i,'').trim();
          ico=icoWeb;href=val.startsWith('http')?val:'https://'+val;
          label=href.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'');
        } else {
          href=p.startsWith('http')?p:'https://'+p;
          label=href.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'');
        }
        html+=`<a href="${esc(href)}" target="_blank" rel="noopener" class="modal-org-social"><span class="modal-org-social-ico">${ico}</span><span>${esc(label)}</span></a>`;
      });
      html+=`</div>`;
    }

    // Liste des ateliers
    if(orga.ateliers.length){
      html+=`<div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);margin-bottom:.75rem;">Événements</div>`;
      html+=orga.ateliers.map(ev=>{
        const tags=[];
        if(ev.Tarif)tags.push(ev.Tarif);
        if(ev['Récurrence']&&ev['Récurrence']!=='Aucune')tags.push(ev['Récurrence']);
        if(ev.Lieu)tags.push(ev.Lieu);
        return`<div class="orga-atelier-item">
          <div class="orga-atelier-title">${esc(ev.Titre||'')}</div>
          <div class="orga-atelier-meta">
            ${ev['Jour/Période']?`<span>📅 ${esc(ev['Jour/Période'])}</span>`:''}
            ${ev.Heure?`<span>🕐 ${esc(ev.Heure)}</span>`:''}
            ${ev.Commune?`<span>📍 ${esc(ev.Commune)}</span>`:''}
          </div>
          ${ev.Description?`<div class="orga-atelier-desc">${esc(ev.Description)}</div>`:''}
          ${tags.length?`<div class="orga-atelier-tags">${tags.map(t=>`<span class="orga-atelier-tag">${esc(t)}</span>`).join('')}</div>`:''}
        </div>`;
      }).join('');
    } else if(!orga.desc){
      html+=`<p style="font-size:13px;color:var(--text-muted);text-align:center;padding:1rem 0;">Aucun atelier renseigné pour le moment.</p>`;
    }

    body.innerHTML=html;
    $('#orga-modal-overlay').classList.add('open');
    document.body.style.overflow='hidden';
  }

  function closeOrgaModal(){$('#orga-modal-overlay').classList.remove('open');document.body.style.overflow='';}

  /* ── ADMIN ── */
  const ADMIN_PWD='lasave2026'; // ← change ce mot de passe avant de mettre en ligne

  function setupAdmin(){
    function checkHash(){
      if(window.location.hash==='#admin'){showSection('admin',null);$$('.nav-btn').forEach(b=>b.classList.remove('active'));}
    }
    window.addEventListener('hashchange',checkHash);
    checkHash();

    const pwdInput=$('#admin-pwd'),loginError=$('#admin-login-error');
    function tryLogin(){
      if(pwdInput.value===ADMIN_PWD){$('#admin-login').style.display='none';$('#admin-panel').style.display='block';loadAdminEvents();}
      else{loginError.style.display='block';pwdInput.value='';pwdInput.focus();}
    }
    $('#admin-login-btn').addEventListener('click',tryLogin);
    pwdInput.addEventListener('keydown',e=>{if(e.key==='Enter')tryLogin();});
    $('#admin-logout').addEventListener('click',()=>{
      $('#admin-login').style.display='flex';$('#admin-panel').style.display='none';
      pwdInput.value='';loginError.style.display='none';
      window.location.hash='';showSection('agenda',null);
    });
    $('#btn-archive-all').addEventListener('click',async()=>{
      const btns=$$('.btn-archive-one:not(:disabled)');
      if(!btns.length)return;
      if(!confirm(`Archiver ${btns.length} événement(s) passé(s) ?`))return;
      $('#btn-archive-all').disabled=true;
      let ok=0,err=0;
      for(const btn of btns){
        const success=await setStatut(btn.dataset.id,'Archivé');
        if(success){ok++;btn.closest('tr').style.opacity='.35';btn.disabled=true;}else err++;
      }
      showAdminMsg(err===0?`✓ ${ok} événement(s) archivé(s).`:`${ok} archivé(s), ${err} erreur(s).`,err===0?'ok':'err');
      $('#admin-count').textContent='0 événement(s)';
      $('#btn-archive-all').disabled=false;
    });
  }

  let adminCurrentTab='archive';
  window.switchAdminTab=function(tab){
    adminCurrentTab=tab;
    $$('#admin-tab-archive,#admin-tab-archived').forEach(t=>t.classList.remove('on'));
    $(`#admin-tab-${tab}`).classList.add('on');
    const archiveBtn=$('#btn-archive-all');
    archiveBtn.style.display=tab==='archive'?'inline-flex':'none';
    loadAdminEvents();
  };

  async function loadAdminEvents(){
    const wrap=$('#admin-table-wrap'),countEl=$('#admin-count');
    wrap.innerHTML='<div class="loading">Chargement…</div>';
    const today=new Date();today.setHours(0,0,0,0);

    const isArchive=adminCurrentTab==='archive';
    const filterStatut=isArchive?"{Statut}='Publié'":"{Statut}='Archivé'";
    const filter=encodeURIComponent(filterStatut);
    const url=`${AT_URL}?filterByFormula=${filter}&pageSize=100`;
    let records=[],offset='';
    try{
      do{const u=offset?`${url}&offset=${offset}`:url;const r=await fetch(u,{headers:HEADS});const d=await r.json();records=records.concat(d.records||[]);offset=d.offset||'';}while(offset);
    }catch(e){wrap.innerHTML='<div class="admin-empty">Erreur de chargement.</div>';return;}

    let list;
    if(isArchive){
      // Onglet "À archiver" : événements Publiés dont la date est passée
      list=records.filter(r=>{
        const date=r.fields['Date'],rec=r.fields['Récurrence'],dateFin=r.fields['Date de fin'];
        if(!date)return false;
        if(rec&&rec!=='Aucune')return false;
        if(dateFin)return new Date(dateFin)<today; // multi-jours : archiver seulement si date de fin passée
        return new Date(date)<today;
      }).sort((a,b)=>new Date(b.fields['Date'])-new Date(a.fields['Date']));
    } else {
      // Onglet "Archivés" : tous les événements archivés
      list=records.sort((a,b)=>new Date(b.fields['Date']||0)-new Date(a.fields['Date']||0));
    }

    countEl.textContent=`${list.length} événement(s)`;
    $('#btn-archive-all').disabled=!list.length||!isArchive;

    if(!list.length){
      wrap.innerHTML=`<div class="admin-empty">${isArchive?'Aucun événement passé à archiver. Tout est à jour !':'Aucun événement archivé.'}</div>`;
      return;
    }

    const rows=list.map(r=>{
      const f=r.fields,cat=f['Catégorie']||'Autre',meta=CAT_META[cat]||CAT_META['Autre'];
      const date=f['Date']?new Date(f['Date']).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'—';
      const btn=isArchive
        ?`<button class="btn-archive-one" data-id="${r.id}" type="button">Archiver</button>`
        :`<button class="btn-republish" data-id="${r.id}" type="button">Remettre en ligne</button>`;
      return`<tr><td><span class="admin-ev-title">${esc(f['Titre']||'—')}</span></td><td><span class="admin-ev-date" style="${isArchive?'color:#ff5080':''}">${date}</span></td><td><span class="admin-ev-cat" style="background:${meta.color}22;color:${meta.color}">${esc(cat)}</span></td><td>${esc(f['Commune']||'—')}</td><td>${btn}</td></tr>`;
    }).join('');

    wrap.innerHTML=`<table class="admin-table"><thead><tr><th>Titre</th><th>Date</th><th>Catégorie</th><th>Commune</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;

    if(isArchive){
      $$('.btn-archive-one').forEach(btn=>{
        btn.addEventListener('click',async()=>{
          btn.disabled=true;btn.textContent='…';
          const ok=await setStatut(btn.dataset.id,'Archivé');
          if(ok){btn.closest('tr').style.opacity='.35';btn.textContent='Archivé ✓';const rem=$$('.btn-archive-one:not(:disabled)').length;countEl.textContent=`${rem} événement(s)`;if(!rem)$('#btn-archive-all').disabled=true;}
          else{btn.disabled=false;btn.textContent='Erreur';showAdminMsg("Erreur lors de l'archivage.",'err');}
        });
      });
    } else {
      $$('.btn-republish').forEach(btn=>{
        btn.addEventListener('click',async()=>{
          btn.disabled=true;btn.textContent='…';
          const ok=await setStatut(btn.dataset.id,'Publié');
          if(ok){btn.closest('tr').style.opacity='.35';btn.textContent='En ligne ✓';const rem=$$('.btn-republish:not(:disabled)').length;countEl.textContent=`${rem} événement(s)`;}
          else{btn.disabled=false;btn.textContent='Erreur';showAdminMsg('Erreur lors de la remise en ligne.','err');}
        });
      });
    }
  }

  async function setStatut(id,statut){
    try{const res=await fetch(`${AT_URL}/${id}`,{method:'PATCH',headers:HEADS,body:JSON.stringify({fields:{Statut:statut}})});return res.ok;}
    catch(e){return false;}
  }
  // Garde la compatibilité avec l'ancien nom
  const archiveOne=id=>setStatut(id,'Archivé');

  function showAdminMsg(text,type){
    const el=$('#admin-msg');el.textContent=text;el.className=`admin-msg ${type}`;el.style.display='block';
    setTimeout(()=>el.style.display='none',5000);
  }

/* ── ORGANISATEURS (table Airtable dédiée) ── */
// ID de la table Organisateurs — à mettre à jour quand tu me donnes l'ID Airtable
const AT_TABLE_ORGAS = 'tblgaldbDy7el5Qw1';

async function fetchOrganisateurs() {
  if (AT_TABLE_ORGAS === 'METTRE_ID_TABLE_ICI') return [];
  const filter = encodeURIComponent("{Publié}=1");
  const url = `https://api.airtable.com/v0/${AT_BASE}/${AT_TABLE_ORGAS}?filterByFormula=${filter}&sort[0][field]=Ordre&sort[0][direction]=asc`;
  try {
    const r = await fetch(url, { headers: HEADS });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.records || []).map(r => ({ id: r.id, ...r.fields }));
  } catch (e) { return []; }
}

function buildOrganisateurs(orgas, allEvts) {
  const wrap = $('#ateliers-wrap');
  const stories = $('#ateliers-stories');
  stories.innerHTML = '';

  // Peupler orgasMap pour l'utiliser dans buildCard
  orgasMap = {};
  orgas.forEach(o => {
    orgasMap[o.Nom] = {
      nom: o.Nom,
      photo: o.Photo?.[0]?.thumbnails?.large?.url || o.Photo?.[0]?.url || null,
      descCourte: o['Description courte'] || '',
      desc: o['Description'] || '',
      contact: o.Contact || '',
      commune: o.Commune || ''
    };
  });

  if (!orgas.length) { wrap.style.display = 'none'; return; }

  $('#ateliers-count').textContent = `${orgas.length} organisateur${orgas.length > 1 ? 's' : ''}`;

  orgas.forEach(orga => {
    // Tous les événements de cet organisateur
    const evts = allEvts.filter(e => e.Organisation === orga.Nom);
    const orgaData = {
      ...orgasMap[orga.Nom],
      ateliers: evts // on garde le nom "ateliers" pour la modale mais c'est tous les events
    };

    const item = document.createElement('div');
    item.className = 'story-item';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', orga.Nom);

    const initiales = orga.Nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const couleur = `hsl(${orga.Nom.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360},45%,55%)`;
    const photo = orgaData.photo;

    item.innerHTML = `
      <div class="story-ring">
        <div class="story-inner">
          ${photo
            ? `<img src="${esc(photo)}" alt="${esc(orga.Nom)}" loading="lazy"/>`
            : `<div class="story-inner-placeholder" style="background:${couleur}22;color:${couleur};font-family:'Playfair Display',serif;font-weight:700;font-size:18px;">${initiales}</div>`
          }
        </div>
      </div>
      <span class="story-label">${esc(orga.Nom)}</span>
      ${evts.length ? `<span class="story-nb">${evts.length} événement${evts.length > 1 ? 's' : ''}</span>` : ''}
    `;

    const open = () => openOrgaModal(orgaData);
    item.addEventListener('click', open);
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
    stories.appendChild(item);
  });

  wrap.style.display = '';
  // Reconstruire les cards pour afficher les logos maintenant que orgasMap est peuplé
  renderEvents();
}
