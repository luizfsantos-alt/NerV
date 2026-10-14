// Stats: números totais, atividade das últimas 8 semanas e recordes.

import { state } from '../state.js';
import { escapeHtml, fmtDuration, fmtDateShort, startOfWeek, volumeOfSets, repsToNumber } from '../util.js';
import { ICON } from '../ui.js';
import { allPRs, weekStreak, cardioRecords } from '../progress.js';
import { back } from '../router.js';
import { read, motionOK } from '../fx.js';

export function screenStats(params, el) {
  const w = state.workoutHistory, c = state.cardioHistory;
  const totalTime = w.reduce((s, h) => s + h.duration, 0) + c.reduce((s, h) => s + h.duration, 0);
  const totalVol = w.reduce((s, h) => s + h.exercicios.reduce((a, ex) => a + volumeOfSets(ex.sets), 0), 0);
  const totalReps = w.reduce((s, h) => s + h.exercicios.reduce((a, ex) =>
    a + ex.sets.reduce((b, set) => b + repsToNumber(set.reps), 0), 0), 0);
  const totalKm = c.reduce((s, h) => s + h.distance, 0);

  let html = '<div class="back" id="back" role="link" tabindex="0">' + ICON.back + 'Voltar</div><h2>Stats</h2>';

  if (!w.length && !c.length) {
    html += '<div class="empty">Nada para ler ainda.<br>Conclua um treino para ver seus números.</div>';
    el.innerHTML = html;
    el.querySelector('#back').onclick = back;
    return;
  }

  html += '<div class="stat-grid">';
  html += card(w.length + c.length, 'Sessões');
  // Antes isto era fmtTime() e virava "1247:33" depois de algumas semanas.
  html += card(fmtDuration(totalTime), 'Tempo total');
  html += card(totalVol >= 1000 ? (totalVol / 1000).toFixed(1).replace('.', ',') + 't' : Math.round(totalVol), 'Volume', true);
  html += card(Math.round(totalReps), 'Repetições');
  html += card(totalKm.toFixed(1).replace('.', ','), 'Cardio km');
  html += card(weekStreak(), 'Semanas seguidas');
  html += '</div>';

  html += '<div class="card"><div class="card-tag">Calor</div><h3>Sessões por semana</h3><div class="chart" id="chart"></div></div>';
  html += '<div class="card"><div class="card-tag">Frequência</div><h3>Treino favorito</h3>' + favoritos() + '</div>';
  html += '<div class="card"><div class="card-tag">Recordes</div><h3>Recordes pessoais</h3>' + prs() + '</div>';
  html += '<div class="card"><div class="card-tag">Cardio</div><h3>Recordes de corrida</h3>' + recordesCardio() + '</div>';

  el.innerHTML = html;
  const voltar = el.querySelector('#back');
  voltar.onclick = back;
  voltar.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); back(); } };
  // Os totais chegam pela Leitura.
  el.querySelectorAll('.stat-value').forEach(v => { const t = v.textContent; v.textContent = ''; read(v, t); });
  desenharGrafico(el.querySelector('#chart'));
}

function card(v, label, hot = false) {
  return '<div class="stat-card"><div class="stat-value' + (hot ? ' hot' : '') + '">' + escapeHtml(String(v)) +
    '</div><div class="stat-label">' + label + '</div></div>';
}

function favoritos() {
  const counts = {};
  state.workoutHistory.forEach(h => { counts[h.treino] = (counts[h.treino] || 0) + 1; });
  const ord = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!ord.length) return '<div class="empty">Sem treinos registrados.</div>';
  return ord.map(([nome, n]) =>
    '<div class="pr-row"><span>' + escapeHtml(nome) + '</span>' +
    '<span class="v">' + n + '×</span></div>'
  ).join('');
}

function prs() {
  const list = allPRs();
  if (!list.length) return '<div class="empty">Sem recordes ainda.</div>';
  return list.slice(0, 15).map((p, i) =>
    '<div class="pr-row">' +
      '<span>#' + (i + 1) + ' ' + escapeHtml(p.nome) + '</span>' +
      '<span style="text-align:right;">' +
        '<span class="v">' + String(p.carga).replace('.', ',') + ' kg</span>' +
        (p.e1rm > p.carga ? '<br><span class="pr-1rm">1RM ~' + p.e1rm.toFixed(1).replace('.', ',') + ' kg</span>' : '') +
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

  // Calor (09): as barras sobem como imagem térmica; quanto mais alta, mais
  // quente a cor que ela alcança (o gradiente é fixo na altura do gráfico).
  const max = Math.max(1, ...semanas.map(s => s.count));
  chart.innerHTML = semanas.map(s =>
    '<div class="col' + (s.count ? '' : ' empty-col') + '">' +
      '<em>' + (s.count || '') + '</em>' +
      '<i style="height:' + Math.max(2, s.count / max * 152).toFixed(0) + 'px"></i>' +
      '<small>' + fmtDateShort(s.start) + '</small>' +
    '</div>'
  ).join('');
  if (!motionOK()) return;
  chart.querySelectorAll('.col i').forEach((b, k) => b.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
    { duration: 600, delay: 120 + k * 50, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'backwards' }));
  chart.querySelectorAll('.col em').forEach((b, k) => b.animate([{ opacity: 0 }, { opacity: 1 }],
    { duration: 200, delay: 600 + k * 50, fill: 'backwards' }));
}

/** Melhor pace (corridas de pelo menos 1 km) e maior distância numa corrida. */
function recordesCardio() {
  const r = cardioRecords();
  if (!r.pace && !r.distancia) return '<div class="empty">Sem corridas registradas.</div>';
  const s = r.pace && Math.round(r.pace);
  return (r.pace ? '<div class="pr-row"><span>Melhor pace</span><span class="v">' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' /km</span></div>' : '') +
    (r.distancia ? '<div class="pr-row"><span>Maior distância</span><span class="v">' + r.distancia.toFixed(2).replace('.', ',') + ' km</span></div>' : '');
}
