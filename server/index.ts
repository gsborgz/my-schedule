import './env.ts';
import fs from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import { activitiesRouter } from './activities.ts';
import {
  checkPassword,
  clearSessionCookie,
  isAuthenticated,
  isLoginRateLimited,
  requireAuth,
  resetLoginAttempts,
  setSessionCookie,
} from './auth.ts';
import { config } from './config.ts';
import { pushRouter } from './push.ts';
import { startScheduler } from './scheduler.ts';

const app = express();
app.set('trust proxy', 1); // respeita X-Forwarded-Proto atrás de proxy HTTPS
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

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

// --- Módulos (exigem senha) ---
app.use('/api', requireAuth);
app.use('/api/activities', activitiesRouter);
app.use('/api/push', pushRouter);
app.use('/api', (_req, res) => void res.status(404).json({ error: 'Rota não encontrada' }));

// --- Frontend compilado (produção) ---
const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(
    express.static(dist, {
      setHeaders(res, file) {
        if (file.endsWith('sw.js') || file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
};
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port}`);
  startScheduler();
});
