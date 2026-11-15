import type { Activity, ActivityInput } from '../types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401 && url !== '/api/login') window.dispatchEvent(new Event('auth:expired'));
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error ?? `Erro ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  session: () => request<{ authenticated: boolean }>('GET', '/api/session'),
  login: (password: string) => request<void>('POST', '/api/login', { password }),
  logout: () => request<void>('POST', '/api/logout'),

  activities: {
    list: () => request<Activity[]>('GET', '/api/activities'),
    create: (input: ActivityInput) => request<Activity>('POST', '/api/activities', input),
    update: (id: number, input: ActivityInput) => request<Activity>('PUT', `/api/activities/${id}`, input),
    remove: (id: number) => request<void>('DELETE', `/api/activities/${id}`),
  },

  push: {
    publicKey: () => request<{ publicKey: string }>('GET', '/api/push/public-key'),
    subscribe: (sub: PushSubscriptionJSON) => request<void>('POST', '/api/push/subscribe', sub),
    unsubscribe: (endpoint: string) => request<void>('POST', '/api/push/unsubscribe', { endpoint }),
    test: () => request<{ delivered: number }>('POST', '/api/push/test'),
  },
};
