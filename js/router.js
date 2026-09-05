// Navegação por hash + History API.
//
// O app original trocava telas chamando funções que reescreviam o <main>.
// Resultado: no Android o botão físico "voltar" fechava o app em vez de voltar
// de tela, e não dava para recarregar/compartilhar uma tela específica.

const routes = new Map();
let current = null;
let beforeLeave = null;

/** Registra uma tela: nome -> função(params) que devolve/monta o HTML. */
export function route(name, handler) { routes.set(name, handler); }

/**
 * Permite que uma tela intercepte a saída (ex.: treino em andamento).
 * O handler recebe o destino e devolve true para liberar, ou uma Promise<boolean>.
 */
export function setBeforeLeave(fn) { beforeLeave = fn; }

export function currentRoute() { return current; }

function parseHash() {
  const raw = (location.hash || '#/fichas').replace(/^#/, '');
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const name = parts[0] || 'fichas';
  const params = {};
  if (query) new URLSearchParams(query).forEach((v, k) => { params[k] = v; });
  if (parts[1]) params.id = decodeURIComponent(parts[1]);
  if (parts[2]) params.sub = decodeURIComponent(parts[2]);
  return { name, params };
}

/** Navega para uma rota. `replace` troca a entrada atual em vez de empilhar. */
export function go(path, { replace = false } = {}) {
  const target = path.startsWith('#') ? path : '#' + path;
  if (location.hash === target) { render(); return; }
  if (replace) history.replaceState(null, '', target);
  else location.hash = target;
  if (replace) render();
}

export function back() {
  if (history.length > 1) history.back();
  else go('/fichas', { replace: true });
}

let rendering = false;

export async function render() {
  if (rendering) return;
  const { name, params } = parseHash();
  const handler = routes.get(name) || routes.get('fichas');

  if (beforeLeave && current && current.name !== name) {
    const ok = await beforeLeave({ name, params });
    if (!ok) return;   // a tela cancelou a saída e já cuidou de restaurar o hash
  }

  rendering = true;
  try {
    const main = document.getElementById('main');
    main.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'screen';
    screen.id = 'screen-' + name;
    main.appendChild(screen);
    current = { name, params };
    await handler(params, screen);
    main.scrollTop = 0;
  } finally {
    rendering = false;
  }
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  if (!location.hash) history.replaceState(null, '', '#/fichas');
  render();
}
