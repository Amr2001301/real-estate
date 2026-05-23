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
export function UnitsExplorer({ units }: { units: PublicUnit[] }) {
  return (
    <CompareProvider>
      <Stagger className="grid gap-7 md:grid-cols-2 lg:grid-cols-3" childClassName="h-full" step={80}>
        {units.map((unit) => (
          <div key={unit.id} className="relative h-full">
            <div className="absolute left-4 top-4 z-20">
              <CompareToggle item={toCompareItem(unit)} />
            </div>
            <UnitCard unit={unit} />
          </div>
        ))}
      </Stagger>
      <CompareBar />
    </CompareProvider>
  );
}
