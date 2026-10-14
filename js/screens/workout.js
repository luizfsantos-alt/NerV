// Execução do treino.
//
// Principais correções em relação ao original:
//  - a carga sugerida vem da ÚLTIMA sessão (série a série), não do PR histórico;
//  - o cronômetro é baseado em timestamp e sobrevive à tela bloqueada;
//  - o descanso é uma barra fixa única, com som/vibração e +30s;
//  - a tela não apaga no meio do treino (Wake Lock);
//  - sair com treino em andamento pede confirmação;
//  - a Mutação só esquenta a tela quando há recorde de verdade;
//  - cada série é uma célula: fechar a série a divide em duas (Contração) e
//    uma faísca desce até a próxima (Impulso);
//  - exercício com todas as séries fechadas encista: o card contrai numa fenda
//    de luz e vira uma cápsula, que reabre no toque.

import { state, saveState } from '../state.js';
import { escapeHtml, fmtTime, uid, num, repsToNumber, volumeOfSets } from '../util.js';
import { ICON, confirmDialog, toast } from '../ui.js';
import { Stopwatch, startRest, stopRest, isResting, keepScreenOn } from '../timers.js';
import { mutation, vibrate, motionOK, read, setRhythm } from '../fx.js';
import { cellHTML, mitoseHTML, divide } from '../cells.js';
import { suggestSets, detectPRs, lastPerformance } from '../progress.js';
import { go, back, setBeforeLeave } from '../router.js';
import { findFicha } from './treinos.js';

let sessao = null;      // { ficha, treino, exercicios[], watch, salvo }

export function activeSession() { return sessao; }

export function screenWorkout(params, el) {
  const ficha = findFicha(params.id);
  const treino = ficha && ficha.treinos.find(t => t.id === params.sub);
  if (!ficha || !treino) { go('/fichas', { replace: true }); return; }

  // Retomar a sessão em curso se o usuário só navegou e voltou.
  const mesma = sessao && sessao.treino.id === treino.id && !sessao.salvo;
  if (!mesma) {
    stopRest();
    sessao = {
      ficha, treino, salvo: false,
      exercicios: treino.exercicios.map(ex => {
        const sug = suggestSets(ex);
        return {
          nome: ex.nome, series: ex.series, reps: ex.reps, intervalo: ex.intervalo,
          progressed: sug.progressed,
          last: sug.last,
          sets: sug.sets.map(carga => ({ carga, reps: '', done: false })),
        };
      }),
      watch: new Stopwatch(sec => {
        const t = document.getElementById('workoutTimer');
        if (t) t.textContent = fmtTime(sec);
      }),
      alvoVolume: volumeAlvo(treino),
    };
    sessao.watch.start();
    keepScreenOn(true);
  }

  if (!isResting()) setRhythm(88, 'Sessão em leitura');
  paint(el);
  guardExit();
}

/**
 * Volume de referência para o termômetro: a última sessão deste treino ou,
 * sem histórico, o que a ficha prescreve (carga × reps alvo).
 */
function volumeAlvo(treino) {
  const anterior = [...state.workoutHistory].reverse().find(h => h.treino === treino.nome);
  if (anterior) {
    const v = anterior.exercicios.reduce((a, ex) => a + volumeOfSets(ex.sets), 0);
    if (v > 0) return v;
  }
  const prescrito = treino.exercicios.reduce((a, ex) =>
    a + (num(ex.carga) || 0) * repsToNumber(ex.reps) * (ex.series || 0), 0);
  return prescrito > 0 ? prescrito : null;
}

const pad2 = n => String(n).padStart(2, '0');
const reps = r => escapeHtml(String(r || '')).replace('-', '–');

