// Tela inicial: lista de fichas + acessos a histórico, stats e ajustes.

import { state, saveState } from '../state.js';
import { escapeHtml, uid } from '../util.js';
import { ICON, modal, modalError, confirmDialog, toast } from '../ui.js';
import { parseTextoFicha } from '../importers.js';
import { fichaABCD, RESUMO_ABCD } from '../modelos.js';
import { go, render } from '../router.js';
import { weekStreak } from '../progress.js';

export function screenFichas(params, el) {
  const streak = weekStreak();
  const nEx = state.fichas.reduce((a, f) => a + f.treinos.reduce((b, t) => b + t.exercicios.length, 0), 0);
  const nTr = state.fichas.reduce((a, f) => a + f.treinos.length, 0);
  let html = '<h2>Fichas</h2>';
  html += '<div class="lbl screen-sub">' + state.fichas.length + ' lâmina' + (state.fichas.length === 1 ? '' : 's') +
    ' · <b>' + nTr + ' amostra' + (nTr === 1 ? '' : 's') + '</b> · ' + nEx + ' exercícios' +
    (streak > 0 ? '<br>sequência: <b>' + streak + ' semana' + (streak > 1 ? 's' : '') + '</b>' : '') + '</div>';

  html += '<button class="btn btn-primary" id="btnNovaFicha" type="button">' + ICON.plus + 'Nova ficha</button>';
  html += '<div class="grid-2">';
  html += '<button class="btn" id="btnImportar" type="button">' + ICON.import + 'Importar</button>';
  html += '<button class="btn" id="btnCardio" type="button">' + ICON.gps + 'Cardio</button>';
  html += '<button class="btn" id="btnHistorico" type="button">' + ICON.history + 'Histórico</button>';
  html += '<button class="btn" id="btnStats" type="button">' + ICON.stats + 'Stats</button>';
  html += '</div>';

  if (!state.fichas.length) {
    html += '<div class="empty">Nenhuma lâmina sob a lente.<br>Crie uma ficha ou importe de texto ou planilha.</div>';
  } else {
    state.fichas.forEach((f, i) => {
      html += '<div class="card">';
      html += '<div class="card-actions">' +
        '<button class="icon-act" type="button" data-ren="' + f.id + '" title="Renomear" aria-label="Renomear ' + escapeHtml(f.nome) + '">' + ICON.edit + '</button>' +
        '<button class="icon-act del" type="button" data-del="' + f.id + '" title="Excluir" aria-label="Excluir ' + escapeHtml(f.nome) + '">' + ICON.trash + '</button>' +
      '</div>';
      html += '<div class="card-tag">Lâmina ' + String(i + 1).padStart(2, '0') + '</div>';
      html += '<div class="card-title">' + escapeHtml(f.nome) + '</div>';
      // Cada treino é uma linha: tocar já começa o treino.
      f.treinos.forEach(t => {
        const series = t.exercicios.reduce((a, e) => a + (e.series || 0), 0);
        const ult = ultimaSessao(t.nome);
        html += '<button class="am-row" type="button" data-go="' + f.id + '/' + t.id + '">' +
          '<span class="lt">' + escapeHtml(letra(t.nome)) + '</span>' +
          '<div><b>' + escapeHtml(semLetra(t.nome)) + '</b><span>' + t.exercicios.length + ' exercícios · ' + series + ' séries' + (ult ? ' · ' + ult : '') + '</span></div>' +
          ICON.go + '</button>';
      });
      html += '<button class="btn btn-ghost btn-small" type="button" data-abrir="' + f.id + '" style="width:100%;margin-top:10px;">' + ICON.edit + (f.treinos.length ? 'Editar treinos' : 'Criar treinos') + '</button>';
      html += '</div>';
    });
  }
  el.innerHTML = html;

  el.querySelector('#btnNovaFicha').onclick = novaFicha;
  el.querySelector('#btnImportar').onclick = importarTexto;
  el.querySelector('#btnCardio').onclick = () => go('/cardio');
  el.querySelector('#btnHistorico').onclick = () => go('/historico');
  el.querySelector('#btnStats').onclick = () => go('/stats');

  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go('/treino/' + b.dataset.go));
  el.querySelectorAll('[data-abrir]').forEach(b => b.onclick = () => go('/ficha/' + b.dataset.abrir));
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
      'Excluir');
    if (!ok) return;
    state.fichas = state.fichas.filter(x => x.id !== b.dataset.del);
    saveState();
    render();
    toast('Ficha excluída');
  });
}

