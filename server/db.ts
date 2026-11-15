import fs from 'node:fs';
import { createClient } from '@libsql/client';
import { config } from './config.js';

if (config.database.url.startsWith('file:')) fs.mkdirSync(config.database.dataDir, { recursive: true });

export const db = createClient({ url: config.database.url, authToken: config.database.authToken });

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS activities (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT    NOT NULL,
    notes         TEXT    NOT NULL DEFAULT '',
    days          TEXT    NOT NULL,              -- JSON: [0..6], 0 = domingo
    start_time    TEXT    NOT NULL,              -- "HH:MM"
    end_time      TEXT,                          -- "HH:MM" ou NULL
    remind_before INTEGER DEFAULT 10,            -- minutos antes; NULL = sem lembrete
    color         TEXT    NOT NULL DEFAULT '#6366f1',
    enabled       INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint   TEXT PRIMARY KEY,
    keys       TEXT NOT NULL,                    -- JSON: { p256dh, auth }
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // Evita enviar o mesmo lembrete duas vezes.
  `CREATE TABLE IF NOT EXISTS notification_log (
    activity_id INTEGER NOT NULL,
    fire_key    TEXT    NOT NULL,                -- "YYYY-MM-DDTmmmm" (data + minuto do dia)
    PRIMARY KEY (activity_id, fire_key)
  )`,
  // Valores avulsos (ex.: última execução do agendador).
  `CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

export async function setMeta(key: string, value: string): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    args: [key, value],
  });
}

export async function getMeta(key: string): Promise<string | null> {
  const { rows } = await db.execute({ sql: 'SELECT value FROM meta WHERE key = ?', args: [key] });
  return rows.length ? String(rows[0].value) : null;
}

let ready: Promise<void> | undefined;

/** Colunas adicionadas depois da primeira versão (bancos existentes são atualizados). */
const ACTIVITY_COLUMNS: Record<string, string> = {
  repeat_type: "TEXT NOT NULL DEFAULT 'weekly'", // 'weekly' | 'interval'
  start_date: 'TEXT', //                             "YYYY-MM-DD" (interval)
  interval_days: 'INTEGER', //                       a cada N dias (interval)
};

async function migrate(): Promise<void> {
  await db.batch(SCHEMA, 'write');
  const { rows } = await db.execute('PRAGMA table_info(activities)');
  const existing = new Set(rows.map((r) => String(r.name)));
  const missing = Object.entries(ACTIVITY_COLUMNS).filter(([name]) => !existing.has(name));
  if (missing.length) {
    await db.batch(
      missing.map(([name, type]) => `ALTER TABLE activities ADD COLUMN ${name} ${type}`),
      'write',
    );
  }
}

/** Cria/atualiza as tabelas (uma vez por instância). */
export function ensureSchema(): Promise<void> {
  ready ??= migrate().catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}
