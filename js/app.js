// Entrada do app: registra rotas, liga os efeitos e cuida do ciclo do PWA.

import { seedIfEmpty, removerFichaExemplo } from './state.js';
import { setupFX, setupAmbient } from './fx.js';
import { setupAudioPriming, toast } from './ui.js';
import { route, startRouter, go, render } from './router.js';
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
export const VERSION = '2.2.0';
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
setupAmbient();
setupAudioPriming();

document.getElementById('logo').onclick = () => go('/fichas');
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
  toast('NERv2 instalado', 'ok');
});

// Avisa quando a conexão cai — e que isso não muda nada.
window.addEventListener('offline', () => toast('Offline — o app continua funcionando normalmente.'));
