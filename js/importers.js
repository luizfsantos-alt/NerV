// Importação de fichas: texto colado, CSV e XLSX.

import { uid, num } from './util.js';

/**
 * Uma linha vira exercício se casar com um dos formatos aceitos:
 *   Supino reto 4x8-12 60kg 90s
 *   Supino reto | 4 | 8-12 | 60 | 90
 *   Supino reto, 4, 8-12, 60, 90
 */
export function parseExercicioLine(line) {
  const txt = String(line || '').trim();
  if (!txt) return null;

  // Separadores explícitos primeiro — são inequívocos.
  if (/[|;]/.test(txt) || (txt.match(/,/g) || []).length >= 2) {
    const parts = txt.split(/[|;,]/).map(p => p.trim()).filter((p, i) => i === 0 || p !== '');
    if (parts.length >= 2 && parts[0]) {
      return {
        nome: parts[0],
        series: clampSeries(parts[1]),
        reps: String(parts[2] || '10').replace(/reps?/i, '').trim() || '10',
        carga: num(String(parts[3] || '').replace(/kg/i, '')),
        intervalo: clampIntervalo(parts[4]),
      };
    }
  }

  // Formato livre: "Nome 4x8-12 60kg 90s"
  const m = txt.match(/^(.+?)[\s:–-]+(\d{1,2})\s*[xX×]\s*(\d+(?:\s*[-–a]\s*\d+)?)\s*(?:reps?)?(?:\s*[·|,-]?\s*(\d+(?:[.,]\d+)?)\s*kg)?(?:\s*[·|,-]?\s*(\d+)\s*s(?:eg)?)?/i);
  if (m && m[1].trim()) {
    return {
      nome: m[1].trim().replace(/[-–:]\s*$/, '').trim(),
      series: clampSeries(m[2]),
      reps: m[3].replace(/\s+/g, ''),
      carga: num(m[4]),
      intervalo: clampIntervalo(m[5]),
    };
  }
  return null;
}

function clampSeries(v) {
  const n = parseInt(v);
  return Math.max(1, Math.min(20, isFinite(n) && n > 0 ? n : 3));
}
function clampIntervalo(v) {
  const n = parseInt(v);
  return Math.max(0, Math.min(900, isFinite(n) && n > 0 ? n : 60));
}

/** Linha que anuncia um treino: "Treino A:", "Dia 2 — Pernas", "A - Peito". */
function isTreinoHeader(line) {
  const t = String(line).trim();
  if (parseExercicioLine(t)) return false;      // exercício ganha da heurística
  if (/^(treino|dia|workout|semana|day)\b/i.test(t)) return true;
  if (/^[A-Z]\s*[-–—:]\s*\S/.test(t)) return true;   // "A — Peito/Costas"
  if (/:\s*\S/.test(t) && t.length < 60 && !/\d+\s*[xX×]/.test(t)) return true;
  return false;
}

function isFichaHeader(line) {
  return /^(ficha|plano|programa|rotina)\b/i.test(String(line).trim());
}

function cleanHeader(line) {
  const original = String(line).replace(/:\s*/, ' — ').trim();
  const stripped = String(line)
    .replace(/^(treino|dia|workout|semana|day|ficha|plano|programa|rotina)\s*/i, '')
    .replace(/^[:\-–—]\s*/, '').replace(/:\s*/, ' — ').trim();
  // "Treino A" viraria só "A" — nesse caso o rótulo original diz mais.
  return stripped.length >= 3 ? stripped : (original || 'Treino');
}

/**
 * Ficha inteira a partir de texto colado.
 * Antes, qualquer linha com ":" virava um treino novo — inclusive linhas de
 * exercício. Agora a checagem de exercício vem primeiro.
 */
export function parseTextoFicha(text) {
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  const ficha = { id: uid('f'), nome: 'Ficha Importada', treinos: [] };
  let atual = null;

  lines.forEach(line => {
    if (isFichaHeader(line)) {
      ficha.nome = cleanHeader(line) || ficha.nome;
      return;
    }
    if (isTreinoHeader(line)) {
      if (atual && atual.exercicios.length) ficha.treinos.push(atual);
      atual = { id: uid('t'), nome: cleanHeader(line), exercicios: [] };
      return;
    }
    const ex = parseExercicioLine(line);
    if (!ex) return;
    if (!atual) atual = { id: uid('t'), nome: 'Treino 1', exercicios: [] };
    atual.exercicios.push(ex);
  });

  if (atual && atual.exercicios.length) ficha.treinos.push(atual);
  return ficha.treinos.length ? ficha : null;
}

/**
 * CSV robusto: respeita aspas e detecta o separador (Excel em pt-BR exporta
 * com ponto e vírgula, não vírgula).
 */
export function parseCSV(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const head = src.split('\n').slice(0, 5).join('\n');
  const sep = (head.match(/;/g) || []).length > (head.match(/,/g) || []).length ? ';'
            : (head.match(/\t/g) || []).length > (head.match(/,/g) || []).length ? '\t' : ',';

  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === sep) { row.push(field.trim()); field = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field.trim()); field = '';
      if (row.some(c => c !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field.trim());
  if (row.some(c => c !== '')) rows.push(row);
  return rows;
}

/** Remove células vazias do fim da linha, que a planilha costuma deixar. */
function trimRow(row) {
  const out = row.slice();
  while (out.length && String(out[out.length - 1]).trim() === '') out.pop();
  return out;
}

/**
 * Matriz de planilha -> treinos.
 * Colunas esperadas: Nome | Séries | Reps | Carga | Intervalo.
 * Uma linha com só a primeira célula preenchida é tratada como título de treino.
 */
export function rowsToTreinos(rows) {
  const treinos = [];
  let atual = null;

  (rows || []).forEach((raw, idx) => {
    const row = trimRow(raw || []);
    const first = String(row[0] || '').trim();
    if (!first) return;

    // Cabeçalho de colunas da planilha — ignora.
    if (idx === 0 && /^(nome|exerc)/i.test(first) && row.length >= 3) return;

    if (row.length === 1) {
      if (atual && atual.exercicios.length) treinos.push(atual);
      atual = { id: uid('t'), nome: cleanHeader(first), exercicios: [] };
      return;
    }

    if (!atual) atual = { id: uid('t'), nome: 'Treino Importado', exercicios: [] };
    atual.exercicios.push({
      nome: first,
      series: clampSeries(row[1]),
      reps: String(row[2] ?? '10').trim() || '10',
      carga: num(String(row[3] ?? '').replace(/kg/i, '')),
      intervalo: clampIntervalo(row[4]),
    });
  });

  if (atual && atual.exercicios.length) treinos.push(atual);
  return treinos;
}
