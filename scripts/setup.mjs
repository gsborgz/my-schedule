// Gera/completa o arquivo .env. Uso: npm run setup -- "minha-senha"
// Não sobrescreve valores que já existem.
import crypto from 'node:crypto';
import fs from 'node:fs';
import * as webpush from 'web-push';

const ENV_FILE = '.env';
const current = {};
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) current[m[1]] = m[2];
  }
}

const generatedPassword = !current.APP_PASSWORD && !process.argv[2];
const vapid = current.VAPID_PUBLIC_KEY ? null : webpush.generateVAPIDKeys();

const env = {
  APP_PASSWORD: process.argv[2] || current.APP_PASSWORD || crypto.randomBytes(9).toString('base64url'),
  SESSION_SECRET: current.SESSION_SECRET || crypto.randomBytes(32).toString('base64url'),
  VAPID_PUBLIC_KEY: current.VAPID_PUBLIC_KEY || vapid.publicKey,
  VAPID_PRIVATE_KEY: current.VAPID_PRIVATE_KEY || vapid.privateKey,
  VAPID_SUBJECT: current.VAPID_SUBJECT || 'mailto:admin@example.com',
  APP_TIMEZONE: current.APP_TIMEZONE || 'America/Sao_Paulo',
  CRON_SECRET: current.CRON_SECRET || crypto.randomBytes(24).toString('base64url'),
  PORT: current.PORT || '3000',
};

fs.writeFileSync(
  ENV_FILE,
  Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n',
);

console.log('.env pronto.');
if (generatedPassword) console.log(`Senha gerada: ${env.APP_PASSWORD}  (troque em APP_PASSWORD no .env)`);
