// Células: o elemento de marca do NerV.
//
// Cada série é uma célula. Pendente, ela está em repouso (apagada); a próxima
// acende e pulsa com o coração; fechar a série divide a célula em duas. O
// mesmo par de células-filhas volta na cápsula do exercício, no aviso e na
// Mutação. As imagens vêm do Gemini (docs/redesign/texturas) e cada célula é
// girada e espelhada por semente, para nenhuma série repetir a outra.

export const IMG = {
  repouso: 'assets/tex/cel-repouso.webp',
  mitose: 'assets/tex/cel-mitose.webp',
  celula: 'assets/tex/celula.webp',
  mitoseG: 'assets/tex/mitose.webp',
  cromossomos: 'assets/tex/cromossomos.webp',
  nucleo: 'assets/tex/nucleo.webp',
};

/** Gerador pseudoaleatório com semente: a mesma célula sai sempre igual. */
export function rng(seed) {
  let s = Math.abs(Math.floor(seed)) % 2147483646 + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Orientação da célula: girada entre -40° e 40°, às vezes espelhada. */
function pose(seed) {
  const r = rng(seed * 7919 + 13);
  return 'rotate(' + Math.round((r() - .5) * 80) + 'deg)' + (r() < .5 ? ' scaleX(-1)' : '');
}

/** Conteúdo do botão de série: a célula em repouso e o par já dividido. */
export function cellHTML(seed) {
  return '<span class="cel" style="transform:' + pose(seed) + '">' +
    '<img class="rep" src="' + IMG.repouso + '" alt="" draggable="false">' +
    '<img class="mit" src="' + IMG.mitose + '" alt="" draggable="false">' +
  '</span>';
}

/** Par de células-filhas avulso (cápsula, aviso). */
export function mitoseHTML(seed = 2) {
  return '<img class="mit-ico" src="' + IMG.mitose + '" alt="" draggable="false" style="transform:' + pose(seed) + '">';
}

/**
 * Contração (04): a célula aperta, estica e se divide. A célula em repouso
 * alonga e some enquanto o par de filhas nasce estrangulado no meio e passa
 * do ponto antes de assentar.
 */
export function divide(cellBtn) {
  const rep = cellBtn.querySelector('.rep'), mit = cellBtn.querySelector('.mit');
  if (!rep || !mit) return;
  rep.animate([
    { opacity: 1, transform: 'scale(1)' },
    { opacity: 1, transform: 'scale(.82, .9)', offset: .25 },
    { opacity: 0, transform: 'scale(1.25, .8)' },
  ], { duration: 260, easing: 'cubic-bezier(.4,0,1,1)' });
  mit.animate([
    { opacity: 0, transform: 'scale(.5, .85)' },
    { opacity: 1, transform: 'scale(.62, .9)', offset: .3 },
    { opacity: 1, transform: 'scale(1.12, .96)', offset: .72 },
    { opacity: 1, transform: 'scale(1)' },
  ], { duration: 420, delay: 60, easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards' });
}
