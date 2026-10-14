# Texturas para gerar no app do Gemini

## Situação

As cinco foram geradas e estão aplicadas na maquete. Os originais ficam em `texturas/fontes/` e não precisam ser gerados de novo.
Para mudar cor, contraste ou tamanho, edite e rode `python3 texturas/processar.py`: ele refaz os `.webp` e o bloco embutido na maquete.

| Recurso | Arquivo | Uso |
|---------|---------|-----|
| Ósteon | `osteon.webp` (320 px, 38 KB) | Células de série, cápsula, aviso e Mutação. Recortado por contorno orgânico e girado por semente, para que nenhuma célula repita a outra. |
| Membrana | `membrana.webp` (ladrilho 512 px, 26 KB) | Fundo de todas as telas, respirando com o coração. |
| Fibra | `fibra.webp` (ladrilho 688×768, 17 KB) | Fundo dos cards. |
| Veias | `veias.webp` (540×968, 58 KB) | Hemorragia do descanso estourado. Revela-se das bordas para dentro, sob os galhos procedurais, e o centro fica limpo. |
| Osso esponjoso | `osso.webp` (ladrilho 688×384, 9 KB) | Botões principais. |

## Rodada 2: células em divisão

O ósteon saiu. A série passa a ser uma célula que se divide ao ser fechada.

**Situação:** geradas e aplicadas no app (`assets/tex/`). As imagens ficaram boas o bastante para entrar inteiras, e não só como preenchimento:
- `celula.jpg` → célula em repouso (série pendente e próxima), início da Mutação e **ícone do app** (desde a 3.0.2);
- `mitose-1.jpg` → série fechada, cápsula, aviso e fim da Mutação. Foi o ícone na 3.0, mas pequenas as duas células juntas ficavam ambíguas;
- `cromossomos-1.jpg` → placa metafásica que acende na Mutação, antes da divisão;
- `nucleo-2.jpg` → telas vazias.

Desde a 3.1, todas as imagens de célula passam por um filtro violeta (`corante()` no `processar.py`): o brilho de cada ponto vira um tom da rampa violeta e a transparência é mantida. O ícone é a célula em violeta (`-v5`), e o botão principal usa a textura da membrana em violeta claro (`botao.webp`). O osso esponjoso ficou só na maquete.

Guardadas sem uso, para variações futuras: `mitose-2.jpg`, `cromossomos-2.jpg`, `nucleo-1.jpg`.

| # | Recurso | Onde entra | Formato | Prioridade |
|---|---------|-----------|---------|------------|
| 6 | Célula | Preenchimento das células de série, das células-filhas e da cápsula | Quadrado | Alta |
| 7 | Núcleo | Núcleo da célula pendente e da próxima série (condensa e pulsa) | Quadrado | Alta |
| 8 | Cromossomos | Mutação (alinhados antes de separar) e telas vazias | Quadrado | Média |
| 9 | Mitose | Novo ícone do app e abertura | Quadrado | Alta |

### 6. Célula

```
Fotografia de microscópio de uma única célula animal vista de cima, redonda e levemente irregular, centralizada e ocupando quase toda a imagem. Citoplasma translúcido e granulado com pequenas organelas, membrana fina e nítida na borda, núcleo arredondado discreto no centro. Tons marfim, creme e âmbar sobre fundo preto puro. Iluminação suave, foco nítido, alto detalhe, aparência orgânica. Formato quadrado. Sem nenhum texto, legenda, seta ou escala.
```

### 7. Núcleo

```
Fotografia de microscópio de um único núcleo celular em close, redondo e levemente irregular, centralizado e ocupando quase toda a imagem. Cromatina em fios e grumos densos, nucléolo escuro visível, envoltório nuclear fino na borda. Tons âmbar e dourado escuros sobre fundo preto puro. Iluminação suave, foco nítido, alto detalhe. Formato quadrado. Sem nenhum texto, legenda, seta ou escala.
```

### 8. Cromossomos

```
Fotografia de microscópio de cromossomos condensados em metáfase, vistos de lado, alinhados numa faixa horizontal no centro da imagem, cada um em forma de X com braços grossos e texturizados. Tons marfim e âmbar quentes sobre fundo preto puro, com leve brilho. Foco nítido, alto detalhe, aparência orgânica. Formato quadrado. Sem nenhum texto, legenda, seta ou escala.
```

