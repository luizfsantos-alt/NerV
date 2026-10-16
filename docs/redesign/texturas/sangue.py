"""Leva as imagens do app do violeta de contraste para o vermelho-sangue (3.4.0).

Uso: python3 docs/redesign/texturas/sangue.py   (na raiz do repositório)

Aplica nos arquivos de assets/tex/ as mesmas matrizes de cor dos filtros CSS
que a mesa aprovou na prévia, para o resultado ficar idêntico sem pagar filtro
em tempo real nas células que pulsam a cada batida:
  - células e cromossomos: hue-rotate(95deg) saturate(1.3)
  - membrana (fundo):      hue-rotate(-12deg) saturate(1.2) brightness(.8)
  - fibra (cards):         grayscale(1) contrast(1.3)
Cada imagem só é convertida se ainda for o arquivo violeta original, então
rodar de novo não estraga nada.
"""
from hashlib import sha256
from math import cos, sin, radians
from pathlib import Path
import numpy as np
from PIL import Image

TEX = Path('assets/tex')


def hue(deg):
    c, s = cos(radians(deg)), sin(radians(deg))
    return np.array([
        [.213 + c * .787 - s * .213, .715 - c * .715 - s * .715, .072 - c * .072 + s * .928],
        [.213 - c * .213 + s * .143, .715 + c * .285 + s * .140, .072 - c * .072 - s * .283],
        [.213 - c * .213 - s * .787, .715 - c * .715 + s * .715, .072 + c * .928 + s * .072],
    ])


def saturate(k):
    return np.array([
        [.213 + .787 * k, .715 - .715 * k, .072 - .072 * k],
        [.213 - .213 * k, .715 + .285 * k, .072 - .072 * k],
        [.213 - .213 * k, .715 - .715 * k, .072 + .928 * k],
    ])


def aplica(rgb, *ops):
    out = rgb
    for op in ops:
        out = np.clip(op(out), 0, 1)
    return out


def matriz(m):
    return lambda a: a @ m.T


def brilho(k):
    return lambda a: a * k


def contraste(k):
    return lambda a: (a - .5) * k + .5


CELULAS = ['cel-repouso', 'cel-mitose', 'celula', 'mitose', 'cromossomos', 'nucleo']
RECEITAS = {n: (matriz(hue(95)), matriz(saturate(1.3))) for n in CELULAS}
RECEITAS['membrana'] = (matriz(hue(-12)), matriz(saturate(1.2)), brilho(.8))
RECEITAS['fibra'] = (matriz(saturate(0)), contraste(1.3))


# Assinatura dos arquivos violeta (3.3.0). Só esses são convertidos.
ORIGINAIS = {
    'cel-repouso': '0a157ec6f9529108', 'cel-mitose': 'f2bd6a470942341e',
    'celula': '220c1e700fe339a9', 'mitose': '4962bf2f2f473da7',
    'cromossomos': 'd04d25b23a61fa8a', 'nucleo': 'a3f4707d84bd9692',
    'membrana': 'a747332e82b606bc', 'fibra': '8158d71a75300a0b',
}


for nome, ops in RECEITAS.items():
    arq = TEX / (nome + '.webp')
    if sha256(arq.read_bytes()).hexdigest()[:16] != ORIGINAIS[nome]:
        print('já convertida:', arq)
        continue
    im = Image.open(arq)
    rgba = np.asarray(im.convert('RGBA'), float) / 255
    rgba[..., :3] = aplica(rgba[..., :3], *ops)
    out = Image.fromarray((rgba * 255 + .5).astype(np.uint8), 'RGBA')
    if im.mode != 'RGBA':
        out = out.convert(im.mode)
    out.save(arq, 'WEBP', quality=86, method=6)
    print('convertida:', arq)
