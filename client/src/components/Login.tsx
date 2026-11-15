import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <img src="/icons/icon-192.png" alt="" width={64} height={64} className="login-logo" />
        <h1>My Schedule</h1>
        <p className="muted">Digite a senha para entrar.</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={loading || !password}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
