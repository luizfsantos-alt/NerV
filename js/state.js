// Estado do app + persistência.
//
// A regra é: o localStorage do usuário guarda anos de treino e não pode ser
// perdido por um bug de escrita. Por isso toda gravação é validada, e a última
// versão boa fica num backup separado que serve de rede de segurança.

import { uid, num } from './util.js';
import { fichaABCD } from './modelos.js';

const STORAGE_KEY = 'nerv2_data_v1';
const BACKUP_KEY = 'nerv2_data_backup';
const FX_KEY = 'nerv2_fx';
const SEED_LIMPO_KEY = 'nerv2_seed_exemplo_removido';
const SCHEMA = 2;

function emptyState() {
  return { schema: SCHEMA, fichas: [], workoutHistory: [], cardioHistory: [] };
}

function isPlausible(obj) {
  return obj && typeof obj === 'object'
    && Array.isArray(obj.fichas)
    && Array.isArray(obj.workoutHistory)
    && Array.isArray(obj.cardioHistory);
}

/** Normaliza dados de qualquer versão anterior para o formato atual. */
export function migrate(raw) {
  const s = Object.assign(emptyState(), raw || {});
  s.schema = SCHEMA;

  s.fichas = (s.fichas || []).map(f => ({
    id: f.id || uid('f'),
    nome: String(f.nome || 'Ficha'),
    treinos: (f.treinos || []).map(t => ({
      id: t.id || uid('t'),
      nome: String(t.nome || 'Treino'),
      exercicios: (t.exercicios || []).map(e => ({
        nome: String(e.nome || 'Exercicio'),
        series: Math.max(1, Math.min(20, parseInt(e.series) || 3)),
        reps: String(e.reps ?? '10'),
        carga: num(e.carga),
        intervalo: Math.max(0, Math.min(900, parseInt(e.intervalo) || 60)),
      })),
    })),
  }));

  s.workoutHistory = (s.workoutHistory || []).filter(h => h && h.date).map(h => ({
    id: h.id || uid('w'),
    date: h.date,
    ficha: String(h.ficha || ''),
    treino: String(h.treino || 'Treino'),
    duration: Math.max(0, parseInt(h.duration) || 0),
    exercicios: (h.exercicios || []).map(ex => ({
      nome: String(ex.nome || ''),
      sets: (ex.sets || []).map(st => ({ carga: num(st.carga), reps: String(st.reps ?? '') })),
    })),
  }));

  s.cardioHistory = (s.cardioHistory || []).filter(h => h && h.date).map(h => ({
    id: h.id || uid('c'),
    date: h.date,
    distance: num(h.distance),
    duration: Math.max(0, parseInt(h.duration) || 0),
    pace: String(h.pace || '00:00'),
    source: h.source === 'gps' ? 'gps' : 'manual',
  }));

  return s;
}

export function loadState() {
  for (const key of [STORAGE_KEY, BACKUP_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (isPlausible(parsed)) return migrate(parsed);
    } catch (e) {
      console.warn('[nerv] falha ao ler', key, e);
    }
  }
  return emptyState();
}

export let state = loadState();

/**
 * Grava o estado. Antes de sobrescrever, promove o último valor íntegro a
 * backup — assim uma gravação corrompida nunca fica sendo a única cópia.
 * Devolve false se o navegador recusou (cota cheia, modo privado).
 */
export function saveState() {
  let payload;
  try {
    payload = JSON.stringify(state);
  } catch (e) {
    console.error('[nerv] estado não serializável', e);
    return false;
  }
  try {
    const prev = localStorage.getItem(STORAGE_KEY);
    if (prev) localStorage.setItem(BACKUP_KEY, prev);
    localStorage.setItem(STORAGE_KEY, payload);
    return true;
  } catch (e) {
    console.error('[nerv] falha ao gravar', e);
    return false;
  }
}

export function replaceState(next) {
  const migrated = migrate(next);
  state.schema = migrated.schema;
  state.fichas = migrated.fichas;
  state.workoutHistory = migrated.workoutHistory;
  state.cardioHistory = migrated.cardioHistory;
  return saveState();
}

/** Backup completo em JSON, para o usuário guardar onde quiser. */
export function exportJSON() {
  return JSON.stringify({
    app: 'NERv2',
    schema: SCHEMA,
    exportedAt: new Date().toISOString(),
    data: { fichas: state.fichas, workoutHistory: state.workoutHistory, cardioHistory: state.cardioHistory },
  }, null, 2);
}

