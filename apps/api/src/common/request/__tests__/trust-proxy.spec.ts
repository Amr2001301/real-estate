import express from 'express';
import request from 'supertest';
import { trustProxyHops } from '../trust-proxy';

/** F-056: behind a proxy every client shared one rate-limit address. */
describe('trustProxyHops', () => {
  it('defaults to 0 (trust no forwarded header)', () => {
    expect(trustProxyHops(undefined)).toBe(0);
    expect(trustProxyHops('')).toBe(0);
    expect(trustProxyHops('0')).toBe(0);
  });

  it('reads a whole number of hops and refuses nonsense', () => {
    expect(trustProxyHops('1')).toBe(1);
    expect(trustProxyHops(' 2 ')).toBe(2);
    expect(() => trustProxyHops('-1')).toThrow(/TRUST_PROXY_HOPS/);
    expect(() => trustProxyHops('1.5')).toThrow(/TRUST_PROXY_HOPS/);
    expect(() => trustProxyHops('many')).toThrow(/TRUST_PROXY_HOPS/);
    expect(() => trustProxyHops('99')).toThrow(/TRUST_PROXY_HOPS/);
  });

  const ipSeenBy = async (hops: number) => {
    const app = express();
    if (hops > 0) app.set('trust proxy', hops);
    app.get('/ip', (req, res) => res.json({ ip: req.ip }));
    const res = await request(app).get('/ip').set('X-Forwarded-For', '203.0.113.7');
    return res.body.ip as string;
  };

  it('with hops = 0 a client cannot choose its address; with hops = 1 the real client is the key', async () => {
    expect(await ipSeenBy(0)).not.toBe('203.0.113.7');
    expect(await ipSeenBy(1)).toBe('203.0.113.7');
  });
});
