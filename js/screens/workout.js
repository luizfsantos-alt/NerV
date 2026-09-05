// Execução do treino.
//
// Principais correções em relação ao original:
//  - a carga sugerida vem da ÚLTIMA sessão (série a série), não do PR histórico;
//  - o cronômetro é baseado em timestamp e sobrevive à tela bloqueada;
//  - o descanso é uma barra fixa única, com som/vibração e +30s;
//  - a tela não apaga no meio do treino (Wake Lock);
//  - sair com treino em andamento pede confirmação;
//  - o "+1 SINGULARITY" só aparece quando há recorde de verdade.

import { state, saveState } from '../state.js';
import { escapeHtml, fmtTime, uid, num, repsToNumber, volumeOfSets } from '../util.js';
import { ICON, confirmDialog, toast } from '../ui.js';
import { Stopwatch, startRest, stopRest, isResting, keepScreenOn } from '../timers.js';
import { singularity, redBlink, vibrate } from '../fx.js';
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
    html += '<div class="exercise-card" data-ex="' + i + '">';
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
    html += '</div>';
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
        // Marcar a série é exatamente o momento de começar a descansar.
        const ex = sessao.exercicios[i];
        const ultima = j === ex.sets.length - 1;
        if (!ultima && ex.intervalo > 0) startRest(ex.intervalo, ex.nome + ' · série ' + (j + 2));
      }
      markExerciseDone(i);
      updateProgress();
    };
  });

  el.querySelectorAll('.rest').forEach(b => b.onclick = () => {
    const ex = sessao.exercicios[+b.dataset.ex];
    startRest(ex.intervalo || 60, ex.nome);
  });

  el.querySelector('#btnConcluir').onclick = () => finalizar(false);
  el.querySelector('#btnCardio').onclick = () => finalizar(true);
  el.querySelector('#btnAbandonar').onclick = async () => {
    if (!await confirmDialog('Descartar sessão?', 'Nada do que você registrou neste treino será salvo.', 'DESCARTAR')) return;
    encerrar();
    back();
  };

  sessao.exercicios.forEach((_, i) => markExerciseDone(i));
}

function markExerciseDone(i) {
  const card = document.querySelector('.exercise-card[data-ex="' + i + '"]');
  if (!card) return;
  const ex = sessao.exercicios[i];
  card.classList.toggle('all-done', ex.sets.every(s => s.done));
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
