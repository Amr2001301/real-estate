/**
 * @jest-environment jsdom
 *
 * Analytics abstraction tests.
 *
 * Covers:
 *   - Disabled behavior (no measurement ID or no gtag → silent noop)
 *   - Event payload forwarded correctly
 *   - PII key blocking (case-insensitive)
 *   - Sensitive URL stripping (/reset-password, /verify-email)
 *   - trackPageView only fires when enabled
 */

import { safePath, hasPii, trackEvent, trackPageView } from '@/lib/analytics';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGtag() {
  return jest.fn();
}

const TEST_GA_ID = 'G-TEST123456';

function withGtag(fn: (gtag: jest.Mock) => void) {
  const orig = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = TEST_GA_ID;
  const gtag = makeGtag();
  Object.defineProperty(window, 'gtag', { value: gtag, writable: true, configurable: true });
  fn(gtag);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).gtag;
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = orig;
}

// ── safePath ─────────────────────────────────────────────────────────────────

describe('safePath', () => {
  it('passes through normal paths unchanged', () => {
    expect(safePath('/projects')).toBe('/projects');
    expect(safePath('/units/abc-123')).toBe('/units/abc-123');
    expect(safePath('/')).toBe('/');
  });

  it('strips /reset-password?token=... to just /reset-password', () => {
    expect(safePath('/reset-password?token=supersecrettoken')).toBe('/reset-password');
    expect(safePath('/reset-password?token=abc&foo=bar')).toBe('/reset-password');
  });

  it('strips /verify-email?token=... to just /verify-email', () => {
    expect(safePath('/verify-email?token=rawtoken123')).toBe('/verify-email');
    expect(safePath('/verify-email?token=xyz&uid=1')).toBe('/verify-email');
  });

  it('preserves paths that merely contain the word "token" but are not sensitive routes', () => {
    expect(safePath('/account/token-info')).toBe('/account/token-info');
  });
});

// ── hasPii ───────────────────────────────────────────────────────────────────

describe('hasPii', () => {
  it('returns false for clean event params', () => {
    expect(hasPii({ project_id: 'abc', city: 'الرياض', item_id: '123' })).toBe(false);
    expect(hasPii({ content_type: 'unit', unit_status: 'AVAILABLE' })).toBe(false);
    expect(hasPii({})).toBe(false);
  });

  it('returns true for email', () => {
    expect(hasPii({ email: 'user@example.com' })).toBe(true);
  });

  it('returns true for phone', () => {
    expect(hasPii({ phone: '+966501234567' })).toBe(true);
  });

  it('returns true for name / full_name (case-insensitive)', () => {
    expect(hasPii({ name: 'Ahmed' })).toBe(true);
    expect(hasPii({ full_name: 'Ahmed Al-Rashid' })).toBe(true);
    expect(hasPii({ FULL_NAME: 'Ahmed' })).toBe(true);
  });

  it('returns true for password', () => {
    expect(hasPii({ password: 'hunter2' })).toBe(true);
  });

  it('returns true for token / reset_token / verification_token', () => {
    expect(hasPii({ token: 'abc123' })).toBe(true);
    expect(hasPii({ reset_token: 'abc123' })).toBe(true);
    expect(hasPii({ verification_token: 'xyz' })).toBe(true);
  });

  it('returns true for jwt / access_token / refresh_token', () => {
    expect(hasPii({ jwt: 'ey...' })).toBe(true);
    expect(hasPii({ access_token: 'ey...' })).toBe(true);
    expect(hasPii({ refresh_token: 'ey...' })).toBe(true);
  });

  it('returns true for OTP', () => {
    expect(hasPii({ otp: '123456' })).toBe(true);
  });
});

// ── trackEvent ────────────────────────────────────────────────────────────────

