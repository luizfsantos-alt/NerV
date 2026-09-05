# NERv2 — Neural Engine Routine

Diário de treino e cardio. PWA instalável, **funciona 100% offline**, sem
back-end, sem conta e sem dependências externas em tempo de execução.

![estética: preto, vermelho NERV, tipografia Anton/Orbitron/Share Tech Mono](assets/icon-192.png)

## Como usar

Abra `index.html` servido por HTTP (o service worker exige `https://` ou
`localhost`). Não há build step — os arquivos são o app.

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Para publicar: qualquer host estático serve. No GitHub Pages, ative
*Settings → Pages → Deploy from branch* e o app fica instalável direto do
celular pelo botão "Instalar".

## O que faz

- **Fichas → Treinos → Execução.** Cronômetro de sessão, marcação de séries
  (carga/reps), descanso com som, vibração e +30s. Estourou o descanso? A barra
  conta o atraso para cima e pulsa em vermelho, cada vez mais rápido, até você
  voltar para a série.
- **Progressão.** A carga sugerida vem da sua última sessão daquele exercício,
  série a série. Fechou todas as séries no topo da faixa de reps? O alvo sobe
  um incremento de anilha automaticamente.
- **Recordes de verdade.** O "+1 SINGULARITY" só dispara quando você bate um
  PR — por carga ou por 1RM estimado (Epley).
- **Cardio com GPS.** Distância e pace medidos por `watchPosition`, com
  descarte de leituras ruins. Sem sinal ou na esteira, você informa no fim.
- **Estatísticas.** Volume, repetições, km, sequência de semanas, atividade das
  últimas 8 semanas e ranking de recordes.
- **Importação.** Texto colado (`Supino reto 4x8-12 60kg 90s`), CSV (detecta
  `,` `;` e tab, respeita aspas) e `.xlsx`.
- **Backup.** Exporte e restaure tudo em JSON, juntando ou substituindo.

## Estrutura

```
index.html              shell da aplicação
manifest.webmanifest    identidade do PWA (ícones, atalhos, standalone)
sw.js                   service worker, cache-first
css/
  styles.css            estilos + safe-area + prefers-reduced-motion
  fonts.css             @font-face apontando para as fontes locais
js/
  app.js                entrada: rotas, ciclo de vida do PWA
  router.js             navegação por hash + History API
  state.js              persistência, migração de schema, backup
  progress.js           última sessão, PRs, 1RM, sugestão de carga
  timers.js             cronômetros por timestamp, descanso, Wake Lock
  fx.js                 canvas ambiente, som, vibração, singularity
  ui.js                 modais, toasts, ícones (substituem alert/confirm/prompt)
  importers.js          parsers de texto, CSV e planilha
  xlsx-lite.js          leitor .xlsx próprio (~200 linhas, sem dependências)
  screens/              uma tela por arquivo
assets/                 logo, mascote, ícones PWA e fontes .woff2
```

## Decisões

**Nada vem da rede em tempo de execução.** As fontes são `.woff2` locais e o
leitor de planilha é próprio. O cenário real de uso é uma academia no subsolo
sem sinal; qualquer CDN no caminho crítico quebraria o app justamente ali.

**Sem SheetJS.** Um `.xlsx` é um ZIP de XMLs e o navegador já descomprime via
`DecompressionStream`. `js/xlsx-lite.js` lê a primeira planilha em ~200 linhas,
contra ~900 KB da biblioteca — que, na única versão ainda publicada no npm,
carrega CVEs abertas. O módulo só é carregado quando você escolhe um arquivo.

**Cronômetros por timestamp.** `setInterval` como fonte da verdade atrasa
minutos quando o celular bloqueia. O tempo vem sempre de `Date.now()`; o
intervalo só redesenha.

**Os dados são seus e ficam no aparelho.** `localStorage`, com a última versão
íntegra mantida num backup separado. Não há telemetria nem servidor.

## Suporte

Chrome/Edge 103+, Safari 16.4+, Firefox 113+ (exigido por
`DecompressionStream`, usado só na importação de `.xlsx` — o resto do app
funciona em navegadores mais antigos). Wake Lock e o banner de instalação
dependem do navegador; ausentes, o app funciona sem eles.
