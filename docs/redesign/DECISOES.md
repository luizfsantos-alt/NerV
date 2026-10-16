# Redesign NerV: decisões da mesa

Referência visual e de movimento: [`maquete.html`](maquete.html).

## Decidido

- **Nome:** NerV (sem NERv2 / NERV3).
- **Direção:** Espécime em Metabolismo. Fontes Anybody e Martian Mono. A paleta nasceu D3 (Medula, cor de osso); desde a 3.1 a cor de destaque é o **violeta de contraste**, o corante da lâmina, e as imagens de célula passam por esse filtro.
- **Botões principais:** o mesmo tecido de células do fundo do app, em violeta profundo (cristal violeta) com texto claro (antes, osso esponjoso; na 3.1.0, violeta claro).
- **Tom do violeta (3.1.1):** saturado e escuro, como em lâmina corada de verdade. O destaque é `#9B5DE5`, o mais vivo que ainda dá 4,5:1 de contraste como texto sobre os cards.
- **Elemento de marca:** ~~ósteon~~ (não funcionou como ícone). A série é uma **célula que se divide** ao ser fechada; a Mutação mostra os cromossomos se alinhando antes da divisão.
- **Mascote:** a bomba sai e não volta.
- **Descanso:** começa só quando o usuário pede (botão), como o código já faz. O README será corrigido.
- **Som:** só dois momentos, lub-dub no fim do descanso e acorde curto no recorde. Com o descanso estourado, a cobrança é só vibração (hoje o app apita a cada 15 s).
- **Crítica da mesa:** a primeira maquete ficou geométrica demais (ósteon de círculos perfeitos, veias em zigue-zague de espessura constante, membrana em grade hexagonal, fibras em listras regulares).
- **Caminho escolhido:** híbrido. O Gemini gera as texturas-base (osso, tecido, fibra) e o movimento continua procedural por cima. As imagens entram como WebP comprimido e no precache do service worker.
- **CRT (3.3.0):** primeira peça da direção mais agressiva, estilo Resident Evil 3 e 4. Linhas de varredura fixas e uma faixa de brilho que desce a tela a cada 7 s. O "Sedar" desliga as duas; com menos movimento pedido no sistema, a faixa para e as linhas ficam. O logo fica como está: a mesa vai desenhar um novo.
- **Direção Resident Evil (3.4.0):** a mesa achou a UI leve demais depois do redesign e aprovou, a partir de prévias antes/depois, oito ajustes:
  1. **Paleta sangue:** o violeta sai. Destaque `#F03A3A` (4,9:1 como texto sobre os cards), botões em chapa vinho `#7A0D14` (texto claro a 8,7:1), bordas em ferrugem `--iron`. O "V" do logo fica vermelho pela própria paleta. As imagens foram recoloridas com [`texturas/sangue.py`](texturas/sangue.py).
  2. **Condição no descanso:** o eletro e o rótulo mudam com o tempo: Estável (verde), Atenção (âmbar, últimos 10 s), Perigo (o estouro, com as veias).
  3. **Botões de chapa:** cantos chanfrados, borda dupla e bisel, clarão ao tocar. Sai a textura `botao.webp`.
  4. **Cards de arquivo:** fundo opaco, moldura dupla, rebites nos cantos, fibra cinza e apagada, rótulo como carimbo torto.
  5. **Ambiente opressivo:** vinheta pesada nas bordas, membrana mais escura e vermelha, mais grão, o CRT da 3.3.0.
  6. **Tipografia mais dura:** rótulos cerrados e em negrito, títulos com sombra vermelha. A fonte não mudou.
  7. **Impacto:** fechar a série faz o card tremer e acender em vermelho, com vibração mais forte.
  8. **Mutação:** palavra com aberração cromática, calor sem violeta.
- **Monitor ruim (3.5.0):** dois efeitos por cima do CRT.
  - **Flicker:** um véu escuro que oscila de leve e afunda uma vez a cada 5,3 s. A maior queda escurece 16%, longe do limite de risco para fotossensíveis (3 piscadas fortes por segundo). O "Sedar" e o "menos movimento" do sistema desligam.
  - **Bleed de fósforo:** texto e contornos vazam a própria luz, com um fantasma vermelho e outro ciano. A mesa comparou dois níveis e escolheu o combinado: bordas, carimbos e títulos no nível forte, texto corrido num meio-termo para continuar legível. O logo fica de fora.
  - **Fora:** o desfoque nas bordas da tela. Ele teria de ser refeito a cada quadro em cima do fundo que pulsa, o que pesa na bateria e trava a rolagem. A vinheta continua como na 3.4.0.
- **Logo (3.6.0):** a mesa trouxe o desenho, duas esferas vermelhas com NERV em preto, e ele virou vetor.
  - **Esferas tangentes:** só se tocam num ponto, a célula no instante da divisão (o mesmo símbolo da série fechada e da Mutação). Como ali o vermelho tem altura zero, o nome se parte junto: NE numa esfera, RV na outra.
  - **Letras:** espaço igual entre todas, Anybody 900 a 90% de largura, o maior tamanho em que cada letra perde no máximo 6% nas bordas (52% do diâmetro). As esferas recortam o que passa. A mesa comparou quatro proporções e escolheu esta.
  - **Abertura:** no topo, sem segurar o app. Uma esfera alonga e vira duas, e o nome entra partido (0,9 s).
  - **Ícone:** só as esferas, na diagonal, para não ler como outros símbolos de dois círculos. Gerado por [`icone.py`](icone.py), sufixo `-v7`.
  - Antes, testamos Anybody condensada, uma serifada estilo RE4 e um stencil militar.

## Próximos passos

1. ~~Passada orgânica procedural na maquete~~ (feita): ósteon com contorno torto, lamelas interrompidas e lacunas variadas; veias curvas que afinam e bifurcam em Y; membrana em células irregulares; fibras onduladas.
   - ~~Texturas do Gemini~~ (feitas): a API exige faturamento (mínimo de R$ 150), então as imagens foram geradas à mão no app do Gemini. Veja [`TEXTURAS.md`](TEXTURAS.md).
2. ~~Ok da mesa~~: aprovado, e a mesa pediu para seguir direto para o app, sem briefing.
3. ~~Redesign aplicado no app~~ (versão 3.0.0): paleta, fontes locais, texturas, células, os nove movimentos, Lâmina, Aviso, Abertura e a política de som.