function paint(el) {
  const { treino, exercicios, watch } = sessao;
  let html = '<div class="back" id="back" role="link" tabindex="0">' + ICON.back + escapeHtml(sessao.ficha.nome) + '</div>';
  html += '<h2>' + escapeHtml(treino.nome) + '</h2>';
  html += '<div class="sess">' +
    '<button class="clock' + (watch.running ? '' : ' paused') + '" type="button" id="clock" aria-label="Tempo de sessão. Toque para pausar ou continuar.">' +
      '<svg viewBox="0 0 220 92" fill="none" aria-hidden="true">' +
        '<path d="M22 46c1-17 38-31 82-31s88 13 88 31-42 31-86 31-85-14-84-31z" stroke="#6A45A8" stroke-opacity=".5"/>' +
        '<path d="M14 50c4-22 48-38 96-37s92 16 90 36" stroke="#6A45A8" stroke-opacity=".3" stroke-dasharray="2 5"/>' +
      '</svg>' +
      '<span id="workoutTimer">' + fmtTime(watch.seconds) + '</span>' +
    '</button>' +
    '<div class="lbl"><span id="pSets" class="rd">0 / 0</span> séries<br>amostra <span id="pAm">01</span> / ' + pad2(exercicios.length) + '<br><span id="timerSub">' + (watch.running ? 'em leitura' : 'pausado') + '</span></div>' +
  '</div>';
  html += '<div class="therm"><div class="bar"><div class="fill" id="heat"></div></div>' +
    '<div class="l lbl"><span>Temperatura · volume</span><span><b id="pVol" class="rd">0 kg</b> · <span id="pHeat">frio</span></span></div></div>';

  exercicios.forEach((ex, i) => {
    const completo = ex.sets.length > 0 && ex.sets.every(s => s.done);
    html += '<div class="ex' + (ex.collapsed ? ' cyst' : '') + (completo ? ' all-done' : '') + '" data-ex="' + i + '">';
    html += '<div class="card">';
    html += '<div class="card-tag" data-tag>Amostra ' + pad2(i + 1) + ' · ' + (completo ? 'lida' : 'em leitura') + '</div>';
    html += '<div class="card-title">' + escapeHtml(ex.nome) + '</div>';
    html += '<div class="ex-sub">' + ex.series + ' × ' + reps(ex.reps) + ' · descanso ' + ex.intervalo + 's</div>';

    if (ex.last) {
      const resumo = ex.last.sets.map(s => num(s.carga) + '×' + (s.reps || '?')).join('  ');
      html += '<div class="last-hint">última vez: <b>' + escapeHtml(resumo) + '</b>' +
        (ex.progressed ? '<span class="chip">+CARGA</span>' : '') + '</div>';
    } else {
      html += '<div class="last-hint">primeira leitura: registre para criar a referência</div>';
    }

    html += '<div class="sets">';
    ex.sets.forEach((set, j) => {
      html += '<div class="set' + (set.done ? ' done' : '') + '" data-i="' + i + '" data-j="' + j + '">';
      html += '<span class="n">S' + (j + 1) + '</span>';
      html += '<label class="fld"><input type="number" inputmode="decimal" step="any" class="carga" placeholder="carga" value="' + (set.carga || '') + '" aria-label="Carga, série ' + (j + 1) + '"><span>KG</span></label>';
      html += '<label class="fld"><input type="number" inputmode="numeric" class="reps" placeholder="alvo ' + reps(ex.reps) + '" value="' + escapeHtml(set.reps || '') + '" aria-label="Repetições, série ' + (j + 1) + '"><span>REPS</span></label>';
      html += '<button class="cell" type="button" role="checkbox" aria-checked="' + set.done + '" aria-label="Fechar série ' + (j + 1) + '">' + cellHTML(i * 17 + j * 5 + 3) + '</button>';
      html += '</div>';
    });
    html += '</div>';
    html += '<button class="btn rest-btn" type="button" data-ex="' + i + '">' + ICON.rest + 'Descanso ' + ex.intervalo + 's</button>';
    // Só aparece com o exercício completo e reaberto: permite encistar de novo.
    html += '<button class="btn btn-ghost hide-ex" type="button" data-hide="' + i + '">' + ICON.hide + 'Encistar</button>';
    html += '</div>';   // .card
    html += '<button class="cap" type="button" data-cap="' + i + '" aria-label="Reabrir ' + escapeHtml(ex.nome) + '">' +
      '<span class="dot">' + mitoseHTML(i * 13 + 4) + '</span><b>' + escapeHtml(ex.nome) + '</b><span class="cap-meta"></span></button>';
    html += '</div>';   // .ex
  });

  html += '<button class="btn btn-primary" id="btnConcluir" type="button">Concluir</button>';
  html += '<button class="btn btn-secondary" id="btnCardio" type="button">Seguir para cardio</button>';
  html += '<button class="btn btn-ghost" id="btnAbandonar" type="button">Descartar sessão</button>';
  el.innerHTML = html;

  bind(el);
  sessao.exercicios.forEach((_, i) => { pintarCap(i); markNext(i); });
  updateProgress(false);
}

