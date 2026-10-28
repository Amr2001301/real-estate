import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

/**
 * SES1 — which device and network a request came from, for the session list
 * («الأجهزة المتصلة»). Display only: nothing is authorised on it. The web
 * apps call the API from their own server, so they pass the browser's user
 * agent in `x-client-user-agent` and its address first in `x-forwarded-for`.
 */
export interface ClientMeta {
  userAgent: string | null;
  ipAddress: string | null;
}

const als = new AsyncLocalStorage<ClientMeta>();

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export function clientMetaMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const ua = first(req.headers['x-client-user-agent']) ?? first(req.headers['user-agent']);
  const forwarded = first(req.headers['x-forwarded-for'])?.split(',')[0]?.trim();
  const ip = forwarded || req.socket?.remoteAddress || null;
  als.run({ userAgent: ua ? ua.slice(0, 512) : null, ipAddress: ip ? ip.replace(/^::ffff:/, '').slice(0, 64) : null }, next);
}

export function currentClientMeta(): ClientMeta {
  return als.getStore() ?? { userAgent: null, ipAddress: null };
}
