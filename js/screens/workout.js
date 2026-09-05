// Execução do treino.
//
// Principais correções em relação ao original:
//  - a carga sugerida vem da ÚLTIMA sessão (série a série), não do PR histórico;
//  - o cronômetro é baseado em timestamp e sobrevive à tela bloqueada;
//  - o descanso é uma barra fixa única, com som/vibração e +30s;
//  - a tela não apaga no meio do treino (Wake Lock);
//  - sair com treino em andamento pede confirmação;
//  - o "+1 SINGULARITY" só aparece quando há recorde de verdade;
//  - exercício com todas as séries fechadas se desliga como uma TV de tubo e
//    vira uma barra compacta, que reabre no toque.

import { state, saveState } from '../state.js';
import { escapeHtml, fmtTime, uid, num, repsToNumber, volumeOfSets } from '../util.js';
import { ICON, confirmDialog, toast } from '../ui.js';
import { Stopwatch, startRest, stopRest, isResting, keepScreenOn } from '../timers.js';
import { singularity, redBlink, vibrate, isFxOn } from '../fx.js';
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
    };
    sessao.watch.start();
    keepScreenOn(true);
  }

  paint(el);
  guardExit();
}

function paint(el) {
  const { treino, exercicios, watch } = sessao;
  let html = '<div class="back" id="back">' + ICON.back + 'Treinos</div>';
  html += '<h2>' + escapeHtml(treino.nome) + '</h2>';
  html += '<div class="timer" id="workoutTimer">' + fmtTime(watch.seconds) + '</div>';
  html += '<div class="timer-sub" id="timerSub">' + (watch.running ? 'em andamento · toque para pausar' : 'pausado · toque para continuar') + '</div>';
  html += '<div id="progressLine" class="card-sub" style="text-align:center;margin:12px 0 18px;"></div>';

  exercicios.forEach((ex, i) => {
    html += '<div class="exercise-card' + (ex.collapsed ? ' collapsed' : '') + '" data-ex="' + i + '">';
    // Barra compacta que fica no lugar do card depois do desligamento.
    html += '<div class="ex-stub" data-stub="' + i + '" role="button" tabindex="0" ' +
      'aria-label="Reabrir ' + escapeHtml(ex.nome) + '">' +
      '<span class="ex-stub-check">✓</span>' +
      '<span class="ex-stub-name">' + escapeHtml(ex.nome) + '</span>' +
      '<span class="ex-stub-meta"></span>' +
      '<span class="ex-stub-open">REABRIR</span>' +
    '</div>';
    html += '<div class="ex-body">';
    html += '<div class="exercise-name">' + escapeHtml(ex.nome) + '</div>';
    html += '<div class="card-sub" style="margin-bottom:8px;">' +
      ex.series + '× ' + escapeHtml(ex.reps) + ' · descanso ' + ex.intervalo + 's</div>';

    if (ex.last) {
      const resumo = ex.last.sets.map(s => num(s.carga) + '×' + (s.reps || '?')).join('  ');
      html += '<div class="last-hint">última vez: <b>' + escapeHtml(resumo) + '</b>' +
        (ex.progressed ? '<span class="suggest">+CARGA</span>' : '') + '</div>';
    } else {
      html += '<div class="last-hint">primeira vez — registre para criar sua referência</div>';
    }

    html += '<div class="sets">';
    ex.sets.forEach((set, j) => {
      html += '<div class="set-row' + (set.done ? ' set-done' : '') + '" data-i="' + i + '" data-j="' + j + '">';
      html += '<span class="set-tag">S' + (j + 1) + '</span>';
      html += '<input type="number" inputmode="decimal" step="any" class="carga" placeholder="kg" value="' + (set.carga || '') + '" aria-label="Carga série ' + (j + 1) + '" />';
      html += '<span class="unit">kg</span>';
      html += '<input type="number" inputmode="numeric" class="reps" placeholder="reps" value="' + escapeHtml(set.reps || '') + '" aria-label="Repetições série ' + (j + 1) + '" />';
      html += '<span class="unit">reps</span>';
      html += '<input type="checkbox" class="done"' + (set.done ? ' checked' : '') + ' aria-label="Concluir série ' + (j + 1) + '" />';
      html += '</div>';
    });
    html += '</div>';
    html += '<button class="btn btn-secondary btn-small rest" data-ex="' + i + '" style="margin-top:10px;width:100%;">' + ICON.rest + 'Descanso ' + ex.intervalo + 's</button>';
    // Só aparece com o exercício fechado: permite ocultar de novo depois de reabrir.
    html += '<button class="btn btn-ghost btn-small hide-ex" data-hide="' + i + '" style="margin-top:6px;width:100%;">OCULTAR EXERCÍCIO</button>';
    html += '</div>';   // .ex-body
    html += '</div>';   // .exercise-card
  });

  html += '<button class="btn btn-primary" id="btnConcluir">CONCLUIR</button>';
  html += '<button class="btn btn-secondary" id="btnCardio">SEGUIR PARA CARDIO</button>';
  html += '<button class="btn btn-ghost" id="btnAbandonar">DESCARTAR SESSÃO</button>';
  el.innerHTML = html;

  bind(el);
  updateProgress();
}

