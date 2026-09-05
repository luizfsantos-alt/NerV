// Histórico de sessões, com filtro e exclusão.

import { state, saveState } from '../state.js';
import { escapeHtml, fmtDate, fmtTime, volumeOfSets, num } from '../util.js';
import { ICON, confirmDialog, toast } from '../ui.js';
import { back, render } from '../router.js';

let filtro = 'tudo';

export function screenHistorico(params, el) {
  const todos = [
    ...state.workoutHistory.map(h => ({ ...h, type: 'workout' })),
    ...state.cardioHistory.map(h => ({ ...h, type: 'cardio' })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const lista = filtro === 'tudo' ? todos : todos.filter(x => x.type === filtro);

  let html = '<div class="back" id="back">' + ICON.back + 'Voltar</div><h2>HISTÓRICO</h2>';
  html += '<div class="row wrap" style="margin-bottom:16px;">' +
    [['tudo', 'TUDO'], ['workout', 'TREINOS'], ['cardio', 'CARDIO']].map(([k, label]) =>
      '<button class="btn btn-small ' + (filtro === k ? 'btn-primary' : 'btn-secondary') + '" data-f="' + k + '">' + label + '</button>'
    ).join('') + '</div>';

  if (!lista.length) {
    html += '<div class="empty">Nenhum registro.<br>Conclua um treino para começar.</div>';
  }

  lista.forEach(item => {
    html += '<div class="card" style="font-size:14px;">';
    html += '<div class="delete-btn" data-type="' + item.type + '" data-id="' + item.id + '">X</div>';
    if (item.type === 'workout') {
      const vol = item.exercicios.reduce((s, ex) => s + volumeOfSets(ex.sets), 0);
      const nSets = item.exercicios.reduce((s, ex) => s + ex.sets.length, 0);
      html += '<div class="card-title">' + escapeHtml(item.treino) + '</div>';
      html += '<div class="card-sub">' + fmtDate(item.date) + ' · ' + fmtTime(item.duration) +
        ' · ' + nSets + ' séries · ' + Math.round(vol) + ' kg</div>';
      html += '<div style="margin-top:8px;color:var(--gray);font-family:var(--font-mono);font-size:11px;line-height:1.8;">';
      item.exercicios.forEach(ex => {
        html += escapeHtml(ex.nome) + ': <span style="color:var(--muted)">' +
          ex.sets.map(s => num(s.carga) + '×' + escapeHtml(String(s.reps || '?'))).join('  ') + '</span><br>';
      });
      html += '</div>';
    } else {
      html += '<div class="card-title">Cardio</div>';
      html += '<div class="card-sub">' + fmtDate(item.date) +
        (item.distance > 0 ? ' · ' + item.distance.toFixed(2) + ' km' : '') +
        ' · ' + fmtTime(item.duration) +
        (item.distance > 0 ? ' · ' + item.pace + '/km' : '') +
        (item.source === 'gps' ? ' · GPS' : '') + '</div>';
    }
    html += '</div>';
  });

  el.innerHTML = html;
  el.querySelector('#back').onclick = back;
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtro = b.dataset.f; render(); });
  el.querySelectorAll('[data-type]').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    if (!await confirmDialog('Excluir registro?', 'Esta sessão sairá do histórico e das estatísticas.', 'EXCLUIR')) return;
    if (b.dataset.type === 'workout') state.workoutHistory = state.workoutHistory.filter(h => h.id !== b.dataset.id);
    else state.cardioHistory = state.cardioHistory.filter(h => h.id !== b.dataset.id);
    saveState();
    render();
    toast('Registro excluído');
  });
}
