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
let restEndsAt = null;
let restTotal = 0;
let restHandle = null;
let restLabel = '';
let restDoneFired = false;

const bar = () => document.getElementById('restBar');

function paintRest() {
  const el = bar();
  if (!el) return;
  const left = Math.max(0, Math.round((restEndsAt - Date.now()) / 1000));
  const count = el.querySelector('.rest-count');
  const meta = el.querySelector('.rest-meta');
  const fill = el.querySelector('.rest-progress > i');

  if (left > 0) {
    count.textContent = left < 60
      ? String(left).padStart(2, '0')
      : Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
    meta.firstChild.textContent = restLabel;
    fill.style.width = (100 - (left / restTotal) * 100).toFixed(1) + '%';
    el.classList.remove('done');
  } else {
    count.textContent = 'GO';
    meta.firstChild.textContent = restLabel + ' · descanso completo';
    fill.style.width = '100%';
    el.classList.add('done');
    if (!restDoneFired) {
      restDoneFired = true;
      // Sinal triplo: som, vibração e flash — para funcionar com o celular
      // no bolso, na mão ou no chão.
      beep(3, 980);
      vibrate([200, 100, 200, 100, 300]);
      flash();
    }
    if (left < -8) stopRest();
  }
}

export function startRest(seconds, label) {
  stopRest();
  restTotal = Math.max(1, seconds || 60);
  restEndsAt = Date.now() + restTotal * 1000;
  restLabel = label || 'Descanso';
  restDoneFired = false;
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
  restEndsAt = null; restDoneFired = false;
  document.removeEventListener('visibilitychange', onVisible);
  const el = bar();
  if (el) { el.classList.remove('active', 'done'); }
  document.body.classList.remove('resting');
}

export function addRestTime(sec) {
  if (!restEndsAt) return;
  restEndsAt += sec * 1000;
  restTotal += sec;
  restDoneFired = false;
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
