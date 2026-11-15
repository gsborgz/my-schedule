import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { api } from './lib/api';

export function App() {
  const [auth, setAuth] = useState<'loading' | 'in' | 'out'>('loading');

  useEffect(() => {
    api
      .session()
      .then((s) => setAuth(s.authenticated ? 'in' : 'out'))
      .catch(() => setAuth('out'));

    const onExpired = () => setAuth('out');
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  if (auth === 'loading') return <div className="splash">Carregando…</div>;
  if (auth === 'out') return <Login onSuccess={() => setAuth('in')} />;
  return <Layout onLogout={() => setAuth('out')} />;
}
