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

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getPushStatus().then(setStatus);
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
      setBusy(false);
    }
  }

  async function test() {
    const { delivered } = await api.push.test();
    setMessage(delivered > 0 ? `Enviado para ${delivered} dispositivo(s).` : 'Nenhum dispositivo inscrito.');
  }

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
      {message && <p className="muted small">{message}</p>}
    </Modal>
  );
}
