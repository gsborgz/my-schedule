// Regras de repetição das atividades (espelhadas em client/src/lib/recurrence.ts).

export type RepeatType = 'weekly' | 'interval';

export interface Recurrence {
  repeatType: RepeatType;
  /** weekly: dias da semana, 0 = domingo */
  days: number[];
  /** interval: primeira ocorrência, "YYYY-MM-DD" */
  startDate: string | null;
  /** interval: repete a cada N dias */
  intervalDays: number | null;
}

/** Dias entre duas datas "YYYY-MM-DD" (b - a). */
export function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** A atividade acontece nesta data? (`weekday` = dia da semana da data, 0 = domingo) */
export function occursOn(r: Recurrence, date: string, weekday: number): boolean {
  if (r.repeatType === 'interval') {
    if (!r.startDate || !r.intervalDays || date < r.startDate) return false;
    return daysBetween(r.startDate, date) % r.intervalDays === 0;
  }
  return r.days.includes(weekday);
}
