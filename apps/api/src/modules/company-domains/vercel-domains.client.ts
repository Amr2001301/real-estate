/**
 * The public website's hosting (Vercel): a company's custom domain is added
 * to the web-public project so it is served there and gets its certificate,
 * and its DNS is checked from Vercel's side. Configured by VERCEL_API_TOKEN +
 * VERCEL_PROJECT_ID (+ VERCEL_TEAM_ID for a team project); without them it is
 * off and domains are added to the project by hand, as before.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.validation';

const API = 'https://api.vercel.com';
const TIMEOUT_MS = 10_000;

/** A record Vercel asks for when the domain is used by another Vercel account. */
export interface VercelVerification {
  type: string;
  domain: string;
  value: string;
  reason: string;
}

export interface VercelDomainState {
  /** On the project and owned (no extra verification pending). */
  verified: boolean;
  /** DNS points at Vercel (CNAME / A), so the site and its certificate can be served. */
  configured: boolean;
  verification: VercelVerification[];
}

export class VercelError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

@Injectable()
export class VercelDomainsClient {
  private readonly logger = new Logger(VercelDomainsClient.name);

  constructor(private readonly config: ConfigService<AppEnv>) {}

  get enabled(): boolean {
    return !!(this.config.get<string>('VERCEL_API_TOKEN') && this.config.get<string>('VERCEL_PROJECT_ID'));
  }

  private url(path: string): string {
    const team = this.config.get<string>('VERCEL_TEAM_ID');
    return `${API}${path}${team ? `${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(team)}` : ''}`;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.url(path), {
      method,
      headers: {
        Authorization: `Bearer ${this.config.get<string>('VERCEL_API_TOKEN')}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!res.ok) {
      const err = (json.error ?? {}) as { code?: string; message?: string };
      throw new VercelError(err.message ?? `Vercel ${method} ${path}: ${res.status}`, res.status, err.code);
    }
    return json as T;
  }

  private project(): string {
    return encodeURIComponent(this.config.get<string>('VERCEL_PROJECT_ID')!);
  }

  /** Adds the domain to the project; already there is fine. */
  async add(hostname: string): Promise<void> {
    try {
      await this.call('POST', `/v10/projects/${this.project()}/domains`, { name: hostname });
    } catch (e) {
      // Re-adding a domain the project already has.
      if (e instanceof VercelError && (e.code === 'domain_already_exists' || e.status === 409)) {
        const existing = await this.find(hostname);
        if (existing) return;
      }
      throw e;
    }
  }

  /** Removes the domain from the project; already gone is fine. */
  async remove(hostname: string): Promise<void> {
    try {
      await this.call('DELETE', `/v9/projects/${this.project()}/domains/${encodeURIComponent(hostname)}`);
    } catch (e) {
      if (e instanceof VercelError && e.status === 404) return;
      throw e;
    }
  }

  private async find(hostname: string): Promise<{ verified: boolean; verification?: VercelVerification[] } | null> {
    try {
      return await this.call('GET', `/v9/projects/${this.project()}/domains/${encodeURIComponent(hostname)}`);
    } catch (e) {
      if (e instanceof VercelError && e.status === 404) return null;
      throw e;
    }
  }

  /**
   * Where the domain stands at Vercel: added if it is missing, verification
   * re-tried when pending, and whether its DNS points at Vercel.
   */
  async check(hostname: string): Promise<VercelDomainState> {
    let domain = await this.find(hostname);
    if (!domain) {
      await this.add(hostname);
      domain = await this.find(hostname);
    }
    if (domain && !domain.verified) {
      try {
        domain = await this.call('POST', `/v9/projects/${this.project()}/domains/${encodeURIComponent(hostname)}/verify`);
      } catch (e) {
        // Still pending (the TXT record is not there yet).
        this.logger.debug(`Vercel verify ${hostname}: ${(e as Error).message}`);
      }
    }
    const config = await this.call<{ misconfigured?: boolean }>('GET', `/v6/domains/${encodeURIComponent(hostname)}/config`);
    return {
      verified: !!domain?.verified,
      configured: config.misconfigured === false,
      verification: domain?.verification ?? [],
    };
  }
}
