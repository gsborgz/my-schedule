export interface Activity {
  id: number;
  title: string;
  notes: string;
  /** 0 = domingo ... 6 = sábado */
  days: number[];
  startTime: string;
  endTime: string | null;
  /** minutos antes do início; null = sem lembrete */
  remindBefore: number | null;
  color: string;
  enabled: boolean;
}

export type ActivityInput = Omit<Activity, 'id'>;