### 9. Mitose

```
Fotografia de microscópio de uma célula no fim da divisão, em telófase: duas células-filhas redondas ainda unidas por um estrangulamento fino no meio, cada uma com seu núcleo. Composição centralizada e simétrica, as duas células ocupando cerca de 70% da largura, com margem preta generosa em volta. Tons marfim, creme e âmbar sobre fundo preto puro, leve brilho na membrana. Foco nítido, alto detalhe, aparência orgânica. Formato quadrado. Sem nenhum texto, legenda, seta ou escala.
```

## Pedido original

Gere no app do Gemini (gratuito) e salve no Google Drive, na pasta **NerV texturas**, com os nomes indicados.
Gere 2 ou 3 variações de cada recurso. Eu escolho, recorto, ajusto às cores da paleta e comprimo em WebP.

- A marca d'água do Gemini no canto não atrapalha: eu recorto.
- Não precisa sair "sem emenda". Eu deixo as texturas repetíveis.
- Se a imagem vier com texto, setas ou legenda, peça de novo: "sem nenhum texto".

| # | Recurso | Onde entra | Formato | Arquivos | Prioridade |
|---|---------|-----------|---------|----------|------------|
| 1 | Ósteon | Célula de série, cápsula, aviso, Mutação | Quadrado | `osteon-1.png` … `osteon-3.png` | Alta |
| 2 | Membrana | Fundo vivo de todas as telas | Quadrado | `membrana-1.png` … | Alta |
| 3 | Fibra muscular | Fundo dos cards (lâminas) | Horizontal 16:9 | `fibra-1.png` … | Alta |
| 4 | Rede de veias | Hemorragia do descanso estourado | Vertical 9:16 | `veias-1.png` … | Média |
| 5 | Osso esponjoso | Botão principal (superfície de osso) | Horizontal 16:9 | `osso-1.png` … | Baixa |

## 1. Ósteon

```
Fotografia de microscópio de um único ósteon em corte transversal de osso compacto, visto de frente, centralizado e ocupando quase toda a imagem. Canal de Havers escuro no centro, lamelas concêntricas irregulares, lacunas de osteócitos com canalículos finos. Tons marfim e âmbar quentes sobre fundo preto puro. Iluminação suave, foco nítido, alto detalhe, aparência orgânica e levemente imperfeita. Formato quadrado. Sem nenhum texto, legenda, seta ou escala.
```

## 2. Membrana

```
Textura de tecido celular visto ao microscópio, preenchendo toda a imagem de borda a borda: células irregulares de tamanhos diferentes, paredes celulares finas e úmidas, alguns núcleos discretos. Muito escura, quase preta, com tons vinho e bordô profundos. Baixo contraste, sem um ponto focal, iluminação uniforme. Formato quadrado. Sem nenhum texto, legenda ou escala.
```

## 3. Fibra muscular

```
Textura de fibras de músculo esquelético vistas ao microscópio em corte longitudinal, fibras correndo na horizontal de ponta a ponta, levemente onduladas, com espessuras variadas e estrias transversais sutis. Muito escura, quase preta, com tons magenta e vinho profundos. Baixo contraste, iluminação uniforme, sem ponto focal. Formato horizontal 16:9. Sem nenhum texto, legenda ou escala.
```

## 4. Rede de veias

```
Rede de vasos sanguíneos vermelhos vivos sobre fundo preto puro, crescendo a partir da borda inferior e das laterais da imagem em direção ao centro, que fica vazio e escuro. Vasos grossos na base que afinam e se ramificam em Y até capilares finíssimos, com brilho úmido. Aparência orgânica, como angiografia ou vasos sob a pele iluminados por trás. Formato vertical 9:16. Sem nenhum texto, legenda ou escala.
```

## 5. Osso esponjoso

```
Textura de superfície de osso esponjoso (trabecular) em close, preenchendo toda a imagem: rede porosa de trabéculas com poros de tamanhos variados. Tons marfim, creme e dourado claros, iluminação suave e uniforme, baixo contraste, sem sombras fortes. Formato horizontal 16:9. Sem nenhum texto, legenda ou escala.
```

## Quando terminar

Me avise na sessão. Eu baixo da pasta **NerV texturas** no Drive, trato as imagens e aplico na maquete.
