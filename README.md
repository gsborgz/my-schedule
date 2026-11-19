# My Schedule

App pessoal de rotina. Funciona no navegador e no celular (como PWA), protegido por uma senha única, sem cadastro de contas.

## Módulos

| Módulo    | Status          | Descrição                                                        |
| --------- | --------------- | ---------------------------------------------------------------- |
| Agenda    | ✅ pronto       | Atividades por dia da semana e horário, com lembrete por push   |
| Gastos    | 🚧 em breve     | Controle de gastos                                               |
| Lembretes | 🚧 em breve     | Lembretes avulsos                                                |

## Stack

- **Frontend:** React + Vite (PWA com service worker): `client/`
- **Backend:** Node + Express (`server/`), servido na Vercel por `api/index.ts`
- **Banco:** libSQL: Turso em produção, arquivo `data/app.db` localmente
- **Push:** Web Push (VAPID) via `web-push`. A rota `/api/cron/reminders` envia o lembrete `remindBefore` minutos antes do início de cada atividade. Em produção ela é chamada a cada minuto por um agendador externo. Localmente, o próprio servidor a chama a cada 30s.

## Rodando

```bash
npm install
npm run setup -- "minha-senha"   # cria o .env (senha, segredo da sessão, chaves VAPID)
npm run dev                      # API em :3000 + Vite em http://localhost:5173
```

Produção:

```bash
npm run build    # gera dist/
npm start        # serve API + frontend em http://localhost:3000
```

### Variáveis (.env)

| Variável            | Descrição                                                    |
| ------------------- | ------------------------------------------------------------ |
| `APP_PASSWORD`      | Senha de acesso                                              |
| `SESSION_SECRET`    | Assina o cookie de sessão. Trocar desconecta todos os aparelhos |
| `VAPID_*`           | Chaves do Web Push. **Não troque** depois de ativar push, senão os aparelhos precisam reativar |
| `APP_TIMEZONE`      | Fuso usado pelos lembretes (padrão `America/Sao_Paulo`)      |
| `CRON_SECRET`       | Protege a rota `/api/cron/reminders`                         |
| `APP_DATABASE_URL`, `APP_DATABASE_TOKEN` | Banco **principal** do Turso em produção. Sem elas, usa as `TURSO_*` e, na falta delas, `data/app.db` |
| `PORT`, `DATA_DIR`  | Só local: porta e pasta do banco                             |

## Deploy na Vercel

1. Importe o repositório na Vercel. O `vercel.json` já define o build (`npm run build` → `dist`) e direciona `/api/*` para a função.
2. **Banco:** crie um banco no Turso (pelo Marketplace da Vercel ou em turso.tech). Pegue a URL do banco **principal** (`libsql://<banco>-<org>.turso.io`) e gere um token para ele. Cadastre os dois como `APP_DATABASE_URL` e `APP_DATABASE_TOKEN`. As tabelas são criadas sozinhas na primeira requisição.
   > ⚠️ A integração Turso da Vercel cria uma **branch vazia a cada deploy** e aponta `TURSO_DATABASE_URL` para ela. Por isso os dados "somem" a cada deploy se você usar essas variáveis.
3. **Variáveis** (Settings → Environment Variables), copiando do `.env`: `APP_PASSWORD`, `SESSION_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `APP_TIMEZONE`, `CRON_SECRET`. Depois, faça um redeploy.
4. **Agendador** (a cada minuto). No plano Hobby, o Cron da Vercel só roda uma vez por dia, então use um serviço externo gratuito como o [cron-job.org](https://cron-job.org):
   - URL: `https://SEU-APP.vercel.app/api/cron/reminders`
   - Frequência: a cada 1 minuto
   - Cabeçalho: `Authorization: Bearer <CRON_SECRET>`

   No plano Pro, dá para usar o Vercel Cron: adicione `"crons": [{ "path": "/api/cron/reminders", "schedule": "* * * * *" }]` ao `vercel.json`. A Vercel envia o `CRON_SECRET` automaticamente.

   Se o agendador atrasar ou pular algumas execuções, os lembretes dos últimos 5 minutos ainda são enviados, sem duplicar.

## Notificações no celular

Push exige **HTTPS**, que a Vercel já fornece (no `localhost` funciona sem).

- **Android (Chrome):** abra o site, toque em 🔔 e depois em "Ativar". Instalar na tela inicial é opcional, mas recomendado.
- **iPhone (iOS 16.4+):** no Safari, Compartilhar → **Adicionar à Tela de Início**. Abra o app pelo ícone, toque em 🔔 e depois em "Ativar". No iOS, push só funciona no app instalado.
- Cada aparelho/navegador precisa ativar uma vez. Use "Enviar teste" para conferir.

Para testar pelo celular durante o desenvolvimento, use um túnel HTTPS (ex.: `cloudflared tunnel --url http://localhost:3000` após `npm run build && npm start`).

## Estrutura

```
api/index.ts      função da Vercel (exporta o app Express)
server/
  app.ts          rotas
  index.ts        servidor local (estáticos + agendador a cada 30s)
  auth.ts         senha única + cookie de sessão assinado
  activities.ts   CRUD da agenda
  push.ts         inscrições e envio de push
  scheduler.ts    calcula e envia os lembretes devidos
  db.ts           cliente libSQL + schema
client/
  public/sw.js    service worker (recebe push e mostra a notificação)
  src/modules.tsx registro dos módulos (adicione novos aqui)
  src/modules/agenda/
```

### Adicionando um módulo

1. Crie `client/src/modules/<nome>/<Nome>Page.tsx`.
2. Registre em `client/src/modules.tsx`.
3. Se precisar de dados, crie `server/<nome>.ts` com um `Router` e a tabela em `db.ts`, e monte em `server/index.ts` depois do `requireAuth`.
