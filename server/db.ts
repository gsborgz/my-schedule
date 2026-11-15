import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(config.dataDir, 'app.db'));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS activities (
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
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint   TEXT PRIMARY KEY,
    keys       TEXT NOT NULL,                    -- JSON: { p256dh, auth }
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Evita enviar o mesmo lembrete duas vezes.
  CREATE TABLE IF NOT EXISTS notification_log (
    activity_id INTEGER NOT NULL,
    fire_key    TEXT    NOT NULL,                -- "YYYY-MM-DDTmmmm" (data + minuto do dia)
    PRIMARY KEY (activity_id, fire_key)
  );
`);
