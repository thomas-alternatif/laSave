/* laSave — prototype « institutionnel mais vivant » (lecture seule, données réelles via l'API) */
(function(){
'use strict';
const API='https://lasave-api.partage.workers.dev';
document.documentElement.classList.add('js');
const $=s=>document.querySelector(s);
const esc=s=>s==null?'':String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Couleurs des catégories : palette de la commission culture, versions lisibles pour le texte */
const PAL=[{sw:'#096c71',tx:'#096c71'},{sw:'#FFA823',tx:'#8a5200'},{sw:'#B923FF',tx:'#8a17c4'},{sw:'#5C96AB',tx:'#3E6F80'},{sw:'#2f8f5b',tx:'#236e46'},{sw:'#d9486b',tx:'#a8263a'}];
const catColor={};

const today=new Date();today.setHours(0,0,0,0);
const parse=d=>{if(!d)return null;const [y,m,j]=String(d).slice(0,10).split('-').map(Number);return new Date(y,m-1,j);};
const photo=ev=>{const a=ev.Photo&&ev.Photo[0];return a?((a.thumbnails&&a.thumbnails.large&&a.thumbnails.large.url)||a.url):null;};
const fallback={'Concert':'cat-concert','Festival':'cat-festival','Marché':'cat-marche','Sport / Loisir':'cat-sport','Guinguette':'cat-guinguette','Fête & Célébration':'cat-fete'};
const img=ev=>photo(ev)||('../images/'+(fallback[ev['Catégorie']]||'hero-chapiteau')+'.webp');
const fmt=(d,o)=>d.toLocaleDateString('fr-FR',o);
const isRec=ev=>ev['Récurrence']&&ev['Récurrence']!=='Aucune';

const ICON={
  pin:'<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  clock:'<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  tag:'<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>'
};

let events=[],dated=[],regular=[],state={when:'all',cat:'all',q:''},shownDays=10;

function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');}
function startOf(ev){const s=parse(ev.Date),e=parse(ev['Date de fin']);if(s&&s<today&&e&&e>=today)return today;return s;}

function inWhen(d){
  if(state.when==='all')return true;
  const day=today.getDay()||7;
  if(state.when==='week'){const end=new Date(today);end.setDate(today.getDate()+(7-day));return d<=end;}
  if(state.when==='weekend'){const sat=new Date(today);sat.setDate(today.getDate()+(6-day));if(day===7)sat.setDate(today.getDate()-1);const sun=new Date(sat);sun.setDate(sat.getDate()+1);return d>=(day>=6?today:sat)&&d<=sun;}
  if(state.when==='month')return d.getMonth()===today.getMonth()&&d.getFullYear()===today.getFullYear();
  return true;
}
function match(ev){
  if(state.cat!=='all'&&ev['Catégorie']!==state.cat)return false;
  if(state.q){const h=norm([ev.Titre,ev.Commune,ev.Lieu,ev.Organisation,ev['Catégorie'],ev.Description].join(' '));if(!norm(state.q).split(/\s+/).every(w=>h.includes(w)))return false;}
  return true;
}
const link=ev=>'/#event-'+encodeURIComponent(ev.id);

function evCard(ev){
  const c=catColor[ev['Catégorie']]||PAL[0];
  const meta=[];
  if(ev.Heure)meta.push(`<span>${ICON.clock}${esc(ev.Heure)}</span>`);
  if(ev.Commune)meta.push(`<span>${ICON.pin}${esc(ev.Commune)}${ev.Lieu?' · '+esc(ev.Lieu):''}</span>`);
  if(ev.Tarif)meta.push(`<span>${ICON.tag}${esc(ev.Tarif)}</span>`);
  const fin=parse(ev['Date de fin']);
  if(fin&&parse(ev.Date)&&fin>parse(ev.Date))meta.push(`<span>Jusqu'au ${esc(fmt(fin,{day:'numeric',month:'long'}))}</span>`);
  return `<a class="ev reveal" href="${link(ev)}">
    <div class="ev-img"><img src="${esc(img(ev))}" alt="" loading="lazy" /></div>
    <div><p class="ev-cat" style="color:${c.tx}"><i style="background:${c.sw}"></i>${esc(ev['Catégorie']||'Événement')}</p>
      <h3>${esc(ev.Titre||'Sans titre')}</h3><p class="ev-meta">${meta.join('')}</p></div>
    <span class="ev-go">Voir <span aria-hidden="true">→</span></span></a>`;
}

function renderList(){
  const list=$('#list');
  const rows=dated.filter(ev=>inWhen(ev._d)&&match(ev));
  const byDay=new Map();rows.forEach(ev=>{const k=ev._d.toDateString();if(!byDay.has(k))byDay.set(k,[]);byDay.get(k).push(ev);});
  const days=[...byDay.entries()];
  $('#count').textContent=rows.length?`${rows.length} événement${rows.length>1?'s':''} à venir`:'';
  if(!days.length){list.innerHTML=`<p class="empty">Aucun événement ne correspond à votre recherche pour cette période.</p>`;return;}
  const lbl=d=>{const diff=Math.round((d-today)/864e5);return diff===0?"Aujourd'hui":diff===1?'Demain':fmt(d,{weekday:'long'});};
  list.innerHTML=days.slice(0,shownDays).map(([k,evs])=>{const d=new Date(k);return `<section class="day" aria-label="${esc(fmt(d,{weekday:'long',day:'numeric',month:'long'}))}">
      <div class="day-label"><div class="day-num">${d.getDate()}</div><div><div class="day-name">${esc(lbl(d))}</div><div class="day-month">${esc(fmt(d,{month:'long'}))}</div></div></div>
      <div class="day-events">${evs.map(evCard).join('')}</div></section>`;}).join('')
    +(days.length>shownDays?`<div class="more"><button type="button" class="btn" id="more">Afficher plus de dates (${days.length-shownDays})</button></div>`:'');
  const m=$('#more');if(m)m.addEventListener('click',()=>{shownDays+=10;renderList();});
  observe();
}

function renderRegular(){
  const r=regular.filter(match);
  $('#regular').hidden=!r.length;
  $('#reg-grid').innerHTML=r.map(ev=>`<a class="reg reveal" href="${link(ev)}"><img src="${esc(img(ev))}" alt="" loading="lazy" /><span><strong>${esc(ev.Titre)}</strong><small>${esc([ev['Période']||ev['Récurrence'],ev.Commune].filter(Boolean).join(' · '))}</small></span></a>`).join('');
}

function renderFeatured(){
  let f=dated.filter(ev=>ev['À la une']&&photo(ev));
  if(f.length<3)f=f.concat(dated.filter(ev=>photo(ev)&&!f.includes(ev))).slice(0,3);
  if(f.length<3)f=f.concat(dated.filter(ev=>!f.includes(ev))).slice(0,3);
  f=f.slice(0,3);
  $('#featured').innerHTML=f.map((ev,i)=>`<a class="feat" href="${link(ev)}"><img src="${esc(img(ev))}" alt="" ${i?'loading="lazy"':''} /><div class="feat-body">${i===0?'<span class="feat-kicker">À la une</span>':''}<h3>${esc(ev.Titre)}</h3><p>${esc(fmt(ev._d,{weekday:'long',day:'numeric',month:'long'}))}${ev.Commune?' · '+esc(ev.Commune):''}</p></div></a>`).join('');
}

function renderCats(){
  const counts={};[...dated,...regular].forEach(ev=>{const c=ev['Catégorie'];if(c)counts[c]=(counts[c]||0)+1;});
  const cats=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  cats.forEach((c,i)=>catColor[c]=PAL[i%PAL.length]);
  $('#cats').innerHTML=`<button type="button" class="chip" aria-pressed="true" data-cat="all">Toutes les catégories</button>`+cats.map(c=>`<button type="button" class="chip" aria-pressed="false" data-cat="${esc(c)}"><span class="sw" style="background:${catColor[c].sw}"></span>${esc(c)}</button>`).join('');
}

function countUp(el,to){
  if(reduce||document.hidden){el.textContent=to;return;}
  setTimeout(()=>{el.textContent=to;},1400);
  const t0=performance.now(),d=900;
  const step=t=>{const p=Math.min(1,(t-t0)/d),e=1-Math.pow(1-p,4);el.textContent=Math.round(to*e);if(p<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
}

let io;
function observe(){
  if(reduce||!('IntersectionObserver' in window)){document.querySelectorAll('.reveal').forEach(e=>e.classList.add('in'));return;}
  io=io||new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.reveal:not(.in)').forEach(e=>{if(e.getBoundingClientRect().top<innerHeight)e.classList.add('in');else io.observe(e);});
}

function bind(){
  $('#when').addEventListener('click',e=>{const b=e.target.closest('[data-when]');if(!b)return;state.when=b.dataset.when;$('#when').querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));shownDays=10;renderList();});
  $('#cats').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b)return;state.cat=b.dataset.cat;$('#cats').querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));shownDays=10;renderList();renderRegular();});
  let t;$('#q').addEventListener('input',e=>{clearTimeout(t);t=setTimeout(()=>{state.q=e.target.value.trim();shownDays=10;renderList();renderRegular();},180);});
  $('#search-form').addEventListener('submit',e=>{e.preventDefault();state.q=$('#q').value.trim();renderList();renderRegular();const a=$('#agenda');a.scrollIntoView({behavior:reduce?'auto':'smooth'});a.focus({preventScroll:true});});
}

