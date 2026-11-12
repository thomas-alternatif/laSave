/* laSave — transitions entre les sections de l'accueil.
   Au fil du défilement, la section qu'on quitte s'efface en douceur (elle remonte et rétrécit un peu),
   et la suivante apparaît en fondu (elle monte et grossit jusqu'à sa taille). Rien n'est lu ni écrit en dehors de l'écran :
   les sections sont toujours complètes quand elles sont au milieu de l'écran. Désactivé pour « réduire les animations »,
   en mode calme et dans l'espace d'édition. */
(() => {
  if (/[?&]edit=1(&|$)/.test(location.search)) return;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.matches) return;
  const SEL = '#view-home > .hero, #view-home > section.flow, #rows .row-sec, #home-polls, #view-home > section.orgs, #view-home > .bento';
  const clamp = v => Math.max(0, Math.min(1, v));
  const ease = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  const touched = new Set();
  let raf = 0, last = '';

  function clear(el) { el.style.removeProperty('opacity'); el.style.removeProperty('translate'); el.style.removeProperty('scale'); el.style.removeProperty('pointer-events'); touched.delete(el); }
  function frame() {
    raf = 0;
    const calm = window.__lasaveMotion && window.__lasaveMotion.still;
    if (calm || !document.getElementById('view-home') || document.getElementById('view-home').hidden || document.getElementById('view-home').offsetHeight === 0) { touched.forEach(clear); return; }
    const vh = window.innerHeight, k = vh < 720 || window.innerWidth < 720 ? 0.7 : 1;
    document.querySelectorAll(SEL).forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.height) return;
      if (r.bottom < -vh * .2 || r.top > vh * 1.2) { // bien hors de l'écran : état de repos selon le côté
        if (r.top > vh * 1.2) { el.style.setProperty('opacity', '0'); el.style.setProperty('pointer-events', 'none'); touched.add(el); }
        else { el.style.setProperty('opacity', '0'); el.style.setProperty('pointer-events', 'none'); touched.add(el); }
        return;
      }
      const pin = ease((vh * .98 - r.top) / (vh * .40));   // arrive : 0 quand le haut touche le bas de l'écran, 1 quand il est monté de 40 %
      const pout = ease((r.bottom - vh * .05) / (vh * .35)); // part : 1 tant que le bas dépasse 40 % de l'écran, 0 quand il atteint le haut
      if (pin >= .999 && pout >= .999) { if (touched.has(el)) clear(el); return; }
      const o = pin * pout, y = (1 - pin) * 38 * k - (1 - pout) * 30 * k, s = 1 - (1 - pin) * .03 - (1 - pout) * .035;
      el.style.setProperty('opacity', o.toFixed(3));
      el.style.setProperty('translate', '0 ' + y.toFixed(1) + 'px');
      el.style.setProperty('scale', s.toFixed(4));
      if (o < .04) el.style.setProperty('pointer-events', 'none'); else el.style.removeProperty('pointer-events');
      touched.add(el);
    });
    // la flèche « découvrir » s'efface dès qu'on commence à descendre
    const fl = document.getElementById('hero-down');
    if (fl) { const o = clamp(1 - window.scrollY / (vh * .18)); fl.style.setProperty('opacity', o.toFixed(2)); fl.style.pointerEvents = o < .05 ? 'none' : ''; }
  }
  const ask = () => { if (!raf) raf = requestAnimationFrame(frame); };
  window.addEventListener('scroll', ask, { passive: true });
  window.addEventListener('resize', ask);
  window.addEventListener('hashchange', () => setTimeout(ask, 60));
  window.addEventListener('load', () => { ask(); setTimeout(ask, 1200); setTimeout(ask, 3500); });
  mq.addEventListener && mq.addEventListener('change', e => { if (e.matches) { touched.forEach(clear); } });
  document.addEventListener('DOMContentLoaded', ask);
  ask();
})();
