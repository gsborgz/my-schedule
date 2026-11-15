// Entrada para rodar localmente (npm run dev / npm start).
// Na Vercel, quem serve a API é api/index.ts e o frontend sai de dist/ direto pela CDN.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import app from './app.js';
import { config } from './config.js';
import { ensureSchema } from './db.js';
import { runReminders } from './scheduler.js';

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

app.listen(config.port, async () => {
  console.log(`[server] http://localhost:${config.port}`);
  await ensureSchema();

  // Localmente o próprio servidor faz o papel do cron.
  const run = () => runReminders().catch((err) => console.error('[reminders]', err));
  run();
  setInterval(run, 30_000);
  console.log(`[reminders] agendador local ativo (fuso: ${config.timeZone})`);
});
