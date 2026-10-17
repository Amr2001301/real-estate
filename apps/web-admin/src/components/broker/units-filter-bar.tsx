'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PortalProject } from '@/lib/types';
import { tx } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PremiumFilterBar, PremiumFilterField } from '@/components/premium/filter-bar';
import type { Locale } from '@/lib/locale';
import { portalSharedT } from '@/messages/portal/shared';
import { MoreFiltersButton } from './reservations-filter-bar';

export interface UnitSearchParams {
  q?:         string;
  projectId?: string;
  status?:    string;
  type?:      string;
  minPrice?:  string;
  maxPrice?:  string;
  bedrooms?:  string;
  bathrooms?: string;
}

interface Props {
  projects:    PortalProject[];
  typeOptions: string[];
  sp:          UnitSearchParams;
  locale?:     Locale;
}

/** Broker units filter (U5): the shared pill bar; price and specs behind "more filters". */
export function UnitsFilterBar({ projects, typeOptions, sp, locale = 'ar' }: Props) {
  const t = portalSharedT(locale);
  const f = t.filters;
  const L = f.labels;
  const u = t.unitsFilter;
  const advancedCount = [sp.minPrice, sp.maxPrice, sp.bedrooms, sp.bathrooms].filter(Boolean).length;
  const [showAdvanced, setShowAdvanced] = useState(advancedCount > 0);
  const anyFilter = !!(sp.q || sp.projectId || sp.status || sp.type || advancedCount > 0);

  return (
    <PremiumFilterBar
      method="get"
      action="/portal/units"
      trailing={
        <>
          <MoreFiltersButton open={showAdvanced} count={advancedCount} label={u.advanced} onClick={() => setShowAdvanced((v) => !v)} />
          {anyFilter && (
            <Link href="/portal/units" className="px-3 text-[13px] font-bold text-brand-700 underline underline-offset-4">
              {f.clear}
            </Link>
          )}
        </>
      }
    >
      <PremiumFilterField label={L.search} htmlFor="uf-q">
        <Input id="uf-q" name="q" placeholder={u.searchPlaceholder} defaultValue={sp.q ?? ''} />
      </PremiumFilterField>
      <PremiumFilterField label={L.project} htmlFor="uf-project">
        <Select id="uf-project" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
          <option value="">{f.all}</option>
          {projects.map((p) => (
            <option key={p.project.id} value={p.project.id}>
              {tx(p.project.name, locale)}
            </option>
          ))}
        </Select>
      </PremiumFilterField>
      <PremiumFilterField label={L.status} htmlFor="uf-status">
        <Select id="uf-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
          <option value="">{f.all}</option>
          <option value="AVAILABLE">{u.status.AVAILABLE}</option>
          <option value="RESERVED">{u.status.RESERVED}</option>
          <option value="SOLD">{u.status.SOLD}</option>
        </Select>
      </PremiumFilterField>
      <PremiumFilterField label={L.type} htmlFor="uf-type">
        <Select id="uf-type" name="type" inputSize="sm" defaultValue={sp.type ?? ''}>
          <option value="">{f.all}</option>
          {typeOptions.map((ty) => (
            <option key={ty} value={ty}>{ty}</option>
          ))}
        </Select>
      </PremiumFilterField>
      {showAdvanced && (
        <div className="flex basis-full flex-wrap items-center gap-2.5 border-t border-hairline pt-2.5">
          <span className="px-2 text-[13px] text-slate-500">{u.priceAndSpecs}</span>
          <PremiumFilterField label={L.minPrice} htmlFor="uf-min">
            <input id="uf-min" name="minPrice" type="number" min={0} dir="ltr" defaultValue={sp.minPrice ?? ''} className="w-28" />
          </PremiumFilterField>
          <PremiumFilterField label={L.maxPrice} htmlFor="uf-max">
            <input id="uf-max" name="maxPrice" type="number" min={0} dir="ltr" defaultValue={sp.maxPrice ?? ''} className="w-28" />
          </PremiumFilterField>
          <PremiumFilterField label={L.bedrooms} htmlFor="uf-bed">
            <Select id="uf-bed" name="bedrooms" inputSize="sm" defaultValue={sp.bedrooms ?? ''}>
              <option value="">{f.all}</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>{u.bedroomsOption(n)}</option>
              ))}
            </Select>
          </PremiumFilterField>
          <PremiumFilterField label={L.bathrooms} htmlFor="uf-bath">
            <Select id="uf-bath" name="bathrooms" inputSize="sm" defaultValue={sp.bathrooms ?? ''}>
              <option value="">{f.all}</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={String(n)}>{u.bathroomsOption(n)}</option>
              ))}
            </Select>
          </PremiumFilterField>
        </div>
      )}
    </PremiumFilterBar>
  );
}
