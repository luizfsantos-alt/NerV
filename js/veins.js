// Hemorragia: veias que crescem das bordas quando o descanso estoura.
//
// Por baixo fica a imagem de vasos (assets/tex/veias.webp), revelada das
// bordas para dentro pelo CSS. Por cima, galhos procedurais que crescem trecho
// a trecho: curvas que afinam e se dividem em Y, com halo escuro e brilho
// úmido. O centro da tela, onde está o texto, fica limpo.

import { rng } from './cells.js';
import { motionOK } from './fx.js';

export function clearVeins() {
  const svg = document.getElementById('veinSvg');
  if (svg) svg.innerHTML = '';
}

export function growVeins() {
  const svg = document.getElementById('veinSvg');
  if (!svg) return;
  const W = window.innerWidth, H = window.innerHeight;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const r = rng(Date.now() % 100000 + 1), segs = [];
  const k = Math.min(1.6, Math.max(.8, W / 390));   // telas largas, galhos maiores

  function branch(x, y, ang, len, w0, depth, t0) {
    if (depth > 6 || len < 7 || w0 < .3) return;
    const n = 9, pts = [[x, y]], w1 = w0 * (.62 + r() * .12);
    let a = ang, turn = (r() - .5) * .3;
    for (let i = 1; i <= n; i++) {
      turn += (r() - .5) * .22; turn *= .8; a += turn;
      x += Math.cos(a) * len / n; y += Math.sin(a) * len / n; pts.push([x, y]);
    }
    const per = 34 + depth * 8;
    for (let i = 0; i < n; i++) {
      const m0 = i ? [(pts[i - 1][0] + pts[i][0]) / 2, (pts[i - 1][1] + pts[i][1]) / 2] : pts[0];
      const m1 = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
      const d = 'M' + m0[0].toFixed(1) + ' ' + m0[1].toFixed(1) + 'Q' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1) + ' ' + m1[0].toFixed(1) + ' ' + m1[1].toFixed(1);
      segs.push({ d, w: w0 + (w1 - w0) * i / n, t: t0 + i * per, dur: per + 20 });
    }
    // Ramo lateral fino, de vez em quando, no meio do caminho.
    if (r() < .45 && depth < 4) {
      const i = 3 + Math.floor(r() * 4), s = r() < .5 ? -1 : 1;
      branch(pts[i][0], pts[i][1], a + s * (.9 + r() * .5), len * .4, (w0 + (w1 - w0) * i / n) * .45, depth + 2, t0 + i * per);
    }
    // Bifurcação em Y, assimétrica: o galho dominante segue mais grosso e mais reto.
    const tEnd = t0 + n * per, s = r() < .5 ? -1 : 1, spread = .45 + r() * .35;
    branch(x, y, a + s * spread * .55, len * (.6 + r() * .12), w1 * .86, depth + 1, tEnd);
    branch(x, y, a - s * spread * 1.2, len * (.42 + r() * .14), w1 * .66, depth + 1, tEnd);
  }

  const roots = [
    [-4, H + 6, -.9, 95], [-4, H * .85, -.25, 70], [-4, H * .66, -.1, 45],
    [W + 4, H + 6, -2.25, 95], [W + 4, H * .82, -2.9, 70], [W + 4, H * .62, -3.05, 45],
    [W * .36, H + 6, -1.45, 60], [W * .64, H + 6, -1.7, 60],
  ];
  for (const [x, y, a, L] of roots) branch(x, y, a + (r() - .5) * .2, L * k * (.8 + r() * .4), (L > 60 ? 4.8 : 3.4) + r() * .8, 0, r() * 120);

  const layer = (stroke, op, wf, min) => segs.filter(g => g.w >= min).map(g =>
    `<path d="${g.d}" fill="none" stroke="${stroke}" stroke-opacity="${op}" stroke-width="${(g.w * wf).toFixed(2)}" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" data-t="${g.t}" data-u="${g.dur}"/>`).join('');
  svg.innerHTML = layer('#5a0612', .45, 2.2, 0) + layer('#FF2440', .8, 1, 0) + layer('#FFB3BC', .35, .22, 1.4);

  svg.querySelectorAll('path').forEach(p => {
    if (!motionOK()) { p.style.strokeDashoffset = 0; return; }
    p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: +p.dataset.u, delay: +p.dataset.t, easing: 'linear', fill: 'forwards' });
  });
}
