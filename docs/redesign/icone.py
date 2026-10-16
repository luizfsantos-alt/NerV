"""Gera os ícones do app (3.6.0): as duas esferas tangentes do logo, sem o
nome, na diagonal para não ler como outros símbolos de dois círculos.

Uso: python3 docs/redesign/icone.py   (na raiz do repositório)

O nome dos arquivos leva a versão do desenho (-v7): o Android só troca o ícone
do app instalado quando o endereço no manifesto muda. Desenho novo, sufixo
novo, e atualize manifesto, index e sw.js. Histórico: v3 mitose, v4 célula em
âmbar, v5 e v6 célula em violeta, v7 esferas do logo em vermelho.
"""
from math import sqrt
from pathlib import Path
from PIL import Image, ImageDraw

APP = Path('assets')
FUNDO = (8, 5, 6)        # --flesh-0
SANGUE = (200, 16, 26)   # o vermelho das esferas do logo, #C8101A
SS = 4                   # superamostragem para borda suave


def icone(tam, alcance, destino):
    """`alcance` é a distância do centro do ícone até o ponto mais distante das
    esferas, em fração do lado. O maskable usa 0,4: tudo dentro da zona segura
    (o círculo central de 80%) que os recortes do Android preservam."""
    T = tam * SS
    img = Image.new('RGB', (T, T), FUNDO)
    d = ImageDraw.Draw(img)
    r = alcance * T / 2                      # ponto mais distante = 2r do centro
    o = r / sqrt(2)                          # cada centro a r do meio, na diagonal
    for sx, sy in ((-1, 1), (1, -1)):        # embaixo à esquerda, em cima à direita
        cx, cy = T / 2 + sx * o, T / 2 + sy * o
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=SANGUE)
    img = img.resize((tam, tam), Image.LANCZOS)
    img.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(destino, 'PNG', optimize=True)
    print(f'{destino.name:28} {tam}x{tam}  {destino.stat().st_size // 1024} KB')


icone(192, .46, APP / 'icon-192-v7.png')
icone(512, .46, APP / 'icon-512-v7.png')
icone(512, .40, APP / 'icon-maskable-512-v7.png')
icone(180, .43, APP / 'apple-touch-icon-v7.png')
