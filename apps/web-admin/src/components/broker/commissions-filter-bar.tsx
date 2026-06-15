import Link from 'next/link';
import { Search } from 'lucide-react';
import type { PortalProject } from '@/lib/types';
import { tx } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

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
}

export function CommissionsFilterBar({ projects, sp }: Props) {
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
        placeholder="ابحث برقم العمولة أو العقد أو الوحدة…"
        defaultValue={sp.q ?? ''}
        className="flex-1 min-w-[200px]"
      />
      <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-40 shrink-0">
        <option value="">كل الحالات</option>
        <option value="PENDING">قيد الاعتماد</option>
        <option value="APPROVED">معتمدة</option>
        <option value="REJECTED">مرفوضة</option>
        <option value="CANCELLED">ملغاة</option>
      </Select>
      <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-44 shrink-0">
        <option value="">كل المشاريع</option>
        {projects.map((p) => (
          <option key={p.project.id} value={p.project.id}>
            {tx(p.project.name)}
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
          تصفية
        </Button>
        {anyFilter && (
          <Link href="/portal/commissions">
            <Button type="button" variant="ghost" size="sm">
              مسح التصفية
            </Button>
          </Link>
        )}
      </div>
    </form>
  );
}
