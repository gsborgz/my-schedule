import path from 'node:path';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não definida. Local: rode "npm run setup". Vercel: Settings → Environment Variables.`);
  return value;
}

const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');

// Banco usado, em ordem de prioridade:
// 1. APP_DATABASE_URL/TOKEN: definidas por você, apontando para o banco principal.
//    A integração Turso da Vercel cria uma *branch* nova (vazia) a cada deploy e troca
//    TURSO_DATABASE_URL para ela, então em produção use estas.
// 2. TURSO_DATABASE_URL/AUTH_TOKEN: criadas pela integração.
// 3. Arquivo local data/app.db (só desenvolvimento).
const remote = process.env.APP_DATABASE_URL
  ? { url: process.env.APP_DATABASE_URL, authToken: process.env.APP_DATABASE_TOKEN, source: 'APP_DATABASE_URL' }
  : process.env.TURSO_DATABASE_URL
    ? { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN, source: 'TURSO_DATABASE_URL' }
    : null;

// Na Vercel o disco é temporário: sem banco remoto os dados sumiriam a cada deploy/reinício.
if (process.env.VERCEL && !remote) {
  throw new Error(
    'Nenhum banco remoto configurado neste ambiente da Vercel. Cadastre APP_DATABASE_URL e APP_DATABASE_TOKEN ' +
      '(apontando para o banco principal do Turso) em Settings → Environment Variables e faça redeploy.',
  );
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  password: required('APP_PASSWORD'),
  sessionSecret: required('SESSION_SECRET'),
  timeZone: process.env.APP_TIMEZONE ?? 'America/Sao_Paulo',
  /** Protege a rota de cron. Obrigatório em produção. */
  cronSecret: process.env.CRON_SECRET,
  database: {
    url: remote?.url ?? `file:${path.join(dataDir, 'app.db').replace(/\\/g, '/')}`,
    authToken: remote?.authToken,
    source: remote?.source ?? 'arquivo local',
    dataDir,
  },
  vapid: {
    publicKey: required('VAPID_PUBLIC_KEY'),
    privateKey: required('VAPID_PRIVATE_KEY'),
    subject: process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
  },
};
