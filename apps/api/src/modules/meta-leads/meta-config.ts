import { createHmac, timingSafeEqual } from 'node:crypto';

/** Meta app settings. Everything comes from the environment; the feature is off until the app exists. */
export interface MetaConfig {
  appId: string;
  appSecret: string;
  verifyToken: string;
  graphVersion: string;
  /** Where Meta sends the admin back after the login dialog. */
  redirectUri: string;
  /** The admin dashboard, to return to once connected. */
  adminUrl: string;
  /** Seals the stored Page tokens. */
  sealKey: string;
}

export const META_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'leads_retrieval'];

export function metaConfig(env: Record<string, string | undefined> = process.env): MetaConfig | null {
  const appId = env.META_APP_ID?.trim();
  const appSecret = env.META_APP_SECRET?.trim();
  const verifyToken = env.META_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!appId || !appSecret || !verifyToken) return null;
  const api = (env.API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const adminUrl = (env.WEB_ADMIN_URL ?? env.CORS_ORIGINS?.split(',')[0] ?? 'http://localhost:3001').trim().replace(/\/$/, '');
  return {
    appId,
    appSecret,
    verifyToken,
    graphVersion: env.META_GRAPH_VERSION?.trim() || 'v21.0',
    redirectUri: `${api}/v1/meta/callback`,
    adminUrl,
    sealKey: env.META_TOKEN_ENCRYPTION_KEY?.trim() || env.JWT_REFRESH_SECRET || '',
  };
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Meta signs every webhook body with the app secret: `X-Hub-Signature-256: sha256=<hex>`. */
export function verifyWebhookSignature(rawBody: Buffer | undefined, header: string | undefined, appSecret: string): boolean {
  if (!rawBody || !header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return safeEqual(header.slice('sha256='.length), expected);
}

const STATE_TTL_MS = 15 * 60 * 1000;

/** The OAuth `state`: who started the connection, signed so the callback cannot be forged. */
export function signState(companyId: string, userId: string, secret: string, now = Date.now()): string {
  const body = `${companyId}.${userId}.${now}`;
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${sig}`;
}

export function readState(state: string | undefined, secret: string, now = Date.now()): { companyId: string; userId: string } | null {
  if (!state) return null;
  const [b64, sig] = state.split('.');
  if (!b64 || !sig) return null;
  const body = Buffer.from(b64, 'base64url').toString();
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  const [companyId, userId, ts] = body.split('.');
  if (!companyId || !userId || !ts || now - Number(ts) > STATE_TTL_MS || now < Number(ts)) return null;
  return { companyId, userId };
}
