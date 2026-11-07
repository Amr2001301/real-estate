/**
 * QA run 1, F-047: the website set no security headers. They come from one
 * list that next.config applies to every route.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECURITY_HEADERS } from '../../security-headers';

const header = (key: string) => SECURITY_HEADERS.find((h) => h.key === key)?.value;

describe('security headers', () => {
  it('forbids framing by other origins', () => {
    expect(header('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(header('Content-Security-Policy')).toContain("frame-ancestors 'self'");
  });

  it('sets nosniff, a referrer policy, HSTS and a permissions policy', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('Strict-Transport-Security')).toMatch(/max-age=\d{7,}/);
    expect(header('Permissions-Policy')).toContain('camera=()');
  });

  it('is applied to every route and the framework is not announced', () => {
    const cfg = readFileSync(join(__dirname, '..', '..', 'next.config.ts'), 'utf8');
    expect(cfg).toContain('poweredByHeader: false');
    expect(cfg).toContain("source: '/:path*'");
    expect(cfg).toContain('SECURITY_HEADERS');
  });

  it('does not restrict scripts or styles (that needs nonces, a separate piece of work)', () => {
    expect(header('Content-Security-Policy')).not.toMatch(/script-src|style-src|default-src/);
  });
});
