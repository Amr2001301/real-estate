import { pickAr } from '@/lib/format';
import type { PublicProjectDetail, Translatable } from '@/lib/api-types';
import { extraT } from '@/messages/site-extra';
import type { Locale } from '@/lib/locale';
import { DetailHead } from '@/components/detail/DetailStats';
import { AmenityTiles, type AmenityTile } from './AmenityTiles';

/**
 * «ما يميّز هذا المشروع»: the amenities as icon tiles, split into «داخل
 * المشروع» / «حول المشروع» tabs when the project has both. A project saved
 * before amenities had icons shows its names with a tick. Null when empty.
 */
export function ProjectAmenities({
  amenities,
  services,
  locale = 'ar',
}: {
  amenities?: PublicProjectDetail['amenities'];
  services: Translatable[];
  locale?: Locale;
}) {
  const t = extraT(locale);
  const tiles: AmenityTile[] = (amenities?.length
    ? amenities.map((a) => ({ name: pickAr(a.name, '', locale), icon: a.icon, group: a.group }))
    : (services ?? []).map((s) => ({ name: pickAr(s, '', locale), icon: 'check', group: 'INSIDE' as const }))
  ).filter((a) => a.name);
  if (tiles.length === 0) return null;

  return (
    <div>
      <DetailHead eyebrow={t.amenities.eyebrow} title={t.amenities.title} />
      <AmenityTiles tiles={tiles} groups={t.projectContent.groups} />
    </div>
  );
}
