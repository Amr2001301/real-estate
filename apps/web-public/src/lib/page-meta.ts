import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { getLocale } from '@/lib/locale';
import { metaEntry, type MetaKey } from '@/messages/meta';

type Extra = { path?: string; robots?: Metadata['robots'] };

/** A page's metadata in the visitor's language (titles and descriptions: messages/meta.ts). */
export async function pageMeta(key: MetaKey, extra: Extra = {}): Promise<Metadata> {
  const e = metaEntry(key, await getLocale());
  return buildMetadata({
    ...(e.title ? { title: e.title } : {}),
    ...(e.description ? { description: e.description } : {}),
    ...(extra.path ? { path: extra.path } : {}),
    ...(extra.robots ? { robots: extra.robots } : {}),
  });
}
