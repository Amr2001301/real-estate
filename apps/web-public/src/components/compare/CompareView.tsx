'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { X, ArrowLeft, Plus, MapPin } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { pickAr, formatPrice, formatArea, formatNumber, unitTypeLabel, cityLabel } from '@/lib/format';
import type { PublicUnit } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { CoverImage } from '@/components/ui/CoverImage';
import { writeCompareItems, type CompareItem } from './CompareContext';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  AVAILABLE: { label: 'متاحة', tone: 'success' },
  RESERVED: { label: 'محجوزة', tone: 'warning' },
  SOLD: { label: 'مباعة', tone: 'neutral' },
};
const DEFAULT_STATUS = { label: 'متاحة', tone: 'success' as const };

interface Row {
  label: string;
  value: (u: PublicUnit) => string;
  /** When set, the standout value across the compared units is highlighted. */
  metric?: (u: PublicUnit) => number;
  dir?: 'min' | 'max';
}

const ROWS: Row[] = [
  { label: 'السعر', value: (u) => formatPrice(u.price), metric: (u) => Number(u.price), dir: 'min' },
  { label: 'المساحة', value: (u) => formatArea(u.area), metric: (u) => u.area, dir: 'max' },
  { label: 'غرف النوم', value: (u) => formatNumber(u.bedrooms), metric: (u) => u.bedrooms, dir: 'max' },
  { label: 'دورات المياه', value: (u) => formatNumber(u.bathrooms), metric: (u) => u.bathrooms, dir: 'max' },
  { label: 'الطابق', value: (u) => formatNumber(u.floor) },
  { label: 'النوع', value: (u) => unitTypeLabel(u.type) },
  { label: 'الحالة', value: (u) => (STATUS[u.status] ?? DEFAULT_STATUS).label },
  { label: 'المشروع', value: (u) => (u.project ? pickAr(u.project.name, '—') : '—') },
  { label: 'المدينة', value: (u) => cityLabel(u.project?.city) },
];

/** Winning metric value for a row, or null when there's no clear winner (all equal / no metric). */
function bestValue(row: Row, units: PublicUnit[]): number | null {
  if (!row.metric || !row.dir || units.length < 2) return null;
  const vals = units.map((u) => row.metric!(u)).filter((n) => Number.isFinite(n) && n > 0);
  if (vals.length < 2) return null;
  const first = vals[0]!;
  if (vals.every((v) => v === first)) return null;
  return row.dir === 'min' ? Math.min(...vals) : Math.max(...vals);
}

function toItem(u: PublicUnit): CompareItem {
  const project = u.project ? pickAr(u.project.name) : '';
  return {
    id: u.id,
    label: [u.type, project].filter(Boolean).join(' · ') || `وحدة ${u.code}`,
    price: u.price,
    coverImage: u.coverImage,
  };
}

