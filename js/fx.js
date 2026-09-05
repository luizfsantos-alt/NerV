// Efeitos: canvas ambiente, vinhetas, som, vibração e o toggle FX.
//
// Mudanças em relação ao original: o loop do canvas PARA quando o FX está
// desligado ou o app vai para segundo plano (antes rodava a 60fps à toa,
// drenando bateria durante uma hora de treino), e o toggle agora controla
// mesmo todos os efeitos, via classe no <body>.

import { getFX, setFX } from './state.js';

export let fx = getFX();
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let rafId = null;
let visible = !document.hidden;

export function isFxOn() { return fx; }

function applyBodyClass() {
  document.body.classList.toggle('fx-off', !fx);
}

export function setupFX() {
  applyBodyClass();
  const btn = document.getElementById('fxToggle');
  const paint = () => {
    btn.innerHTML = fx
      ? '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg><span>FX</span>'
      : '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2"/></svg><span>FX</span>';
    btn.classList.toggle('off', !fx);
    btn.setAttribute('aria-pressed', String(fx));
    btn.title = fx ? 'Efeitos visuais ligados' : 'Efeitos visuais desligados';
  };
  paint();
  btn.onclick = () => {
    fx = !fx;
    setFX(fx);
    applyBodyClass();
    paint();
    fx ? startAmbient() : stopAmbient();
  };
}

// ===== canvas ambiente =====
let canvas, ctx, W = 0, H = 0, drops = [];

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function frame(t) {
  rafId = null;
  if (!fx || !visible) return;

  ctx.clearRect(0, 0, W, H);
  const beat = Math.sin(t / 500) * 0.5 + 0.5;
  const grd = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  grd.addColorStop(0, 'rgba(255,0,64,' + (0.04 + beat * 0.06) + ')');
  grd.addColorStop(1, 'rgba(255,0,64,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,0,64,0.4)';
  drops.forEach(d => {
    d.y += d.s;
    if (d.y > H) { d.y = -10; d.x = Math.random() * W; }
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  });

  if (Math.random() < 0.02) {
    ctx.strokeStyle = 'rgba(255,0,64,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const x = Math.random() * W;
    ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  rafId = requestAnimationFrame(frame);
}

function startAmbient() {
  if (rafId != null || !fx || !visible || reduceMotion) return;
  rafId = requestAnimationFrame(frame);
}

function stopAmbient() {
  if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
  if (ctx) ctx.clearRect(0, 0, W, H);
}

export function setupAmbient() {
  canvas = document.getElementById('ambient');
  ctx = canvas.getContext('2d');
  window.addEventListener('resize', resize);
  resize();
  const n = window.innerWidth < 500 ? 20 : 30;
  drops = Array.from({ length: n }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: Math.random() * 2.5 + 0.5, s: Math.random() * 0.6 + 0.2,
  }));
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    visible ? startAmbient() : stopAmbient();
  });
  startAmbient();
}

// ===== efeitos pontuais =====
export function redBlink(cb) {
  if (!fx) { cb && cb(); return; }
  const v = document.getElementById('vignette');
  v.classList.add('active');
  setTimeout(() => { v.classList.remove('active'); cb && cb(); }, 400);
}

export function flash() {
  if (!fx) return;
  const s = document.getElementById('scanline');
  s.classList.add('active');
  setTimeout(() => s.classList.remove('active'), 160);
}

/**
 * Tela de conquista. Sem PRs mostra "+1" rápido; com PRs mostra quais foram,
 * acorda o mascote do fundo e segura um pouco mais.
 */
export function singularity(prs, cb) {
  const list = prs || [];
  if (!fx) { cb && cb(); return; }

  const el = document.getElementById('singularity');
  const txt = el.querySelector('.singularity-text');
  const sub = el.querySelector('.singularity-sub');
  const det = el.querySelector('.singularity-list');

  if (list.length) {
    txt.textContent = 'PR';
    sub.textContent = list.length + ' RECORDE' + (list.length > 1 ? 'S' : '') + ' QUEBRADO' + (list.length > 1 ? 'S' : '');
    det.innerHTML = list.slice(0, 4).map(p =>
      p.nome.toUpperCase() + ' — ' + (p.tipo === 'carga'
        ? p.valor + ' KG'
        : '1RM ' + p.valor.toFixed(1) + ' KG')
    ).join('<br>');
    document.body.classList.add('mascot-hype');
    vibrate([60, 60, 60, 60, 220]);
  } else {
    txt.textContent = '+1';
    sub.textContent = 'SINGULARITY';
    det.innerHTML = '';
    vibrate(120);
  }

  el.classList.add('active');
  const hold = list.length ? 2600 : 1200;
  const close = () => {
    el.classList.remove('active');
    document.body.classList.remove('mascot-hype');
    el.removeEventListener('click', close);
    clearTimeout(timer);
    cb && cb();
  };
  const timer = setTimeout(close, hold);
  el.addEventListener('click', close); // dá para pular tocando na tela
}

// ===== feedback físico =====
export function vibrate(pattern) {
  try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {}
}

let audioCtx = null;
/** Bipe sintetizado — nenhum arquivo de áudio para baixar, funciona offline. */
export function beep(times = 1, freq = 880, dur = 0.14) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    for (let i = 0; i < times; i++) {
      const t0 = audioCtx.currentTime + i * (dur + 0.09);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    }
  } catch (e) { /* navegador sem áudio: a vibração já cobre */ }
}

/** iOS só libera áudio depois de um toque do usuário. */
export function primeAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
}
