import path from 'node:path';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não definida. Local: rode "npm run setup". Vercel: Settings → Environment Variables.`);
  return value;
}

const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');

export const config = {
  port: Number(process.env.PORT ?? 3000),
  password: required('APP_PASSWORD'),
  sessionSecret: required('SESSION_SECRET'),
  timeZone: process.env.APP_TIMEZONE ?? 'America/Sao_Paulo',
  /** Protege a rota de cron. Obrigatório em produção. */
  cronSecret: process.env.CRON_SECRET,
  database: {
    // Em produção: Turso (variáveis criadas pela integração da Vercel).
    // Local: arquivo SQLite em data/app.db.
    url: process.env.TURSO_DATABASE_URL ?? `file:${path.join(dataDir, 'app.db').replace(/\\/g, '/')}`,
    authToken: process.env.TURSO_AUTH_TOKEN,
    dataDir,
  },
  vapid: {
    publicKey: required('VAPID_PUBLIC_KEY'),
    privateKey: required('VAPID_PRIVATE_KEY'),
    subject: process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
  },
};
