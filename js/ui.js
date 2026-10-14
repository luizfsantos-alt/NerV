// Peças de interface compartilhadas: ícones, toasts, modais e confirmações.
//
// O app antigo usava confirm()/alert()/prompt() nativos. Em PWA instalado no
// iOS eles são feios, bloqueiam a thread e quebram completamente a identidade
// visual. Aqui tudo passa por modais próprios.

import { escapeHtml } from './util.js';
import { primeAudio, motionOK, read } from './fx.js';
import { mitoseHTML } from './cells.js';

// Ícones em SVG de traço reto (o CSS dá a cor e a espessura). Sem emoji.
const ic = d => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + d + '" stroke-linecap="square"/></svg>';
export const ICON = {
  plus:    ic('M12 4v16M4 12h16'),
  import:  ic('M12 15V3M7 8l5-5 5 5M4 15v5h16v-5'),
  history: ic('M4 6h16M4 12h16M4 18h10'),
  stats:   ic('M5 20V11M12 20V5M19 20v-6M3 20h18'),
  back:    ic('M20 12H5M11 5l-7 7 7 7'),
  go:      ic('M5 12h14M13 5l7 7-7 7'),
  rest:    ic('M3 12h4l2-5 3 10 2-7 2 4h5'),
  start:   ic('M7 4l12 8-12 8z'),
  edit:    ic('M4 20h4L19 9l-4-4L4 16zM13 7l4 4'),
  trash:   ic('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6'),
  down:    ic('M12 3v12M7 10l5 5 5-5M4 20h16'),
  gps:     ic('M12 2v4M12 18v4M2 12h4M18 12h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z'),
  hide:    ic('M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4'),
};

// ===== aviso (B) =====
// Uma tira impressa sai do topo, com o texto em Leitura e a célula ao lado.
// `onClick`, quando passado, mantém o aviso na tela até ser tocado (usado
// pelo aviso de atualização do service worker, que não deve sumir sozinho).
export function toast(msg, kind = '', onClick = null) {
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.setAttribute('role', 'status');
  const icon = document.createElement('i');
  icon.innerHTML = mitoseHTML(kind === 'err' ? 5 : 2);
  const txt = document.createElement('span');
  el.append(icon, txt);
  wrap.appendChild(el);
  read(txt, msg);
  if (motionOK()) el.animate([{ transform: 'translateY(-100%)' }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,0,0,1)' });
  const dismiss = () => {
    const fin = () => el.remove();
    if (!motionOK()) return fin();
    el.animate([{ transform: 'none' }, { transform: 'translateY(-100%)', opacity: 0 }], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)' }).onfinish = fin;
  };
  if (onClick) {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => { onClick(); dismiss(); }, { once: true });
  } else {
    setTimeout(dismiss, 2400 + Math.min(2000, msg.length * 25));
  }
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
    // Até dois botões ficam lado a lado (o principal à direita, onde o polegar
    // alcança); com três ou mais, empilham.
    const lado = buttons.length <= 2;
    const ordem = lado ? [...buttons.keys()].reverse() : [...buttons.keys()];
    overlay.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">' +
        '<i class="reg a"></i><i class="reg b"></i><i class="reg c"></i><i class="reg d"></i>' +
        '<h3 id="modalTitle" tabindex="-1">' + escapeHtml(title) + '</h3>' +
        body +
        '<div class="error" id="modalError" role="alert"></div>' +
        '<div class="modal-btns' + (lado ? '' : ' stack') + '">' +
        ordem.map(i =>
          '<button type="button" class="btn ' + (buttons[i].cls || 'btn-secondary') + '" data-mi="' + i + '">' + (buttons[i].label) + '</button>'
        ).join('') +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    openOverlay = overlay;
    const lastFocus = document.activeElement;
    entrar(overlay);

    const done = val => {
      closeModal();
      if (lastFocus && lastFocus.isConnected && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      resolve(val);
    };

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
    else overlay.querySelector('#modalTitle').focus({ preventScroll: true });
  });
}

export function closeModal() {
  if (!openOverlay) return;
  const ov = openOverlay;
  openOverlay = null;
  if (!motionOK()) { ov.remove(); return; }
  ov.style.pointerEvents = 'none';
  ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
  ov.querySelector('.modal').animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)' })
    .onfinish = () => ov.remove();
}

/** Lâmina (A): sobe como uma lâmina sob a lente; as marcas chegam e travam nos cantos. */
function entrar(ov) {
  const m = ov.querySelector('.modal');
  if (!motionOK()) return;
  ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  m.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,0,0,1)' });
  const off = { a: '-14px,-14px', b: '14px,-14px', c: '-14px,14px', d: '14px,14px' };
  m.querySelectorAll('.reg').forEach(r => {
    const k = [...r.classList].find(c => off[c]);
    r.animate([{ transform: `translate(${off[k]})`, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 240, delay: 140, easing: 'cubic-bezier(.5,1.6,.4,1)', fill: 'backwards' });
  });
}

export function modalError(msg) {
  const el = document.getElementById('modalError');
  if (el) el.textContent = msg || '';
}

/** Substitui o confirm() nativo. */
export function confirmDialog(title, texto, okLabel = 'Confirmar', danger = true) {
  return modal({
    title,
    body: '<div class="hint">' + escapeHtml(texto) + '</div>',
    buttons: [
      { label: okLabel, cls: danger ? 'btn-danger' : 'btn-primary', value: true },
      { label: 'Voltar', cls: 'btn-secondary', value: false },
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
        { label: 'Cancelar', cls: 'btn-secondary', value: null },
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
