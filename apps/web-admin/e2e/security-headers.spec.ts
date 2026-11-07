import { expect, test } from '@playwright/test';

// QA run 1, F-047: the admin dashboard set no security headers (it could be
// framed) and announced «X-Powered-By: Next.js».
test.describe('security headers', () => {
  for (const path of ['/login', '/dashboard']) {
    test(`${path} cannot be framed and carries the standard headers`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      const h = res.headers();
      expect(h['x-frame-options']).toBe('DENY');
      expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(h['strict-transport-security']).toMatch(/max-age=\d{7,}/);
      expect(h['x-powered-by']).toBeUndefined();
    });
  }
});
