// Tela de uma ficha: seus treinos, com criação, EDIÇÃO e importação de planilha.
//
// O app original só permitia criar e apagar. Para mudar a carga de um
// exercício era preciso apagar o treino inteiro e digitar tudo de novo.

import { state, saveState } from '../state.js';
import { escapeHtml, uid, num } from '../util.js';
import { ICON, modal, modalError, confirmDialog, toast } from '../ui.js';
import { parseCSV, rowsToTreinos } from '../importers.js';
import { go, back, render } from '../router.js';

export function findFicha(id) { return state.fichas.find(f => f.id === id); }

export function screenTreinos(params, el) {
  const ficha = findFicha(params.id);
  if (!ficha) { go('/fichas', { replace: true }); return; }

  let html = '<div class="back" id="back">' + ICON.back + 'Fichas</div>';
  html += '<h2>' + escapeHtml(ficha.nome) + '</h2>';
  html += '<button class="btn btn-primary" id="btnNovo">' + ICON.plus + 'Novo Treino</button>';
  html += '<button class="btn btn-secondary" id="btnUpload">' + ICON.import + 'Importar Excel / CSV</button>';
  html += '<input type="file" class="hidden-file" id="fileInput" accept=".xlsx,.csv,.tsv,text/csv" />';

  if (!ficha.treinos.length) {
    html += '<div class="empty">Nenhum treino nesta ficha.<br>Crie um ou importe de uma planilha.</div>';
  } else {
    ficha.treinos.forEach(t => {
      const series = t.exercicios.reduce((a, e) => a + (e.series || 0), 0);
      html += '<div class="card">';
      html += '<div class="edit-btn" data-edit="' + t.id + '" title="Editar">' + ICON.edit + '</div>';
      html += '<div class="delete-btn" data-del="' + t.id + '" title="Excluir">X</div>';
      html += '<div class="card-title">' + escapeHtml(t.nome) + '</div>';
      html += '<div class="card-sub">' + t.exercicios.length + ' exercício(s) · ' + series + ' séries</div>';
      html += '<div style="margin-top:8px;color:var(--gray);font-family:var(--font-mono);font-size:11px;line-height:1.7;">' +
        t.exercicios.slice(0, 4).map(e => escapeHtml(e.nome) + ' <span style="color:var(--muted)">' + e.series + '×' + escapeHtml(e.reps) + '</span>').join('<br>') +
        (t.exercicios.length > 4 ? '<br><span style="color:var(--muted)">+' + (t.exercicios.length - 4) + ' …</span>' : '') +
        '</div>';
      html += '<button class="btn btn-primary btn-small iniciar" data-id="' + t.id + '" style="margin-top:12px;">' + ICON.start + 'INICIAR</button>';
      html += '</div>';
    });
  }
  el.innerHTML = html;

  el.querySelector('#back').onclick = back;
  el.querySelector('#btnNovo').onclick = () => editarTreino(ficha, null);
  el.querySelector('#btnUpload').onclick = () => el.querySelector('#fileInput').click();
  el.querySelector('#fileInput').onchange = e => handleUpload(e, ficha);

  el.querySelectorAll('.iniciar').forEach(b =>
    b.onclick = () => go('/treino/' + ficha.id + '/' + b.dataset.id));
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    editarTreino(ficha, ficha.treinos.find(t => t.id === b.dataset.edit));
  });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    const t = ficha.treinos.find(x => x.id === b.dataset.del);
    if (!t) return;
    if (!await confirmDialog('Excluir treino?', '"' + t.nome + '" será removido da ficha.', 'EXCLUIR')) return;
    ficha.treinos = ficha.treinos.filter(x => x.id !== b.dataset.del);
    saveState();
    render();
    toast('Treino excluído');
  });
}

/** Uma linha do editor de exercícios. */
function exRow(ex = {}) {
  return '<div class="ex-edit-row">' +
    '<input class="ex-nome" placeholder="Exercício" value="' + escapeHtml(ex.nome || '') + '" />' +
    '<input class="ex-series" type="number" inputmode="numeric" min="1" max="20" placeholder="4" value="' + (ex.series ?? '') + '" />' +
    '<input class="ex-reps" placeholder="8-12" value="' + escapeHtml(ex.reps ?? '') + '" />' +
    '<input class="ex-carga" type="number" inputmode="decimal" step="any" placeholder="kg" value="' + (ex.carga || '') + '" />' +
    '<input class="ex-int" type="number" inputmode="numeric" placeholder="90" value="' + (ex.intervalo ?? '') + '" />' +
    '<button class="mini-del" type="button" title="Remover">X</button>' +
  '</div>';
}