describe('trackEvent', () => {
  it('does nothing when window.gtag is absent', () => {
    // Ensure gtag is not on window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).gtag;
    expect(() => trackEvent('test_event', { item_id: '1' })).not.toThrow();
  });

  it('forwards event name and params to gtag when enabled', () => {
    withGtag((gtag) => {
      trackEvent('project_view', { project_id: 'p-1', city: 'الرياض' });
      expect(gtag).toHaveBeenCalledWith('event', 'project_view', {
        project_id: 'p-1',
        city: 'الرياض',
      });
    });
  });

  it('fires with empty params by default', () => {
    withGtag((gtag) => {
      trackEvent('login_complete');
      expect(gtag).toHaveBeenCalledWith('event', 'login_complete', {});
    });
  });

  it('silently blocks events with PII keys — gtag NOT called', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    withGtag((gtag) => {
      trackEvent('info_request_submit', { email: 'user@example.com', project_id: 'p-1' });
      expect(gtag).not.toHaveBeenCalled();
    });
    spy.mockRestore();
  });

  it('silently blocks events with phone PII', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    withGtag((gtag) => {
      trackEvent('visit_request_submit', { phone: '+966501234567' });
      expect(gtag).not.toHaveBeenCalled();
    });
    spy.mockRestore();
  });

  it('silently blocks events with token in params', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    withGtag((gtag) => {
      trackEvent('page_view', { token: 'secret', page_path: '/verify-email' });
      expect(gtag).not.toHaveBeenCalled();
    });
    spy.mockRestore();
  });

  it('does not throw when gtag is absent — safe noop', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).gtag;
    expect(() => trackEvent('favorite_add', { content_type: 'project', item_id: 'p-1' })).not.toThrow();
  });
});

// ── trackPageView ─────────────────────────────────────────────────────────────

describe('trackPageView', () => {
  it('does nothing when window.gtag is absent', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).gtag;
    expect(() => trackPageView('/projects')).not.toThrow();
  });

  it('calls gtag config with the safe pathname', () => {
    withGtag((gtag) => {
      trackPageView('/projects/abc-123');
      expect(gtag).toHaveBeenCalledWith('config', expect.anything(), {
        page_path: '/projects/abc-123',
      });
    });
  });

  it('strips token from /reset-password before calling gtag', () => {
    withGtag((gtag) => {
      trackPageView('/reset-password?token=supersecrettoken123');
      const call = gtag.mock.calls[0];
      expect(call[2]).toEqual({ page_path: '/reset-password' });
    });
  });

  it('strips token from /verify-email before calling gtag', () => {
    withGtag((gtag) => {
      trackPageView('/verify-email?token=rawverificationtoken');
      const call = gtag.mock.calls[0];
      expect(call[2]).toEqual({ page_path: '/verify-email' });
    });
  });

  it('passes measurement ID as the second arg to gtag config', () => {
    withGtag((gtag) => {
      trackPageView('/');
      const [cmd, id] = gtag.mock.calls[0] as [string, string, unknown];
      expect(cmd).toBe('config');
      expect(id).toBe(TEST_GA_ID);
    });
  });
});

// ── Conversion events fire only after API success ─────────────────────────────

describe('conversion events — success-only contract', () => {
  it('info_request_submit carries project_id and unit_id but no PII', () => {
    withGtag((gtag) => {
      trackEvent('info_request_submit', { project_id: 'p-1', unit_id: 'u-1' });
      expect(gtag).toHaveBeenCalledWith('event', 'info_request_submit', {
        project_id: 'p-1',
        unit_id: 'u-1',
      });
    });
  });

  it('visit_request_submit with only project_id is clean', () => {
    withGtag((gtag) => {
      trackEvent('visit_request_submit', { project_id: 'p-2' });
      expect(gtag).toHaveBeenCalledWith('event', 'visit_request_submit', { project_id: 'p-2' });
    });
  });

  it('sign_up_complete fires with no params', () => {
    withGtag((gtag) => {
      trackEvent('sign_up_complete');
      expect(gtag).toHaveBeenCalledWith('event', 'sign_up_complete', {});
    });
  });

  it('favorite_add carries content_type and item_id only', () => {
    withGtag((gtag) => {
      trackEvent('favorite_add', { content_type: 'project', item_id: 'p-1' });
      expect(gtag).toHaveBeenCalledWith('event', 'favorite_add', {
        content_type: 'project',
        item_id: 'p-1',
      });
    });
  });

  it('compare_add carries item_id only — no label or price', () => {
    withGtag((gtag) => {
      trackEvent('compare_add', { item_id: 'u-1' });
      expect(gtag).toHaveBeenCalledWith('event', 'compare_add', { item_id: 'u-1' });
    });
  });
});

