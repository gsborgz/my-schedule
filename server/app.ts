import './env.js';
import crypto from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import { activitiesRouter } from './activities.js';
import {
  checkPassword,
  clearSessionCookie,
  isAuthenticated,
  isLoginRateLimited,
  requireAuth,
  resetLoginAttempts,
  setSessionCookie,
} from './auth.js';
import { config } from './config.js';
import { ensureSchema } from './db.js';
import { pushRouter } from './push.js';
import { runReminders } from './scheduler.js';

const app = express();
app.set('trust proxy', 1); // respeita X-Forwarded-Proto atrás de proxy HTTPS
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// Garante as tabelas antes de qualquer rota da API.
app.use('/api', async (_req, _res, next) => {
  await ensureSchema();
  next();
});

// --- Sessão (rotas públicas) ---
app.get('/api/session', (req, res) => {
  res.json({ authenticated: isAuthenticated(req) });
});

app.post('/api/login', (req, res) => {
  const ip = req.ip ?? 'unknown';
  if (isLoginRateLimited(ip)) {
    return void res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
  }
  if (typeof req.body?.password !== 'string' || !checkPassword(req.body.password)) {
    return void res.status(401).json({ error: 'Senha incorreta' });
  }
  resetLoginAttempts(ip);
  setSessionCookie(req, res);
  res.status(204).end();
});

app.post('/api/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

// --- Cron: chamado a cada minuto pelo agendador externo (ou Vercel Cron) ---
app.all('/api/cron/reminders', async (req, res) => {
  if (!config.cronSecret) return void res.status(503).json({ error: 'CRON_SECRET não configurado' });
  const expected = Buffer.from(`Bearer ${config.cronSecret}`);
  const received = Buffer.from(req.get('authorization') ?? '');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return void res.status(401).json({ error: 'Não autorizado' });
  }
  res.json(await runReminders());
});

// --- Módulos (exigem senha) ---
app.use('/api', requireAuth);
app.use('/api/activities', activitiesRouter);
app.use('/api/push', pushRouter);
app.use('/api', (_req, res) => void res.status(404).json({ error: 'Rota não encontrada' }));

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
};
app.use(errorHandler);

export default app;
