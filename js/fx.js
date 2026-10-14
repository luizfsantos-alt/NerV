// Efeitos: o coração, a varredura, a leitura, o som, a vibração e a Mutação.
//
// Um laço só (requestAnimationFrame) escreve --beat no <html> a cada quadro, e
// tudo o que respira lê essa variável: a membrana do fundo, a marca, a célula
// da próxima série, as veias. O ritmo conta a história do treino: 52 bpm em
// repouso, 88 treinando, sobe no fim do descanso e dispara quando ele estoura.
//
// Sedar (o antigo FX) desliga o ambiente: o coração para, nada varre nem
// embaralha. O feedback de toque (contração, encistamento) continua, porque é
// ele que confirma que a série fechou. "Menos movimento" no sistema desliga as
// duas coisas, mas a cobrança do descanso estourado nunca depende só de cor ou
// de movimento: tem rótulo e vibração.

import { getFX, setFX } from './state.js';

export let fx = getFX();
const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

export function isFxOn() { return fx; }
/** Animações de feedback (contração, encistamento, lâminas). */
export function motionOK() { return !mqReduce.matches; }
/** Ambiente: coração, varredura, leitura embaralhada. */
export function ambient() { return fx && !mqReduce.matches; }

function applyBodyClass() { document.body.classList.toggle('fx-off', !fx); }

export function setupFX() {
  applyBodyClass();
  const btn = document.getElementById('fxToggle');
  const paint = () => {
    btn.setAttribute('aria-pressed', String(!fx));
    btn.title = fx ? 'Sedar: desliga os efeitos de ambiente' : 'Sedado: toque para acordar o organismo';
  };
  paint();
  btn.onclick = async () => {
    fx = !fx;
    setFX(fx);
    applyBodyClass();
    paint();
    const { toast } = await import('./ui.js');
    toast(fx ? 'Organismo acordado' : 'Sedado: ambiente desligado');
  };
}

// ===== 01 Pulso: o coração =====
let bpm = 52, bpmTarget = 52, phase = 0, last = 0, rafId = null;
let rhythmLabel = 'Organismo em repouso';
let urgent = false;      // descanso estourado: bate mesmo sedado
let ecgOn = false, ecgX = 0;
const gauss = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));
const beatCurve = p => Math.max(gauss(p, .06, .035), .62 * gauss(p, .24, .04));
const root = document.documentElement;

function frame(t) {
  rafId = null;
  if (document.hidden) return;
  const dt = Math.min(.1, (t - (last || t)) / 1000); last = t;
  bpm += (bpmTarget - bpm) * Math.min(1, dt * 1.6);
  phase = (phase + dt * bpm / 60) % 1;
  const live = ambient() || (urgent && motionOK());
  root.style.setProperty('--beat', live ? beatCurve(phase).toFixed(3) : '0');
  if (ecgOn && motionOK()) {
    ecgX = (ecgX + dt * bpm / 60 * 78) % 78;
    const ecg = document.getElementById('ecg');
    if (ecg) ecg.style.transform = 'translateX(' + (-ecgX).toFixed(1) + 'px)';
  }
  const shown = Math.round(bpm) + ' BPM';
  document.querySelectorAll('.bpm-out').forEach(el => { if (el.textContent !== shown) el.textContent = shown; });
  // Parado e em repouso não há o que desenhar: o laço dorme até o próximo ritmo.
  if (!live && !ecgOn && Math.abs(bpm - bpmTarget) < .5) { last = 0; return; }
  rafId = requestAnimationFrame(frame);
}

function wake() { if (rafId == null && !document.hidden) rafId = requestAnimationFrame(frame); }

export function setupHeart() {
  // Traçado do eletro: um complexo P-QRS-T a cada 78 px, repetido para rolar.
  const path = document.querySelector('#ecg path');
  if (path) {
    let d = 'M0 22'; const P = 78;
    for (let x = 0; x < 780; x += P) d += ' H' + (x + 26) + ' l4 -4 4 4 H' + (x + 44) + ' l3 5 5 -21 6 26 4 -10 H' + (x + P);
    path.setAttribute('d', d);
  }
  document.addEventListener('visibilitychange', () => { last = 0; wake(); });
  mqReduce.addEventListener?.('change', wake);
  wake();
}

/** Muda o ritmo do coração (e o estado no topo). */
export function setRhythm(target, label) {
  bpmTarget = target;
  if (label) {
    rhythmLabel = label;
    const el = document.getElementById('roState');
    if (el) el.textContent = label;
  }
  wake();
}
export function rhythm() { return { bpm: bpmTarget, label: rhythmLabel }; }
export function setUrgent(on) { urgent = on; wake(); }
export function setEcg(on) { ecgOn = on; wake(); }
/** Na Abertura (C), o primeiro batimento acontece logo. */
export function firstBeat() { phase = .98; wake(); }

