'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, SlidersHorizontal } from 'lucide-react';
import type { PortalProject } from '@/lib/types';
import { tx } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';

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
}

export function ReservationsFilterBar({ projects, sp }: Props) {
  const advancedValues = [sp.from, sp.to];
  const advancedCount = advancedValues.filter(Boolean).length;
  const advancedActive = advancedCount > 0;
  const [showAdvanced, setShowAdvanced] = useState(advancedActive);

  const anyFilter = !!(sp.q || sp.status || sp.projectId || advancedActive);

  return (
    <form
      method="get"
      action="/portal/reservations"
      className="rounded-xl border border-hairline bg-white shadow-xs overflow-hidden"
    >
      {/* Primary row */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <Input
          inputSize="sm"
          name="q"
          leftAddon={<Search />}
          placeholder="ابحث باسم العميل أو رقم الجوال أو الوحدة…"
          defaultValue={sp.q ?? ''}
          className="flex-1 min-w-[200px]"
        />
        <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-44 shrink-0">
          <option value="">كل الحالات</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="APPROVED">تمت الموافقة</option>
          <option value="REJECTED">مرفوض</option>
          <option value="CANCELLED">ملغى</option>
          <option value="EXPIRED">منتهي</option>
          <option value="CONVERTED">محوّل إلى عقد</option>
        </Select>
        <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-48 shrink-0">
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.project.id} value={p.project.id}>
              {tx(p.project.name)}
            </option>
          ))}
        </Select>
        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border transition-colors shrink-0 select-none',
            showAdvanced || advancedActive
              ? 'bg-brand-50 border-brand-200 text-brand-700'
              : 'bg-surface border-hairline text-slate-600 hover:border-slate-300 hover:text-slate-800',
          )}
        >
          <SlidersHorizontal className="h-3 w-3" />
          فلاتر متقدمة
          {advancedActive && (
            <span className="inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-brand-600 text-white text-[9px] font-bold leading-none px-1">
              {advancedCount}
            </span>
          )}
        </button>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          {anyFilter && (
            <Link href="/portal/reservations">
              <Button type="button" variant="ghost" size="sm">
                مسح التصفية
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Advanced row — date range */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          showAdvanced ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-t border-hairline bg-slate-50/50">
            <span className="text-2xs font-medium text-slate-400 shrink-0">تاريخ الحجز:</span>
            <Input
              name="from"
              inputSize="sm"
              type="date"
              dir="ltr"
              defaultValue={sp.from ?? ''}
              className="w-40 shrink-0"
            />
            <span className="text-slate-300 text-xs shrink-0 select-none">—</span>
            <Input
              name="to"
              inputSize="sm"
              type="date"
              dir="ltr"
              defaultValue={sp.to ?? ''}
              className="w-40 shrink-0"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
