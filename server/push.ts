import { Router } from 'express';
import * as webpush from 'web-push';
import { config } from './config.ts';
import { db } from './db.ts';

webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

interface SubscriptionRow {
  endpoint: string;
  keys: string;
}

/** Envia para todos os dispositivos inscritos. Remove inscrições expiradas. */
export async function sendToAll(payload: PushPayload): Promise<number> {
  const subs = db.prepare('SELECT endpoint, keys FROM push_subscriptions').all() as unknown as SubscriptionRow[];
  let delivered = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: JSON.parse(s.keys) }, JSON.stringify(payload), {
          TTL: 60 * 30,
          urgency: 'high',
        });
        delivered++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(s.endpoint);
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

pushRouter.post('/subscribe', (req, res) => {
  const { endpoint, keys } = req.body ?? {};
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth) {
    return void res.status(400).json({ error: 'Inscrição inválida' });
  }
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, keys, user_agent) VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET keys = excluded.keys, user_agent = excluded.user_agent`,
  ).run(endpoint, JSON.stringify({ p256dh: keys.p256dh, auth: keys.auth }), req.get('user-agent') ?? null);
  res.status(204).end();
});

pushRouter.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body ?? {};
  if (typeof endpoint === 'string') db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
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
