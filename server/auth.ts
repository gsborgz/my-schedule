import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.ts';

const COOKIE = 'ms_session';
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function sign(value: string): string {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createToken(): string {
  const exp = String(Date.now() + MAX_AGE_MS);
  return `${exp}.${sign(exp)}`;
}

function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  if (!safeEqual(Buffer.from(sig), Buffer.from(sign(exp)))) return false;
  return Number(exp) > Date.now();
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function checkPassword(input: string): boolean {
  const hash = (s: string) => crypto.createHash('sha256').update(s).digest();
  return safeEqual(hash(input), hash(config.password));
}

export function isAuthenticated(req: Request): boolean {
  return verifyToken(readCookie(req, COOKIE));
}

export function setSessionCookie(req: Request, res: Response): void {
  res.cookie(COOKIE, createToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE, { path: '/' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isAuthenticated(req)) return next();
  res.status(401).json({ error: 'Não autenticado' });
}

// Limite simples de tentativas de login por IP (10 a cada 15 min).
const attempts = new Map<string, { count: number; resetAt: number }>();

export function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 10;
}

export function resetLoginAttempts(ip: string): void {
  attempts.delete(ip);
}