// "A — Peito/Tríceps" vira a letra A grande e "Peito / Tríceps" ao lado.
const RX_LETRA = /^\s*(?:treino\s+)?([A-Z0-9]{1,2})\s*[-—–:·.)]\s*(.+)$/i;
function letra(nome) {
  const m = nome.match(RX_LETRA);
  return m ? m[1].toUpperCase() : (nome.trim()[0] || '?').toUpperCase();
}
function semLetra(nome) {
  const m = nome.match(RX_LETRA);
  return (m ? m[2] : nome).replace(/\s*\/\s*/g, ' / ');
}

/** "última há 3 dias", a partir do histórico. */
function ultimaSessao(nomeTreino) {
  const h = [...state.workoutHistory].reverse().find(x => x.treino === nomeTreino);
  if (!h) return '';
  const dias = Math.floor((startOfDay(new Date()) - startOfDay(new Date(h.date))) / 86400000);
  return dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : 'última há ' + dias + ' dias';
}
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

/**
 * Nova ficha, em branco ou já com a divisão ABCD montada.
 *
 * A ficha ABCD entra sozinha na primeira abertura do app, mas quem já tem
 * dados no aparelho nunca veria essa semente — daí a opção aqui, que evita
 * digitar os 25 exercícios um a um.
 */
async function novaFicha() {
  let nome = '';
  let modelo = 'vazia';
  const v = await modal({
    title: 'Nova Ficha',
    body:
      '<label>Nome da ficha</label>' +
      '<input id="inpNome" placeholder="Ex: Hipertrofia A/B" />' +
      '<label style="margin-top:6px;">Começar com</label>' +
      '<select id="inpModelo">' +
        '<option value="vazia">Ficha em branco</option>' +
        '<option value="abcd">Modelo ABCD (' + RESUMO_ABCD.treinos + ' treinos)</option>' +
      '</select>' +
      '<div class="hint" id="hintModelo">Você cria os treinos depois, um a um.</div>',
    buttons: [
      { label: 'Criar', cls: 'btn-primary', value: 'ok', onClick(ov) {
        modelo = ov.querySelector('#inpModelo').value;
        nome = ov.querySelector('#inpNome').value.trim();
        if (!nome && modelo === 'abcd') nome = 'Ficha ABCD';
        if (!nome) { modalError('Digite um nome'); return false; }
      } },
      { label: 'Cancelar', cls: 'btn-secondary', value: null },
    ],
    onMount(ov) {
      const sel = ov.querySelector('#inpModelo');
      const hint = ov.querySelector('#hintModelo');
      const inp = ov.querySelector('#inpNome');
      sel.onchange = () => {
        const abcd = sel.value === 'abcd';
        hint.textContent = abcd
          ? RESUMO_ABCD.exercicios + ' exercícios: A — Peito/Tríceps · B — Costas/Bíceps · '
            + 'C — Pernas · D — Ombros/Abdômen. Séries, reps e descanso já vêm preenchidos; '
            + 'a carga você registra treinando.'
          : 'Você cria os treinos depois, um a um.';
        if (abcd) inp.placeholder = 'Ficha ABCD';
        else inp.placeholder = 'Ex: Hipertrofia A/B';
      };
    },
  });
  if (v !== 'ok') return;

  const ficha = modelo === 'abcd' ? fichaABCD(nome) : { id: uid('f'), nome, treinos: [] };
  state.fichas.push(ficha);
  saveState();
  if (modelo === 'abcd') {
    toast(RESUMO_ABCD.treinos + ' treinos e ' + RESUMO_ABCD.exercicios + ' exercícios criados', 'ok');
  }
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
      { label: 'Salvar', cls: 'btn-primary', value: 'ok', onClick(ov) {
        nome = ov.querySelector('#inpNome').value.trim();
        if (!nome) { modalError('Digite um nome'); return false; }
      } },
      { label: 'Cancelar', cls: 'btn-secondary', value: null },
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
      { label: 'Importar', cls: 'btn-primary', value: 'ok', onClick(ov) {
        ficha = parseTextoFicha(ov.querySelector('#inpTexto').value);
        if (!ficha) {
          modalError('Nenhum exercício reconhecido. Confira o formato acima.');
          return false;
        }
      } },
      { label: 'Cancelar', cls: 'btn-secondary', value: null },
    ],
  });
  if (v !== 'ok' || !ficha) return;
  state.fichas.push(ficha);
  saveState();
  const nEx = ficha.treinos.reduce((a, t) => a + t.exercicios.length, 0);
  toast(ficha.treinos.length + ' treino(s) e ' + nEx + ' exercício(s) importados', 'ok');
  go('/ficha/' + ficha.id);
}