async function load(){
  bind();
  try{
    const [ev,orgs]=await Promise.all([fetch(API+'/events').then(r=>r.json()),fetch(API+'/orgas').then(r=>r.json()).catch(()=>[])]);
    events=Array.isArray(ev)?ev:[];
    dated=[];regular=[];
    events.forEach(e=>{const d=startOf(e);const fin=parse(e['Date de fin']);
      if(d&&(d>=today||(fin&&fin>=today))){e._d=d;dated.push(e);} else if(!d&&isRec(e))regular.push(e); else if(!d)regular.push(e);});
    dated.sort((a,b)=>a._d-b._d);
    renderCats();renderFeatured();renderList();renderRegular();
    const communes=new Set(dated.concat(regular).map(e=>e.Commune).filter(Boolean));
    countUp(document.querySelector('[data-count="events"]'),dated.length+regular.length);
    countUp(document.querySelector('[data-count="communes"]'),communes.size);
    countUp(document.querySelector('[data-count="orgas"]'),Array.isArray(orgs)?orgs.length:0);
    $('#org-grid').innerHTML=(Array.isArray(orgs)?orgs:[]).map(o=>{const p=o.Photo&&o.Photo[0]&&((o.Photo[0].thumbnails&&o.Photo[0].thumbnails.large&&o.Photo[0].thumbnails.large.url)||o.Photo[0].url);const ini=(o.Nom||'?').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
      return `<li class="reveal"><div class="org"><span class="org-av">${p?`<img src="${esc(p)}" alt="" loading="lazy" />`:`<span aria-hidden="true">${esc(ini)}</span>`}</span><strong>${esc(o.Nom)}</strong></div></li>`;}).join('');
    observe();
  }catch(err){$('#list').innerHTML='<p class="empty">L\'agenda n\'a pas pu être chargé. Réessayez dans un instant.</p>';}
}
load();
})();