/**
 * Importa um backup. `mode` 'merge' mantém o que já existe e só acrescenta o
 * que falta (por id); 'replace' troca tudo.
 */
export function importJSON(text, mode = 'merge') {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('Arquivo não é um JSON válido.');
  }
  const data = parsed && parsed.data ? parsed.data : parsed;
  if (!isPlausible(Object.assign({ fichas: [], workoutHistory: [], cardioHistory: [] }, data))) {
    throw new Error('Formato de backup não reconhecido.');
  }
  const incoming = migrate(data);

  if (mode === 'replace') {
    replaceState(incoming);
    return { fichas: incoming.fichas.length, sessoes: incoming.workoutHistory.length + incoming.cardioHistory.length };
  }

  const mergeById = (base, add) => {
    const ids = new Set(base.map(x => x.id));
    let n = 0;
    add.forEach(x => { if (!ids.has(x.id)) { base.push(x); ids.add(x.id); n++; } });
    return n;
  };
  const f = mergeById(state.fichas, incoming.fichas);
  const w = mergeById(state.workoutHistory, incoming.workoutHistory);
  const c = mergeById(state.cardioHistory, incoming.cardioHistory);
  saveState();
  return { fichas: f, sessoes: w + c };
}

export function wipeAll() {
  state.fichas = [];
  state.workoutHistory = [];
  state.cardioHistory = [];
  saveState();
}

// --- preferência de FX ---
export function getFX() { 
  try { return localStorage.getItem(FX_KEY) !== 'false'; } catch (e) { return true; }
}
export function setFX(on) {
  try { localStorage.setItem(FX_KEY, String(!!on)); } catch (e) {}
}

/**
 * Remove a ficha de exemplo que as versões antigas semeavam na primeira
 * abertura ("Hipertrofia Full Body").
 *
 * A checagem é deliberadamente rígida: só sai a ficha que continua idêntica,
 * exercício por exercício, ao que o app plantou — e apenas se nenhuma sessão
 * do histórico tiver sido registrada nela. Bastou o usuário trocar um nome, uma
 * carga ou treinar uma vez e ela passa a ser dado de verdade, que fica. Roda
 * uma única vez por aparelho.
 */
const EXEMPLO_ANTIGO = {
  nome: 'Hipertrofia Full Body',
  treinos: [
    ['A — Peito/Costas/Ombro', [
      ['Supino reto', 4, '8-12', 20, 90],
      ['Remada curvada', 4, '10-12', 30, 90],
      ['Desenvolvimento', 3, '10-12', 12, 60],
    ]],
    ['B — Pernas/Bíceps/Tríceps', [
      ['Agachamento', 4, '10-12', 40, 120],
      ['Rosca direta', 3, '12-15', 10, 60],
      ['Tríceps corda', 3, '12-15', 15, 60],
    ]],
  ],
};

function ehExemploIntocado(f) {
  if (!f || f.nome !== EXEMPLO_ANTIGO.nome) return false;
  if ((f.treinos || []).length !== EXEMPLO_ANTIGO.treinos.length) return false;
  return EXEMPLO_ANTIGO.treinos.every(([nomeT, exs], i) => {
    const t = f.treinos[i];
    if (!t || t.nome !== nomeT || (t.exercicios || []).length !== exs.length) return false;
    return exs.every(([nome, series, reps, carga, intervalo], j) => {
      const e = t.exercicios[j];
      return e && e.nome === nome && e.series === series && e.reps === reps
        && num(e.carga) === carga && e.intervalo === intervalo;
    });
  });
}

export function removerFichaExemplo() {
  try { if (localStorage.getItem(SEED_LIMPO_KEY)) return false; } catch (e) {}

  const usadas = new Set(state.workoutHistory.map(h => h.ficha));
  const alvo = state.fichas.filter(f => ehExemploIntocado(f) && !usadas.has(f.nome));
  if (alvo.length) {
    const ids = new Set(alvo.map(f => f.id));
    state.fichas = state.fichas.filter(f => !ids.has(f.id));
    saveState();
  }
  try { localStorage.setItem(SEED_LIMPO_KEY, '1'); } catch (e) {}
  return alvo.length > 0;
}

/**
 * Primeira abertura do app: entra a ficha ABCD de verdade, pronta para treinar.
 * Antes vinha um exemplo genérico de três exercícios que só servia para ser
 * apagado. Só roda com o aparelho ainda vazio — nunca mexe em dados existentes.
 */
export function seedIfEmpty() {
  if (state.fichas.length || state.workoutHistory.length) return false;
  state.fichas = [fichaABCD()];
  saveState();
  return true;
}
