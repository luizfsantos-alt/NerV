// Ajustes: backup, restauração e informações do app.
//
// O app antigo não tinha nenhuma saída para os dados: limpar o navegador
// apagava anos de treino sem aviso e sem volta.

import { state, exportJSON, importJSON, wipeAll } from '../state.js';
import { fmtDate } from '../util.js';
import { ICON, modal, modalError, confirmDialog, toast, downloadFile } from '../ui.js';
import { back, go } from '../router.js';

export function screenAjustes(params, el) {
  const nSessoes = state.workoutHistory.length + state.cardioHistory.length;
  const primeira = [...state.workoutHistory, ...state.cardioHistory]
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  el.innerHTML =
    '<div class="back" id="back">' + ICON.back + 'Voltar</div>' +
    '<h2>AJUSTES</h2>' +

    '<div class="card"><h3>Seus dados</h3>' +
      '<div class="card-sub" style="line-height:2;">' +
        state.fichas.length + ' ficha(s)<br>' +
        nSessoes + ' sessão(ões) registrada(s)<br>' +
        (primeira ? 'desde ' + fmtDate(primeira.date) : 'nenhum registro ainda') +
      '</div>' +
      '<div class="hint" style="margin-top:12px;">Tudo fica gravado só neste aparelho. Limpar os dados do navegador apaga o histórico — exporte um backup de vez em quando.</div>' +
      '<button class="btn btn-primary btn-small" id="btnExport" style="width:100%;margin-top:8px;">' + ICON.down + 'EXPORTAR BACKUP</button>' +
      '<button class="btn btn-secondary btn-small" id="btnImport" style="width:100%;margin-top:8px;">' + ICON.import + 'RESTAURAR BACKUP</button>' +
      '<input type="file" class="hidden-file" id="importFile" accept="application/json,.json" />' +
    '</div>' +

    '<div class="card"><h3>Zona de risco</h3>' +
      '<div class="hint">Apaga fichas, treinos e histórico deste aparelho. Não tem como desfazer.</div>' +
      '<button class="btn btn-danger btn-small" id="btnWipe" style="width:100%;">APAGAR TUDO</button>' +
    '</div>' +

    '<div class="card"><h3>Sobre</h3>' +
      '<div class="card-sub" style="line-height:2;">' +
        'NERv2 — Neural Engine Routine<br>' +
        'versão <span id="appVer">—</span><br>' +
        'funciona 100% offline<br>' +
        '<span id="netState">—</span>' +
      '</div>' +
      '<button class="btn btn-secondary btn-small" id="btnUpdate" style="width:100%;margin-top:12px;">PROCURAR ATUALIZAÇÃO</button>' +
    '</div>';

  el.querySelector('#back').onclick = back;
  el.querySelector('#appVer').textContent = (window.__NERV_VERSION__ || 'dev');
  pintarRede(el);
  window.addEventListener('online', () => pintarRede(el));
  window.addEventListener('offline', () => pintarRede(el));

  el.querySelector('#btnExport').onclick = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile('nerv2-backup-' + stamp + '.json', exportJSON());
    toast('Backup gerado', 'ok');
  };

  el.querySelector('#btnImport').onclick = () => el.querySelector('#importFile').click();
  el.querySelector('#importFile').onchange = async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const texto = await file.text();

    let modo = null;
    const v = await modal({
      title: 'Restaurar backup',
      body: '<div class="hint">Juntar mantém o que já existe neste aparelho e só acrescenta o que falta. ' +
            'Substituir apaga tudo o que está aqui e usa apenas o backup.</div>',
      buttons: [
        { label: 'JUNTAR', cls: 'btn-primary', value: 'ok', onClick() { modo = 'merge'; } },
        { label: 'SUBSTITUIR TUDO', cls: 'btn-danger', value: 'ok', onClick() { modo = 'replace'; } },
        { label: 'CANCELAR', cls: 'btn-ghost', value: null },
      ],
    });
    if (v !== 'ok' || !modo) return;

    if (modo === 'replace' &&
        !await confirmDialog('Substituir tudo?', 'Seus dados atuais neste aparelho serão apagados.', 'SUBSTITUIR')) return;

    try {
      const r = importJSON(texto, modo);
      toast(r.fichas + ' ficha(s) e ' + r.sessoes + ' sessão(ões) restauradas', 'ok');
      go('/fichas');
    } catch (err) {
      toast(err.message || 'Não foi possível ler o backup.');
    }
  };

  el.querySelector('#btnWipe').onclick = async () => {
    if (!await confirmDialog('Apagar tudo?',
      'Fichas, treinos e todo o histórico deste aparelho serão apagados definitivamente.', 'APAGAR TUDO')) return;
    const ok = await modal({
      title: 'Tem certeza mesmo?',
      body: '<div class="hint">Se ainda não exportou um backup, cancele agora e exporte primeiro.</div>' +
            '<label>Digite APAGAR para confirmar</label><input id="inpWipe" placeholder="APAGAR" />',
      buttons: [
        { label: 'APAGAR DEFINITIVAMENTE', cls: 'btn-danger', value: 'ok', onClick(ov) {
          if (ov.querySelector('#inpWipe').value.trim().toUpperCase() !== 'APAGAR') {
            modalError('Digite APAGAR exatamente.');
            return false;
          }
        } },
        { label: 'CANCELAR', cls: 'btn-ghost', value: null },
      ],
    });
    if (ok !== 'ok') return;
    wipeAll();
    toast('Tudo apagado');
    go('/fichas');
  };

  el.querySelector('#btnUpdate').onclick = async () => {
    if (!('serviceWorker' in navigator)) { toast('Este navegador não suporta atualização offline.'); return; }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { toast('App ainda não instalado como offline.'); return; }
    toast('Procurando atualização…');
    await reg.update();
    setTimeout(() => toast(reg.waiting ? 'Atualização pronta — reabra o app.' : 'Você já está na versão mais recente.', 'ok'), 1200);
  };
}

function pintarRede(el) {
  const n = el.querySelector('#netState');
  if (n) n.textContent = navigator.onLine ? 'conectado' : 'offline — tudo funcionando';
}
