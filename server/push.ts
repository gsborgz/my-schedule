import { Router } from 'express';
import * as webpush from 'web-push';
import { config } from './config.js';
import { db } from './db.js';

webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Envia para todos os dispositivos inscritos. Remove inscrições expiradas. */
export async function sendToAll(payload: PushPayload): Promise<number> {
  const { rows } = await db.execute('SELECT endpoint, keys FROM push_subscriptions');
  let delivered = 0;
  await Promise.all(
    rows.map(async (row) => {
      const endpoint = String(row.endpoint);
      try {
        await webpush.sendNotification({ endpoint, keys: JSON.parse(String(row.keys)) }, JSON.stringify(payload), {
          TTL: 60 * 30,
          urgency: 'high',
        });
        delivered++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?', args: [endpoint] });
        } else {
          console.error('[push] falha ao enviar:', status ?? err);
        }
      }
    }),
  );
  return delivered;
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
  const delivered = await sendToAll({
    title: 'Notificações funcionando ✅',
    body: 'Você vai receber os lembretes da sua agenda aqui.',
    tag: 'test',
  });
  res.json({ delivered });
});
