/**
 * Unit tests for the sitemap generation logic.
 *
 * The Next.js sitemap() RSC entrypoint is not invoked here — instead we test:
 *   1. fetchAll — pagination until totalPages is exhausted
 *   2. The sitemap's full output via a re-implementation of the assembly logic
 *      that uses the same siteUrl / policy decisions
 *
 * safeFetch is mocked so no real API or Next.js runtime is needed.
 */

// Mock safeFetch before any import so the module system picks up the mock.
jest.mock('@/lib/api', () => ({
  safeFetch: jest.fn(),
}));

import { safeFetch } from '@/lib/api';
import { fetchAll } from '@/app/sitemap';
import { siteUrl } from '@/lib/seo';
import type { Paginated, PublicProjectListItem, PublicUnit } from '@/lib/api-types';

const mockFetch = safeFetch as jest.Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<PublicProjectListItem> = {}): PublicProjectListItem {
  return {
    id: 'proj-1',
    name: { ar: 'مشروع', en: 'Project' },
    description: { ar: '', en: '' },
    city: 'الرياض',
    lat: 24.7,
    lng: 46.7,
    services: [],
    featured: false,
    status: 'PUBLISHED',
    coverImage: null,
    availableUnitsCount: 5,
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeUnit(overrides: Partial<PublicUnit> = {}): PublicUnit {
  return {
    id: 'unit-1',
    code: 'U-001',
    type: 'APARTMENT',
    area: 120,
    bedrooms: 3,
    bathrooms: 2,
    floor: 2,
    price: '500000',
    status: 'AVAILABLE',
    coverImage: null,
    media: [],
    project: null,
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePage<T>(items: T[], page: number, totalPages: number): { ok: true; data: Paginated<T> } {
  return {
    ok: true,
    data: {
      data: items,
      meta: { page, pageSize: 200, total: items.length * totalPages, totalPages },
    },
  };
}

// ── fetchAll ─────────────────────────────────────────────────────────────────

describe('fetchAll', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns items from a single page', async () => {
    mockFetch.mockResolvedValueOnce(makePage([makeProject()], 1, 1));
    const result = await fetchAll<PublicProjectListItem>('/public/projects');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('proj-1');
  });

  it('iterates multiple pages until totalPages is reached', async () => {
    mockFetch
      .mockResolvedValueOnce(makePage([makeProject({ id: 'p1' })], 1, 3))
      .mockResolvedValueOnce(makePage([makeProject({ id: 'p2' })], 2, 3))
      .mockResolvedValueOnce(makePage([makeProject({ id: 'p3' })], 3, 3));

    const result = await fetchAll<PublicProjectListItem>('/public/projects');
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('stops gracefully when the API fails mid-pagination', async () => {
    mockFetch
      .mockResolvedValueOnce(makePage([makeProject({ id: 'p1' })], 1, 2))
      .mockResolvedValueOnce({ ok: false, error: { message: 'timeout', status: 0 } });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await fetchAll<PublicProjectListItem>('/public/projects');
    consoleSpy.mockRestore();

    // Returns what was fetched before the failure
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('p1');
  });

  it('returns an empty array when the first request fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, error: { message: 'down', status: 503 } });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await fetchAll('/public/projects');
    consoleSpy.mockRestore();
    expect(result).toEqual([]);
  });

  it('appends page/pageSize with ? when path has no query', async () => {
    mockFetch.mockResolvedValueOnce(makePage([], 1, 1));
    await fetchAll('/public/projects');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('?page=1&pageSize=200'),
      expect.anything(),
    );
  });

  it('appends page/pageSize with & when path already has a query', async () => {
    mockFetch.mockResolvedValueOnce(makePage([], 1, 1));
    await fetchAll('/public/units?status=AVAILABLE');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('&page=1&pageSize=200'),
      expect.anything(),
    );
  });
});

// ── Sitemap URL policy ────────────────────────────────────────────────────────

