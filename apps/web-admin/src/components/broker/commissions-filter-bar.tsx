import Link from 'next/link';
import { Search } from 'lucide-react';
import type { PortalProject } from '@/lib/types';
import { tx } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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

export function CommissionsFilterBar({ projects, sp, locale = 'ar' }: Props) {
  const t = portalSharedT(locale);
  const f = t.filters;
  const c = t.commissionsFilter;
  const anyFilter = !!(sp.q || sp.status || sp.projectId || sp.from || sp.to);

  return (
    <form
      method="get"
      action="/portal/commissions"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
    >
      <Input
        inputSize="sm"
        name="q"
        leftAddon={<Search />}
        placeholder={c.searchPlaceholder}
        defaultValue={sp.q ?? ''}
        className="flex-1 min-w-[200px]"
      />
      <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-40 shrink-0">
        <option value="">{f.allStatuses}</option>
        <option value="PENDING">{c.status.PENDING}</option>
        <option value="APPROVED">{c.status.APPROVED}</option>
        <option value="REJECTED">{c.status.REJECTED}</option>
        <option value="CANCELLED">{c.status.CANCELLED}</option>
      </Select>
      <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-44 shrink-0">
        <option value="">{f.allProjects}</option>
        {projects.map((p) => (
          <option key={p.project.id} value={p.project.id}>
            {tx(p.project.name, locale)}
          </option>
        ))}
      </Select>
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
          <Link href="/portal/commissions">
            <Button type="button" variant="ghost" size="sm">
              {f.clear}
            </Button>
          </Link>
        )}
      </div>
    </form>
  );
}
