// Service worker do NERv2.
//
// Estratégia: cache-first para tudo o que forma o app. O cenário real de uso é
// uma academia no subsolo, sem sinal — então nada aqui pode depender da rede.
// A rede só é consultada para descobrir versões novas, em segundo plano.

const VERSION = 'nerv2-v2.0.0';
const CACHE = VERSION;

// Tudo o que o app precisa para abrir do zero, offline.
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './css/fonts.css',
  './js/app.js',
  './js/router.js',
  './js/state.js',
  './js/util.js',
  './js/ui.js',
  './js/fx.js',
  './js/timers.js',
  './js/progress.js',
  './js/importers.js',
  './js/xlsx-lite.js',
  './js/screens/fichas.js',
  './js/screens/treinos.js',
  './js/screens/workout.js',
  './js/screens/cardio.js',
  './js/screens/historico.js',
  './js/screens/stats.js',
  './js/screens/ajustes.js',
  './assets/logo.jpg',
  './assets/mascot.jpg',
  './assets/mascot-head.jpg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png',
  './assets/fonts/anton-400-latin.woff2',
  './assets/fonts/orbitron-var-latin.woff2',
  './assets/fonts/share-tech-mono-400-latin.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll falha por inteiro se um item cair; guardamos um a um para que um
    // arquivo problemático não impeça a instalação do resto.
    await Promise.all(PRECACHE.map(async url => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (e) {
        console.warn('[sw] não consegui pré-cachear', url, e);
      }
    }));
    // Não chamamos skipWaiting: trocar o SW no meio de um treino recarregaria
    // a tela. A versão nova assume no próximo abrir do app.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // nada externo a servir

  // Navegação (abrir o app, recarregar): devolve o shell do cache.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match('./index.html');
      if (cached) {
        // Atualiza o shell em segundo plano, sem travar a abertura.
        event.waitUntil(refresh('./index.html'));
        return cached;
      }
      try { return await fetch(req); }
      catch (e) { return new Response('Offline', { status: 503, statusText: 'Offline' }); }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      // Guarda o que for do próprio app, para a próxima vez já sair do cache.
      if (res && res.ok && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
      }
      return res;
    } catch (e) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});

async function refresh(url) {
  try {
    const res = await fetch(url, { cache: 'reload' });
    if (res && res.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(url, res);
    }
  } catch (e) { /* offline: o cache já resolveu */ }
}

// A tela de ajustes pode pedir a troca imediata de versão.
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