function bind(el) {
  el.querySelector('#back').onclick = back;

  const timer = el.querySelector('#workoutTimer');
  timer.style.cursor = 'pointer';
  timer.onclick = () => {
    sessao.watch.toggle();
    el.querySelector('#timerSub').textContent = sessao.watch.running
      ? 'em andamento · toque para pausar' : 'pausado · toque para continuar';
    keepScreenOn(sessao.watch.running);
    vibrate(30);
  };

  el.querySelectorAll('.set-row').forEach(row => {
    const i = +row.dataset.i, j = +row.dataset.j;
    const set = sessao.exercicios[i].sets[j];

    row.querySelector('.carga').oninput = e => { set.carga = num(e.target.value); };
    row.querySelector('.reps').oninput = e => { set.reps = e.target.value; };

    row.querySelector('.done').onchange = e => {
      set.done = e.target.checked;
      row.classList.toggle('set-done', set.done);

      if (set.done) {
        // Sem reps digitado, assume o alvo prescrito — na academia ninguém
        // quer digitar duas vezes o que já está na ficha.
        if (!String(set.reps).trim()) {
          const alvo = repsToNumber(sessao.exercicios[i].reps);
          if (alvo > 0) { set.reps = String(Math.round(alvo)); row.querySelector('.reps').value = set.reps; }
        }
        vibrate(40);
      }
      const fechouAgora = markExerciseDone(i);
      updateProgress();
      // Só na transição: reabrir um exercício já completo não o fecha de novo.
      if (fechouAgora) desligarCRT(i);
    };
  });

  el.querySelectorAll('.rest').forEach(b => b.onclick = () => {
    const ex = sessao.exercicios[+b.dataset.ex];
    startRest(ex.intervalo || 60, ex.nome);
  });

  el.querySelectorAll('.ex-stub').forEach(stub => {
    const i = +stub.dataset.stub;
    stub.onclick = () => ligarCRT(i);
    stub.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ligarCRT(i); }
    };
  });

  el.querySelectorAll('.hide-ex').forEach(b => b.onclick = () => desligarCRT(+b.dataset.hide));

  el.querySelector('#btnConcluir').onclick = () => finalizar(false);
  el.querySelector('#btnCardio').onclick = () => finalizar(true);
  el.querySelector('#btnAbandonar').onclick = async () => {
    if (!await confirmDialog('Descartar sessão?', 'Nada do que você registrou neste treino será salvo.', 'DESCARTAR')) return;
    encerrar();
    back();
  };

  // Na montagem só sincronizamos o visual — o retorno é descartado de
  // propósito, senão voltar de outra tela dispararia o desligamento de novo.
  sessao.exercicios.forEach((_, i) => markExerciseDone(i));
}

/**
 * Sincroniza o visual do exercício com o estado das séries.
 * Devolve true quando ele ACABOU de fechar todas — o gatilho do desligamento.
 */
function markExerciseDone(i) {
  const card = document.querySelector('.exercise-card[data-ex="' + i + '"]');
  const ex = sessao.exercicios[i];
  if (!card || !ex) return false;

  const completo = ex.sets.length > 0 && ex.sets.every(s => s.done);
  const antes = card.classList.contains('all-done');
  card.classList.toggle('all-done', completo);
  pintarStub(i);

  // Desmarcar uma série reabre o exercício: não dá para editar o que está oculto.
  if (!completo && ex.collapsed) { ex.collapsed = false; card.classList.remove('collapsed'); }

  return completo && !antes;
}

/** Resumo que fica na barra compacta: quantas séries e quanto volume. */
function pintarStub(i) {
  const card = document.querySelector('.exercise-card[data-ex="' + i + '"]');
  const ex = sessao.exercicios[i];
  if (!card || !ex) return;
  const alvo = card.querySelector('.ex-stub-meta');
  if (!alvo) return;
  const feitas = ex.sets.filter(s => s.done);
  const vol = Math.round(volumeOfSets(feitas));
  alvo.textContent = feitas.length + ' séries' + (vol > 0 ? ' · ' + vol + ' kg' : '');
}

