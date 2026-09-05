// Tela inicial: lista de fichas + acessos a histórico, stats e ajustes.

import { state, saveState } from '../state.js';
import { escapeHtml, uid } from '../util.js';
import { ICON, modal, modalError, confirmDialog, toast } from '../ui.js';
import { parseTextoFicha } from '../importers.js';
import { go, render } from '../router.js';
import { weekStreak } from '../progress.js';

export function screenFichas(params, el) {
  const streak = weekStreak();
  let html = '<h2>FICHAS</h2>';

  if (streak > 0) {
    html += '<div class="card-sub" style="margin:-10px 0 16px;">' +
      'sequência: <span style="color:var(--red)">' + streak + ' semana' + (streak > 1 ? 's' : '') + '</span></div>';
  }

  html += '<button class="btn btn-primary" id="btnNovaFicha">' + ICON.plus + 'Nova Ficha</button>';
  html += '<button class="btn btn-secondary" id="btnImportar">' + ICON.import + 'Importar Texto</button>';
  html += '<button class="btn btn-secondary" id="btnCardio">' + ICON.gps + 'Cardio Avulso</button>';
  html += '<div class="grid-2">';
  html += '<button class="btn btn-secondary" id="btnHistorico">' + ICON.history + 'Histórico</button>';
  html += '<button class="btn btn-secondary" id="btnStats">' + ICON.stats + 'Stats</button>';
  html += '</div>';

  if (!state.fichas.length) {
    html += '<div class="empty">Nenhuma ficha criada.<br>Crie uma nova ou importe de texto / planilha.</div>';
  } else {
    state.fichas.forEach((f, i) => {
      const nEx = f.treinos.reduce((a, t) => a + t.exercicios.length, 0);
      html += '<div class="card">';
      html += '<div class="ghost-number">' + String(i + 1).padStart(2, '0') + '</div>';
      html += '<div class="edit-btn" data-ren="' + f.id + '" title="Renomear">' + ICON.edit + '</div>';
      html += '<div class="delete-btn" data-del="' + f.id + '" title="Excluir">X</div>';
      html += '<div class="card-title">' + escapeHtml(f.nome) + '</div>';
      html += '<div class="card-sub">' + f.treinos.length + ' treino(s) · ' + nEx + ' exercício(s)</div>';
      html += '<button class="btn btn-primary btn-small abrir" data-id="' + f.id + '" style="margin-top:12px;">ABRIR</button>';
      html += '</div>';
    });
  }
  el.innerHTML = html;

  el.querySelector('#btnNovaFicha').onclick = novaFicha;
  el.querySelector('#btnImportar').onclick = importarTexto;
  el.querySelector('#btnCardio').onclick = () => go('/cardio');
  el.querySelector('#btnHistorico').onclick = () => go('/historico');
  el.querySelector('#btnStats').onclick = () => go('/stats');

  el.querySelectorAll('.abrir').forEach(b => b.onclick = () => go('/ficha/' + b.dataset.id));
  el.querySelectorAll('[data-ren]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    renomearFicha(b.dataset.ren);
  });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    const f = state.fichas.find(x => x.id === b.dataset.del);
    if (!f) return;
    const ok = await confirmDialog('Excluir ficha?',
      '"' + f.nome + '" e seus ' + f.treinos.length + ' treino(s) serão removidos. O histórico de sessões NÃO será apagado.',
      'EXCLUIR');
    if (!ok) return;
    state.fichas = state.fichas.filter(x => x.id !== b.dataset.del);
    saveState();
    render();
    toast('Ficha excluída');
  });
}

async function novaFicha() {
  let nome = '';
  const v = await modal({
    title: 'Nova Ficha',
    body: '<label>Nome da ficha</label><input id="inpNome" placeholder="Ex: Hipertrofia A/B" />',
    buttons: [
      { label: 'CRIAR', cls: 'btn-primary', value: 'ok', onClick(ov) {
        nome = ov.querySelector('#inpNome').value.trim();
        if (!nome) { modalError('Digite um nome'); return false; }
      } },
      { label: 'CANCELAR', cls: 'btn-ghost', value: null },
    ],
  });
  if (v !== 'ok') return;
  const ficha = { id: uid('f'), nome, treinos: [] };
  state.fichas.push(ficha);
  saveState();
  go('/ficha/' + ficha.id);
}

async function renomearFicha(id) {
  const f = state.fichas.find(x => x.id === id);
  if (!f) return;
  let nome = '';
  const v = await modal({
    title: 'Renomear Ficha',
    body: '<label>Nome</label><input id="inpNome" value="' + escapeHtml(f.nome) + '" />',
    buttons: [
      { label: 'SALVAR', cls: 'btn-primary', value: 'ok', onClick(ov) {
        nome = ov.querySelector('#inpNome').value.trim();
        if (!nome) { modalError('Digite um nome'); return false; }
      } },
      { label: 'CANCELAR', cls: 'btn-ghost', value: null },
    ],
  });
  if (v !== 'ok') return;
  f.nome = nome;
  saveState();
  render();
}

async function importarTexto() {
  let ficha = null;
  const exemplo = 'Ficha: Hipertrofia\nTreino A: Peito/Tríceps\nSupino reto 4x8-12 60kg 90s\nTríceps corda | 3 | 12-15 | 25 | 60';
  const v = await modal({
    title: 'Importar Texto',
    body:
      '<div class="hint">Um exercício por linha. Formatos aceitos:<br>' +
      '<b>Supino reto 4x8-12 60kg 90s</b><br>' +
      '<b>Supino reto | 4 | 8-12 | 60 | 90</b><br>' +
      'Linhas como "Treino A: Peito" separam os treinos.</div>' +
      '<label>Cole o texto da ficha</label>' +
      '<textarea id="inpTexto" placeholder="' + escapeHtml(exemplo) + '"></textarea>',
    buttons: [
      { label: 'IMPORTAR', cls: 'btn-primary', value: 'ok', onClick(ov) {
        ficha = parseTextoFicha(ov.querySelector('#inpTexto').value);
        if (!ficha) {
          modalError('Nenhum exercício reconhecido. Confira o formato acima.');
          return false;
        }
      } },
      { label: 'CANCELAR', cls: 'btn-ghost', value: null },
    ],
  });
  if (v !== 'ok' || !ficha) return;
  state.fichas.push(ficha);
  saveState();
  const nEx = ficha.treinos.reduce((a, t) => a + t.exercicios.length, 0);
  toast(ficha.treinos.length + ' treino(s) e ' + nEx + ' exercício(s) importados', 'ok');
  go('/ficha/' + ficha.id);
}
