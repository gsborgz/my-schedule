import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { disablePush, enablePush, getPushStatus, type PushStatus } from '../lib/push';
import { Modal } from './Modal';

const MESSAGES: Record<PushStatus, string> = {
  enabled: 'Este dispositivo está recebendo lembretes.',
  disabled: 'Ative para receber os lembretes neste dispositivo.',
  denied: 'As notificações estão bloqueadas. Libere nas configurações do navegador para este site.',
  unsupported: 'Este navegador não suporta notificações push.',
  insecure: 'Notificações push exigem HTTPS (ou localhost).',
  'ios-needs-install':
    'No iPhone, toque em Compartilhar → "Adicionar à Tela de Início" e abra o app por lá para ativar as notificações.',
};

type ServerStatus = Awaited<ReturnType<typeof api.push.status>>;

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'agora há pouco';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `há ${hours} h` : `há ${Math.round(hours / 24)} dias`;
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [server, setServer] = useState<ServerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refreshServer = () => api.push.status().then(setServer).catch(() => {});

  useEffect(() => {
    getPushStatus().then(setStatus);
    refreshServer();
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setStatus(await getPushStatus());
      refreshServer();
      setBusy(false);
    }
  }

  async function test() {
    const { delivered, failures } = await api.push.test();
    const parts: string[] = [];
    if (delivered > 0) {
      parts.push(
        `Aceito pelo serviço de push em ${delivered} dispositivo(s). Se não aparecer, verifique se as notificações do navegador estão liberadas no sistema (Windows: Configurações → Sistema → Notificações).`,
      );
    }
    for (const f of failures) parts.push(`Falha em ${f.service} (${f.status ?? 'sem status'}): ${f.message}`);
    if (parts.length === 0) parts.push('Nenhum dispositivo inscrito no servidor. Desative e ative novamente.');
    setMessage(parts.join('\n'));
  }

  const cronStale = server?.lastCronRun ? Date.now() - new Date(server.lastCronRun).getTime() > 5 * 60_000 : true;

  return (
    <Modal title="Notificações" onClose={onClose}>
      {status === null ? (
        <p className="muted">Verificando…</p>
      ) : (
        <>
          <p className={`status-pill ${status}`}>{status === 'enabled' ? 'Ativadas' : status === 'disabled' ? 'Desativadas' : 'Indisponível'}</p>
          <p>{MESSAGES[status]}</p>
          <div className="row gap">
            {status === 'disabled' && (
              <button className="btn primary" disabled={busy} onClick={() => run(enablePush)}>
                Ativar notificações
              </button>
            )}
            {status === 'enabled' && (
              <>
                <button className="btn primary" disabled={busy} onClick={() => run(test)}>
                  Enviar teste
                </button>
                <button className="btn" disabled={busy} onClick={() => run(disablePush)}>
                  Desativar
                </button>
              </>
            )}
          </div>
        </>
      )}
      {message && <p className="muted small pre">{message}</p>}

      {server && (
        <dl className="diagnostics small">
          <dt>Banco de dados</dt>
          <dd>{server.database}</dd>
          <dt>ID do banco</dt>
          <dd>
            {server.dbId ?? '—'}
            {server.dbCreatedAt && <span className="muted"> · criado {new Date(server.dbCreatedAt).toLocaleString('pt-BR')}</span>}
          </dd>
          <dt>Atividades salvas</dt>
          <dd>{server.activities}</dd>
          <dt>Deploy</dt>
          <dd>{server.deployment}</dd>
          <dt>Aparelhos inscritos</dt>
          <dd>{server.subscriptions}</dd>
          <dt>Agendador</dt>
          <dd className={cronStale ? 'warn' : ''}>
            {!server.cronConfigured
              ? 'CRON_SECRET não configurado no servidor'
              : server.lastCronRun
                ? `última execução ${timeAgo(server.lastCronRun)}`
                : 'nunca executou'}
            {server.cronConfigured && cronStale && ' (os lembretes agendados não vão disparar)'}
          </dd>
        </dl>
      )}
    </Modal>
  );
}
