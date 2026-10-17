import Link from 'next/link';
import type { PortalProject } from '@/lib/types';
import { tx } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PremiumFilterBar, PremiumFilterField } from '@/components/premium/filter-bar';
import type { Locale } from '@/lib/locale';
import { portalSharedT } from '@/messages/portal/shared';

export interface CommissionSearchParams {
  q?: string;
  status?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

interface Props {
  projects: PortalProject[];
  sp: CommissionSearchParams;
  locale?: Locale;
}

/** Broker commissions filter (U5): the shared pill bar, applied on change. */
export function CommissionsFilterBar({ projects, sp, locale = 'ar' }: Props) {
  const t = portalSharedT(locale);
  const f = t.filters;
  const L = f.labels;
  const c = t.commissionsFilter;
  const anyFilter = !!(sp.q || sp.status || sp.projectId || sp.from || sp.to);

  return (
    <PremiumFilterBar
      method="get"
      action="/portal/commissions"
      trailing={
        anyFilter ? (
          <Link href="/portal/commissions" className="px-3 text-[13px] font-bold text-brand-700 underline underline-offset-4">
            {f.clear}
          </Link>
        ) : undefined
      }
    >
      <PremiumFilterField label={L.search} htmlFor="cf-q">
        <Input id="cf-q" name="q" placeholder={c.searchPlaceholder} defaultValue={sp.q ?? ''} />
      </PremiumFilterField>
      <PremiumFilterField label={L.status} htmlFor="cf-status">
        <Select id="cf-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
          <option value="">{f.all}</option>
          <option value="PENDING">{c.status.PENDING}</option>
          <option value="APPROVED">{c.status.APPROVED}</option>
          <option value="REJECTED">{c.status.REJECTED}</option>
          <option value="CANCELLED">{c.status.CANCELLED}</option>
        </Select>
      </PremiumFilterField>
      <PremiumFilterField label={L.project} htmlFor="cf-project">
        <Select id="cf-project" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
          <option value="">{f.all}</option>
          {projects.map((p) => (
            <option key={p.project.id} value={p.project.id}>
              {tx(p.project.name, locale)}
            </option>
          ))}
        </Select>
      </PremiumFilterField>
      <PremiumFilterField label={L.from} htmlFor="cf-from">
        <input id="cf-from" name="from" type="date" dir="ltr" defaultValue={sp.from ?? ''} />
      </PremiumFilterField>
      <PremiumFilterField label={L.to} htmlFor="cf-to">
        <input id="cf-to" name="to" type="date" dir="ltr" defaultValue={sp.to ?? ''} />
      </PremiumFilterField>
    </PremiumFilterBar>
  );
}
