import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PremiumFilterBar, PremiumFilterField } from '@/components/premium/filter-bar';
import type { Locale } from '@/lib/locale';
import { portalSharedT } from '@/messages/portal/shared';

export interface PayoutSearchParams {
  q?: string;
  status?: string;
  period?: string;
  from?: string;
  to?: string;
}

interface Props {
  sp: PayoutSearchParams;
  locale?: Locale;
}

/** Broker payouts filter (U5): the shared pill bar, applied on change. */
export function PayoutsFilterBar({ sp, locale = 'ar' }: Props) {
  const t = portalSharedT(locale);
  const f = t.filters;
  const L = f.labels;
  const c = t.payoutsFilter;
  const anyFilter = !!(sp.q || sp.status || sp.period || sp.from || sp.to);

  return (
    <PremiumFilterBar
      method="get"
      action="/portal/payouts"
      trailing={
        anyFilter ? (
          <Link href="/portal/payouts" className="px-3 text-[13px] font-bold text-brand-700 underline underline-offset-4">
            {f.clear}
          </Link>
        ) : undefined
      }
    >
      <PremiumFilterField label={L.search} htmlFor="pf-q">
        <Input id="pf-q" name="q" placeholder={c.searchPlaceholder} defaultValue={sp.q ?? ''} />
      </PremiumFilterField>
      <PremiumFilterField label={L.status} htmlFor="pf-status">
        <Select id="pf-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
          <option value="">{f.all}</option>
          <option value="DRAFT">{c.status.DRAFT}</option>
          <option value="APPROVED">{c.status.APPROVED}</option>
          <option value="PROCESSING">{c.status.PROCESSING}</option>
          <option value="PAID">{c.status.PAID}</option>
          <option value="CANCELLED">{c.status.CANCELLED}</option>
        </Select>
      </PremiumFilterField>
      <PremiumFilterField label={L.period} htmlFor="pf-period">
        <input id="pf-period" name="period" dir="ltr" placeholder={c.periodPlaceholder} defaultValue={sp.period ?? ''} />
      </PremiumFilterField>
      <PremiumFilterField label={L.from} htmlFor="pf-from">
        <input id="pf-from" name="from" type="date" dir="ltr" defaultValue={sp.from ?? ''} />
      </PremiumFilterField>
      <PremiumFilterField label={L.to} htmlFor="pf-to">
        <input id="pf-to" name="to" type="date" dir="ltr" defaultValue={sp.to ?? ''} />
      </PremiumFilterField>
    </PremiumFilterBar>
  );
}
