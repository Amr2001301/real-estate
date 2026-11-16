'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PortalProject } from '@/lib/types';
import { tx } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PremiumFilterBar, PremiumFilterField, PremiumFilterAdvancedPanel, PremiumFilterAdvancedToggle } from '@/components/premium/filter-bar';
import type { Locale } from '@/lib/locale';
import { portalSharedT } from '@/messages/portal/shared';

export interface ReservationSearchParams {
  q?: string;
  status?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

interface Props {
  projects: PortalProject[];
  sp: ReservationSearchParams;
  locale?: Locale;
}

/** Broker reservations filter (U5): the shared pill bar; dates behind "more filters". */
export function ReservationsFilterBar({ projects, sp, locale = 'ar' }: Props) {
  const t = portalSharedT(locale);
  const f = t.filters;
  const L = f.labels;
  const r = t.reservationsFilter;
  const advancedCount = [sp.from, sp.to].filter(Boolean).length;
  const [showAdvanced, setShowAdvanced] = useState(advancedCount > 0);
  const anyFilter = !!(sp.q || sp.status || sp.projectId || advancedCount > 0);

  return (
    <PremiumFilterBar
      method="get"
      action="/portal/reservations"
      trailing={
        <>
          <MoreFiltersButton open={showAdvanced} count={advancedCount} label={r.advanced} onClick={() => setShowAdvanced((v) => !v)} />
          {anyFilter && (
            <Link href="/portal/reservations" className="px-3 text-[13px] font-bold text-brand-700 underline underline-offset-4">
              {f.clear}
            </Link>
          )}
        </>
      }
    >
      <PremiumFilterField label={L.search} htmlFor="rf-q">
        <Input id="rf-q" name="q" placeholder={r.searchPlaceholder} defaultValue={sp.q ?? ''} />
      </PremiumFilterField>
      <PremiumFilterField label={L.status} htmlFor="rf-status">
        <Select id="rf-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
          <option value="">{f.all}</option>
          <option value="PENDING">{r.status.PENDING}</option>
          <option value="APPROVED">{r.status.APPROVED}</option>
          <option value="REJECTED">{r.status.REJECTED}</option>
          <option value="CANCELLED">{r.status.CANCELLED}</option>
          <option value="EXPIRED">{r.status.EXPIRED}</option>
          <option value="CONVERTED">{r.status.CONVERTED}</option>
        </Select>
      </PremiumFilterField>
      <PremiumFilterField label={L.project} htmlFor="rf-project">
        <Select id="rf-project" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
          <option value="">{f.all}</option>
          {projects.map((p) => (
            <option key={p.project.id} value={p.project.id}>
              {tx(p.project.name, locale)}
            </option>
          ))}
        </Select>
      </PremiumFilterField>
      {showAdvanced && (
        <PremiumFilterAdvancedPanel>
<PremiumFilterField label={L.from} htmlFor="rf-from">
            <input id="rf-from" name="from" type="date" dir="ltr" defaultValue={sp.from ?? ''} />
          </PremiumFilterField>
          <PremiumFilterField label={L.to} htmlFor="rf-to">
            <input id="rf-to" name="to" type="date" dir="ltr" defaultValue={sp.to ?? ''} />
          </PremiumFilterField>
        </PremiumFilterAdvancedPanel>
      )}
    </PremiumFilterBar>
  );
}

/** The gold "more filters" square, with a dot when an advanced filter is set. */
export function MoreFiltersButton({
  open,
  count,
  label,
  onClick,
}: {
  open: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return <PremiumFilterAdvancedToggle onClick={onClick} open={open} active={count > 0} label={label} />;
}