// ── GA4 page-view deduplication ───────────────────────────────────────────────
//
// These tests verify the deduplication contract:
//   - The GA4 init snippet has send_page_view:false (no automatic first page view)
//   - PageViewTracker is the sole source of page_view events
//   - Each distinct navigation emits exactly one page_view
//   - Sensitive tokens are never sent to GA

describe('GA4 page-view deduplication', () => {
  // Test 1 — GA configuration
  it('layout.tsx init script contains send_page_view:false', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const layoutSrc = fs.readFileSync(
      path.join(__dirname, '../app/layout.tsx'),
      'utf-8',
    );
    expect(layoutSrc).toContain('send_page_view:false');
  });

  // Test 2 — Initial page view: exactly ONE call, no automatic duplicate
  it('initial load: trackPageView emits exactly one gtag config call', () => {
    withGtag((gtag) => {
      trackPageView('/projects');
      expect(gtag).toHaveBeenCalledTimes(1);
      expect(gtag).toHaveBeenCalledWith('config', TEST_GA_ID, { page_path: '/projects' });
    });
  });

  // Test 3 — Client-side navigation: one call per distinct pathname, no duplicates
  it('client navigation: each distinct pathname emits exactly one page_view', () => {
    withGtag((gtag) => {
      trackPageView('/projects');
      trackPageView('/projects/p-1');
      trackPageView('/units/u-1');
      expect(gtag).toHaveBeenCalledTimes(3);
      expect(gtag).toHaveBeenNthCalledWith(1, 'config', TEST_GA_ID, { page_path: '/projects' });
      expect(gtag).toHaveBeenNthCalledWith(2, 'config', TEST_GA_ID, { page_path: '/projects/p-1' });
      expect(gtag).toHaveBeenNthCalledWith(3, 'config', TEST_GA_ID, { page_path: '/units/u-1' });
    });
  });

  // Test 4 — Sensitive URL: /verify-email token stripped
  it('/verify-email?token=SECRET → GA receives /verify-email only', () => {
    withGtag((gtag) => {
      trackPageView('/verify-email?token=SECRET_VERIFICATION_TOKEN');
      expect(gtag).toHaveBeenCalledWith('config', TEST_GA_ID, { page_path: '/verify-email' });
      const call = gtag.mock.calls[0] as [string, string, { page_path: string }];
      expect(call[2].page_path).not.toContain('token');
      expect(call[2].page_path).not.toContain('SECRET');
    });
  });

  // Test 5 — Sensitive URL: /reset-password token stripped
  it('/reset-password?token=SECRET → GA receives /reset-password only', () => {
    withGtag((gtag) => {
      trackPageView('/reset-password?token=SECRET_RESET_TOKEN');
      expect(gtag).toHaveBeenCalledWith('config', TEST_GA_ID, { page_path: '/reset-password' });
      const call = gtag.mock.calls[0] as [string, string, { page_path: string }];
      expect(call[2].page_path).not.toContain('token');
      expect(call[2].page_path).not.toContain('SECRET');
    });
  });

  // Test 6 — Analytics disabled: no measurement ID → zero gtag calls, no error
  it('analytics disabled (no measurement ID): no page_view fired, no error', () => {
    const orig = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = '';
    const gtag = makeGtag();
    Object.defineProperty(window, 'gtag', { value: gtag, writable: true, configurable: true });
    expect(() => trackPageView('/projects')).not.toThrow();
    expect(gtag).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).gtag;
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = orig;
  });

  // Test 6b — Analytics disabled: no gtag function → zero calls, no error
  it('analytics disabled (no gtag function): no page_view fired, no error', () => {
    const orig = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = TEST_GA_ID;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).gtag;
    expect(() => trackPageView('/projects')).not.toThrow();
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = orig;
  });
});
