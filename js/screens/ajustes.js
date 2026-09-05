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

    '<div class="card"><h3>Atualização</h3>' +
      '<div class="card-sub" style="line-height:2;">' +
        'app <span id="appVer">—</span><br>' +
        'cache <span id="swVer">—</span><br>' +
        '<span id="verWarn"></span>' +
      '</div>' +
      '<div class="hint" style="margin-top:8px;">Forçar atualização limpa o cache e reinstala o app. ' +
        '<b>Suas fichas e seu histórico não são apagados</b> — só os arquivos do programa.</div>' +
      '<button class="btn btn-primary btn-small" id="btnForce" style="width:100%;">FORÇAR ATUALIZAÇÃO</button>' +
      '<button class="btn btn-secondary btn-small" id="btnUpdate" style="width:100%;margin-top:8px;">PROCURAR ATUALIZAÇÃO</button>' +
    '</div>' +

    '<div class="card"><h3>Sobre</h3>' +
      '<div class="card-sub" style="line-height:2;">' +
        'NERv2 — Neural Engine Routine<br>' +
        'funciona 100% offline<br>' +
        '<span id="netState">—</span>' +
      '</div>' +
    '</div>';

  el.querySelector('#back').onclick = back;
  el.querySelector('#appVer').textContent = (window.__NERV_VERSION__ || 'dev');
  pintarVersaoSW(el);
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
    try { await reg.update(); } catch (e) { toast('Sem conexão para procurar atualização.'); return; }
    setTimeout(() => {
      if (reg.waiting) {
        // Nada de "reabra o app": o toque aplica a troca na hora.
        toast('Atualização pronta — toque para aplicar.', 'ok', () => reg.waiting?.postMessage('skipWaiting'));
      } else {
        toast('Você já está na versão mais recente.', 'ok');
      }
      pintarVersaoSW(el);
    }, 1200);
  };

  // O botão que substitui "apagar os dados de navegação" na mão.
  el.querySelector('#btnForce').onclick = async () => {
    if (!await confirmDialog('Forçar atualização?',
      'O cache e o service worker deste aparelho serão apagados e o app vai recarregar do zero. ' +
      'Suas fichas, treinos e histórico NÃO serão apagados.', 'FORÇAR', false)) return;
    toast('Limpando cache…');
    // A função mora no index.html — que é o arquivo mais recente que o
    // aparelho tem — justamente para funcionar mesmo com o js/ desatualizado.
    if (typeof window.nervHardReset === 'function') { await window.nervHardReset(); return; }
    // Shell antigo demais para ter a função: faz o mesmo aqui.
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
      await Promise.all(regs.map(r => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (e) { console.warn('[nerv] limpeza parcial', e); }
    location.replace(location.pathname + '?nerv-reset=' + Date.now() + '#/fichas');
  };
}

/**
 * Pergunta ao service worker em que versão ele está. Divergir do número do app
 * é o sintoma exato do cache preso — então mostramos o aviso em vez de deixar
 * o usuário adivinhar por que a novidade não chegou.
 */
function pintarVersaoSW(el) {
  const alvo = el.querySelector('#swVer');
  const aviso = el.querySelector('#verWarn');
  if (!alvo) return;

  const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (!sw) { alvo.textContent = 'não instalado'; return; }

  const canal = new MessageChannel();
  const prazo = setTimeout(() => { alvo.textContent = 'sem resposta'; }, 1500);
  canal.port1.onmessage = ev => {
    clearTimeout(prazo);
    const v = (ev.data && ev.data.version) || '—';
    alvo.textContent = v;
    // 'nerv2-v2.1.0' precisa terminar com a versão do app, '2.1.0'.
    if (aviso && !v.endsWith(window.__NERV_VERSION__ || '')) {
      aviso.innerHTML = '<span style="color:var(--red);">o cache ficou para trás — force a atualização</span>';
    }
  };
  try { sw.postMessage({ type: 'version' }, [canal.port2]); }
  catch (e) { clearTimeout(prazo); alvo.textContent = 'sem resposta'; }
}

function pintarRede(el) {
  const n = el.querySelector('#netState');
  if (n) n.textContent = navigator.onLine ? 'conectado' : 'offline — tudo funcionando';
}