function bind(el) {
  const voltar = el.querySelector('#back');
  voltar.onclick = back;
  voltar.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); back(); } };

  el.querySelector('#clock').onclick = () => {
    sessao.watch.toggle();
    const rodando = sessao.watch.running;
    el.querySelector('#clock').classList.toggle('paused', !rodando);
    el.querySelector('#timerSub').textContent = rodando ? 'em leitura' : 'pausado';
    keepScreenOn(rodando);
    vibrate(30);
  };

  el.querySelectorAll('.set').forEach(row => {
    const i = +row.dataset.i, j = +row.dataset.j;
    const set = sessao.exercicios[i].sets[j];
    row.querySelector('.carga').oninput = e => { set.carga = num(e.target.value); };
    row.querySelector('.reps').oninput = e => { set.reps = e.target.value; };
    row.querySelector('.cell').onclick = () => toggleSet(i, j);
  });

  // O descanso só começa quando você pede: fechar a série não dispara nada.
  el.querySelectorAll('.rest-btn').forEach(b => b.onclick = () => {
    const ex = sessao.exercicios[+b.dataset.ex];
    startRest(ex.intervalo || 60, ex.nome);
  });

  el.querySelectorAll('.cap').forEach(c => c.onclick = () => reabrir(+c.dataset.cap));
  el.querySelectorAll('.hide-ex').forEach(b => b.onclick = () => encistar(+b.dataset.hide));

  el.querySelector('#btnConcluir').onclick = () => finalizar(false);
  el.querySelector('#btnCardio').onclick = () => finalizar(true);
  el.querySelector('#btnAbandonar').onclick = async () => {
    if (!await confirmDialog('Descartar sessão?', 'Nada do que você registrou neste treino será salvo.', 'Descartar')) return;
    encerrar();
    back();
  };
}

const esperar = ms => new Promise(r => setTimeout(r, ms));
const cardDo = i => document.querySelector('.ex[data-ex="' + i + '"]');

// ===== 04 Contração + 05 Impulso =====
async function toggleSet(i, j) {
  const ex = sessao.exercicios[i], set = ex.sets[j];
  const card = cardDo(i);
  const row = card && card.querySelector('.set[data-j="' + j + '"]');
  if (!row) return;
  const cell = row.querySelector('.cell');

  set.done = !set.done;
  // Sem reps digitado, assume o alvo prescrito — na academia ninguém quer
  // digitar duas vezes o que já está na ficha.
  if (set.done && !String(set.reps).trim()) {
    const alvo = repsToNumber(ex.reps);
    if (alvo > 0) { set.reps = String(Math.round(alvo)); row.querySelector('.reps').value = set.reps; }
  }
  row.classList.toggle('done', set.done);
  cell.setAttribute('aria-checked', String(set.done));

  const completo = ex.sets.every(s => s.done);
  card.classList.toggle('all-done', completo);
  card.querySelector('[data-tag]').textContent = 'Amostra ' + pad2(i + 1) + ' · ' + (completo ? 'lida' : 'em leitura');
  pintarCap(i);
  updateProgress(true);

  if (!set.done) { markNext(i); return; }

  vibrate(15);
  if (motionOK()) {
    divide(cell);
    cell.animate([{ transform: 'scale(1)' }, { transform: 'scale(.78)', offset: .28 }, { transform: 'scale(1.08)', offset: .7 }, { transform: 'scale(1)' }],
      { duration: 320, easing: 'ease-out' });
    const rp = document.createElement('span');
    rp.className = 'ripple';
    cell.appendChild(rp);
    rp.animate([{ transform: 'scale(1)', opacity: .8 }, { transform: 'scale(2.3)', opacity: 0 }],
      { duration: 460, delay: 90, easing: 'cubic-bezier(.2,0,0,1)' }).onfinish = () => rp.remove();
    const lam = card.querySelector('.card');
    lam.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(.988)', offset: .35 }, { transform: 'scaleY(1)' }], { duration: 240, easing: 'ease-out' });
  }

  const next = ex.sets.findIndex(s => !s.done);
  if (next >= 0) {
    await impulso(card, cell, card.querySelector('.set[data-j="' + next + '"] .cell'));
    markNext(i);
  } else {
    markNext(i);
    await esperar(motionOK() ? 380 : 0);
    encistar(i);
  }
}

