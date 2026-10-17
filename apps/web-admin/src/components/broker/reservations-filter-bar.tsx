'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import type { PortalProject } from '@/lib/types';
import { tx } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PremiumFilterBar, PremiumFilterField } from '@/components/premium/filter-bar';
import { cn } from '@/lib/cn';
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
        <div className="flex basis-full flex-wrap items-center gap-2.5 border-t border-hairline pt-2.5">
          <span className="px-2 text-[13px] text-slate-500">{r.reservationDate}</span>
          <PremiumFilterField label={L.from} htmlFor="rf-from">
            <input id="rf-from" name="from" type="date" dir="ltr" defaultValue={sp.from ?? ''} />
          </PremiumFilterField>
          <PremiumFilterField label={L.to} htmlFor="rf-to">
            <input id="rf-to" name="to" type="date" dir="ltr" defaultValue={sp.to ?? ''} />
          </PremiumFilterField>
        </div>
      )}
    </PremiumFilterBar>
  );
}

/** The dashed "more filters" pill, with the count of advanced filters set. */
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
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-full border border-dashed px-4 text-[13.5px] font-bold transition-colors',
        open || count > 0 ? 'border-brand-400/70 text-brand-700' : 'border-hairline text-slate-700 hover:border-brand-400/50',
      )}
    >
      <SlidersHorizontal className="h-4 w-4" aria-hidden />
      {label}
      {count > 0 && (
        <span className="num inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-100 px-1.5 text-[14px] text-brand-700">
          {count}
        </span>
      )}
    </button>
  );
}
