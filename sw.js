// Service worker do NERv2.
//
// Duas exigências que puxam para lados opostos:
//
//  - o cenário real de uso é uma academia no subsolo, sem sinal: o app precisa
//    abrir e funcionar inteiro sem rede;
//  - uma versão nova precisa chegar sozinha, sem o usuário ter que limpar os
//    dados de navegação na mão.
//
// A versão anterior era cache-first para tudo, inclusive os .js. Dentro de uma
// mesma versão de cache nenhum módulo era jamais rebuscado, e nada disparava a
// procura por um SW novo além do botão da tela de Ajustes — que, por ser código
// da aplicação, também estava preso no cache. O impasse só quebrava apagando os
// dados do site.
//
// Agora o código do app (shell, .js, .css, manifest) é network-first com um
// timeout curto: com internet, a versão nova chega na próxima abertura; sem
// rede — ou com a rede ruim de subsolo — o fetch estoura em NET_TIMEOUT e o
// cache responde. O offline continua sendo 100%. Fontes, ícones e imagens
// seguem cache-first: são grandes, mudam junto com a versão e não vale gastar
// rede com elas.

const VERSION = 'nerv2-v2.1.0';
const CACHE = VERSION;

// Rede lenta não pode segurar a abertura do app. Passou disto, o cache assume.
const NET_TIMEOUT = 2500;

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
    // Não chamamos skipWaiting aqui: trocar o SW sozinho recarregaria a tela
    // no meio de um treino. Quem decide é o app, via mensagem 'skipWaiting'
    // (toast "toque para atualizar" em app.js) — ou, sem toque nenhum, no
    // próximo abrir do zero, quando não sobra nenhum client do SW antigo.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/** Código do app: precisa poder mudar sem depender de um SW novo. */
function isCode(url, req) {
  if (req.mode === 'navigate') return true;
  return /\.(?:js|mjs|css|webmanifest)$/.test(url.pathname);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // nada externo a servir

  // Navegação (abrir o app, recarregar) sempre resolve pelo shell: as rotas
  // são hash, então qualquer endereço é o mesmo index.html.
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(new Request('./index.html', { cache: 'reload' }), './index.html'));
    return;
  }

  if (isCode(url, req)) {
    event.respondWith(networkFirst(req, req));
    return;
  }

  // Fontes, ícones, imagens: cache-first, com preenchimento no primeiro acesso.
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
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

/**
 * Tenta a rede por NET_TIMEOUT ms e cai para o cache em qualquer tropeço
 * (offline, DNS travado, wifi de academia que conecta mas não navega).
 * `cacheKey` é o que procurar no cache — para navegação é sempre o shell.
 */
async function networkFirst(req, cacheKey) {
  try {
    const res = await withTimeout(fetch(req), NET_TIMEOUT);
    if (res && res.ok && res.type === 'basic') {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(cacheKey, clone)).catch(() => {});
      return res;
    }
    // 404/500 do servidor: o cache ainda é melhor resposta que um erro.
    const cached = await caches.match(cacheKey, { ignoreSearch: true });
    return cached || res;
  } catch (e) {
    const cached = await caches.match(cacheKey, { ignoreSearch: true });
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); }
    );
  });
}

self.addEventListener('message', event => {
  // A tela de ajustes pode pedir a troca imediata de versão.
  if (event.data === 'skipWaiting') { self.skipWaiting(); return; }

  // ...e perguntar em que versão o SW está. Se o número divergir do que o
  // app.js informa, é sinal claro de que o SW ficou para trás.
  if (event.data && event.data.type === 'version') {
    event.ports[0] && event.ports[0].postMessage({ version: VERSION });
  }
});
