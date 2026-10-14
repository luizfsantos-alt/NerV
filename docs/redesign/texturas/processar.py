"""Gera as texturas do redesign a partir das imagens do Gemini em fontes/.

Uso: python3 processar.py   (escreve os .webp ao lado deste arquivo)
As fontes ficam guardadas para refazer ajustes sem gerar imagens de novo.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

AQUI = Path(__file__).parent
FONTES = AQUI / 'fontes'


def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)


def luma(a):
    return a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114


def normaliza(L, lo=1, hi=99):
    a, b = np.percentile(L, [lo, hi])
    return np.clip((L - a) / (b - a), 0, 1)


def rampa(t, cores):
    """Mapeia 0..1 numa rampa de cores da paleta."""
    pos = np.linspace(0, 1, len(cores))
    out = np.zeros(t.shape + (3,))
    for c in range(3):
        out[..., c] = np.interp(t, pos, [hexrgb(h)[c] for h in cores])
    return out


def sem_emenda(a):
    """Repete sem emenda: mistura a imagem com ela mesma deslocada meia volta,
    escondendo as bordas originais no centro do deslocamento."""
    h, w = a.shape[:2]
    rolada = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    y = 1 - np.abs(np.linspace(-1, 1, h))[:, None]
    x = 1 - np.abs(np.linspace(-1, 1, w))[None, :]
    peso = np.clip(np.minimum(y, x) * 2.2, 0, 1) ** 1.5
    if a.ndim == 3:
        peso = peso[..., None]
    return a * peso + rolada * (1 - peso)


def sem_emenda_fibra(a):
    """Fibras correm na horizontal: emenda só na horizontal (meia volta, rampa larga)
    e espelha na vertical, que numa fibra ondulada passa despercebido."""
    h, w = a.shape[:2]
    rolada = np.roll(a, w // 2, 1)
    peso = (np.clip((1 - np.abs(np.linspace(-1, 1, w))) * 1.6, 0, 1) ** 1.2)[None, :, None]
    a = a * peso + rolada * (1 - peso)
    return np.concatenate([a, a[::-1]], 0)


def salva(a, nome, q):
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    img.save(AQUI / nome, 'WEBP', quality=q, method=6)
    if nome not in ('osteon.webp', 'osso.webp'):   # saíram do app; ficam só na maquete
        (AQUI.parents[2] / 'assets' / 'tex').mkdir(parents=True, exist_ok=True)
        img.save(AQUI.parents[2] / 'assets' / 'tex' / nome, 'WEBP', quality=q, method=6)
    print(f'{nome:16} {img.size[0]}x{img.size[1]}  {(AQUI / nome).stat().st_size // 1024} KB')


def carrega(nome, tamanho=None):
    img = Image.open(FONTES / nome).convert('RGB')
    if tamanho:
        img = img.resize(tamanho, Image.LANCZOS)
    return np.asarray(img, float)


# Ósteon: recorta o disco, reforça lamelas e lacunas para ler em 36 px, tinge para o osso da paleta.
img = Image.open(FONTES / 'osteon.jpg').convert('RGB')
m = luma(np.asarray(img, float)) > 40
ys, xs = np.nonzero(m)
cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
r = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 * .985
img = img.crop((cx - r, cy - r, cx + r, cy + r)).resize((320, 320), Image.LANCZOS)
img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=2))
a = np.asarray(img, float)
t = normaliza(luma(a), 2, 99.5)
cor = rampa(t ** 1.1, ['#1c0f08', '#5c3d14', '#94692C', '#D6B57A', '#EEDAA9', '#F6E8C4'])
a = cor * .78 + a * .22  # guarda um pouco da cor original (o laranja da borda)
salva(a, 'osteon.webp', 80)

# Membrana: sem emenda, paredes escuras e células na cor do tecido, bem discreta.
a = sem_emenda(carrega('membrana.jpg', (512, 512)))
t = normaliza(luma(a), 3, 99.7) ** .8
salva(rampa(t, ['#0C0709', '#1a0d12', '#3a1823', '#5e2a3a']), 'membrana.webp', 72)

# Fibra: sem emenda, magenta profundo; o topo da rampa fica baixo para o texto do card seguir legível.
a = sem_emenda_fibra(carrega('fibra.jpg', (688, 384)))
t = normaliza(luma(a), 1, 99.7)
salva(rampa(t, ['#120a0e', '#1d0f17', '#3a1430', '#5e1d4c']), 'fibra.webp', 72)

# Veias: entram em modo screen, então o preto some; o vermelho vai para a hemorragia da paleta.
a = carrega('veias.jpg', (540, 968))
t = normaliza(luma(a), 1, 99.8)
salva(rampa(t, ['#000000', '#3a0610', '#a3142a', '#FF2440', '#FFB3BC']), 'veias.webp', 70)

# Osso esponjoso: superfície do botão principal; contraste baixo para o texto escuro por cima.
# Repete em ladrilho pequeno: os poros ficam miúdos e a rampa estreita mantém o texto legível.
a = sem_emenda(carrega('osso.jpg', (688, 384)))
t = normaliza(luma(a), 1, 99)
salva(rampa(t, ['#c09a5c', '#d2b077', '#dfc28d', '#ead1a2']), 'osso.webp', 74)

# Botões principais (desde a 3.1): o mesmo tecido de células do fundo do app,
# em violeta claro, repetido sem emenda. Substitui o osso esponjoso.
a = sem_emenda(carrega('membrana.jpg', (512, 512)))
t = normaliza(luma(a), 3, 99.7) ** .8
img = Image.fromarray(rampa(t, ['#7a52bb', '#9472d0', '#ae90df', '#c8b0ee']).astype(np.uint8))
(AQUI.parents[2] / 'assets' / 'tex').mkdir(parents=True, exist_ok=True)
img.save(AQUI.parents[2] / 'assets' / 'tex' / 'botao.webp', 'WEBP', quality=74, method=6)
print('botao.webp       512x512')

# ===== Rodada 2: células em divisão (vão direto para o app, em assets/) =====
APP = AQUI.parents[2] / 'assets'
TEX = APP / 'tex'


def recorta_objeto(img, limiar=28, margem=.04):
    """Recorta o objeto claro sobre fundo preto num quadrado, com margem."""
    L = luma(np.asarray(img, float))
    ys, xs = np.nonzero(L > limiar)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    r = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 * (1 + margem)
    return img.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r)))


def sem_fundo(img, lo=10, hi=60):
    """O preto vira transparência; o brilho da membrana continua."""
    a = np.asarray(img.convert('RGB'), float)
    m = np.clip((a.max(2) - lo) / (hi - lo), 0, 1)
    alpha = (m * m * (3 - 2 * m) * 255).astype(np.uint8)
    return Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), 'RGBA')


# Violeta de contraste (desde a 3.1): as células aparecem como numa lâmina
# corada. O filtro mapeia o brilho de cada ponto numa rampa violeta e mantém
# a transparência, então o detalhe da imagem original fica todo lá.
CORANTE = ['#000000', '#1a0c33', '#4f2a94', '#9a72dc', '#efe4ff']


def corante(img):
    a = np.asarray(img.convert('RGBA'), float)
    t = normaliza(luma(a[..., :3]) * (a[..., 3] / 255), 1, 99.7)
    return Image.fromarray(np.dstack([rampa(t, CORANTE), a[..., 3]]).astype(np.uint8), 'RGBA')


def salva_rgba(img, destino, q):
    img = corante(img)
    img.save(destino, 'WEBP', quality=q, method=6)
    print(f'{destino.name:22} {img.size[0]}x{img.size[1]}  {destino.stat().st_size // 1024} KB')


TEX.mkdir(parents=True, exist_ok=True)
mitose = recorta_objeto(Image.open(FONTES / 'mitose-1.jpg').convert('RGB'))
celula = recorta_objeto(Image.open(FONTES / 'celula.jpg').convert('RGB'))
nucleo = recorta_objeto(Image.open(FONTES / 'nucleo-2.jpg').convert('RGB'))
# Pequenas (células de série, cápsula, aviso): nítidas a 44 px em tela 3x.
salva_rgba(sem_fundo(mitose.resize((144, 144), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1, 60, 2))), TEX / 'cel-mitose.webp', 82)
salva_rgba(sem_fundo(celula.resize((144, 144), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1, 60, 2))), TEX / 'cel-repouso.webp', 82)
# Grandes (Mutação e abertura).
salva_rgba(sem_fundo(mitose.resize((480, 480), Image.LANCZOS)), TEX / 'mitose.webp', 78)
salva_rgba(sem_fundo(celula.resize((480, 480), Image.LANCZOS)), TEX / 'celula.webp', 78)
salva_rgba(sem_fundo(nucleo.resize((360, 360), Image.LANCZOS)), TEX / 'nucleo.webp', 76)
# Cromossomos alinhados em faixa (placa metafásica): fundo da Mutação e telas vazias.
crom = Image.open(FONTES / 'cromossomos-1.jpg').convert('RGB')
crom = crom.crop((0, 300, 1024, 720)).resize((800, 328), Image.LANCZOS)
salva_rgba(sem_fundo(crom, 14, 70), TEX / 'cromossomos.webp', 74)

# Ícones do app: uma célula sozinha, antes da divisão, em violeta, sobre o
# fundo preto-sangue. Histórico: v3 mitose (ambígua quando pequena), v4 célula
# em âmbar, v5 célula em violeta.
# O nome leva a versão do desenho (-v5): o Android só troca o ícone do app
# instalado quando o endereço no manifesto muda. Desenho novo, sufixo novo, e
# atualize manifesto, index e sw.js. O maskable deixa a zona segura (80% do
# centro) para os recortes redondos do Android.
FUNDO = (12, 7, 9)
def icone(tam, ocupa, destino):
    base = Image.new('RGB', (tam, tam), FUNDO)
    m = corante(sem_fundo(celula)).resize((int(tam * ocupa), int(tam * ocupa)), Image.LANCZOS)
    base.paste(m, ((tam - m.width) // 2, (tam - m.height) // 2), m)
    # 200 cores com pontilhado: um terço do tamanho, sem diferença visível.
    base.quantize(colors=200, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(destino, 'PNG', optimize=True)
    print(f'{destino.name:22} {tam}x{tam}  {destino.stat().st_size // 1024} KB')
icone(192, .92, APP / 'icon-192-v5.png')
icone(512, .92, APP / 'icon-512-v5.png')
icone(512, .78, APP / 'icon-maskable-512-v5.png')
icone(180, .86, APP / 'apple-touch-icon-v5.png')

# Embute tudo na maquete (arquivo único, abre em qualquer lugar). No app, os .webp vão como arquivos.
import base64
import re

def uri(nome):
    return 'data:image/webp;base64,' + base64.b64encode((AQUI / nome).read_bytes()).decode()

bloco = ('<!-- texturas:inicio -->\n<style>:root {\n' +
         ''.join(f'  --tex-{n}: url({uri(n + ".webp")});\n' for n in ('membrana', 'fibra', 'veias', 'osso')) +
         '}</style>\n<svg width="0" height="0" style="position:absolute" aria-hidden="true">'
         f'<symbol id="os-img" viewBox="0 0 100 100"><image href="{uri("osteon.webp")}" width="100" height="100"/></symbol></svg>\n'
         '<!-- texturas:fim -->')
maquete = AQUI.parent / 'maquete.html'
html = maquete.read_text(encoding='utf-8')
html, n = re.subn(r'<!-- texturas:inicio -->.*?<!-- texturas:fim -->', lambda _: bloco, html, flags=re.S)
assert n == 1, 'marcadores do bloco de texturas não encontrados na maquete'
maquete.write_text(html, encoding='utf-8')
print(f'maquete.html     {maquete.stat().st_size // 1024} KB')
