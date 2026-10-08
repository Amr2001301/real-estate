import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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

export function PayoutsFilterBar({ sp, locale = 'ar' }: Props) {
  const t = portalSharedT(locale);
  const f = t.filters;
  const p = t.payoutsFilter;
  const anyFilter = !!(sp.q || sp.status || sp.period || sp.from || sp.to);

  return (
    <form
      method="get"
      action="/portal/payouts"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
    >
      <Input
        inputSize="sm"
        name="q"
        leftAddon={<Search />}
        placeholder={p.searchPlaceholder}
        defaultValue={sp.q ?? ''}
        className="flex-1 min-w-[200px]"
      />
      <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-40 shrink-0">
        <option value="">{f.allStatuses}</option>
        <option value="DRAFT">{p.status.DRAFT}</option>
        <option value="APPROVED">{p.status.APPROVED}</option>
        <option value="PROCESSING">{p.status.PROCESSING}</option>
        <option value="PAID">{p.status.PAID}</option>
        <option value="CANCELLED">{p.status.CANCELLED}</option>
      </Select>
      <Input
        name="period"
        inputSize="sm"
        placeholder={p.periodPlaceholder}
        dir="ltr"
        defaultValue={sp.period ?? ''}
        className="w-28 shrink-0"
      />
      <Input
        name="from"
        inputSize="sm"
        type="date"
        dir="ltr"
        defaultValue={sp.from ?? ''}
        className="w-36 shrink-0"
      />
      <span className="text-slate-300 text-xs shrink-0 select-none">—</span>
      <Input
        name="to"
        inputSize="sm"
        type="date"
        dir="ltr"
        defaultValue={sp.to ?? ''}
        className="w-36 shrink-0"
      />
      <div className="flex items-center gap-1.5 ms-auto">
        <Button type="submit" variant="primary" size="sm">
          {f.apply}
        </Button>
        {anyFilter && (
          <Link href="/portal/payouts">
            <Button type="button" variant="ghost" size="sm">
              {f.clear}
            </Button>
          </Link>
        )}
      </div>
    </form>
  );
}