export function CompareView({ units }: { units: PublicUnit[] }) {
  const router = useRouter();

  // Keep the querystring (source of truth) and localStorage in sync so the
  // compare selection stays consistent when the user returns to /units.
  useEffect(() => {
    writeCompareItems(units.map(toItem));
  }, [units]);

  function removeUnit(id: string) {
    const remaining = units.filter((u) => u.id !== id);
    writeCompareItems(remaining.map(toItem));
    const ids = remaining.map((u) => u.id);
    const href = ids.length ? `${routes.compare}?ids=${ids.join(',')}` : routes.compare;
    router.replace(href as Route);
  }

  const canAddMore = units.length < 3;
  // "أضف وحدات أخرى" must carry the current selection so /units can preserve it
  // (merged with localStorage there) and adding a unit appends to A,B → A,B,C.
  const addMoreHref = (
    units.length ? `${routes.units}?compareIds=${units.map((u) => u.id).join(',')}` : routes.units
  ) as Route;
  // Winning value per comparable row (null = no highlight).
  const bests = ROWS.map((row) => bestValue(row, units));

  return (
    <div>
      {/* Header cards */}
      <div
        className={cn(
          'grid gap-5',
          units.length === 1 && 'sm:grid-cols-1 lg:max-w-md',
          units.length === 2 && 'sm:grid-cols-2',
          units.length >= 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {units.map((u) => {
          const status = STATUS[u.status] ?? DEFAULT_STATUS;
          const project = u.project ? pickAr(u.project.name) : '';
          return (
            <div key={u.id} className="flex h-full flex-col overflow-hidden rounded-3xl border border-hairline bg-surface shadow-card">
              <div className="relative">
                <CoverImage src={u.coverImage} alt={`وحدة ${u.code}`} className="aspect-[4/3]" />
                <span className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/25 to-transparent" aria-hidden />
                <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-navy/55 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur-md">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      status.tone === 'success' ? 'bg-success' : status.tone === 'warning' ? 'bg-warning' : 'bg-ink-muted',
                    )}
                    aria-hidden
                  />
                  {status.label}
                </span>
                <button
                  type="button"
                  aria-label="إزالة من المقارنة"
                  onClick={() => removeUnit(u.id)}
                  className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-ink-strong shadow-soft backdrop-blur-md transition-colors hover:bg-surface"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="line-clamp-1 text-sm text-ink-muted">
                  {unitTypeLabel(u.type)}{project ? ` · ${project}` : ''}
                </div>
                <div className="mt-1 font-display text-xl font-bold text-ink-strong">{formatPrice(u.price)}</div>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <ButtonLink href={routes.unit(u.id) as Route} variant="primary" size="sm">
                    عرض التفاصيل
                  </ButtonLink>
                  <ButtonLink href={`${routes.contact}?unitId=${u.id}` as Route} variant="outline" size="sm">
                    طلب معلومات
                  </ButtonLink>
                </div>
              </div>
            </div>
          );
        })}

        {canAddMore && (
          <Link
            href={addMoreHref}
            className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-hairline bg-surface-soft/60 p-6 text-center text-ink-muted transition-colors hover:border-hairline/30 hover:text-ink-strong"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-gold-500 shadow-soft">
              <Plus className="h-6 w-6" aria-hidden />
            </span>
            أضف وحدات أخرى
          </Link>
        )}
      </div>

      {/* Best-value legend */}
      {units.length >= 2 && (
        <p className="mt-8 inline-flex items-center gap-2 text-xs text-ink-muted">
          <span className="inline-block h-3 w-3 rounded bg-gold-100 ring-1 ring-gold-200" aria-hidden />
          القيمة المميّزة في كل صف (الأقل سعرًا، الأكبر مساحةً، والأكثر غرفًا) مظللة بالذهبي.
        </p>
      )}

      {/* Desktop comparison matrix */}
      <div className="mt-4 hidden overflow-hidden rounded-3xl border border-hairline bg-surface shadow-card lg:block">
        {/* Column headers — anchor each unit so the matrix reads on its own */}
        <div
          className="grid border-b border-hairline bg-navy text-white"
          style={{ gridTemplateColumns: `200px repeat(${units.length}, minmax(0, 1fr))` }}
        >
          <div className="px-6 py-4 text-sm font-bold">المواصفات</div>
          {units.map((u) => {
            const project = u.project ? pickAr(u.project.name) : '';
            return (
              <div key={u.id} className="border-s border-white/10 px-6 py-4 text-center">
                <div className="line-clamp-1 text-sm font-bold">{unitTypeLabel(u.type)}</div>
                {project && <div className="mt-0.5 line-clamp-1 text-xs text-white/65">{project}</div>}
              </div>
            );
          })}
        </div>

        {/* Attribute rows */}
        {ROWS.map((row, i) => {
          const best = bests[i];
          return (
            <div
              key={row.label}
              className="grid items-stretch border-b border-hairline last:border-b-0"
              style={{ gridTemplateColumns: `200px repeat(${units.length}, minmax(0, 1fr))` }}
            >
              <div className="flex items-center bg-surface-soft/50 px-6 py-4 text-sm font-semibold text-ink-strong">{row.label}</div>
              {units.map((u) => {
                const isBest = best != null && row.metric != null && row.metric(u) === best;
                return (
                  <div
                    key={u.id}
                    className={cn(
                      'flex items-center justify-center border-s border-hairline px-6 py-4 text-center text-ink-strong',
                      isBest && 'bg-gold-100/70 font-semibold',
                    )}
                  >
                    {row.value(u)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Mobile stacked cards */}
      <div className="mt-10 space-y-5 lg:hidden">
        {units.map((u) => {
          const project = u.project ? pickAr(u.project.name) : '';
          return (
            <div key={u.id} className="overflow-hidden rounded-3xl border border-hairline bg-surface shadow-soft">
              <div className="flex items-center gap-3 border-b border-hairline bg-surface-soft/50 px-5 py-4">
                <span className="font-display text-ink-strong">{unitTypeLabel(u.type)}</span>
                {project && (
                  <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                    <MapPin className="h-3.5 w-3.5 text-gold-500" aria-hidden />
                    {project}
                  </span>
                )}
              </div>
              <dl className="divide-y divide-hairline">
                {ROWS.map((row, i) => {
                  const best = bests[i];
                  const isBest = best != null && row.metric != null && row.metric(u) === best;
                  return (
                    <div key={row.label} className="flex items-center justify-between px-5 py-3">
                      <dt className="text-sm text-ink-muted">{row.label}</dt>
                      <dd className={cn('text-ink-strong', isBest && 'font-semibold text-gold-600')}>{row.value(u)}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <ButtonLink href={addMoreHref} variant="primary" size="md">
          <Plus className="h-4 w-4" aria-hidden />
          أضف وحدات أخرى
        </ButtonLink>
        {/* Premium text-link — same arrow-circle pattern as project page */}
        <Link
          href={routes.units}
          className="group flex items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink-strong"
        >
          العودة إلى الوحدات
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface transition-colors group-hover:border-gold-200 group-hover:bg-gold-50 group-hover:text-gold-600">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          </span>
        </Link>
      </div>
    </div>
  );
}