// ===== desligamento estilo TV de tubo =====
//
// Fechou todas as séries, o card não serve mais para nada e só atrapalha a
// rolagem até o próximo exercício. Ele se apaga como uma TV CRT — colapsa numa
// linha, estoura o brilho, some no ponto — e vira uma barra compacta. Tocar na
// barra religa e devolve o card editável.

const CRT_MS = 420;       // duração da animação, casada com o CSS
const ALTURA_MS = 240;    // colapso/expansão da altura do card

/** Sem FX ou com "menos movimento" no sistema, a troca é seca. */
function comAnimacao() {
  return isFxOn() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

async function desligarCRT(i) {
  const card = document.querySelector('.exercise-card[data-ex="' + i + '"]');
  const ex = sessao && sessao.exercicios[i];
  if (!card || !ex || ex.collapsed || card.dataset.anim) return;

  ex.collapsed = true;
  pintarStub(i);

  if (!comAnimacao()) { card.classList.add('collapsed'); return; }

  card.dataset.anim = '1';
  const alto = card.offsetHeight;
  card.style.height = alto + 'px';
  card.classList.add('crt-anim', 'crt-off');
  vibrate(20);

  await esperar(CRT_MS);

  // Troca o corpo pela barra e mede onde a altura precisa chegar.
  card.classList.remove('crt-off');
  card.classList.add('collapsed');
  card.style.height = 'auto';
  const baixo = card.offsetHeight;
  card.style.height = alto + 'px';
  void card.offsetHeight;                       // força o reflow antes da transição
  card.style.transition = 'height ' + ALTURA_MS + 'ms ease';
  card.style.height = baixo + 'px';

  await esperar(ALTURA_MS + 20);
  limpar(card);
}

async function ligarCRT(i) {
  const card = document.querySelector('.exercise-card[data-ex="' + i + '"]');
  const ex = sessao && sessao.exercicios[i];
  if (!card || !ex || !ex.collapsed || card.dataset.anim) return;

  ex.collapsed = false;

  if (!comAnimacao()) { card.classList.remove('collapsed'); return; }

  card.dataset.anim = '1';
  const baixo = card.offsetHeight;
  card.classList.add('crt-anim');
  card.classList.remove('collapsed');
  card.style.height = 'auto';
  const alto = card.offsetHeight;
  card.style.height = baixo + 'px';
  void card.offsetHeight;
  card.style.transition = 'height ' + ALTURA_MS + 'ms ease';
  card.style.height = alto + 'px';
  card.classList.add('crt-on');
  vibrate(20);

  await esperar(Math.max(CRT_MS, ALTURA_MS) + 20);
  limpar(card);
}

function limpar(card) {
  card.style.transition = '';
  card.style.height = '';
  card.classList.remove('crt-anim', 'crt-off', 'crt-on');
  delete card.dataset.anim;
}

function updateProgress() {
  const line = document.getElementById('progressLine');
  if (!line || !sessao) return;
  const todas = sessao.exercicios.reduce((a, e) => a + e.sets.length, 0);
  const feitas = sessao.exercicios.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  const vol = sessao.exercicios.reduce((a, e) => a + volumeOfSets(e.sets.filter(s => s.done)), 0);
  line.innerHTML = feitas + ' / ' + todas + ' séries · <span style="color:var(--red)">' + Math.round(vol) + ' kg</span> de volume';
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
    const ok = await confirmDialog('Nenhuma série marcada',
      'Você não marcou nenhuma série como concluída, então não há nada para salvar. Sair mesmo assim?', 'SAIR');
    if (!ok) return;
    encerrar();
    go(irParaCardio ? '/cardio' : '/fichas', { replace: true });
    return;
  }

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
  if (irParaCardio) {
    redBlink(() => go('/cardio', { replace: true }));
  } else {
    singularity(prs, () => go('/fichas', { replace: true }));
  }
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
      'Você tem séries registradas que ainda não foram salvas. Use CONCLUIR para gravar a sessão.',
      'SAIR SEM SALVAR');
    if (ok) { encerrar(); return true; }
    // Volta o endereço para a tela do treino, sem empilhar histórico.
    history.replaceState(null, '', '#/treino/' + sessao.ficha.id + '/' + sessao.treino.id);
    return false;
  });
}
