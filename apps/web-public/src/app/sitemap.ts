import type { MetadataRoute } from 'next';
import { safeFetch } from '@/lib/api';
import { siteUrl } from '@/lib/seo';
import type { Paginated, PublicProjectListItem, PublicUnit } from '@/lib/api-types';

// Re-generate at most hourly; static URLs are always returned even if the API
// is unreachable.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: siteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: siteUrl('/projects'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: siteUrl('/units'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: siteUrl('/contact'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const [projects, units] = await Promise.all([
    safeFetch<Paginated<PublicProjectListItem>>('/public/projects?pageSize=100', { revalidate }),
    safeFetch<Paginated<PublicUnit>>('/public/units?pageSize=100', { revalidate }),
  ]);

  const projectEntries: MetadataRoute.Sitemap = projects.ok
    ? projects.data.data.map((p) => ({
        url: siteUrl(`/projects/${p.id}`),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      }))
    : [];

  const unitEntries: MetadataRoute.Sitemap = units.ok
    ? units.data.data.map((u) => ({
        url: siteUrl(`/units/${u.id}`),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      }))
    : [];

  return [...staticEntries, ...projectEntries, ...unitEntries];
}
