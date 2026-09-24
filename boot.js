/* laSave — scripts de démarrage (sortis du HTML pour la politique de sécurité CSP) */
/* Filet de sécurité : l'écran d'ouverture ne reste jamais bloqué */setTimeout(function(){var s=document.getElementById('splash');if(s)s.classList.add('out');},9000);

(function(){
  var cv = document.getElementById('bg-light');
  if (!cv || !cv.getContext) return;
  var mq = window.matchMedia('(prefers-color-scheme:light)');
  var ctx = cv.getContext('2d');
  var W, H;
  function resize(){ W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  var COLS = 28, ROWS = 18;
  function draw(t){
    if (window.__motionPaused || document.documentElement.classList.contains('motion-paused')){ requestAnimationFrame(draw); return; }
    if (!mq.matches){ cv.style.display='none'; return; }
    cv.style.display='block';
    // Fond dégradé: bleu-lavande → gris perle (pas de rosé)
    var bg = ctx.createLinearGradient(0, H * 0.85, W * 0.9, H * 0.05);
    bg.addColorStop(0,   'hsl(222,28%,83%)');
    bg.addColorStop(0.4, 'hsl(224,16%,92%)');
    bg.addColorStop(0.75,'hsl(220,8%,96%)');
    bg.addColorStop(1,   'hsl(215,12%,93%)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // Calcul des points du maillage déformés par une vague diagonale
    var pts = [], r, c;
    for (r = 0; r <= ROWS; r++){
      pts[r] = [];
      for (c = 0; c <= COLS; c++){
        var px = (c / COLS) * W;
        var py = (r / ROWS) * H;
        var u = c / COLS - r / ROWS;           // axe diagonal
        var phase = u * Math.PI * 3 - t * 0.0006;
        var amp = Math.sin(phase) * H * 0.13;
        pts[r][c] = {
          x: px - amp * 0.42,
          y: py + amp,
          bright: (Math.sin(phase + 0.4) + 1) * 0.5
        };
      }
    }
    // Tracé du maillage — flou + discret
    ctx.filter = 'blur(2px)';
    ctx.lineWidth = 0.5;
    for (r = 0; r <= ROWS; r++){
      for (c = 0; c <= COLS; c++){
        var p = pts[r][c];
        var a = (0.03 + p.bright * 0.22).toFixed(2);
        ctx.strokeStyle = 'rgba(255,255,255,' + a + ')';
        if (c < COLS){
          ctx.beginPath(); ctx.moveTo(p.x, p.y);
          ctx.lineTo(pts[r][c+1].x, pts[r][c+1].y); ctx.stroke();
        }
        if (r < ROWS){
          ctx.beginPath(); ctx.moveTo(p.x, p.y);
          ctx.lineTo(pts[r+1][c].x, pts[r+1][c].y); ctx.stroke();
        }
      }
    }
    ctx.filter = 'none';
  }
  var t0 = null;
  function loop(ts){ if (!t0) t0 = ts; draw(ts - t0); requestAnimationFrame(loop); }
  mq.addEventListener('change', function(e){ if (!e.matches) cv.style.display='none'; });
  requestAnimationFrame(loop);
})();
