'use client';

import { useEffect, useRef, useState } from 'react';
import { ListFilter, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { LeadStage } from '@/lib/types';

const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: 'جديد',
  INTERESTED: 'مهتم',
  VISIT: 'زيارة',
  NEGOTIATION: 'تفاوض',
  WON: 'فوز',
  LOST: 'خسارة',
};

const STAGES: LeadStage[] = ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION', 'WON', 'LOST'];

interface Props {
  defaultStage?: string;
  defaultQ?: string;
}

export function LeadsFilterPopover({ defaultStage, defaultQ }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeCount = (defaultStage ? 1 : 0) + (defaultQ ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="outline"
        size="md"
        leftIcon={<ListFilter className="h-4 w-4" />}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        تصفية النتائج
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-brand-500 text-white text-2xs font-bold ms-1">
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="تصفية النتائج"
          className={cn(
            'absolute end-0 mt-2 w-[320px] z-30',
            'rounded-2xl bg-surface border border-hairline shadow-xl p-4',
            'animate-fade-in',
          )}
        >
          <form
            method="get"
            action="/dashboard/leads"
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="filter-q"
                className="text-2xs font-semibold uppercase tracking-wide text-slate-500"
              >
                بحث (اسم / هاتف / بريد)
              </label>
              <Input
                id="filter-q"
                name="q"
                inputSize="sm"
                defaultValue={defaultQ ?? ''}
                placeholder="اكتب للبحث…"
                leftAddon={<Search />}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="filter-stage"
                className="text-2xs font-semibold uppercase tracking-wide text-slate-500"
              >
                المرحلة
              </label>
              <Select
                id="filter-stage"
                name="stage"
                inputSize="sm"
                defaultValue={defaultStage ?? ''}
              >
                <option value="">الكل</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <a
                href="/dashboard/leads"
                className="text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                إعادة تعيين
              </a>
              <Button type="submit" variant="primary" size="sm">
                تطبيق
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
