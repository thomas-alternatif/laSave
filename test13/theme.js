/* Applique le thème choisi avant l'affichage (évite un flash) */
try { if (localStorage.getItem('lasave_theme') === 'light') document.documentElement.setAttribute('data-theme', 'light'); } catch (e) {}
