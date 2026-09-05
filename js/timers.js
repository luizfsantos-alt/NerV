// Cronômetros e Wake Lock.
//
// Problema do app original: setInterval de 1s como fonte da verdade. Quando o
// celular bloqueia ou o app vai para segundo plano, o navegador estrangula os
// timers e a contagem atrasa minutos. Aqui o tempo real vem sempre de
// Date.now(); o intervalo só redesenha a tela.

import { beep, vibrate, flash } from './fx.js';

// ===== cronômetro de sessão =====
export class Stopwatch {
  constructor(onTick) {
    this.onTick = onTick;
    this.startedAt = null;
    this.accum = 0;      // segundos acumulados antes da última retomada
    this.handle = null;
  }
  get seconds() {
    const live = this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0;
    return Math.floor(this.accum + live);
  }
  start() {
    if (this.startedAt) return;
    this.startedAt = Date.now();
    this.handle = setInterval(() => this.onTick && this.onTick(this.seconds), 250);
    this.onTick && this.onTick(this.seconds);
  }
  pause() {
    if (!this.startedAt) return;
    this.accum += (Date.now() - this.startedAt) / 1000;
    this.startedAt = null;
    clearInterval(this.handle); this.handle = null;
    this.onTick && this.onTick(this.seconds);
  }
  get running() { return !!this.startedAt; }
  toggle() { this.running ? this.pause() : this.start(); }
  stop() { this.pause(); }
  reset() { this.stop(); this.accum = 0; }
}

// ===== timer de descanso =====
// Um só por vez, com alvo em timestamp — sobrevive à tela apagada.
//
// Estourar o tempo não é conquista: cada segundo a mais é corpo mole. Por isso
// não existe estado "descanso completo" em verde — ao zerar, a barra passa a
// contar o atraso para cima, pulsa em vermelho cada vez mais rápido e cutuca de
// tempos em tempos até você voltar para a série.
let restEndsAt = null;
let restTotal = 0;
let restHandle = null;
let restLabel = '';
let restDoneFired = false;
let restNextNag = 0;   // segundo de atraso em que cutucamos de novo
let restPulse = '';    // duração de pulsação já aplicada no CSS

const NAG_EVERY = 15;  // s entre cutucadas
const NAG_UNTIL = 180; // s de atraso: passando disso, só o visual insiste
const GIVE_UP = 300;   // s de atraso: descanso abandonado, a barra sai da tela

const bar = () => document.getElementById('restBar');

const mmss = s => (s < 60
  ? String(s).padStart(2, '0')
  : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'));

// A cobrança sobe junto com o atraso. Frases curtas: a barra é uma linha só.
function overMessage(over) {
  if (over < 15) return 'volta pra série';
  if (over < 45) return 'corpo mole · volta';
  return 'levanta · agora';
}

function setText(node, txt) { if (node.textContent !== txt) node.textContent = txt; }

function paintRest() {
  const el = bar();
  if (!el) return;
  const left = Math.round((restEndsAt - Date.now()) / 1000);
  const count = el.querySelector('.rest-count');
  const text = el.querySelector('.rest-text');
  const fill = el.querySelector('.rest-progress > i');
  const skip = document.getElementById('restSkip');

  if (left > 0) {
    setText(count, mmss(left));
    setText(text, restLabel);
    fill.style.width = (100 - (left / restTotal) * 100).toFixed(1) + '%';
    if (el.classList.contains('over')) clearOverState(el, skip);
    return;
  }

  const over = -left;
  setText(count, '+' + mmss(over));
  setText(text, overMessage(over));
  fill.style.width = '100%';
  el.classList.add('over');
  document.body.classList.add('rest-over');
  if (skip) {
    setText(skip, 'VOLTAR');
    skip.title = 'Encerrar o descanso e voltar para a série';
  }

  // Quanto maior o atraso, mais rápida a pulsação (1.10s → 0.45s em 1 minuto).
  const dur = (1.1 - Math.min(over, 60) / 60 * 0.65).toFixed(2) + 's';
  // Vai no <body> para valer também no pulso da tela inteira (CSS).
  if (dur !== restPulse) { restPulse = dur; document.body.style.setProperty('--rest-pulse', dur); }

  if (!restDoneFired) {
    restDoneFired = true;
    restNextNag = NAG_EVERY;
    // Sinal triplo: som, vibração e flash — para funcionar com o celular
    // no bolso, na mão ou no chão.
    beep(3, 980);
    vibrate([200, 100, 200, 100, 300]);
    flash();
  } else if (over >= restNextNag && over <= NAG_UNTIL) {
    // Cutucada periódica: não deixa o descanso virar intervalo de novela.
    restNextNag = over + NAG_EVERY;
    beep(2, 1180);
    vibrate([120, 80, 200]);
    flash();
  }

  // Atraso longo demais — o descanso virou pausa: some com a barra em vez de
  // pulsar (e gastar bateria) para sempre.
  if (over >= GIVE_UP) stopRest();
}

function clearOverState(el, skip) {
  el.classList.remove('over');
  document.body.classList.remove('rest-over');
  document.body.style.removeProperty('--rest-pulse');
  restPulse = '';
  const btn = skip || document.getElementById('restSkip');
  if (btn) {
    setText(btn, 'PULAR');
    btn.title = 'Pular descanso';
  }
}

export function startRest(seconds, label) {
  stopRest();
  restTotal = Math.max(1, seconds || 60);
  restEndsAt = Date.now() + restTotal * 1000;
  restLabel = label || 'Descanso';
  restDoneFired = false;
  restNextNag = 0;
  const el = bar();
  el.classList.add('active');
  document.body.classList.add('resting');
  paintRest();
  restHandle = setInterval(paintRest, 250);
  // Redesenha na hora ao voltar do bloqueio, sem esperar o próximo tick.
  document.addEventListener('visibilitychange', onVisible);
}

function onVisible() { if (!document.hidden && restHandle) paintRest(); }

export function stopRest() {
  clearInterval(restHandle); restHandle = null;
  restEndsAt = null; restDoneFired = false; restNextNag = 0;
  document.removeEventListener('visibilitychange', onVisible);
  const el = bar();
  if (el) { el.classList.remove('active'); clearOverState(el); }
  document.body.classList.remove('resting');
}

export function addRestTime(sec) {
  if (!restEndsAt) return;
  // Com o tempo estourado, os segundos contam a partir de agora — somados ao
  // alvo vencido eles cairiam no passado e a barra seguiria em atraso.
  restEndsAt = Math.max(Date.now(), restEndsAt) + sec * 1000;
  restTotal += sec;
  restDoneFired = false;
  restNextNag = 0;
  paintRest();
}

export function isResting() { return !!restHandle; }

// ===== Wake Lock =====
// Sem isso a tela apaga no meio da série e você perde o cronômetro de vista.
let wakeLock = null;

export async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return false;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
    document.addEventListener('visibilitychange', reacquire);
    return true;
  } catch (e) {
    return false;
  }
}

async function reacquire() {
  // O sistema solta o lock ao minimizar; precisamos pedir de novo na volta.
  if (!document.hidden && wakeLock === null && document.body.dataset.wantWakeLock === '1') {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
  }
}

export function releaseWakeLock() {
  document.body.dataset.wantWakeLock = '0';
  document.removeEventListener('visibilitychange', reacquire);
  try { wakeLock && wakeLock.release(); } catch (e) {}
  wakeLock = null;
}

export function keepScreenOn(on) {
  document.body.dataset.wantWakeLock = on ? '1' : '0';
  if (on) return acquireWakeLock();
  releaseWakeLock();
  return Promise.resolve(false);
}
