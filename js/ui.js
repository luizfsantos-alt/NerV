// Peças de interface compartilhadas: ícones, toasts, modais e confirmações.
//
// O app antigo usava confirm()/alert()/prompt() nativos. Em PWA instalado no
// iOS eles são feios, bloqueiam a thread e quebram completamente a identidade
// visual. Aqui tudo passa por modais próprios.

import { escapeHtml } from './util.js';
import { primeAudio } from './fx.js';

export const ICON = {
  plus:    '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
  import:  '<svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>',
  history: '<svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>',
  stats:   '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>',
  back:    '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
  rest:    '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
  start:   '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  edit:    '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
  gear:    '<svg viewBox="0 0 24 24"><path d="M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.24-1.12.55-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.5.39 1.04.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.24 1.12-.55 1.62-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>',
  down:    '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
  gps:     '<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A9 9 0 0 0 13 3.06V1h-2v2.06A9 9 0 0 0 3.06 11H1v2h2.06A9 9 0 0 0 11 20.94V23h2v-2.06A9 9 0 0 0 20.94 13H23v-2h-2.06zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z"/></svg>',
};

// ===== toast =====
export function toast(msg, kind = '') {
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 260);
  }, kind === 'ok' ? 2200 : 3200);
}

// ===== modal genérico =====
let openOverlay = null;

/**
 * Abre um modal. `body` é HTML; `buttons` é [{label, cls, value}].
 * Devolve uma Promise com o `value` do botão clicado (null se cancelado),
 * e entrega o elemento do modal via `onMount` para quem precisa ler campos.
 */
export function modal({ title, body = '', buttons = [], onMount, dismissible = true }) {
  return new Promise(resolve => {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<h3>' + escapeHtml(title) + '</h3>' +
        body +
        '<div class="error" id="modalError"></div>' +
        buttons.map((b, i) =>
          '<button class="btn ' + (b.cls || 'btn-secondary') + '" data-mi="' + i + '">' + (b.label) + '</button>'
        ).join('') +
      '</div>';
    document.body.appendChild(overlay);
    openOverlay = overlay;

    const done = val => { closeModal(); resolve(val); };

    overlay.querySelectorAll('[data-mi]').forEach(btn => {
      btn.onclick = () => {
        const b = buttons[+btn.dataset.mi];
        // Um botão pode validar antes: se onClick devolver false, o modal fica aberto.
        if (b.onClick && b.onClick(overlay) === false) return;
        done(b.value === undefined ? null : b.value);
      };
    });

    if (dismissible) {
      overlay.addEventListener('click', e => { if (e.target === overlay) done(null); });
    }
    const onKey = e => {
      if (e.key === 'Escape' && dismissible) { document.removeEventListener('keydown', onKey); done(null); }
    };
    document.addEventListener('keydown', onKey);

    onMount && onMount(overlay);
    const first = overlay.querySelector('input, textarea');
    if (first) setTimeout(() => first.focus(), 60);
  });
}

export function closeModal() {
  if (openOverlay) { openOverlay.remove(); openOverlay = null; }
}

export function modalError(msg) {
  const el = document.getElementById('modalError');
  if (el) el.textContent = msg || '';
}

/** Substitui o confirm() nativo. */
export function confirmDialog(title, texto, okLabel = 'CONFIRMAR', danger = true) {
  return modal({
    title,
    body: '<div class="hint">' + escapeHtml(texto) + '</div>',
    buttons: [
      { label: okLabel, cls: danger ? 'btn-danger' : 'btn-primary', value: true },
      { label: 'CANCELAR', cls: 'btn-ghost', value: false },
    ],
  }).then(v => v === true);
}

/** Substitui o prompt() nativo. Lê o campo ANTES do modal ser removido. */
export function promptValue(opts) {
  return new Promise(resolve => {
    let captured = null;
    modal({
      title: opts.title,
      body:
        (opts.hint ? '<div class="hint">' + escapeHtml(opts.hint) + '</div>' : '') +
        '<label>' + escapeHtml(opts.label) + '</label>' +
        '<input id="promptInput" type="' + (opts.type || 'text') + '" ' +
          ((opts.type === 'number') ? 'inputmode="decimal" step="any" ' : '') +
          'value="' + escapeHtml(opts.value || '') + '" placeholder="' + escapeHtml(opts.placeholder || '') + '" />',
      buttons: [
        {
          label: opts.okLabel || 'OK', cls: 'btn-primary', value: 'ok',
          onClick(ov) { captured = ov.querySelector('#promptInput').value; },
        },
        { label: 'CANCELAR', cls: 'btn-ghost', value: null },
      ],
      onMount(ov) {
        ov.querySelector('#promptInput').addEventListener('keydown', e => {
          if (e.key === 'Enter') ov.querySelector('[data-mi="0"]').click();
        });
      },
    }).then(v => resolve(v === 'ok' ? captured : null));
  });
}

/** Entrega um arquivo para download (backup JSON). */
export function downloadFile(name, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Primeiro toque na tela libera o áudio no iOS. */
export function setupAudioPriming() {
  const once = () => { primeAudio(); document.removeEventListener('pointerdown', once); };
  document.addEventListener('pointerdown', once);
}
