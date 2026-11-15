// Importado antes de tudo para que as variáveis do .env existam quando config.ts for avaliado.
import fs from 'node:fs';

if (fs.existsSync('.env')) process.loadEnvFile('.env');
