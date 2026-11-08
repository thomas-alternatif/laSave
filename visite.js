/* laSave — compteur de visites anonyme (aucun cookie, aucune donnée personnelle)
   Une visite = une session de navigation ; on note seulement d'où vient le visiteur. */
(() => {
  const API = 'https://go.la-save.fr';
  try {
    if (navigator.webdriver) return;                         // robots d'indexation
    if (sessionStorage.getItem('lasave_visite')) return;     // déjà comptée pendant cette session
    sessionStorage.setItem('lasave_visite', '1');
  } catch (_) { /* navigation privée : on compte quand même */ }
  let src = 'direct';
  try {
    const h = document.referrer ? new URL(document.referrer).hostname : '';
    if (!h) src = 'direct';
    else if (h === 'go.la-save.fr' || h === 'partage.la-save.fr' || /workers\.dev$/.test(h)) src = 'partage'; // lien partagé laSave (/e/…)
    else if (/(^|\.)la-save\.fr$/.test(h)) src = 'interne';        // lien partagé laSave (/e/…)
    else if (/google\./.test(h)) src = 'google';
    else if (/facebook|fb\.com|messenger/.test(h)) src = 'facebook';
    else if (/instagram/.test(h)) src = 'instagram';
    else if (/bing|duckduckgo|qwant|ecosia|yahoo|lilo/.test(h)) src = 'recherche';
    else if (/intramuros|mairie|linktr\.ee/.test(h)) src = 'mairie';
    else src = 'autre';
  } catch (_) {}
  const page = /^\/test\d+\//.test(location.pathname) ? 'test' : 'site';
  const body = JSON.stringify({ t: 'visite', id: page, c: src });
  try { if (!(navigator.sendBeacon && navigator.sendBeacon(API + '/stat', body))) fetch(API + '/stat', { method: 'POST', body, keepalive: true }); } catch (_) {}
})();
