import { Router } from 'express';
import { db } from './db.ts';

export interface Activity {
  id: number;
  title: string;
  notes: string;
  days: number[];
  startTime: string;
  endTime: string | null;
  remindBefore: number | null;
  color: string;
  enabled: boolean;
}

type ActivityInput = Omit<Activity, 'id'>;

interface ActivityRow {
  id: number;
  title: string;
  notes: string;
  days: string;
  start_time: string;
  end_time: string | null;
  remind_before: number | null;
  color: string;
  enabled: number;
}

function fromRow(row: ActivityRow): Activity {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    days: JSON.parse(row.days),
    startTime: row.start_time,
    endTime: row.end_time,
    remindBefore: row.remind_before,
    color: row.color,
    enabled: row.enabled === 1,
  };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function parseInput(body: unknown): ActivityInput | string {
  if (typeof body !== 'object' || body === null) return 'Corpo inválido';
  const b = body as Record<string, unknown>;

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title) return 'Informe um título';
  if (title.length > 120) return 'Título muito longo';

  const notes = typeof b.notes === 'string' ? b.notes.trim().slice(0, 2000) : '';

  if (!Array.isArray(b.days) || b.days.length === 0) return 'Escolha pelo menos um dia';
  const days = [...new Set(b.days.map(Number))].sort((x, y) => x - y);
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return 'Dias inválidos';

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

  return { title, notes, days, startTime, endTime, remindBefore, color, enabled };
}

function toParams(a: ActivityInput) {
  return {
    title: a.title,
    notes: a.notes,
    days: JSON.stringify(a.days),
    start_time: a.startTime,
    end_time: a.endTime,
    remind_before: a.remindBefore,
    color: a.color,
    enabled: a.enabled ? 1 : 0,
  };
}

export function listActivities(): Activity[] {
  const rows = db.prepare('SELECT * FROM activities ORDER BY start_time, title').all() as unknown as ActivityRow[];
  return rows.map(fromRow);
}

function getActivity(id: number): Activity | undefined {
  const row = db.prepare('SELECT * FROM activities WHERE id = ?').get(id) as unknown as ActivityRow | undefined;
  return row && fromRow(row);
}

export const activitiesRouter = Router();

activitiesRouter.get('/', (_req, res) => {
  res.json(listActivities());
});

activitiesRouter.post('/', (req, res) => {
  const input = parseInput(req.body);
  if (typeof input === 'string') return void res.status(400).json({ error: input });
  const result = db
    .prepare(
      `INSERT INTO activities (title, notes, days, start_time, end_time, remind_before, color, enabled)
       VALUES (:title, :notes, :days, :start_time, :end_time, :remind_before, :color, :enabled)`,
    )
    .run(toParams(input));
  res.status(201).json(getActivity(Number(result.lastInsertRowid)));
});

activitiesRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const input = parseInput(req.body);
  if (typeof input === 'string') return void res.status(400).json({ error: input });
  const result = db
    .prepare(
      `UPDATE activities SET title = :title, notes = :notes, days = :days, start_time = :start_time,
         end_time = :end_time, remind_before = :remind_before, color = :color, enabled = :enabled,
         updated_at = datetime('now')
       WHERE id = :id`,
    )
    .run({ ...toParams(input), id });
  if (result.changes === 0) return void res.status(404).json({ error: 'Atividade não encontrada' });
  res.json(getActivity(id));
});

activitiesRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM notification_log WHERE activity_id = ?').run(id);
  const result = db.prepare('DELETE FROM activities WHERE id = ?').run(id);
  if (result.changes === 0) return void res.status(404).json({ error: 'Atividade não encontrada' });
  res.status(204).end();
});
