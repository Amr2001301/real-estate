import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Generates (or honors) a per-request id and surfaces it both on the request
 * object (`req.id`) for downstream interceptors/services and on the response
 * as `x-request-id` so callers can correlate against server logs.
 *
 * If the caller already sent an `x-request-id` header we trust it after a
 * lightweight sanity check — useful when an upstream load balancer or the
 * Next.js front-end already minted one.
 */
const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;

export interface RequestWithId extends Request {
  id?: string;
}

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers['x-request-id'];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const id = candidate && SAFE_ID.test(candidate) ? candidate : randomUUID();

  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}
