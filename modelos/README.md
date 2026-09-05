# Modelos de ficha

Arquivos prontos para montar seus treinos fora da academia e importar no app
sem digitar exercício por exercício no celular.

| Arquivo | Para que serve | Onde importar |
|---|---|---|
| `modelo-ficha.xlsx` | Planilha com a ficha ABCD de exemplo e uma aba de instruções | dentro de uma ficha |
| `modelo-ficha.csv` | Mesma ficha em CSV (`;`, padrão do Excel pt-BR) | dentro de uma ficha |
| `modelo-ficha-em-branco.csv` | Esqueleto A/B/C/D com linhas para preencher | dentro de uma ficha |
| `modelo-ficha.txt` | Ficha inteira em texto, para colar | `Nova Ficha` → `Importar Texto` |

Há duas portas de entrada diferentes, e a diferença importa:

- **Planilha (`.xlsx` / `.csv`)** → abra a ficha e use o botão de importar
  arquivo. Os treinos do arquivo são **adicionados à ficha aberta**; o arquivo
  não cria a ficha.
- **Texto (`.txt`)** → `Nova Ficha` → `Importar Texto` cria a **ficha inteira**,
  com nome e todos os treinos de uma vez.

---

## Planilha: as cinco colunas

```
Nome                          | Séries | Reps  | Carga | Intervalo
A — Peito/Tríceps
Supino reto com barra         | 4      | 8-10  | 0     | 120
Supino inclinado com halteres | 4      | 10-12 | 0     | 90
```

- A **primeira linha** é o cabeçalho e é ignorada na importação.
- Linha com conteúdo **só na coluna A** abre um treino novo — é assim que se
  separa A, B, C e D.
- Qualquer outra linha com conteúdo é um exercício.
- Linhas totalmente vazias são ignoradas: use à vontade para respirar.
- No `.xlsx`, **só a primeira aba é lida**. A aba `Instruções` nunca entra.

### Os campos

| Campo | Regra | Vazio ou inválido vira |
|---|---|---|
| **Nome** | texto livre | (linha ignorada) |
| **Séries** | inteiro de 1 a 20 | `3` |
| **Reps** | texto livre: `10`, `8-12`, `15-20`, `40s` | `10` |
| **Carga** | kg, aceita `22,5` ou `22.5` | `0` |
| **Intervalo** | descanso em segundos, de 0 a 900 | `60` |

**Deixe a carga em 0.** É de propósito: o app sugere a carga a partir da sua
última sessão daquele exercício, série a série. Número chutado aqui vira
referência falsa no primeiro treino.

### Dois cuidados com o Excel

- **Reps viram data.** Digitar `8-10` numa célula comum vira `8 de out`. A
  coluna Reps do `.xlsx` já vem formatada como **Texto** por isso — se criar
  uma planilha do zero, formate a coluna antes de digitar.
- **Separador do CSV.** Os `.csv` daqui usam `;`, que é o que o Excel em pt-BR
  espera. O app também aceita `,` e tabulação, e respeita aspas — então um CSV
  exportado de qualquer lugar costuma funcionar.

Sem suporte a `.xlsx` no navegador (raro, e o app avisa), exporte a planilha
como `.csv` e importe assim.

---

## Texto: um exercício por linha

```
Ficha: Hipertrofia ABCD
Treino A: Peito/Tríceps
Supino reto com barra 4x8-10 0kg 120s
Remada curvada com barra | 4 | 8-10 | 0 | 120
```

- `Ficha:`, `Plano:`, `Programa:` ou `Rotina:` dão nome à ficha.
- `Treino A:`, `Dia 2 — Pernas` ou `A - Peito` abrem um treino.
- O resto é exercício, em qualquer um dos formatos:
  - `Supino reto 4x8-12 60kg 90s` (livre)
  - `Supino reto | 4 | 8-12 | 60 | 90` (barras)
  - `Supino reto, 4, 8-12, 60, 90` (vírgulas)
- O que faltar assume o padrão: 3 séries, 10 reps, 60 s.

Uma pegadinha do formato livre: um número seguido de `x` fecha o nome do
exercício. `Leg press 45° 4x10-12` funciona, mas evite nomes que terminem em
algo como `2x` se não for a contagem de séries.
