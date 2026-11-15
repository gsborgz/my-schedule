import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { MODULES } from '../modules';
import { BellIcon, LogoutIcon } from './Icons';
import { NotificationPanel } from './NotificationPanel';

function currentModuleId(): string {
  const id = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return MODULES.some((m) => m.id === id) ? id : 'agenda';
}

export function Layout({ onLogout }: { onLogout: () => void }) {
  const [moduleId, setModuleId] = useState(currentModuleId);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const onHash = () => setModuleId(currentModuleId());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const active = MODULES.find((m) => m.id === moduleId)!;
  const Page = active.component;

  async function logout() {
    await api.logout().catch(() => {});
    onLogout();
  }

  return (
    <div className="layout">
      <header className="topbar">
        <span className="brand">
          <img src="/icons/icon-192.png" alt="" width={28} height={28} /> My Schedule
        </span>
        <nav className="modules-nav">
          {MODULES.map((m) => (
            <a key={m.id} href={`#/${m.id}`} className={m.id === moduleId ? 'active' : ''}>
              <span aria-hidden>{m.icon}</span>
              <span>{m.label}</span>
            </a>
          ))}
        </nav>
        <div className="topbar-actions">
          <button className="icon-btn" title="Notificações" aria-label="Notificações" onClick={() => setShowNotifications(true)}>
            <BellIcon />
          </button>
          <button className="icon-btn" title="Sair" aria-label="Sair" onClick={logout}>
            <LogoutIcon />
          </button>
        </div>
      </header>

      <main className="content">
        {Page ? (
          <Page />
        ) : (
          <div className="empty">
            <div className="empty-icon">{active.icon}</div>
            <h2>{active.label}</h2>
            <p className="muted">Módulo em construção.</p>
          </div>
        )}
      </main>

      {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
    </div>
  );
}
