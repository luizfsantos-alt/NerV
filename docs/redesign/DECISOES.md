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
- **CRT (3.3.0):** primeira peça da direção mais agressiva, estilo Resident Evil 3 e 4. Linhas de varredura fixas e uma faixa de brilho que desce a tela a cada 7 s. O "Sedar" desliga as duas; com menos movimento pedido no sistema, a faixa para e as linhas ficam. Os outros tweaks (paleta sangue, condição no descanso, botões de chapa, cards de arquivo, ambiente, tipografia, impacto, Mutação) foram mostrados em prévia e aguardam o ok da mesa. O logo fica como está: a mesa vai desenhar um novo.

## Próximos passos

1. ~~Passada orgânica procedural na maquete~~ (feita): ósteon com contorno torto, lamelas interrompidas e lacunas variadas; veias curvas que afinam e bifurcam em Y; membrana em células irregulares; fibras onduladas.
   - ~~Texturas do Gemini~~ (feitas): a API exige faturamento (mínimo de R$ 150), então as imagens foram geradas à mão no app do Gemini. Veja [`TEXTURAS.md`](TEXTURAS.md).
2. ~~Ok da mesa~~: aprovado, e a mesa pediu para seguir direto para o app, sem briefing.
3. ~~Redesign aplicado no app~~ (versão 3.0.0): paleta, fontes locais, texturas, células, os nove movimentos, Lâmina, Aviso, Abertura e a política de som.
