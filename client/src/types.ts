export type RepeatType = 'weekly' | 'interval';

export interface Activity {
  id: number;
  title: string;
  notes: string;
  /** weekly: dias da semana escolhidos · interval: a cada N dias a partir de startDate */
  repeatType: RepeatType;
  /** weekly: 0 = domingo ... 6 = sábado */
  days: number[];
  /** interval: primeira ocorrência, "YYYY-MM-DD" */
  startDate: string | null;
  /** interval: repete a cada N dias */
  intervalDays: number | null;
  startTime: string;
  endTime: string | null;
  /** minutos antes do início; null = sem lembrete */
  remindBefore: number | null;
  color: string;
  enabled: boolean;
}

export type ActivityInput = Omit<Activity, 'id'>;