async function impulso(card, from, to) {
  if (!to || !motionOK()) return;
  await esperar(140);
  if (!card.isConnected) return;
  const cr = card.getBoundingClientRect(), a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const sp = document.createElement('span');
  sp.className = 'spark';
  card.appendChild(sp);
  const x0 = a.left + a.width / 2 - cr.left, y0 = a.top + a.height / 2 - cr.top;
  const x1 = b.left + b.width / 2 - cr.left, y1 = b.top + b.height / 2 - cr.top;
  sp.style.left = x0 + 'px'; sp.style.top = y0 + 'px';
  await sp.animate([
    { transform: 'translate(0,0) scale(.4)', opacity: 0 },
    { transform: 'translate(0,0) scale(1)', opacity: 1, offset: .15 },
    { transform: `translate(${x1 - x0}px, ${y1 - y0}px) scale(1)`, opacity: 1, offset: .85 },
    { transform: `translate(${x1 - x0}px, ${y1 - y0}px) scale(2.2)`, opacity: 0 },
  ], { duration: 300, easing: 'cubic-bezier(.2,0,0,1)' }).finished.catch(() => {});
  sp.remove();
}

/** A próxima série a fechar ganha a célula acesa, pulsando com o coração. */
function markNext(i) {
  const card = cardDo(i);
  if (!card) return;
  card.querySelectorAll('.set').forEach(r => r.classList.remove('next'));
  const j = sessao.exercicios[i].sets.findIndex(s => !s.done);
  if (j >= 0) card.querySelector('.set[data-j="' + j + '"]').classList.add('next');
}

/** Resumo que fica na cápsula: quantas séries e quanto volume. */
function pintarCap(i) {
  const card = cardDo(i), ex = sessao.exercicios[i];
  if (!card || !ex) return;
  const feitas = ex.sets.filter(s => s.done);
  const vol = Math.round(volumeOfSets(feitas));
  card.querySelector('.cap-meta').textContent = feitas.length + ' séries' + (vol > 0 ? ' · ' + vol.toLocaleString('pt-BR') + ' kg' : '');
}

// ===== 06 Encistamento =====
// Fechou todas as séries, o card não serve mais para nada e só atrapalha a
// rolagem até o próximo exercício. Ele contrai até virar uma fenda, a fenda
// brilha em violeta e sela numa cápsula. Tocar na cápsula reabre o card.

async function encistar(i) {
  const card = cardDo(i), ex = sessao && sessao.exercicios[i];
  if (!card || !ex || ex.collapsed || card.dataset.anim) return;
  ex.collapsed = true;
  pintarCap(i);
  if (!motionOK()) { card.classList.add('cyst'); return; }

  card.dataset.anim = '1';
  vibrate(20);
  const lam = card.querySelector('.card'), h0 = card.offsetHeight;
  const seal = document.createElement('span');
  seal.className = 'seal';
  card.appendChild(seal);
  card.style.height = h0 + 'px';
  await lam.animate([
    { transform: 'scaleY(1)', filter: 'brightness(1)' },
    { transform: 'scale(1.02, .03)', filter: 'brightness(2.2) saturate(1.6)' },
  ], { duration: 240, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' }).finished;
  seal.animate([{ opacity: 0, transform: 'scaleX(1)' }, { opacity: 1, transform: 'scaleX(1)', offset: .3 }, { opacity: 0, transform: 'scaleX(.05)' }],
    { duration: 300, easing: 'cubic-bezier(.4,0,1,1)' });
  card.classList.add('cyst');
  lam.getAnimations().forEach(a => a.cancel());
  card.style.height = 'auto';
  const h1 = card.offsetHeight;
  card.style.height = h0 + 'px';
  await card.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 200, easing: 'cubic-bezier(.2,0,0,1)' }).finished;
  card.style.height = '';
  const cap = card.querySelector('.cap');
  cap.animate([{ borderRadius: '2px', transform: 'scaleX(.9)', opacity: 0 }, { borderRadius: '22px 2px 22px 2px', transform: 'scaleX(1)', opacity: 1 }],
    { duration: 240, easing: 'cubic-bezier(.2,0,0,1)' });
  cap.querySelector('.dot').animate([{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1.25) rotate(0)', offset: .7 }, { transform: 'scale(1)' }],
    { duration: 300, delay: 120, easing: 'ease-out', fill: 'backwards' });
  await esperar(320);
  seal.remove();
  delete card.dataset.anim;
}

async function reabrir(i) {
  const card = cardDo(i), ex = sessao && sessao.exercicios[i];
  if (!card || !ex || !ex.collapsed || card.dataset.anim) return;
  ex.collapsed = false;
  if (!motionOK()) { card.classList.remove('cyst'); return; }

  card.dataset.anim = '1';
  vibrate(20);
  const h0 = card.offsetHeight;
  card.classList.remove('cyst');
  const h1 = card.offsetHeight;
  const lam = card.querySelector('.card');
  card.style.overflow = 'hidden';
  card.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 260, easing: 'cubic-bezier(.2,0,0,1)' });
  await lam.animate([{ transform: 'scaleY(.03)', filter: 'brightness(2.2) saturate(1.6)' }, { transform: 'scaleY(1)', filter: 'brightness(1)' }],
    { duration: 300, easing: 'cubic-bezier(.2,0,0,1)' }).finished;
  card.style.overflow = '';
  delete card.dataset.anim;
}

