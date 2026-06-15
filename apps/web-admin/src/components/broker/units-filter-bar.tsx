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

export interface UnitSearchParams {
  q?:         string;
  projectId?: string;
  status?:    string;
  type?:      string;
  minPrice?:  string;
  maxPrice?:  string;
  bedrooms?:  string;
  bathrooms?: string;
}

interface Props {
  projects:    PortalProject[];
  typeOptions: string[];
  sp:          UnitSearchParams;
}

export function UnitsFilterBar({ projects, typeOptions, sp }: Props) {
  // Advanced = secondary filters (price + specs)
  const advancedValues = [sp.minPrice, sp.maxPrice, sp.bedrooms, sp.bathrooms];
  const advancedCount  = advancedValues.filter(Boolean).length;
  const advancedActive = advancedCount > 0;

  // Auto-open when navigating back with active advanced filters
  const [showAdvanced, setShowAdvanced] = useState(advancedActive);

  const anyFilter = !!(sp.q || sp.projectId || sp.status || sp.type || advancedActive);

  return (
    <form
      method="get"
      action="/portal/units"
      className="rounded-xl border border-hairline bg-white shadow-xs overflow-hidden"
    >
      {/* ── Row 1: Primary filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">

        {/* Search */}
        <Input
          inputSize="sm"
          name="q"
          leftAddon={<Search />}
          placeholder="ابحث برمز الوحدة أو المشروع…"
          defaultValue={sp.q ?? ''}
          className="min-w-[180px] flex-1"
        />

        {/* Project */}
        <Select
          name="projectId"
          inputSize="sm"
          defaultValue={sp.projectId ?? ''}
          className="w-36 shrink-0"
        >
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.project.id} value={p.project.id}>
              {tx(p.project.name)}
            </option>
          ))}
        </Select>

        {/* Status */}
        <Select
          name="status"
          inputSize="sm"
          defaultValue={sp.status ?? ''}
          className="w-32 shrink-0"
        >
          <option value="">كل الحالات</option>
          <option value="AVAILABLE">متاحة</option>
          <option value="RESERVED">محجوزة</option>
          <option value="SOLD">مباعة</option>
        </Select>

        {/* Unit type */}
        <Select
          name="type"
          inputSize="sm"
          defaultValue={sp.type ?? ''}
          className="w-28 shrink-0"
        >
          <option value="">كل الأنواع</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>

        {/* Advanced toggle — tinted when open OR when advanced filters are active */}
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

        {/* Apply + Reset */}
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {anyFilter && (
            <Link href="/portal/units">
              <Button type="button" variant="ghost" size="sm">مسح التصفية</Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Row 2: Advanced filters (collapsible with height animation) ──── */}
      {/* grid-rows-[0fr/1fr] trick: child overflow-hidden collapses to 0    */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          showAdvanced ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-t border-hairline bg-slate-50/50">
            <span className="text-2xs font-medium text-slate-400 shrink-0">السعر والمواصفات:</span>

            <Input
              inputSize="sm"
              name="minPrice"
              type="number"
              min={0}
              placeholder="سعر من"
              defaultValue={sp.minPrice ?? ''}
              className="w-28 shrink-0"
            />
            <span className="text-slate-300 text-xs shrink-0">—</span>
            <Input
              inputSize="sm"
              name="maxPrice"
              type="number"
              min={0}
              placeholder="سعر إلى"
              defaultValue={sp.maxPrice ?? ''}
              className="w-28 shrink-0"
            />

            <Select
              name="bedrooms"
              inputSize="sm"
              defaultValue={sp.bedrooms ?? ''}
              className="w-28 shrink-0"
            >
              <option value="">عدد الغرف</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>{n} غرف</option>
              ))}
            </Select>

            <Select
              name="bathrooms"
              inputSize="sm"
              defaultValue={sp.bathrooms ?? ''}
              className="w-32 shrink-0"
            >
              <option value="">عدد الحمامات</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={String(n)}>{n} حمام</option>
              ))}
            </Select>
          </div>
        </div>
      </div>
    </form>
  );
}
