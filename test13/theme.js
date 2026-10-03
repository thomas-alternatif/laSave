/* Le site n'existe plus qu'en sombre : on efface un ancien choix « clair » resté dans le navigateur */
try { localStorage.removeItem('lasave_theme'); document.documentElement.removeAttribute('data-theme'); } catch (e) {}
