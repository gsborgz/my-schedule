import { Router } from 'express';
import type { Row } from '@libsql/client';
import { db } from './db.js';
import type { Recurrence } from './recurrence.js';

export interface Activity extends Recurrence {
  id: number;
  title: string;
  notes: string;
  startTime: string;
  endTime: string | null;
  remindBefore: number | null;
  color: string;
  enabled: boolean;
}

type ActivityInput = Omit<Activity, 'id'>;

function fromRow(row: Row): Activity {
  return {
    id: Number(row.id),
    title: String(row.title),
    notes: String(row.notes),
    repeatType: row.repeat_type === 'interval' ? 'interval' : 'weekly',
    days: JSON.parse(String(row.days)),
    startDate: row.start_date === null ? null : String(row.start_date),
    intervalDays: row.interval_days === null ? null : Number(row.interval_days),
    startTime: String(row.start_time),
    endTime: row.end_time === null ? null : String(row.end_time),
    remindBefore: row.remind_before === null ? null : Number(row.remind_before),
    color: String(row.color),
    enabled: Number(row.enabled) === 1,
  };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function parseInput(body: unknown): ActivityInput | string {
  if (typeof body !== 'object' || body === null) return 'Corpo inválido';
  const b = body as Record<string, unknown>;

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title) return 'Informe um título';
  if (title.length > 120) return 'Título muito longo';

  const notes = typeof b.notes === 'string' ? b.notes.trim().slice(0, 2000) : '';

  // Repetição
  const repeatType = b.repeatType === 'interval' ? 'interval' : 'weekly';
  let days: number[] = [];
  let startDate: string | null = null;
  let intervalDays: number | null = null;

  if (repeatType === 'weekly') {
    if (!Array.isArray(b.days) || b.days.length === 0) return 'Escolha pelo menos um dia';
    days = [...new Set(b.days.map(Number))].sort((x, y) => x - y);
    if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return 'Dias inválidos';
  } else {
    if (typeof b.startDate !== 'string' || !DATE_RE.test(b.startDate)) return 'Data de início inválida';
    startDate = b.startDate;
    intervalDays = Number(b.intervalDays);
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365) return 'Intervalo deve ser de 1 a 365 dias';
  }

  if (typeof b.startTime !== 'string' || !TIME_RE.test(b.startTime)) return 'Horário de início inválido';
  const startTime = b.startTime;

  let endTime: string | null = null;
  if (b.endTime) {
    if (typeof b.endTime !== 'string' || !TIME_RE.test(b.endTime)) return 'Horário de término inválido';
    if (b.endTime <= startTime) return 'O término precisa ser depois do início';
    endTime = b.endTime;
  }

  let remindBefore: number | null = null;
  if (b.remindBefore !== null && b.remindBefore !== undefined && b.remindBefore !== '') {
    remindBefore = Number(b.remindBefore);
    if (!Number.isInteger(remindBefore) || remindBefore < 0 || remindBefore > 1440) return 'Lembrete inválido';
  }

  const color = typeof b.color === 'string' && COLOR_RE.test(b.color) ? b.color : '#6366f1';
  const enabled = b.enabled === undefined ? true : Boolean(b.enabled);

  return { title, notes, repeatType, days, startDate, intervalDays, startTime, endTime, remindBefore, color, enabled };
}

function toArgs(a: ActivityInput) {
  return {
    title: a.title,
    notes: a.notes,
    repeat_type: a.repeatType,
    days: JSON.stringify(a.days),
    start_date: a.startDate,
    interval_days: a.intervalDays,
    start_time: a.startTime,
    end_time: a.endTime,
    remind_before: a.remindBefore,
    color: a.color,
    enabled: a.enabled ? 1 : 0,
  };
}

export async function listActivities(): Promise<Activity[]> {
  const { rows } = await db.execute('SELECT * FROM activities ORDER BY start_time, title');
  return rows.map(fromRow);
}

export const activitiesRouter = Router();

activitiesRouter.get('/', async (_req, res) => {
  res.json(await listActivities());
});

activitiesRouter.post('/', async (req, res) => {
  const input = parseInput(req.body);
  if (typeof input === 'string') return void res.status(400).json({ error: input });
  const { rows } = await db.execute({
    sql: `INSERT INTO activities (title, notes, repeat_type, days, start_date, interval_days,
            start_time, end_time, remind_before, color, enabled)
          VALUES (:title, :notes, :repeat_type, :days, :start_date, :interval_days,
            :start_time, :end_time, :remind_before, :color, :enabled)
          RETURNING *`,
    args: toArgs(input),
  });
  res.status(201).json(fromRow(rows[0]));
});

activitiesRouter.put('/:id', async (req, res) => {
  const input = parseInput(req.body);
  if (typeof input === 'string') return void res.status(400).json({ error: input });
  const { rows } = await db.execute({
    sql: `UPDATE activities SET title = :title, notes = :notes, repeat_type = :repeat_type, days = :days,
            start_date = :start_date, interval_days = :interval_days, start_time = :start_time,
            end_time = :end_time, remind_before = :remind_before, color = :color, enabled = :enabled,
            updated_at = datetime('now')
          WHERE id = :id
          RETURNING *`,
    args: { ...toArgs(input), id: Number(req.params.id) },
  });
  if (rows.length === 0) return void res.status(404).json({ error: 'Atividade não encontrada' });
  res.json(fromRow(rows[0]));
});

activitiesRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [, result] = await db.batch(
    [
      { sql: 'DELETE FROM notification_log WHERE activity_id = ?', args: [id] },
      { sql: 'DELETE FROM activities WHERE id = ?', args: [id] },
    ],
    'write',
  );
  if (result.rowsAffected === 0) return void res.status(404).json({ error: 'Atividade não encontrada' });
  res.status(204).end();
});