/** Cria ou edita um treino, com o editor completo de exercícios. */
async function editarTreino(ficha, treino) {
  const isNew = !treino;
  const base = treino || { nome: '', exercicios: [] };
  let resultado = null;

  const v = await modal({
    title: isNew ? 'Novo Treino' : 'Editar Treino',
    body:
      '<label>Nome do treino</label>' +
      '<input id="inpNome" placeholder="Ex: A — Peito/Tríceps" value="' + escapeHtml(base.nome) + '" />' +
      '<label style="margin-top:6px;">Exercícios</label>' +
      '<div class="ex-edit-head"><span>Nome</span><span>Sér</span><span>Reps</span><span>Carga</span><span>Desc</span><span></span></div>' +
      '<div id="exList">' + (base.exercicios.length ? base.exercicios.map(exRow).join('') : exRow()) + '</div>' +
      '<button class="btn btn-secondary btn-small" type="button" id="btnAddEx" style="width:100%;margin:6px 0 14px;">' + ICON.plus + 'Adicionar exercício</button>',
    buttons: [
      { label: isNew ? 'CRIAR' : 'SALVAR', cls: 'btn-primary', value: 'ok', onClick(ov) {
        const nome = ov.querySelector('#inpNome').value.trim();
        if (!nome) { modalError('Digite um nome para o treino'); return false; }
        const exercicios = [...ov.querySelectorAll('.ex-edit-row')].map(r => ({
          nome: r.querySelector('.ex-nome').value.trim(),
          series: Math.max(1, Math.min(20, parseInt(r.querySelector('.ex-series').value) || 3)),
          reps: r.querySelector('.ex-reps').value.trim() || '10',
          carga: num(r.querySelector('.ex-carga').value),
          intervalo: Math.max(0, Math.min(900, parseInt(r.querySelector('.ex-int').value) || 60)),
        })).filter(e => e.nome);
        if (!exercicios.length) { modalError('Adicione pelo menos um exercício'); return false; }
        resultado = { nome, exercicios };
      } },
      { label: 'CANCELAR', cls: 'btn-ghost', value: null },
    ],
    onMount(ov) {
      const list = ov.querySelector('#exList');
      const bind = () => list.querySelectorAll('.mini-del').forEach(b => b.onclick = () => {
        if (list.children.length > 1) b.closest('.ex-edit-row').remove();
        else b.closest('.ex-edit-row').querySelectorAll('input').forEach(i => i.value = '');
      });
      bind();
      ov.querySelector('#btnAddEx').onclick = () => {
        list.insertAdjacentHTML('beforeend', exRow());
        bind();
        const rows = list.querySelectorAll('.ex-edit-row');
        rows[rows.length - 1].querySelector('.ex-nome').focus();
      };
    },
  });

  if (v !== 'ok' || !resultado) return;
  if (isNew) {
    ficha.treinos.push({ id: uid('t'), nome: resultado.nome, exercicios: resultado.exercicios });
  } else {
    treino.nome = resultado.nome;
    treino.exercicios = resultado.exercicios;
  }
  saveState();
  render();
  toast(isNew ? 'Treino criado' : 'Treino salvo', 'ok');
}

async function handleUpload(e, ficha) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';   // permite reenviar o mesmo arquivo
  if (!file) return;

  try {
    let rows;
    if (/\.(csv|tsv|txt)$/i.test(file.name)) {
      rows = parseCSV(await file.text());
    } else {
      // Só carrega o leitor de xlsx quando realmente precisa dele.
      const { readXlsx, xlsxSupported } = await import('../xlsx-lite.js');
      if (!xlsxSupported) {
        toast('Este navegador não lê .xlsx. Exporte a planilha como .csv.');
        return;
      }
      rows = await readXlsx(await file.arrayBuffer());
    }

    const treinos = rowsToTreinos(rows);
    if (!treinos.length) {
      toast('Nenhum exercício reconhecido. Use as colunas: Nome | Séries | Reps | Carga | Intervalo.');
      return;
    }
    ficha.treinos.push(...treinos);
    saveState();
    render();
    const nEx = treinos.reduce((a, t) => a + t.exercicios.length, 0);
    toast(treinos.length + ' treino(s) e ' + nEx + ' exercício(s) importados', 'ok');
  } catch (err) {
    console.error(err);
    toast('Erro ao ler o arquivo: ' + (err.message || err));
  }
}
