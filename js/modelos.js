// Fichas modelo — ponto único de verdade para as rotinas prontas do app.
//
// Existe uma só: a ABCD, a divisão clássica de quatro treinos. Ela é a ficha
// que o app cria na primeira abertura (no lugar do exemplo genérico antigo) e
// também a que o usuário pode criar de novo a qualquer momento pela tela de
// Fichas, sem ter que digitar 25 exercícios na mão.
//
// A carga vai zerada de propósito: peso é coisa pessoal e o app já sugere a
// carga da última sessão assim que existe uma. Número inventado aqui viraria
// referência falsa no primeiro treino.

import { uid } from './util.js';

/** [nome, séries, reps, descanso em segundos] */
const ABCD = [
  ['A — Peito/Tríceps', [
    ['Supino reto com barra',            4, '8-10',  120],
    ['Supino inclinado com halteres',    4, '10-12',  90],
    ['Crucifixo na máquina (voador)',    3, '12-15',  60],
    ['Crossover na polia alta',          3, '12-15',  60],
    ['Tríceps testa com barra W',        3, '10-12',  60],
    ['Tríceps corda na polia',           3, '12-15',  60],
  ]],
  ['B — Costas/Bíceps', [
    ['Puxada frente na barra',           4, '8-10',  120],
    ['Remada curvada com barra',         4, '8-10',  120],
    ['Remada baixa com triângulo',       3, '10-12',  90],
    ['Pullover na polia alta',           3, '12-15',  60],
    ['Rosca direta com barra W',         3, '10-12',  60],
    ['Rosca martelo com halteres',       3, '12-15',  60],
  ]],
  ['C — Pernas/Panturrilha', [
    ['Agachamento livre',                4, '8-10',  150],
    ['Leg press 45°',                    4, '10-12', 120],
    ['Cadeira extensora',                3, '12-15',  60],
    ['Mesa flexora',                     4, '10-12',  90],
    ['Stiff com halteres',               3, '10-12',  90],
    ['Panturrilha em pé',                4, '15-20',  45],
  ]],
  ['D — Ombros/Abdômen', [
    ['Desenvolvimento com halteres',     4, '8-10',   90],
    ['Elevação lateral',                 4, '12-15',  60],
    ['Elevação frontal',                 3, '12-15',  60],
    ['Crucifixo inverso (voador inv.)',  3, '12-15',  60],
    ['Encolhimento com halteres',        3, '12-15',  60],
    ['Abdominal infra na paralela',      3, '15-20',  45],
    ['Prancha isométrica',               3, '40s',    45],
  ]],
];

/**
 * Monta uma cópia nova da ficha ABCD — ids frescos a cada chamada, para que
 * criar duas vezes não gere duas fichas compartilhando o mesmo id.
 */
export function fichaABCD(nome = 'Ficha ABCD') {
  return {
    id: uid('f'),
    nome: String(nome || 'Ficha ABCD'),
    treinos: ABCD.map(([nomeTreino, exercicios]) => ({
      id: uid('t'),
      nome: nomeTreino,
      exercicios: exercicios.map(([ex, series, reps, intervalo]) => ({
        nome: ex, series, reps, carga: 0, intervalo,
      })),
    })),
  };
}

/** Resumo para mostrar na interface sem ter que montar a ficha inteira. */
export const RESUMO_ABCD = {
  treinos: ABCD.length,
  exercicios: ABCD.reduce((a, [, ex]) => a + ex.length, 0),
};
