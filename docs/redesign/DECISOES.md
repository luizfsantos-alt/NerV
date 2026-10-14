# Redesign NerV: decisões da mesa

Referência visual e de movimento: [`maquete.html`](maquete.html).

## Decidido

- **Nome:** NerV (sem NERv2 / NERV3).
- **Direção:** Espécime em Metabolismo. Paleta D3 (Medula), fontes Anybody e Martian Mono.
- **Elemento de osso:** a célula de série é um corte de ósteon.
- **Mascote:** a bomba sai e não volta.
- **Descanso:** começa só quando o usuário pede (botão), como o código já faz. O README será corrigido.
- **Som:** só dois momentos, lub-dub no fim do descanso e acorde curto no recorde. Com o descanso estourado, a cobrança é só vibração (hoje o app apita a cada 15 s).
- **Crítica da mesa:** a primeira maquete ficou geométrica demais (ósteon de círculos perfeitos, veias em zigue-zague de espessura constante, membrana em grade hexagonal, fibras em listras regulares).
- **Caminho escolhido:** híbrido. O Gemini gera as texturas-base (osso, tecido, fibra) e o movimento continua procedural por cima. As imagens entram como WebP comprimido e no precache do service worker.

## Próximos passos

1. Passada orgânica na maquete: texturas do Gemini e veias procedurais afinando e se ramificando em Y.
2. Ok da mesa na maquete revisada.
3. `BRIEFING.md` de execução, no formato do MedControl.
