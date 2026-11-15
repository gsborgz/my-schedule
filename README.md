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
- **Backend:** Node 24 + Express + SQLite nativo (`node:sqlite`): `server/`
- **Push:** Web Push (VAPID) via `web-push`. O agendador roda no servidor a cada 20s e envia o lembrete `remindBefore` minutos antes do início de cada atividade.

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
| `PORT`, `DATA_DIR`  | Porta e pasta do banco SQLite (padrão `data/`)               |

## Notificações no celular

Push exige **HTTPS** (no `localhost` funciona sem). Para usar no celular, o app precisa estar publicado num servidor com HTTPS que fique **sempre ligado**, porque é ele quem dispara os lembretes. Exemplos: VPS, Railway, Fly.io, Render (plano pago, o grátis "dorme"). Mantenha a pasta `data/` em disco persistente.

- **Android (Chrome):** abra o site, toque em 🔔 e depois em "Ativar". Instalar na tela inicial é opcional, mas recomendado.
- **iPhone (iOS 16.4+):** no Safari, Compartilhar → **Adicionar à Tela de Início**. Abra o app pelo ícone, toque em 🔔 e depois em "Ativar". No iOS, push só funciona no app instalado.
- Cada aparelho/navegador precisa ativar uma vez. Use "Enviar teste" para conferir.

Para testar pelo celular durante o desenvolvimento, use um túnel HTTPS (ex.: `cloudflared tunnel --url http://localhost:3000` após `npm run build && npm start`).

## Estrutura

```
server/
  index.ts        rotas e servidor
  auth.ts         senha única + cookie de sessão assinado
  activities.ts   CRUD da agenda
  push.ts         inscrições e envio de push
  scheduler.ts    dispara os lembretes no horário
  db.ts           schema SQLite
client/
  public/sw.js    service worker (recebe push e mostra a notificação)
  src/modules.tsx registro dos módulos (adicione novos aqui)
  src/modules/agenda/
```

### Adicionando um módulo

1. Crie `client/src/modules/<nome>/<Nome>Page.tsx`.
2. Registre em `client/src/modules.tsx`.
3. Se precisar de dados, crie `server/<nome>.ts` com um `Router` e a tabela em `db.ts`, e monte em `server/index.ts` depois do `requireAuth`.
