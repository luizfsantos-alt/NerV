# NERv2 — Neural Engine Routine

Diário de treino e cardio para levar para a academia. PWA instalável,
**funciona 100% offline**, sem back-end, sem conta, sem telemetria e sem
nenhuma dependência externa em tempo de execução.

<p align="center">
  <img src="assets/icon-192.png" alt="NERv2" width="96" height="96">
</p>

O cenário que dita todas as decisões deste repositório é concreto: uma academia
no subsolo, sem sinal, com o celular na mão entre uma série e outra. Nada pode
depender da rede, nada pode exigir digitação a mais e nada pode sumir.

---

## Índice

- [Começando](#começando)
- [O que o app faz](#o-que-o-app-faz)
- [Como o app se atualiza](#como-o-app-se-atualiza)
- [Seus dados](#seus-dados)
- [Importar fichas](#importar-fichas)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Decisões de projeto](#decisões-de-projeto)
- [Publicar](#publicar)
- [Checklist de release](#checklist-de-release)
- [Solução de problemas](#solução-de-problemas)
- [Suporte de navegadores](#suporte-de-navegadores)
- [Privacidade](#privacidade)

---

## Começando

Não há build step: os arquivos **são** o app. Mas ele precisa ser servido por
HTTP — abrir `index.html` com duplo clique (`file://`) não funciona, porque
módulos ES e service workers exigem `https://` ou `localhost`.

```bash
git clone https://github.com/luizfsantos-alt/nerv.git
cd nerv
python3 -m http.server 8000
# abra http://localhost:8000
```

Qualquer servidor estático serve: `npx serve`, `php -S localhost:8000`, nginx.

**Instalar no celular:** abra a URL publicada no Chrome (Android) ou Safari
(iOS) e use "Adicionar à tela de início". No Android o próprio app oferece o
banner "INSTALAR". Instalado, ele abre em tela cheia, sem barra de navegador, e
funciona no modo avião.

---

## O que o app faz

**Fichas → Treinos → Execução.** Uma ficha agrupa treinos (A, B, C); cada
treino tem seus exercícios com séries, faixa de reps, carga e intervalo.

**Ficha ABCD pronta.** Na primeira abertura o app já vem com a divisão ABCD
completa — A peito/tríceps, B costas/bíceps, C pernas/panturrilha, D
ombros/abdômen, 25 exercícios com séries, reps e descanso definidos. A carga
vai zerada de propósito: é o que você registra treinando, e a partir da segunda
sessão o app sugere sozinho. Quem já usa o app pode criá-la de novo em
**Nova Ficha → Começar com → Modelo ABCD**.

**Execução.** Cronômetro da sessão, uma linha por série com carga e reps, e um
checkbox para fechar a série. Marcar a série já dispara o descanso — é o gesto
que a pessoa faria de qualquer jeito.

- **Descanso** numa barra fixa no rodapé, visível de qualquer ponto da tela,
  com som, vibração, `+30s` e `PULAR`. Estourou o tempo, a barra conta o atraso
  para cima e pulsa em vermelho cada vez mais rápido até você voltar.
- **Reps em branco assumem o alvo da ficha** ao fechar a série. Ninguém quer
  digitar duas vezes o que já está escrito.
- **A tela não apaga** durante o treino (Wake Lock, onde o navegador suporta).
- **Exercício concluído se desliga** como uma TV de tubo — colapsa numa linha,
  estoura o brilho, some — e vira uma barra compacta com o nome, as séries
  fechadas e o volume. Toque na barra para reabrir; o botão `OCULTAR EXERCÍCIO`
  guarda de novo. Desmarcar uma série reabre sozinho.
- **Sair com séries não salvas pede confirmação**, inclusive pelo botão físico
  de voltar do Android.

**Progressão automática.** A carga sugerida vem da **sua última sessão daquele
exercício, série a série** — não do seu recorde histórico. Se na última vez
você fechou todas as séries no topo da faixa de reps, o alvo sobe um incremento
arredondado para anilha (`+2,5 kg` ou `+2,5%`, o que for maior) e o card mostra
`+CARGA`.

**Recordes de verdade.** O `+1 SINGULARITY` só dispara quando você bate um PR
real, comparado com o histórico **anterior** à sessão — por carga absoluta ou
por 1RM estimado (fórmula de Epley).

**Cardio com GPS.** Distância e pace por `watchPosition`, com descarte de
leituras ruins. Sem sinal ou na esteira, você informa a distância no fim e a
sessão fica marcada como manual.

**Stats.** Sessões, tempo total, volume, repetições, km, sequência de semanas,
atividade das últimas 8 semanas, treino favorito e ranking de recordes.

**Histórico.** Toda sessão gravada, com o que foi feito série a série.

---

## Como o app se atualiza

Esta é a parte que mais deu trabalho, então vale explicar em detalhe.

### A estratégia de cache

O service worker (`sw.js`) trata dois grupos de arquivos de formas diferentes:

| Grupo | Estratégia | Por quê |
|---|---|---|
| `index.html`, `.js`, `.css`, `.webmanifest` | **network-first**, timeout de 2,5 s, queda para o cache | é o código do app: precisa poder mudar sem depender de um service worker novo |
| fontes, ícones, imagens | **cache-first** | são grandes, mudam junto com a versão e não vale gastar rede |

O timeout é o detalhe que faz isso funcionar na academia: se a rede não
responder em 2,5 s — offline, DNS travado, wifi que conecta mas não navega —
o cache assume e o app abre inteiro do mesmo jeito.

### Quando ele procura versão nova

- ao carregar;
- ao voltar do segundo plano (`visibilitychange`), no máximo a cada 15 min;
- ao reconectar (`online`);
- no botão `PROCURAR ATUALIZAÇÃO`, em Ajustes.

O registro usa `updateViaCache: 'none'`, então o próprio `sw.js` nunca vem do
cache HTTP.

Achou versão nova, aparece o aviso **"Nova versão disponível — toque para
atualizar"**. O toque aplica a troca na hora, sem precisar fechar o app. O
service worker novo nunca assume sozinho no meio de um treino.

### As três saídas de emergência

Se ainda assim o app ficar preso numa versão antiga, há três saídas — e
**nenhuma delas apaga suas fichas ou seu histórico**. Todas limpam só os
arquivos do programa (cache + service worker); os dados moram no
`localStorage`, que não é tocado.

1. **`FORÇAR ATUALIZAÇÃO`** — em Ajustes, no card "Atualização".
2. **`#/reset` no endereço** — abra `.../index.html#/reset`. Limpa tudo antes
   de qualquer módulo carregar. É a saída quando nem a tela de Ajustes abre.
3. **Painel de resgate automático** — se o app não terminar de subir em 6 s,
   ele aparece sozinho oferecendo a limpeza.

As saídas 2 e 3 vivem em script clássico dentro do `index.html`, de propósito:
como o shell é servido network-first, esse trecho é sempre o mais novo que o
aparelho conseguiu buscar, e funciona mesmo com todo o `js/` desatualizado.

### Diagnóstico

O card "Atualização" em Ajustes mostra **a versão do app e a do cache lado a
lado**:

```
app 2.2.0
cache nerv2-v2.2.0
```

Se os dois números divergirem, aparece um aviso em vermelho — é o sintoma exato
do cache preso, e a hora de usar `FORÇAR ATUALIZAÇÃO`.

---

## Seus dados

Tudo fica em `localStorage`, só no aparelho. Três chaves:

| Chave | Conteúdo |
|---|---|
| `nerv2_data_v1` | o estado atual (fichas, histórico de treino, histórico de cardio) |
| `nerv2_data_backup` | a última versão íntegra, promovida a cada gravação |
| `nerv2_fx` | preferência do botão FX |

Toda leitura valida o formato e cai para o backup se o principal estiver
corrompido, então uma gravação ruim nunca fica sendo a única cópia. Toda
gravação passa por uma migração de schema, então backups antigos continuam
abrindo.

### Backup

`Ajustes → EXPORTAR BACKUP` gera um `nerv2-backup-AAAA-MM-DD.json`:

```json
{
  "app": "NERv2",
  "schema": 2,
  "exportedAt": "2026-09-05T12:00:00.000Z",
  "data": {
    "fichas": [],
    "workoutHistory": [],
    "cardioHistory": []
  }
}
```

`RESTAURAR BACKUP` oferece dois modos:

- **JUNTAR** — mantém o que já existe e só acrescenta o que falta (por `id`);
- **SUBSTITUIR TUDO** — apaga o que está no aparelho e usa apenas o backup.

> **Exporte de vez em quando.** Limpar os dados do navegador (o botão do
> sistema, não o do app) apaga o histórico e não tem volta.

---

## Importar fichas

Três caminhos, todos em `Nova Ficha` / `Importar Texto`.

Modelos prontos (planilha, CSV e texto) estão em [`modelos/`](modelos/) —
baixe, preencha e importe.

### Texto colado

Uma linha por exercício. O parser aceita formato livre ou com separadores:

```
Ficha: Hipertrofia
Treino A — Peito/Costas
Supino reto 4x8-12 60kg 90s
Remada curvada | 4 | 8-12 | 40 | 90
Crucifixo, 3, 12, 14, 60
Desenvolvimento 3x10
```

- linhas iniciadas por `Ficha`, `Plano`, `Programa` ou `Rotina` nomeiam a ficha;
- linhas como `Treino A:`, `Dia 2 — Pernas` ou `A - Peito` abrem um treino;
- o resto vira exercício. A checagem de exercício vem **antes** da de
  cabeçalho, então uma linha com `:` que também é exercício não vira treino.

Faltou algum campo, entram os padrões: 3 séries, 10 reps, 60 s de intervalo.

### CSV

Detecta o separador (`,`, `;` ou tab — o Excel em pt-BR exporta com `;`) e
respeita aspas. Colunas na ordem: nome, séries, reps, carga, intervalo.

### XLSX

Lê a primeira planilha do arquivo. O módulo do leitor só é carregado quando
você escolhe um arquivo, então não pesa na abertura do app.

---

## Estrutura do projeto

```
index.html              shell da aplicação + resgate de emergência
manifest.webmanifest    identidade do PWA (ícones, atalhos, standalone)
sw.js                   service worker: network-first no código, cache nos assets
css/
  styles.css            estilos, safe-area, animações, prefers-reduced-motion
  fonts.css             @font-face apontando para as fontes locais
js/
  app.js                entrada: rotas, ciclo de vida do PWA, atualização
  router.js             navegação por hash + History API
  state.js              persistência, migração de schema, backup
  progress.js           última sessão, PRs, 1RM, sugestão de carga
  timers.js             cronômetros por timestamp, descanso, Wake Lock
  fx.js                 canvas ambiente, som, vibração, singularity
  ui.js                 modais, toasts, ícones (substituem alert/confirm/prompt)
  importers.js          parsers de texto, CSV e planilha
  modelos.js            ficha ABCD pronta (semente e modelo do "Nova Ficha")
  xlsx-lite.js          leitor .xlsx próprio (~180 linhas, sem dependências)
  util.js               formatação, ids, 1RM, arredondamento para anilha
  screens/
    fichas.js           tela inicial: lista de fichas
    treinos.js          treinos de uma ficha
    workout.js          execução do treino
    cardio.js           corrida/caminhada com GPS
    historico.js        sessões gravadas
    stats.js            números, gráfico de 8 semanas, recordes
    ajustes.js          backup, atualização, zona de risco
assets/                 logo, mascote, ícones PWA e fontes .woff2
```

Cada tela é uma função `screenX(params, el)` que recebe o elemento raiz e o
preenche. O router monta o elemento e chama a função; não há framework.

---

## Decisões de projeto

**Nada vem da rede em tempo de execução.** As fontes são `.woff2` locais e o
leitor de planilha é próprio. Qualquer CDN no caminho crítico quebraria o app
justamente no subsolo onde ele mais precisa funcionar.

**Sem SheetJS.** Um `.xlsx` é um ZIP de XMLs e o navegador já descomprime via
`DecompressionStream`. `js/xlsx-lite.js` lê a primeira planilha em ~180 linhas,
contra ~900 KB da biblioteca — que, na única versão ainda publicada no npm,
carrega CVEs abertas.

**Cronômetros por timestamp.** `setInterval` como fonte da verdade atrasa
minutos quando o celular bloqueia. O tempo vem sempre de `Date.now()`; o
intervalo só redesenha.

**Navegação por hash, não por função.** Antes, trocar de tela era chamar uma
função que reescrevia o `<main>`: o botão físico de voltar do Android fechava o
app, e não dava para recarregar numa tela específica. Agora cada tela tem
endereço.

**Modais próprios, não `alert`/`confirm`/`prompt`.** Os nativos bloqueiam a
thread, são feios no PWA instalado e no iOS quebram a identidade visual.

**A progressão olha a última sessão, não o recorde.** A versão original
pré-preenchia toda série com a carga máxima histórica — ou seja, mandava você
repetir seu PR em todas as séries de todo treino.

**Os efeitos param quando não são vistos.** O canvas ambiente para o loop
quando o FX está desligado ou o app vai para segundo plano; antes rodava a
60 fps à toa, drenando bateria durante uma hora de treino. Tudo respeita
`prefers-reduced-motion`.

---

## Publicar

Qualquer host estático. No GitHub Pages:

1. *Settings → Pages → Deploy from branch*, escolha a branch e a raiz (`/`);
2. o app fica em `https://<usuário>.github.io/<repo>/`.

Todos os caminhos do projeto são relativos (`./`), então ele funciona tanto na
raiz de um domínio quanto num subdiretório. O `scope` do service worker também
é `./`, o que mantém o cache confinado ao subdiretório do app.

---

## Checklist de release

Esquecer estes passos é o que já causou o app preso em versão antiga. Antes de
publicar uma mudança:

1. **Bumpe as duas versões**, sempre juntas:
   - `VERSION` em `js/app.js` (ex.: `'2.2.0'`);
   - `VERSION` em `sw.js` (ex.: `'nerv2-v2.2.0'`).

   O sufixo do cache tem que **terminar** com a versão do app — é assim que a
   tela de Ajustes detecta divergência.

2. **Arquivo novo em `js/` ou `assets/`?** Acrescente ao `PRECACHE` do `sw.js`,
   senão ele não fica disponível offline.

3. **Teste offline:** DevTools → Application → Service Workers → *Offline*, e
   recarregue. O app tem que abrir inteiro.

4. **Teste a atualização:** com o app aberto, publique, espere o aviso "Nova
   versão disponível" e toque nele.

---

## Solução de problemas

**O app não atualiza / continuo vendo a versão antiga.**
Ajustes → `FORÇAR ATUALIZAÇÃO`. Se a tela de Ajustes não abrir, use o endereço
`#/reset`. Nenhum dos dois apaga fichas ou histórico. Veja
[Como o app se atualiza](#como-o-app-se-atualiza).

**O app abre em branco.**
Espere 6 s: o painel de resgate aparece sozinho com o botão de limpeza.

**O cardio não mede distância.**
O GPS precisa de permissão de localização e de sinal — dentro de um prédio ele
não pega. Na esteira, use o campo manual no fim da sessão.

**A tela apaga durante o treino.**
Wake Lock não existe em todos os navegadores (notadamente Safari mais antigo).
Sem ele, aumente o tempo de bloqueio automático nos ajustes do sistema.

**Não aparece o banner de instalação.**
Só o Chrome/Edge no Android dispara `beforeinstallprompt`. No iOS, use
"Compartilhar → Adicionar à Tela de Início" no Safari.

**Perdi meus dados.**
Se você limpou os dados do site pelo navegador, só um backup exportado
recupera. Se foi uma gravação corrompida, o app já cai sozinho para
`nerv2_data_backup` na próxima abertura.

**"O navegador recusou a gravação".**
`localStorage` cheio ou modo privado. Exporte um backup e apague sessões
antigas, ou saia do modo privado.

---

## Suporte de navegadores

Chrome/Edge 103+, Safari 16.4+, Firefox 113+.

O piso vem do `DecompressionStream`, usado **só** na importação de `.xlsx` — o
resto do app funciona em navegadores mais antigos. Wake Lock, o banner de
instalação e a vibração dependem do navegador; ausentes, o app funciona sem
eles.

O layout é pensado para o celular na vertical, com `safe-area` respeitada em
aparelhos com notch. Em telas largas o conteúdo é limitado a 680 px.

---

## Privacidade

Não há servidor, conta, analytics ou requisição de rede em tempo de execução.
Os únicos dados que saem do aparelho são os que **você** exporta, para onde
você escolher. Nem os desenvolvedores nem terceiros veem seus treinos.
