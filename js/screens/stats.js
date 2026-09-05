// Estatísticas: números totais, atividade das últimas 8 semanas e recordes.

import { state } from '../state.js';
import { escapeHtml, fmtDuration, fmtDateShort, startOfWeek, volumeOfSets, repsToNumber } from '../util.js';
import { ICON } from '../ui.js';
import { allPRs, weekStreak } from '../progress.js';
import { back } from '../router.js';

export function screenStats(params, el) {
  const w = state.workoutHistory, c = state.cardioHistory;
  const totalTime = w.reduce((s, h) => s + h.duration, 0) + c.reduce((s, h) => s + h.duration, 0);
  const totalVol = w.reduce((s, h) => s + h.exercicios.reduce((a, ex) => a + volumeOfSets(ex.sets), 0), 0);
  const totalReps = w.reduce((s, h) => s + h.exercicios.reduce((a, ex) =>
    a + ex.sets.reduce((b, set) => b + repsToNumber(set.reps), 0), 0), 0);
  const totalKm = c.reduce((s, h) => s + h.distance, 0);

  let html = '<div class="back" id="back">' + ICON.back + 'Voltar</div><h2>ESTATÍSTICAS</h2>';

  if (!w.length && !c.length) {
    html += '<div class="empty">Sem dados ainda.<br>Conclua um treino para ver seus números.</div>';
    el.innerHTML = html;
    el.querySelector('#back').onclick = back;
    return;
  }

  html += '<div class="stat-grid">';
  html += card(w.length + c.length, 'Sessões');
  // Antes isto era fmtTime() e virava "1247:33" depois de algumas semanas.
  html += card(fmtDuration(totalTime), 'Tempo total');
  html += card(totalVol >= 1000 ? (totalVol / 1000).toFixed(1) + 't' : Math.round(totalVol), 'Volume');
  html += card(Math.round(totalReps), 'Repetições');
  html += card(totalKm.toFixed(1), 'Cardio km');
  html += card(weekStreak(), 'Semanas seguidas');
  html += '</div>';

  html += '<div class="card" style="margin-top:16px;"><h3>Atividade — 8 semanas</h3><div class="chart" id="chart"></div></div>';
  html += '<div class="card"><h3>Treino favorito</h3>' + favoritos() + '</div>';
  html += '<div class="card"><h3>Recordes Pessoais</h3>' + prs() + '</div>';

  el.innerHTML = html;
  el.querySelector('#back').onclick = back;
  desenharGrafico(el.querySelector('#chart'));
}

function card(v, label) {
  return '<div class="stat-card"><div class="stat-value">' + escapeHtml(String(v)) +
    '</div><div class="stat-label">' + label + '</div></div>';
}

function favoritos() {
  const counts = {};
  state.workoutHistory.forEach(h => { counts[h.treino] = (counts[h.treino] || 0) + 1; });
  const ord = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!ord.length) return '<div class="empty">Sem treinos registrados.</div>';
  return ord.map(([nome, n]) =>
    '<div class="pr-row"><span>' + escapeHtml(nome) + '</span>' +
    '<span style="color:var(--red);font-weight:700;">' + n + '×</span></div>'
  ).join('');
}

function prs() {
  const list = allPRs();
  if (!list.length) return '<div class="empty">Sem recordes ainda.</div>';
  return list.slice(0, 15).map((p, i) =>
    '<div class="pr-row">' +
      '<span>#' + (i + 1) + ' ' + escapeHtml(p.nome) + '</span>' +
      '<span style="text-align:right;">' +
        '<span style="color:var(--red);font-weight:700;">' + p.carga + ' kg</span>' +
        (p.e1rm > p.carga ? '<br><span class="pr-1rm">1RM ~' + p.e1rm.toFixed(1) + ' kg</span>' : '') +
      '</span>' +
    '</div>'
  ).join('');
}

/** Barras das últimas 8 semanas — rotuladas com a data de início, não "S1..S8". */
function desenharGrafico(chart) {
  if (!chart) return;
  const hoje = new Date();
  const semanas = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i * 7);
    semanas.push({ start: startOfWeek(d), count: 0 });
  }
  const contar = h => {
    const d = new Date(h.date);
    semanas.forEach(s => {
      const fim = new Date(s.start.getTime() + 7 * 86400000);
      if (d >= s.start && d < fim) s.count++;
    });
  };
  state.workoutHistory.forEach(contar);
  state.cardioHistory.forEach(contar);

  const max = Math.max(1, ...semanas.map(s => s.count));
  chart.innerHTML = semanas.map(s =>
    '<div class="bar' + (s.count ? '' : ' empty-bar') + '" style="height:' +
      Math.max(4, (s.count / max) * 100) + '%">' +
      (s.count ? '<div class="bar-count">' + s.count + '</div>' : '') +
      '<div class="bar-label">' + fmtDateShort(s.start) + '</div>' +
    '</div>'
  ).join('');
}
