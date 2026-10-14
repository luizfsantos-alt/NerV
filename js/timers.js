// Cronômetros e Wake Lock.
//
// Problema do app original: setInterval de 1s como fonte da verdade. Quando o
// celular bloqueia ou o app vai para segundo plano, o navegador estrangula os
// timers e a contagem atrasa minutos. Aqui o tempo real vem sempre de
// Date.now(); o intervalo só redesenha a tela.

import { sound, vibrate, motionOK, setRhythm, rhythm, setUrgent, setEcg } from './fx.js';
import { growVeins, clearVeins } from './veins.js';

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

// ===== timer de descanso (07 Taquicardia) =====
// Um só por vez, com alvo em timestamp — sobrevive à tela apagada.
//
// O descanso é um eletro correndo na velocidade do coração. Nos últimos 5 s o
// ritmo sobe. No zero, um único som (lub-dub), e a barra vira hemorragia: as
// veias crescem das bordas e pulsam cada vez mais rápido. Depois disso a
// cobrança é só vibração, para não brigar com a música de quem treina.
let restEndsAt = null;
let restTotal = 0;
let restHandle = null;
let restLabel = '';
let restDoneFired = false;
let restNextNag = 0;   // segundo de atraso em que cutucamos de novo
let rhythmBefore = null;

const NAG_EVERY = 15;  // s entre cutucadas (vibração)
const NAG_UNTIL = 180; // s de atraso: passando disso, só o visual insiste
const GIVE_UP = 300;   // s de atraso: descanso abandonado, a barra sai da tela

const $ = id => document.getElementById(id);
const mmss = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

function setText(node, txt) { if (node && node.textContent !== txt) node.textContent = txt; }

function paintRest() {
  const el = $('restBar');
  if (!el || !restEndsAt) return;
  const left = Math.ceil((restEndsAt - Date.now()) / 1000);

  if (left > 0) {
    setText($('restCount'), mmss(left));
    $('restLeft').style.transform = 'scaleX(' + Math.max(0, Math.min(1, left / restTotal)).toFixed(3) + ')';
    if (el.classList.contains('over')) clearOverState();
    if (left <= 5) setRhythm(88 + (6 - left) * 6, 'Descanso acabando');
    else setRhythm(88, 'Descanso');
    return;
  }

  const over = -left;
  setText($('restCount'), '+' + mmss(over));
  setRhythm(Math.min(180, 124 + over * 2.2), 'Taquicardia');

  if (!restDoneFired) {
    restDoneFired = true;
    restNextNag = NAG_EVERY;
    el.classList.add('over');
    setText($('restTag'), 'Estourado');
    setText($('restSkip'), 'Voltar');
    $('restSkip').title = 'Encerrar o descanso e voltar para a série';
    $('restLeft').style.transform = 'scaleX(1)';
    growVeins();
    $('veins').classList.add('on');
    setUrgent(true);
    sound('rest');
    vibrate([200, 100, 300]);
    if (motionOK()) el.querySelector('.r1').animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }],
      { duration: 240, easing: 'ease-out' });
  } else if (over >= restNextNag && over <= NAG_UNTIL) {
    // Cutucada periódica, só no corpo: não deixa o descanso virar intervalo.
    restNextNag = over + NAG_EVERY;
    vibrate([120, 80, 200]);
  }

  // Atraso longo demais — o descanso virou pausa: some com a barra em vez de
  // pulsar (e gastar bateria) para sempre.
  if (over >= GIVE_UP) stopRest();
}

function clearOverState() {
  const el = $('restBar');
  if (el) el.classList.remove('over');
  $('veins')?.classList.remove('on');
  setUrgent(false);
  setText($('restTag'), 'Descanso');
  setText($('restSkip'), 'Pular');
  if ($('restSkip')) $('restSkip').title = 'Pular descanso';
}

export function startRest(seconds, label) {
  const anterior = restHandle ? rhythmBefore : rhythm();
  stopRest();
  rhythmBefore = anterior;
  restTotal = Math.max(1, seconds || 60);
  restEndsAt = Date.now() + restTotal * 1000;
  restLabel = label || 'Descanso';
  restDoneFired = false;
  restNextNag = 0;
  clearVeins();
  setText($('restWho'), restLabel);
  $('restLeft').style.transform = 'scaleX(1)';
  $('restBar').classList.add('active');
  document.body.classList.add('resting');
  setEcg(true);
  paintRest();
  restHandle = setInterval(paintRest, 250);
  // Redesenha na hora ao voltar do bloqueio, sem esperar o próximo tick.
  document.addEventListener('visibilitychange', onVisible);
}

function onVisible() { if (!document.hidden && restHandle) paintRest(); }

export function stopRest() {
  const estava = !!restHandle;
  clearInterval(restHandle); restHandle = null;
  restEndsAt = null; restDoneFired = false; restNextNag = 0;
  document.removeEventListener('visibilitychange', onVisible);
  const el = $('restBar');
  if (el) { el.classList.remove('active'); clearOverState(); }
  document.body.classList.remove('resting');
  setEcg(false);
  if (estava && rhythmBefore) setRhythm(rhythmBefore.bpm, rhythmBefore.label);
  rhythmBefore = null;
}

export function addRestTime(sec) {
  if (!restEndsAt) return;
  // Com o tempo estourado, os segundos contam a partir de agora — somados ao
  // alvo vencido eles cairiam no passado e a barra seguiria em atraso.
  const estourado = restEndsAt <= Date.now();
  restEndsAt = Math.max(Date.now(), restEndsAt) + sec * 1000;
  restTotal = estourado ? sec : restTotal + sec;
  restDoneFired = false;
  restNextNag = 0;
  if (estourado) clearVeins();
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
