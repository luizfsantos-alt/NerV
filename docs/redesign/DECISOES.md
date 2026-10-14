# Redesign NerV: decisões da mesa

Referência visual e de movimento: [`maquete.html`](maquete.html).

## Decidido

- **Nome:** NerV (sem NERv2 / NERV3).
- **Direção:** Espécime em Metabolismo. Fontes Anybody e Martian Mono. A paleta nasceu D3 (Medula, cor de osso); desde a 3.1 a cor de destaque é o **violeta de contraste**, o corante da lâmina, e as imagens de célula passam por esse filtro.
- **Botões principais:** o mesmo tecido de células do fundo do app, em violeta claro (antes, osso esponjoso).
- **Elemento de marca:** ~~ósteon~~ (não funcionou como ícone). A série é uma **célula que se divide** ao ser fechada; a Mutação mostra os cromossomos se alinhando antes da divisão.
- **Mascote:** a bomba sai e não volta.
- **Descanso:** começa só quando o usuário pede (botão), como o código já faz. O README será corrigido.
- **Som:** só dois momentos, lub-dub no fim do descanso e acorde curto no recorde. Com o descanso estourado, a cobrança é só vibração (hoje o app apita a cada 15 s).
- **Crítica da mesa:** a primeira maquete ficou geométrica demais (ósteon de círculos perfeitos, veias em zigue-zague de espessura constante, membrana em grade hexagonal, fibras em listras regulares).
- **Caminho escolhido:** híbrido. O Gemini gera as texturas-base (osso, tecido, fibra) e o movimento continua procedural por cima. As imagens entram como WebP comprimido e no precache do service worker.

## Próximos passos

1. ~~Passada orgânica procedural na maquete~~ (feita): ósteon com contorno torto, lamelas interrompidas e lacunas variadas; veias curvas que afinam e bifurcam em Y; membrana em células irregulares; fibras onduladas.
   - ~~Texturas do Gemini~~ (feitas): a API exige faturamento (mínimo de R$ 150), então as imagens foram geradas à mão no app do Gemini. Veja [`TEXTURAS.md`](TEXTURAS.md).
2. ~~Ok da mesa~~: aprovado, e a mesa pediu para seguir direto para o app, sem briefing.
3. ~~Redesign aplicado no app~~ (versão 3.0.0): paleta, fontes locais, texturas, células, os nove movimentos, Lâmina, Aviso, Abertura e a política de som.
