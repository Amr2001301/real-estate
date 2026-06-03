'use client';

import type { PublicUnit } from '@/lib/api-types';
import { pickAr } from '@/lib/format';
import { Stagger } from '@/components/motion/Stagger';
import { UnitCard } from '@/components/home/UnitCard';
import { CompareProvider, type CompareItem } from '@/components/compare/CompareContext';
import { CompareToggle } from '@/components/compare/CompareToggle';
import { CompareBar } from '@/components/compare/CompareBar';

function toCompareItem(unit: PublicUnit): CompareItem {
  const project = unit.project ? pickAr(unit.project.name) : '';
  const label = [unit.type, project].filter(Boolean).join(' · ') || `وحدة ${unit.code}`;
  return { id: unit.id, label, price: unit.price, coverImage: unit.coverImage };
}

/**
 * Client wrapper for the units grid: provides compare state, overlays a compare
 * toggle on each card, and renders the sticky compare bar. The card's link and
 * the toggle are siblings, so selecting never navigates.
 */
export function UnitsExplorer({
  units,
  seedCompareIds = [],
}: {
  units: PublicUnit[];
  /** Compare ids carried over from /compare (?compareIds=…), preserved in order. */
  seedCompareIds?: string[];
}) {
  // Resolve each carried-over id to a full compare item when the unit is on the
  // current page; otherwise a minimal placeholder (id only) — the provider then
  // enriches it from localStorage. Either way the id is preserved.
  const byId = new Map(units.map((u) => [u.id, toCompareItem(u)] as const));
  const seedItems = seedCompareIds.map(
    (id) => byId.get(id) ?? { id, label: '', price: '', coverImage: null },
  );

  return (
    <CompareProvider seedItems={seedItems}>
      <Stagger className="grid gap-7 md:grid-cols-2 lg:grid-cols-3" childClassName="h-full" step={80}>
        {units.map((unit) => (
          <div key={unit.id} className="h-full">
            <UnitCard unit={unit} action={<CompareToggle item={toCompareItem(unit)} />} />
          </div>
        ))}
      </Stagger>
      <CompareBar />
    </CompareProvider>
  );
}
