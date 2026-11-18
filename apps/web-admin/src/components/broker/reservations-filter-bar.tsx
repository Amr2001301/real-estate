'use client';

import { useState } from 'react';
import type { PortalProject } from '@/lib/types';
import { tx } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ListFilterBar, ListFilterField } from '@/components/lists/list-kit';
import { PremiumFilterAdvancedToggle } from '@/components/premium/filter-bar';
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
    <ListFilterBar
      action="/portal/reservations"
      submitLabel={locale === 'en' ? 'Filter' : 'تصفية'}
      advancedLabel={r.advanced}
      onAdvanced={() => setShowAdvanced((v) => !v)}
      clearHref={anyFilter ? '/portal/reservations' : undefined}
      clearLabel={f.clear}
      advanced={
        showAdvanced ? (
          <>
            <ListFilterField label={L.from} htmlFor="rf-from">
              <input id="rf-from" name="from" type="date" dir="ltr" defaultValue={sp.from ?? ''} />
            </ListFilterField>
            <ListFilterField label={L.to} htmlFor="rf-to">
              <input id="rf-to" name="to" type="date" dir="ltr" defaultValue={sp.to ?? ''} />
            </ListFilterField>
          </>
        ) : undefined
      }
    >
      <ListFilterField search label={L.search} htmlFor="rf-q">
        <Input id="rf-q" name="q" placeholder={r.searchPlaceholder} defaultValue={sp.q ?? ''} />
      </ListFilterField>
      <ListFilterField label={L.status} htmlFor="rf-status">
        <Select id="rf-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
          <option value="">{f.all}</option>
          <option value="PENDING">{r.status.PENDING}</option>
          <option value="APPROVED">{r.status.APPROVED}</option>
          <option value="REJECTED">{r.status.REJECTED}</option>
          <option value="CANCELLED">{r.status.CANCELLED}</option>
          <option value="EXPIRED">{r.status.EXPIRED}</option>
          <option value="CONVERTED">{r.status.CONVERTED}</option>
        </Select>
      </ListFilterField>
      <ListFilterField label={L.project} htmlFor="rf-project">
        <Select id="rf-project" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
          <option value="">{f.all}</option>
          {projects.map((p) => (
            <option key={p.project.id} value={p.project.id}>
              {tx(p.project.name, locale)}
            </option>
          ))}
        </Select>
      </ListFilterField>
    </ListFilterBar>
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