// ===== 02 Varredura =====
export function scan(target) {
  const beam = document.getElementById('beam');
  if (!target || !ambient()) return;
  const top = target.getBoundingClientRect().top;
  const h = Math.max(0, window.innerHeight - top);
  beam.style.top = top + 'px';
  target.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], { duration: 560, easing: 'cubic-bezier(.2,0,0,1)' });
  beam.animate([
    { transform: 'translateY(0)', opacity: 1 },
    { transform: `translateY(${h}px)`, opacity: 1, offset: .92 },
    { transform: `translateY(${h}px)`, opacity: 0 },
  ], { duration: 560, easing: 'cubic-bezier(.2,0,0,1)' });
}

// ===== 03 Leitura =====
// Quando um número muda por um evento, os dígitos embaralham e estabilizam da
// esquerda para a direita. O cronômetro não usa: ele só troca.
export function read(el, text, animate = true) {
  if (!el) return;
  text = String(text);
  if (!animate || !ambient() || el.textContent === text) { el.textContent = text; return; }
  const prev = el.textContent;
  el.textContent = '';
  const spans = [...text].map((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch; el.appendChild(s);
    if (ch === prev[i] || !/[0-9]/.test(ch)) return null;
    return { s, ch, end: 260 + i * 40 };
  }).filter(Boolean);
  const t0 = performance.now();
  (function step(t) {
    let live = false;
    for (const o of spans) {
      if (t - t0 < o.end) { live = true; o.s.textContent = (Math.random() * 10) | 0; o.s.style.color = 'var(--corante)'; }
      else { o.s.textContent = o.ch; o.s.style.color = ''; }
    }
    if (live && el.isConnected) requestAnimationFrame(step); else el.textContent = text;
  })(t0);
}

// ===== feedback físico =====
export function vibrate(pattern) {
  try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {}
}

