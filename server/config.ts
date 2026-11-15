import path from 'node:path';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] Variável ${name} não definida. Rode "npm run setup" para gerar o .env.`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  password: required('APP_PASSWORD'),
  sessionSecret: required('SESSION_SECRET'),
  timeZone: process.env.APP_TIMEZONE ?? 'America/Sao_Paulo',
  dataDir: path.resolve(process.env.DATA_DIR ?? 'data'),
  vapid: {
    publicKey: required('VAPID_PUBLIC_KEY'),
    privateKey: required('VAPID_PRIVATE_KEY'),
    subject: process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
  },
};