function updateProgress(animar) {
  if (!sessao || !document.getElementById('pSets')) return;
  const todas = sessao.exercicios.reduce((a, e) => a + e.sets.length, 0);
  const feitas = sessao.exercicios.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  const vol = sessao.exercicios.reduce((a, e) => a + volumeOfSets(e.sets.filter(s => s.done)), 0);
  read(document.getElementById('pSets'), feitas + ' / ' + todas, animar);
  read(document.getElementById('pVol'), Math.round(vol).toLocaleString('pt-BR') + ' kg', animar);

  // Termômetro: volume contra a referência; sem referência, séries fechadas.
  const pct = Math.min(100, sessao.alvoVolume ? vol / sessao.alvoVolume * 100 : (todas ? feitas / todas * 100 : 0));
  document.getElementById('heat').style.setProperty('--heat', pct.toFixed(1) + '%');
  document.getElementById('pHeat').textContent = pct < 25 ? 'frio' : pct < 60 ? 'aquecendo' : pct < 90 ? 'quente' : 'incandescente';
  const cur = sessao.exercicios.findIndex(e => e.sets.some(s => !s.done));
  document.getElementById('pAm').textContent = pad2((cur < 0 ? sessao.exercicios.length - 1 : cur) + 1);
}

/** Séries efetivamente registradas, prontas para o histórico. */
function colher() {
  return sessao.exercicios
    .map(ex => ({
      nome: ex.nome,
      sets: ex.sets.filter(s => s.done && (num(s.carga) > 0 || repsToNumber(s.reps) > 0))
                   .map(s => ({ carga: num(s.carga), reps: String(s.reps || '') })),
    }))
    .filter(ex => ex.sets.length);
}

async function finalizar(irParaCardio) {
  const exercicios = colher();
  if (!exercicios.length) {
    const ok = await confirmDialog('Nenhuma série fechada',
      'Você não fechou nenhuma série, então não há nada para salvar. Sair mesmo assim?', 'Sair');
    if (!ok) return;
    encerrar();
    go(irParaCardio ? '/cardio' : '/fichas', { replace: true });
    return;
  }

  const todas = sessao.exercicios.reduce((a, e) => a + e.sets.length, 0);
  const feitas = sessao.exercicios.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  if (!await confirmDialog('Concluir treino?',
    feitas + ' de ' + todas + ' séries fechadas. A sessão vai para o histórico' + (irParaCardio ? ' e o cardio começa em seguida.' : '.'),
    'Concluir', false)) return;
  if (!sessao || sessao.salvo) return;

  sessao.watch.stop();
  // Os PRs precisam ser calculados ANTES de gravar, senão a sessão nova vira
  // o próprio recorde a bater.
  const prs = detectPRs(sessao.exercicios);

  state.workoutHistory.push({
    id: uid('w'),
    date: new Date().toISOString(),
    ficha: sessao.ficha.nome,
    treino: sessao.treino.nome,
    duration: sessao.watch.seconds,
    exercicios,
  });
  const gravou = saveState();
  sessao.salvo = true;
  if (!gravou) toast('Atenção: o navegador recusou a gravação. Verifique o espaço disponível.');

  encerrar();

  // replace: a sessão acabou, então "voltar" não pode reabrir este treino.
  if (irParaCardio) go('/cardio', { replace: true });
  else mutation(prs, () => go('/fichas', { replace: true }));
}

function encerrar() {
  if (sessao) { sessao.watch.stop(); sessao.salvo = true; }
  stopRest();
  keepScreenOn(false);
  sessao = null;
}

/** Impede sair sem querer de um treino em andamento. */
function guardExit() {
  setBeforeLeave(async destino => {
    if (!sessao || sessao.salvo) return true;
    const temRegistro = colher().length > 0;
    if (!temRegistro) { encerrar(); return true; }

    const ok = await confirmDialog('Sair do treino?',
      'Você tem séries registradas que ainda não foram salvas. Use Concluir para gravar a sessão.',
      'Sair sem salvar');
    if (ok) { encerrar(); return true; }
    // Volta o endereço para a tela do treino, sem empilhar histórico.
    history.replaceState(null, '', '#/treino/' + sessao.ficha.id + '/' + sessao.treino.id);
    return false;
  });
}