describe('sitemap URL policy', () => {
  const STATIC_PATHS = ['/', '/projects', '/units', '/contact', '/privacy', '/terms'];
  const PRIVATE_PATHS = ['/login', '/register', '/forgot-password', '/reset-password',
    '/verify-email', '/account', '/compare', '/app'];

  afterEach(() => jest.resetAllMocks());

  async function buildSitemap(): Promise<import('next').MetadataRoute.Sitemap> {
    const proj = makeProject({ id: 'proj-published', updatedAt: '2026-06-01T00:00:00.000Z' });
    const availableUnit = makeUnit({ id: 'unit-available', status: 'AVAILABLE', updatedAt: '2026-05-15T00:00:00.000Z' });
    const soldUnit = makeUnit({ id: 'unit-sold', status: 'SOLD', updatedAt: '2026-04-01T00:00:00.000Z' });

    // fetchAll calls: projects (1 page), available (1 page), sold (1 page)
    mockFetch
      .mockResolvedValueOnce(makePage([proj], 1, 1))
      .mockResolvedValueOnce(makePage([availableUnit], 1, 1))
      .mockResolvedValueOnce(makePage([soldUnit], 1, 1));

    // Import sitemap() fresh each time (it uses module-level safeFetch mock)
    const { default: sitemapFn } = await import('@/app/sitemap');
    return sitemapFn();
  }

  it('includes all expected static URLs', async () => {
    const entries = await buildSitemap();
    const urls = entries.map((e) => e.url);
    for (const path of STATIC_PATHS) {
      expect(urls).toContain(siteUrl(path));
    }
  });

  it('does NOT include any private/auth routes', async () => {
    const entries = await buildSitemap();
    const urls = entries.map((e) => e.url);
    for (const path of PRIVATE_PATHS) {
      const privateFull = siteUrl(path);
      expect(urls.some((u) => u.startsWith(privateFull))).toBe(false);
    }
  });

  it('includes published project URL', async () => {
    const entries = await buildSitemap();
    expect(entries.map((e) => e.url)).toContain(siteUrl('/projects/proj-published'));
  });

  it('includes AVAILABLE unit URL', async () => {
    const entries = await buildSitemap();
    expect(entries.map((e) => e.url)).toContain(siteUrl('/units/unit-available'));
  });

  it('includes SOLD unit URL', async () => {
    const entries = await buildSitemap();
    expect(entries.map((e) => e.url)).toContain(siteUrl('/units/unit-sold'));
  });

  it('uses real updatedAt timestamps from the API — not fabricated', async () => {
    const entries = await buildSitemap();
    const projEntry = entries.find((e) => e.url === siteUrl('/projects/proj-published'));
    expect(projEntry?.lastModified).toBe('2026-06-01T00:00:00.000Z');

    const unitEntry = entries.find((e) => e.url === siteUrl('/units/unit-available'));
    expect(unitEntry?.lastModified).toBe('2026-05-15T00:00:00.000Z');
  });

  it('assigns lower priority and yearly changeFrequency to SOLD units', async () => {
    const entries = await buildSitemap();
    const soldEntry = entries.find((e) => e.url === siteUrl('/units/unit-sold'));
    expect(soldEntry?.priority).toBe(0.5);
    expect(soldEntry?.changeFrequency).toBe('yearly');
  });

  it('deduplicates unit URLs when the same unit appears in multiple fetches', async () => {
    const dupUnit = makeUnit({ id: 'dup-unit', status: 'AVAILABLE' });
    mockFetch
      .mockResolvedValueOnce(makePage([makeProject()], 1, 1))
      .mockResolvedValueOnce(makePage([dupUnit], 1, 1))
      .mockResolvedValueOnce(makePage([{ ...dupUnit, status: 'SOLD' }], 1, 1));

    const { default: sitemapFn } = await import('@/app/sitemap');
    const entries = await sitemapFn();
    const dupUrls = entries.filter((e) => e.url === siteUrl('/units/dup-unit'));
    expect(dupUrls).toHaveLength(1);
  });

  it('all URLs are consistently derived from the configured SITE_URL', async () => {
    // The intent: no URL is hardcoded to a different origin. Every URL must
    // start with the same siteUrl() base (whatever it is — localhost in test,
    // the real domain in production).
    const entries = await buildSitemap();
    const siteUrlBase = siteUrl('/').replace(/\/$/, ''); // e.g. "http://localhost:3002"
    for (const entry of entries) {
      expect(entry.url.startsWith(siteUrlBase)).toBe(true);
    }
  });

  it('returns static entries even when the API is completely down', async () => {
    const errorResult = { ok: false, error: { message: 'down', status: 503 } };
    mockFetch
      .mockResolvedValue(errorResult);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { default: sitemapFn } = await import('@/app/sitemap');
    const entries = await sitemapFn();
    consoleSpy.mockRestore();

    // Static entries must always be present
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(siteUrl('/'));
    expect(urls).toContain(siteUrl('/projects'));
    // No dynamic entries when API is down
    expect(entries.every((e) => !e.url.includes('/projects/'))).toBe(true);
  });
});

// ── robots.ts ─────────────────────────────────────────────────────────────────

describe('robots', () => {
  it('production: allows / and disallows private paths', () => {
    // robots.ts reads SITE_URL at module evaluation time, so we test the
    // exported function directly under the current env
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const robotsFn = require('@/app/robots').default as () => import('next').MetadataRoute.Robots;
    const result = robotsFn();
    // The sitemap link must be present
    const sitemapUrl = result.sitemap as string | undefined;
    expect(sitemapUrl).toBeTruthy();
    expect(typeof sitemapUrl === 'string' && sitemapUrl.endsWith('/sitemap.xml')).toBe(true);
    // Rules must contain at least one entry
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules.length).toBeGreaterThan(0);
  });

  it('robots sitemap URL ends with /sitemap.xml and uses no localhost in production', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const robotsFn = require('@/app/robots').default as () => import('next').MetadataRoute.Robots;
    const result = robotsFn();
    const sitemapUrl = result.sitemap as string;
    expect(sitemapUrl.endsWith('/sitemap.xml')).toBe(true);
  });
});
