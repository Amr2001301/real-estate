import { BadGatewayException, Injectable } from '@nestjs/common';
import { META_SCOPES, metaConfig, type MetaConfig } from './meta-config';
import type { GraphLead } from './meta-lead-fields';

export interface GraphPage {
  id: string;
  name: string;
  access_token: string;
}

/** The few Graph API calls the connection needs. Kept apart so tests replace it. */
@Injectable()
export class MetaGraphClient {
  private cfg(): MetaConfig {
    const c = metaConfig();
    if (!c) throw new BadGatewayException('Facebook connection is not configured');
    return c;
  }

  private async call<T>(c: MetaConfig, path: string, params: Record<string, string>, method: 'GET' | 'POST' | 'DELETE' = 'GET'): Promise<T> {
    const url = new URL(`https://graph.facebook.com/${c.graphVersion}/${path}`);
    const qs = new URLSearchParams(params);
    let init: NonNullable<Parameters<typeof fetch>[1]> = { method, signal: AbortSignal.timeout(15_000) };
    if (method === 'GET') url.search = qs.toString();
    else init = { ...init, body: qs, headers: { 'content-type': 'application/x-www-form-urlencoded' } };
    const res = await fetch(url, init);
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) throw new BadGatewayException(`Facebook said: ${json.error?.message ?? res.status}`);
    return json;
  }

  /** The Facebook login dialog's address; `state` is echoed back to our callback. */
  loginUrl(state: string): string {
    const c = this.cfg();
    const u = new URL(`https://www.facebook.com/${c.graphVersion}/dialog/oauth`);
    u.search = new URLSearchParams({ client_id: c.appId, redirect_uri: c.redirectUri, state, scope: META_SCOPES.join(','), response_type: 'code' }).toString();
    return u.toString();
  }

  /** The login `code` → a long-lived user token. */
  async userToken(code: string): Promise<string> {
    const c = this.cfg();
    const short = await this.call<{ access_token: string }>(c, 'oauth/access_token', {
      client_id: c.appId, client_secret: c.appSecret, redirect_uri: c.redirectUri, code,
    });
    const long = await this.call<{ access_token: string }>(c, 'oauth/access_token', {
      grant_type: 'fb_exchange_token', client_id: c.appId, client_secret: c.appSecret, fb_exchange_token: short.access_token,
    });
    return long.access_token;
  }

  /** The Pages the person manages, each with its own access token. */
  async pages(userToken: string): Promise<GraphPage[]> {
    const c = this.cfg();
    const r = await this.call<{ data: GraphPage[] }>(c, 'me/accounts', { access_token: userToken, fields: 'id,name,access_token', limit: '100' });
    return r.data ?? [];
  }

  /** Subscribes our app to the Page's lead events. */
  async subscribePage(pageId: string, pageToken: string): Promise<void> {
    await this.call(this.cfg(), `${pageId}/subscribed_apps`, { subscribed_fields: 'leadgen', access_token: pageToken }, 'POST');
  }

  async unsubscribePage(pageId: string, pageToken: string): Promise<void> {
    await this.call(this.cfg(), `${pageId}/subscribed_apps`, { access_token: pageToken }, 'DELETE');
  }

  /** One lead's answers, by the id the webhook carried. */
  async lead(leadgenId: string, pageToken: string): Promise<GraphLead> {
    return this.call<GraphLead>(this.cfg(), leadgenId, { access_token: pageToken, fields: 'id,created_time,form_id,platform,field_data' });
  }
}
