'use client';

import { useState } from 'react';
import { SegmentedFilter } from '@/components/ui/SegmentedFilter';
import { AmenityIconView } from './amenity-icons';

export interface AmenityTile {
  name: string;
  icon: string;
  group: 'INSIDE' | 'AROUND';
}

/** The amenity tiles, with inside / around tabs when both groups have some. */
export function AmenityTiles({ tiles, groups }: { tiles: AmenityTile[]; groups: Record<'INSIDE' | 'AROUND', string> }) {
  const inside = tiles.filter((x) => x.group === 'INSIDE');
  const around = tiles.filter((x) => x.group === 'AROUND');
  const both = inside.length > 0 && around.length > 0;
  const [group, setGroup] = useState<'INSIDE' | 'AROUND'>(inside.length > 0 ? 'INSIDE' : 'AROUND');
  const shown = both ? (group === 'INSIDE' ? inside : around) : tiles;

  return (
    <div>
      {both && (
        <SegmentedFilter
          className="mb-5"
          active={group}
          items={[
            { key: 'INSIDE', label: groups.INSIDE, count: inside.length, onClick: () => setGroup('INSIDE') },
            { key: 'AROUND', label: groups.AROUND, count: around.length, onClick: () => setGroup('AROUND') },
          ]}
        />
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((a, i) => (
          <li key={`${a.group}-${a.name}-${i}`} className="flex flex-col items-center gap-3 rounded-2xl border border-hairline bg-surface px-4 py-5 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-700 dark:text-gold-300">
              <AmenityIconView icon={a.icon} className="h-6 w-6" />
            </span>
            <span className="text-[15px] font-medium leading-snug text-ink-strong">{a.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
