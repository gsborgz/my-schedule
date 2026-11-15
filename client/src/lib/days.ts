import type { Activity } from '../types';

export const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DAY_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Ordem de exibição: semana começando na segunda. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** "YYYY-MM-DD" no fuso local. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Segunda-feira da semana de `d`, deslocada `weekOffset` semanas. */
export function weekStart(d: Date, weekOffset = 0): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(r, -((r.getDay() + 6) % 7) + weekOffset * 7);
}

export function formatDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

export function formatISODate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}/${String(m).padStart(2, '0')}/${y}`;
}

function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** A atividade acontece nesta data? (mesma regra de server/recurrence.ts) */
export function occursOn(a: Activity, date: Date): boolean {
  if (a.repeatType === 'interval') {
    const iso = toISODate(date);
    if (!a.startDate || !a.intervalDays || iso < a.startDate) return false;
    return daysBetween(a.startDate, iso) % a.intervalDays === 0;
  }
  return a.days.includes(date.getDay());
}

export function describeRepeat(a: Activity): string {
  if (a.repeatType === 'interval') {
    return a.intervalDays === 1 ? 'todo dia' : `a cada ${a.intervalDays} dias`;
  }
  if (a.days.length === 7) return 'todo dia';
  return WEEK_ORDER.filter((d) => a.days.includes(d))
    .map((d) => DAY_SHORT[d])
    .join(', ');
}
