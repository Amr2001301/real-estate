import type { MetadataRoute } from 'next';
import { safeFetch } from '@/lib/api';
import { siteUrl } from '@/lib/seo';
import type { Paginated, PublicProjectListItem, PublicUnit } from '@/lib/api-types';

/**
 * Dynamic sitemap — regenerated at most once per hour.
 *
 * PROJECT POLICY: Only PUBLISHED projects are returned by the public API
 * (`/public/projects`), so every record from that endpoint is indexable.
 *
 * UNIT POLICY: The public listing API defaults to AVAILABLE only, but
 * `/public/units?status=SOLD` also returns accessible pages. RESERVED is a
 * transient state (will flip to AVAILABLE or SOLD) so we omit it.
 * Includes: AVAILABLE + SOLD units in PUBLISHED projects.
 * Excludes: RESERVED (transient), units in non-PUBLISHED projects (404 from API).
 *
 * PAGINATION: Iterates all pages so no records are silently dropped when
 * total > pageSize. Uses pageSize=200 to minimize round-trips.
 *
 * TIMESTAMPS: Real `updatedAt` values from the API. Never fabricated.
 *
 * SCALE: Current platform is far below the 50k URL / 50 MB sitemap limit;
 * no sitemap index is needed yet. Structure is clean for future splitting.
 */
export const revalidate = 3600;

const PAGE_SIZE = 200;

/** Fetch every page of a paginated public endpoint and collect all items. */
export async function fetchAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  while (true) {
    const sep = path.includes('?') ? '&' : '?';
    const result = await safeFetch<Paginated<T>>(
      `${path}${sep}page=${page}&pageSize=${PAGE_SIZE}`,
      { revalidate },
    );
    if (!result.ok) {
      // API unavailable on this page — stop gracefully and return what we have.
      console.error(`[sitemap] fetchAll failed at page ${page} for ${path}: HTTP ${result.error.status}`);
      break;
    }
    items.push(...result.data.data);
    if (page >= result.data.meta.totalPages) break;
    page++;
  }

  return items;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages — these never change between data updates.
  const staticEntries: MetadataRoute.Sitemap = [
    { url: siteUrl('/'),        changeFrequency: 'daily',   priority: 1.0 },
    { url: siteUrl('/projects'), changeFrequency: 'daily',   priority: 0.9 },
    { url: siteUrl('/units'),   changeFrequency: 'daily',   priority: 0.9 },
    { url: siteUrl('/contact'), changeFrequency: 'monthly', priority: 0.5 },
    { url: siteUrl('/privacy'), changeFrequency: 'yearly',  priority: 0.3 },
    { url: siteUrl('/terms'),   changeFrequency: 'yearly',  priority: 0.3 },
  ];

  // Fetch all PUBLISHED projects and AVAILABLE+SOLD units in parallel.
  const [projects, availableUnits, soldUnits] = await Promise.all([
    fetchAll<PublicProjectListItem>('/public/projects'),
    fetchAll<PublicUnit>('/public/units?status=AVAILABLE'),
    fetchAll<PublicUnit>('/public/units?status=SOLD'),
  ]);

  const projectEntries: MetadataRoute.Sitemap = projects.map((p) => ({
    url: siteUrl(`/projects/${p.id}`),
    lastModified: p.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Merge AVAILABLE + SOLD, deduplicate by URL in case the API ever returns
  // a unit in both (e.g. concurrent status change during paging).
  const allUnits = [...availableUnits, ...soldUnits];
  const seen = new Set<string>();
  const unitEntries: MetadataRoute.Sitemap = [];
  for (const u of allUnits) {
    const url = siteUrl(`/units/${u.id}`);
    if (seen.has(url)) continue;
    seen.add(url);
    unitEntries.push({
      url,
      lastModified: u.updatedAt,
      changeFrequency: u.status === 'SOLD' ? 'yearly' : 'weekly',
      priority: u.status === 'SOLD' ? 0.5 : 0.7,
    });
  }

  return [...staticEntries, ...projectEntries, ...unitEntries];
}
