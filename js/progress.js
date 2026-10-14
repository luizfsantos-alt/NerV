// Leitura do histórico: o que você fez da última vez, seus recordes e o que
// sugerir para hoje.
//
// A carga sugerida é sempre a maior que você já fez naquele exercício, e nunca
// mais do que ela: o app não inventa progressão. Subir a carga é decisão sua,
// e quando você sobe, a Mutação registra o recorde.

import { normalizeName, num, repsToNumber, epley1RM } from './util.js';
import { state } from './state.js';

/** Sessões que contêm um exercício, da mais recente para a mais antiga. */
function sessionsWith(nome) {
  const key = normalizeName(nome);
  return state.workoutHistory
    .filter(h => h.exercicios.some(e => normalizeName(e.nome) === key))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/** A última vez que você fez este exercício: séries, data e volume. */
export function lastPerformance(nome) {
  const key = normalizeName(nome);
  const sess = sessionsWith(nome)[0];
  if (!sess) return null;
  const ex = sess.exercicios.find(e => normalizeName(e.nome) === key);
  if (!ex || !ex.sets.length) return null;
  return {
    date: sess.date,
    sets: ex.sets,
    topCarga: Math.max(...ex.sets.map(s => num(s.carga))),
    totalReps: ex.sets.reduce((a, s) => a + repsToNumber(s.reps), 0),
  };
}

/** Maior carga já registrada num exercício. */
export function bestCarga(nome) {
  const key = normalizeName(nome);
  let max = 0;
  state.workoutHistory.forEach(h => h.exercicios.forEach(ex => {
    if (normalizeName(ex.nome) !== key) return;
    ex.sets.forEach(s => { if (num(s.carga) > max) max = num(s.carga); });
  }));
  return max;
}

/** Melhor 1RM estimado (Epley) num exercício. */
export function best1RM(nome) {
  const key = normalizeName(nome);
  let max = 0;
  state.workoutHistory.forEach(h => h.exercicios.forEach(ex => {
    if (normalizeName(ex.nome) !== key) return;
    ex.sets.forEach(s => { const e = epley1RM(s.carga, s.reps); if (e > max) max = e; });
  }));
  return max;
}

/**
 * Carga inicial de cada série de hoje: o seu recorde de carga no exercício,
 * em todas as séries. Sem histórico, a carga escrita na ficha.
 */
export function suggestSets(ex) {
  const last = lastPerformance(ex.nome);
  const nSeries = Math.max(1, ex.series || 1);
  const base = bestCarga(ex.nome) || num(ex.carga);
  return { sets: Array.from({ length: nSeries }, () => base), last };
}

/**
 * Compara o que acabou de ser feito com o histórico ANTERIOR e devolve os
 * recordes batidos. Chamado antes de gravar a sessão, para que a Mutação
 * signifique alguma coisa.
 */
export function detectPRs(exercicios) {
  const prs = [];
  exercicios.forEach(ex => {
    const doneSets = ex.sets.filter(s => s.done && num(s.carga) > 0 && repsToNumber(s.reps) > 0);
    if (!doneSets.length) return;

    const anterior = bestCarga(ex.nome);
    const agora = Math.max(...doneSets.map(s => num(s.carga)));
    if (anterior > 0 && agora > anterior) {
      prs.push({ nome: ex.nome, tipo: 'carga', valor: agora, anterior });
      return;
    }
    // Mesma carga, mais repetições, também é progresso.
    const ant1rm = best1RM(ex.nome);
    const now1rm = Math.max(...doneSets.map(s => epley1RM(s.carga, s.reps)));
    if (ant1rm > 0 && now1rm > ant1rm * 1.01) {
      prs.push({ nome: ex.nome, tipo: '1rm', valor: now1rm, anterior: ant1rm });
    }
  });
  return prs;
}

/** Ranking de recordes para a tela de estatísticas. */
export function allPRs() {
  const map = new Map();
  state.workoutHistory.forEach(h => h.exercicios.forEach(ex => {
    const key = normalizeName(ex.nome);
    if (!key) return;
    const cur = map.get(key) || { nome: ex.nome, carga: 0, e1rm: 0 };
    ex.sets.forEach(s => {
      if (num(s.carga) > cur.carga) cur.carga = num(s.carga);
      const e = epley1RM(s.carga, s.reps);
      if (e > cur.e1rm) cur.e1rm = e;
    });
    map.set(key, cur);
  }));
  return [...map.values()].filter(x => x.carga > 0).sort((a, b) => b.carga - a.carga);
}

/** Sequência atual de semanas consecutivas com pelo menos uma sessão. */
export function weekStreak() {
  const weeks = new Set();
  const add = h => {
    const d = new Date(h.date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    weeks.add(d.getTime());
  };
  state.workoutHistory.forEach(add);
  state.cardioHistory.forEach(add);
  if (!weeks.size) return 0;

  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  cur.setDate(cur.getDate() - cur.getDay());

  let streak = 0;
  let cursor = cur.getTime();
  // Se ainda não treinou nesta semana, a sequência pode continuar viva na anterior.
  if (!weeks.has(cursor)) cursor -= 7 * 86400000;
  while (weeks.has(cursor)) { streak++; cursor -= 7 * 86400000; }
  return streak;
}

// ===== cardio =====

// Abaixo disto o pace é ruído: 200 m num tiro dão um pace que nenhuma corrida
// de verdade alcança.
export const PACE_MIN_KM = 1;

/** Segundos por km de uma sessão de cardio (Infinity sem distância válida). */
export function paceSeg(c) {
  return c && c.distance >= PACE_MIN_KM && c.duration > 0 ? c.duration / c.distance : Infinity;
}

/** Recordes de cardio: melhor pace (com pelo menos 1 km) e maior distância. */
export function cardioRecords(historico = state.cardioHistory) {
  let pace = Infinity, distancia = 0;
  historico.forEach(c => {
    pace = Math.min(pace, paceSeg(c));
    distancia = Math.max(distancia, c.distance || 0);
  });
  return { pace: Number.isFinite(pace) ? pace : null, distancia: distancia > 0 ? distancia : null };
}

/**
 * Recordes que uma corrida nova bate, contra o histórico ANTERIOR. A primeira
 * corrida não é recorde de nada: não há com o que comparar.
 */
export function detectCardioPRs(nova) {
  const antes = cardioRecords();
  const prs = [];
  const p = paceSeg(nova);
  if (antes.pace && Number.isFinite(p) && p < antes.pace) prs.push({ nome: 'Pace', tipo: 'pace', valor: p, anterior: antes.pace });
  if (antes.distancia && nova.distance > antes.distancia) prs.push({ nome: 'Distância', tipo: 'distancia', valor: nova.distance, anterior: antes.distancia });
  return prs;
}
