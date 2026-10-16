// Entrada do app: registra rotas, liga os efeitos e cuida do ciclo do PWA.

import { seedIfEmpty, removerFichaExemplo } from './state.js';
import { setupFX, setupHeart, scan, setRhythm, firstBeat, ambient } from './fx.js';
import { setupAudioPriming, toast } from './ui.js';
import { route, startRouter, go, render, onRender } from './router.js';
import { isResting } from './timers.js';
import { screenFichas } from './screens/fichas.js';
import { screenTreinos } from './screens/treinos.js';
import { screenWorkout } from './screens/workout.js';
import { screenCardio } from './screens/cardio.js';
import { screenHistorico } from './screens/historico.js';
import { screenStats } from './screens/stats.js';
import { screenAjustes } from './screens/ajustes.js';
import { setBeforeLeave } from './router.js';

// Anda junto com o VERSION do sw.js. A tela de Ajustes mostra os dois lado a
// lado justamente para denunciar quando o service worker fica para trás.
export const VERSION = '3.4.0';
window.__NERV_VERSION__ = VERSION;

// O resgate de emergência do index.html recarrega com ?nerv-reset=... para
// furar o cache HTTP. Cumprido o papel, o parâmetro sai do endereço.
if (location.search.includes('nerv-reset=')) {
  history.replaceState(null, '', location.pathname + (location.hash || '#/fichas'));
}

route('fichas', (p, el) => { setBeforeLeave(null); screenFichas(p, el); });
route('ficha', (p, el) => { setBeforeLeave(null); screenTreinos(p, el); });
route('treino', screenWorkout);
route('cardio', screenCardio);
route('historico', (p, el) => { setBeforeLeave(null); screenHistorico(p, el); });
route('stats', (p, el) => { setBeforeLeave(null); screenStats(p, el); });
route('ajustes', (p, el) => { setBeforeLeave(null); screenAjustes(p, el); });

// A ficha de exemplo das versões antigas sai antes; se o aparelho ficar sem
// nenhuma ficha, a ABCD entra no lugar.
removerFichaExemplo();
seedIfEmpty();
setupFX();
setupHeart();
setupAudioPriming();

// O topo diz onde você está e como o organismo está; a tela entra varrendo.
const ONDE = {
  fichas: 'Lâminas', ficha: 'Lâmina', treino: 'Amostra', cardio: 'Cardio',
  historico: 'Arquivo', stats: 'Leitura', ajustes: 'Ajustes',
};
let primeira = true;
onRender((name, screen) => {
  document.getElementById('roWhere').textContent = ONDE[name] || 'Lâminas';
  // Treino e cardio ditam o próprio ritmo; o descanso, quando corre, também.
  if (name !== 'treino' && name !== 'cardio' && !isResting()) {
    setRhythm(52, name === 'stats' || name === 'historico' ? 'Histórico em leitura' : 'Organismo em repouso');
  }
  if (primeira) { primeira = false; abertura(); }
  scan(screen);
});

/** Abertura (C): uma vez por carregamento, a membrana acende e a marca estica. */
function abertura() {
  if (!ambient()) return;
  document.querySelector('.membrane').animate([{ opacity: 0 }, { opacity: .6 }], { duration: 600, easing: 'cubic-bezier(.7,0,.2,1)' });
  document.getElementById('logo').animate([{ fontStretch: '50%', opacity: 0 }, { fontStretch: '125%', opacity: 1 }], { duration: 600, easing: 'cubic-bezier(.7,0,.2,1)' });
  firstBeat();
}

const logo = document.getElementById('logo');
logo.onclick = () => go('/fichas');
logo.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('/fichas'); } };
document.getElementById('btnAjustes').onclick = () => go('/ajustes');

// Botões da barra de descanso (fica fora das telas, sempre montada).
document.getElementById('restAdd').onclick = async () => {
  const { addRestTime } = await import('./timers.js');
  addRestTime(30);
};
document.getElementById('restSkip').onclick = async () => {
  const { stopRest } = await import('./timers.js');
  stopRest();
};

startRouter();

// Sinaliza para o vigia de inicialização do index.html que o app subiu.
window.__NERV_BOOTED__ = true;

// ===== ciclo de vida do PWA =====
//
// Duas peças resolvem o app que nunca atualizava:
//  - `updateViaCache: 'none'` impede que o próprio sw.js venha do cache HTTP;
//  - `procurarAtualizacao()` roda na carga e sempre que o app volta do segundo
//    plano. Num PWA instalado quase não existe navegação de verdade, então sem
//    isso o navegador podia passar dias sem checar por uma versão nova.
const UPDATE_INTERVAL = 15 * 60 * 1000;
let ultimaChecagem = 0;
let registro = null;

async function procurarAtualizacao(forcar = false) {
  if (!registro) return;
  const agora = Date.now();
  if (!forcar && agora - ultimaChecagem < UPDATE_INTERVAL) return;
  ultimaChecagem = agora;
  try { await registro.update(); } catch (e) { /* offline: tenta na próxima */ }
}

/** Avisa que há versão nova e aplica a troca no toque, sem fechar o app. */
function avisarAtualizacao() {
  toast('Nova versão disponível — toque para atualizar.', 'ok', () => {
    registro?.waiting?.postMessage('skipWaiting');
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      registro = await navigator.serviceWorker.register('./sw.js', {
        scope: './',
        updateViaCache: 'none',
      });

      // Uma versão nova ficou pronta enquanto o app estava aberto. Em vez de
      // exigir fechar tudo, o toque no aviso já aplica a troca na hora.
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });

      // Já havia uma versão esperando de uma sessão anterior.
      if (registro.waiting && navigator.serviceWorker.controller) avisarAtualizacao();

      registro.addEventListener('updatefound', () => {
        const sw = registro.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) avisarAtualizacao();
        });
      });

      procurarAtualizacao(true);
    } catch (e) {
      console.warn('[nerv] service worker não registrado:', e);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) procurarAtualizacao();
  });
  window.addEventListener('online', () => procurarAtualizacao(true));
}

// Banner de instalação — só aparece se o navegador realmente puder instalar.
let deferredPrompt = null;
const banner = document.getElementById('installBanner');

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  if (!localStorage.getItem('nerv2_install_dismissed')) banner.classList.add('active');
});

document.getElementById('btnInstall').onclick = async () => {
  banner.classList.remove('active');
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
};

document.getElementById('btnInstallNo').onclick = () => {
  banner.classList.remove('active');
  try { localStorage.setItem('nerv2_install_dismissed', '1'); } catch (e) {}
};

window.addEventListener('appinstalled', () => {
  banner.classList.remove('active');
  toast('NerV instalado', 'ok');
});

// Avisa quando a conexão cai — e que isso não muda nada.
window.addEventListener('offline', () => toast('Offline — o app continua funcionando normalmente.'));