// ===== som: um momento só =====
// Quem treina ouve música. O app só soa no fim do descanso (lub-dub curto).
// Fechar série, encistar, navegar, avisos e a Mutação não fazem som; a
// cobrança do descanso estourado é só vibração.
let audioCtx = null;
export function sound(kind) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const ac = audioCtx, t = ac.currentTime, out = ac.createGain();
    out.gain.value = .5; out.connect(ac.destination);
    const tone = (f, at, dur, type = 'sine', g = .6, f2) => {
      const o = ac.createOscillator(), v = ac.createGain(); o.type = type;
      o.frequency.setValueAtTime(f, t + at);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + at + dur);
      v.gain.setValueAtTime(.0001, t + at);
      v.gain.exponentialRampToValueAtTime(g, t + at + .008);
      v.gain.exponentialRampToValueAtTime(.0001, t + at + dur);
      o.connect(v); v.connect(out); o.start(t + at); o.stop(t + at + dur + .02);
    };
    if (kind === 'rest') {          // lub-dub com clique
      tone(190, 0, .16, 'sine', .9, 70); tone(1400, 0, .02, 'square', .12);
      tone(160, .2, .14, 'sine', .6, 60); tone(1200, .2, .018, 'square', .08);
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

// ===== 08 Mutação =====
// Fim de treino ou de corrida. Sem recorde, um "+1". Com recorde, a tela
// esquenta de baixo para cima por toda a rampa térmica até o branco, a célula
// se divide, a palavra estica até o limite da fonte e as conquistas entram uma
// a uma, cada uma com um toque de vibração. Não há som: quem treina ouve música.

const PASSO_CONQUISTA = 900;   // ms entre uma conquista e a próxima
const LEITURA = 3200;          // ms de tela parada depois da última, para ler
let mutOpen = false;
let mutSeed = 23;

export function mutation(prs, cb) {
  const list = prs || [];
  const m = document.getElementById('mut');
  if (!m || mutOpen) { cb && cb(); return; }
  mutOpen = true;
  const word = m.querySelector('#mutWord'), heat = m.querySelector('#mutHeat');
  const pr = list.length > 0;

  word.textContent = pr ? 'Mutação' : '+1';
  m.querySelector('#mutSub').textContent = pr
    ? list.length + (list.length > 1 ? ' recordes quebrados' : ' recorde quebrado')
    : 'Sessão registrada';
  const listEl = m.querySelector('#mutList');
  listEl.innerHTML = '';
  const itens = list.slice(0, 6);
  itens.forEach(p => {
    const d = document.createElement('div');
    d.append(p.nome.toUpperCase() + ' · ');
    const b = document.createElement('b');
    b.textContent = valorPR(p);
    d.append(b);
    listEl.append(d);
  });

  m.classList.add('on');
  vibrate(pr ? [60, 60, 60, 60, 220] : 120);
  const prev = rhythm();
  setRhythm(pr ? 168 : 120, pr ? 'Mutação' : 'Sessão registrada');

  // A célula alinha os cromossomos e se divide.
  const cel = m.querySelector('#mutCel'), crom = m.querySelector('#mutCrom'), mit = m.querySelector('#mutMit');
  const toques = [];
  const final = () => { cel.style.opacity = '0'; crom.style.opacity = '0'; mit.style.opacity = '1'; };
  // O calor é só do recorde; sem ele, a divisão acontece no escuro.
  heat.style.opacity = pr ? '' : '0';
  if (!motionOK()) {
    heat.style.backgroundPosition = pr ? '0 50%' : '0 -100%';
    final();
  } else {
    heat.style.backgroundPosition = '';
    if (pr) {
      heat.animate([
        { backgroundPosition: '0 -100%', opacity: 1 }, { backgroundPosition: '0 0%', opacity: 1, offset: .45 },
        { backgroundPosition: '0 0%', opacity: 1, offset: .55 }, { backgroundPosition: '0 70%', opacity: .7 },
      ], { duration: 1400, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' });
      m.animate([{ backgroundColor: '#0C0709' }, { backgroundColor: '#FFF2D2', offset: .5 }, { backgroundColor: '#0C0709' }], { duration: 1400, easing: 'ease-in-out' });
      word.animate([{ color: '#1A0E0A' }, { color: '#1A0E0A', offset: .4 }, { color: '#EEE3CA' }], { duration: 1300 });
    }
    word.animate([
      { fontStretch: '50%', letterSpacing: '.3em', opacity: 0 },
      { fontStretch: '128%', letterSpacing: '0em', opacity: 1, offset: .55 },
      { fontStretch: '72%', letterSpacing: '.01em', opacity: 1 },
    ], { duration: 900, delay: pr ? 300 : 0, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' });
    const t0 = pr ? 250 : 0, k = pr ? 1 : .6;   // sem recorde, a mesma divisão, mais curta
    cel.animate([
      { opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)', offset: .2 },
      { opacity: 1, transform: 'scale(1.05, .95)', offset: .6 }, { opacity: 0, transform: 'scale(1.4, .8)' },
    ], { duration: 1000 * k, delay: t0, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' });
    crom.animate([
      { opacity: 0, transform: 'scaleX(.3) scaleY(.6)' }, { opacity: .95, transform: 'scaleX(.55) scaleY(.7)', offset: .45 },
      { opacity: 0, transform: 'scaleX(1.1) scaleY(.4)' },
    ], { duration: 900 * k, delay: t0 + 250 * k, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' });
    mit.animate([
      { opacity: 0, transform: 'scale(.5, .8)' }, { opacity: 1, transform: 'scale(1.12, .95)', offset: .6 },
      { opacity: 1, transform: 'scale(1)' },
    ], { duration: 700 * k, delay: t0 + 700 * k, easing: 'cubic-bezier(.5,1.4,.4,1)', fill: 'both' });
    // Uma conquista por vez, depois da divisão.
    [...listEl.children].forEach((d, k) => {
      const t = 1500 + k * PASSO_CONQUISTA;
      d.animate([
        { opacity: 0, transform: 'translateY(10px) scale(.96)' },
        { opacity: 1, transform: 'translateY(-2px) scale(1.04)', offset: .6 },
        { opacity: 1, transform: 'none' },
      ], { duration: 420, delay: t, fill: 'backwards', easing: 'cubic-bezier(.2,0,0,1)' });
      toques.push(setTimeout(() => vibrate(35), t));
    });
  }

  const close = () => {
    if (!mutOpen) return;
    mutOpen = false;
    clearTimeout(timer);
    toques.forEach(clearTimeout);
    m.onclick = null;
    const fin = () => {
      m.classList.remove('on');
      m.getAnimations({ subtree: true }).forEach(a => a.cancel());
      [cel, crom, mit, heat].forEach(el => { el.style.opacity = ''; });
      setRhythm(prev.bpm > 100 ? 52 : prev.bpm, 'Organismo em repouso');
      cb && cb();
    };
    if (!motionOK()) fin();
    else m.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)' }).onfinish = fin;
  };
  const timer = setTimeout(close, pr ? 1500 + itens.length * PASSO_CONQUISTA + LEITURA : 3000);
  m.onclick = close;   // dá para pular tocando na tela
}

function fmtKg(v, dec = 0) {
  return (dec ? v.toFixed(dec) : String(v)).replace('.', ',') + ' KG';
}

/** Texto de uma conquista: carga, 1RM, pace ou distância. */
function valorPR(p) {
  if (p.tipo === 'carga') return fmtKg(p.valor);
  if (p.tipo === '1rm') return '1RM ' + fmtKg(p.valor, 1);
  if (p.tipo === 'pace') {
    const s = Math.round(p.valor);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' /KM';
  }
  if (p.tipo === 'distancia') return p.valor.toFixed(2).replace('.', ',') + ' KM';
  return String(p.valor);
}
