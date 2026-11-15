import { api } from './api';

export type PushStatus =
  | 'unsupported' // navegador sem suporte
  | 'ios-needs-install' // iPhone/iPad: precisa adicionar à Tela de Início
  | 'insecure' // fora de HTTPS/localhost
  | 'denied' // usuário bloqueou
  | 'disabled'
  | 'enabled';

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.error('Falha ao registrar service worker', err));
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!window.isSecureContext) return 'insecure';
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!supported) return isIos() && !isStandalone() ? 'ios-needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub && Notification.permission === 'granted') {
    // Reenvia ao servidor (idempotente) caso o banco tenha sido recriado.
    api.push.subscribe(sub.toJSON()).catch(() => {});
    return 'enabled';
  }
  return 'disabled';
}

export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificação não concedida.');

  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await api.push.publicKey();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await api.push.subscribe(sub.toJSON());
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await api.push.unsubscribe(sub.endpoint).catch(() => {});
  await sub.unsubscribe();
}
