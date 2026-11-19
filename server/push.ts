import { Router } from 'express';
import * as webpush from 'web-push';
import { config } from './config.js';
import { db, getMeta } from './db.js';

webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface SendResult {
  delivered: number;
  failures: { service: string; status: number | null; message: string }[];
}

/** Envia para todos os dispositivos inscritos. Remove inscrições expiradas. */
export async function sendToAll(payload: PushPayload): Promise<SendResult> {
  const { rows } = await db.execute('SELECT endpoint, keys FROM push_subscriptions');
  const result: SendResult = { delivered: 0, failures: [] };
  await Promise.all(
    rows.map(async (row) => {
      const endpoint = String(row.endpoint);
      try {
        await webpush.sendNotification({ endpoint, keys: JSON.parse(String(row.keys)) }, JSON.stringify(payload), {
          TTL: 60 * 30,
          urgency: 'high',
        });
        result.delivered++;
      } catch (err) {
        const e = err as { statusCode?: number; body?: string; message?: string };
        const status = e.statusCode ?? null;
        if (status === 404 || status === 410) {
          await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?', args: [endpoint] });
        }
        const failure = { service: new URL(endpoint).host, status, message: (e.body || e.message || String(err)).slice(0, 300) };
        console.error('[push] falha ao enviar:', failure);
        result.failures.push(failure);
      }
    }),
  );
  return result;
}

export const pushRouter = Router();

pushRouter.get('/public-key', (_req, res) => {
  res.json({ publicKey: config.vapid.publicKey });
});

pushRouter.post('/subscribe', async (req, res) => {
  const { endpoint, keys } = req.body ?? {};
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth) {
    return void res.status(400).json({ error: 'Inscrição inválida' });
  }
  await db.execute({
    sql: `INSERT INTO push_subscriptions (endpoint, keys, user_agent) VALUES (?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET keys = excluded.keys, user_agent = excluded.user_agent`,
    args: [endpoint, JSON.stringify({ p256dh: keys.p256dh, auth: keys.auth }), req.get('user-agent') ?? null],
  });
  res.status(204).end();
});

pushRouter.post('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body ?? {};
  if (typeof endpoint === 'string') {
    await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?', args: [endpoint] });
  }
  res.status(204).end();
});

pushRouter.post('/test', async (_req, res) => {
  const result = await sendToAll({
    title: 'Notificações funcionando ✅',
    body: 'Você vai receber os lembretes da sua agenda aqui.',
    tag: 'test',
  });
  res.json(result);
});

/** Diagnóstico: quantos aparelhos inscritos e quando o agendador rodou por último. */
pushRouter.get('/status', async (_req, res) => {
  const { rows } = await db.execute(
    'SELECT (SELECT COUNT(*) FROM push_subscriptions) AS subs, (SELECT COUNT(*) FROM activities) AS acts',
  );
  res.json({
    subscriptions: Number(rows[0].subs),
    activities: Number(rows[0].acts),
    dbId: await getMeta('db_id'),
    dbCreatedAt: await getMeta('db_created_at'),
    deployment: process.env.VERCEL_DEPLOYMENT_ID?.slice(-8) ?? 'local',
    lastCronRun: await getMeta('last_cron_run'),
    cronConfigured: Boolean(config.cronSecret),
    database: config.database.url.startsWith('file:')
      ? 'arquivo local'
      : `${new URL(config.database.url).host.split('.')[0]} (via ${config.database.source})`,
  });
});
