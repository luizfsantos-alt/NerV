// Entrada do app: registra rotas, liga os efeitos e cuida do ciclo do PWA.

import { seedIfEmpty } from './state.js';
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

export const VERSION = '2.0.0';
window.__NERV_VERSION__ = VERSION;

route('fichas', (p, el) => { setBeforeLeave(null); screenFichas(p, el); });
route('ficha', (p, el) => { setBeforeLeave(null); screenTreinos(p, el); });
route('treino', screenWorkout);
route('cardio', screenCardio);
route('historico', (p, el) => { setBeforeLeave(null); screenHistorico(p, el); });
route('stats', (p, el) => { setBeforeLeave(null); screenStats(p, el); });
route('ajustes', (p, el) => { setBeforeLeave(null); screenAjustes(p, el); });

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

// ===== ciclo de vida do PWA =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });

      // Uma versão nova ficou pronta enquanto o app estava aberto.
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Nova versão disponível — feche e reabra o app.', 'ok');
          }
        });
      });
    } catch (e) {
      console.warn('[nerv] service worker não registrado:', e);
    }
  });
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
