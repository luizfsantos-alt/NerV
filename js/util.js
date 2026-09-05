// Utilitários puros, sem estado.

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Segundos -> MM:SS, ou H:MM:SS quando passa de uma hora. */
export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Duração longa em formato compacto: "42h 15min". Para totais acumulados. */
export function fmtDuration(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h >= 1) return `${h}h ${String(m).padStart(2, '0')}min`;
  return `${m}min`;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '--';
  return d.toLocaleDateString('pt-BR');
}

export function fmtDateShort(d) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Ids curtos e sem colisão, para ficha/treino/sessão. */
export function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Aceita "12,5" e "12.5"; devolve 0 para lixo. */
export function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

/** Média de reps de um intervalo tipo "8-12" -> 10. Usado só para estimativas. */
export function repsToNumber(reps) {
  const s = String(reps ?? '').trim();
  const range = s.match(/^(\d+)\s*[-–a]\s*(\d+)$/i);
  if (range) return (parseInt(range[1]) + parseInt(range[2])) / 2;
  return num(s);
}

/** 1RM estimado pela fórmula de Epley. Acima de ~12 reps a estimativa perde valor. */
export function epley1RM(carga, reps) {
  const c = num(carga), r = repsToNumber(reps);
  if (c <= 0 || r <= 0) return 0;
  return c * (1 + r / 30);
}

export function startOfWeek(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

/** Volume (kg) de uma lista de séries: soma de carga x reps. */
export function volumeOfSets(sets) {
  return (sets || []).reduce((a, s) => a + num(s.carga) * repsToNumber(s.reps), 0);
}

export function normalizeName(nome) {
  return String(nome || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Arredonda para o incremento de anilha mais próximo (2,5 kg). */
export function roundToPlate(kg, step = 2.5) {
  return Math.round(kg / step) * step;
}
