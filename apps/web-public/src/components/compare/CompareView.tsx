'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { X, Plus, MapPin, CalendarDays } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/cn';
import { pickAr, formatPrice, formatArea, formatNumber, unitTypeLabel, cityLabel } from '@/lib/format';
import type { PublicUnit } from '@/lib/api-types';
import { CoverImage } from '@/components/ui/CoverImage';
import { writeCompareItems, type CompareItem } from './CompareContext';
import { useCurrency } from '@/components/currency/CurrencyProvider';
import { useSiteLocale } from '@/components/locale/SiteLocaleProvider';
import { extraT } from '@/messages/site-extra';
import { siteT } from '@/messages/site';
import type { Locale } from '@/lib/locale';

/** A unit's public payment terms, worked out on the server (null = no public plan). */
export type CompareTerms = {
  downPercent: number;
  downAmount: number;
  monthly: number;
  /** Balloon plan: the big payment beside that monthly instalment. */
  balloon?: { amount: number; everyMonths: number } | null;
} | null;

interface Row {
  label: string;
  value: (u: PublicUnit, currency: string) => string;
  /** When set, the standout value across the compared units gets «الأفضل». */
  metric?: (u: PublicUnit) => number;
  dir?: 'min' | 'max';
}

function handover(date: string | null | undefined, locale: Locale, now: string): string {
  if (!date) return '—';
  const due = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(due.getTime())) return '—';
  if (due.getTime() <= Date.now()) return now;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(due);
}

function groups(locale: Locale, terms: Record<string, CompareTerms>): { title: string; rows: Row[] }[] {
  const t = extraT(locale).comparePage;
  const s = siteT(locale).unitSpecs;
  const now = extraT(locale).unitPage.readyNow;
  const term = (u: PublicUnit) => terms[u.id] ?? null;
  const anyTerms = Object.values(terms).some(Boolean);
  return [
    {
      title: t.groups.price,
      rows: [
        { label: t.rows.price, value: (u, c) => formatPrice(u.price, c, locale), metric: (u) => Number(u.price), dir: 'min' },
        { label: t.rows.perMeter, value: (u, c) => (u.pricePerMeter ? formatPrice(u.pricePerMeter, c, locale) : formatPrice(Number(u.price) / (u.area || 1), c, locale)), metric: (u) => Number(u.pricePerMeter ?? Number(u.price) / (u.area || 1)), dir: 'min' },
        ...(anyTerms
          ? ([
              { label: t.rows.down, value: (u, c) => (term(u) ? `${formatNumber(term(u)!.downPercent, locale)}% · ${formatPrice(term(u)!.downAmount, c, locale)}` : '—'), metric: (u) => term(u)?.downAmount ?? 0, dir: 'min' },
              {
                label: t.rows.monthly,
                value: (u, c) => {
                  const tm = term(u);
                  if (!tm?.monthly) return '—';
                  const b = tm.balloon;
                  return b ? `${formatPrice(tm.monthly, c, locale)} + ${formatPrice(b.amount, c, locale)} ${extraT(locale).unitPage.balloonEvery(b.everyMonths)}` : formatPrice(tm.monthly, c, locale);
                },
                metric: (u) => term(u)?.monthly ?? 0,
                dir: 'min',
              },
            ] as Row[])
          : []),
      ],
    },
    {
      title: t.groups.space,
      rows: [
        { label: t.rows.area, value: (u) => formatArea(u.area, locale), metric: (u) => u.area, dir: 'max' },
        { label: t.rows.netArea, value: (u) => (u.netArea ? formatArea(u.netArea, locale) : '—'), metric: (u) => u.netArea ?? 0, dir: 'max' },
        { label: t.rows.bedrooms, value: (u) => (u.usage && u.usage !== 'RESIDENTIAL' ? '—' : formatNumber(u.bedrooms, locale)), metric: (u) => u.bedrooms, dir: 'max' },
        { label: t.rows.bathrooms, value: (u) => formatNumber(u.bathrooms, locale), metric: (u) => u.bathrooms, dir: 'max' },
        { label: t.rows.floor, value: (u) => formatNumber(u.floor, locale) },
      ],
    },
    {
      title: t.groups.finish,
      rows: [
        { label: t.rows.finishing, value: (u) => (u.finishing ? s.finishingLabels[u.finishing] ?? u.finishing : '—') },
        { label: t.rows.view, value: (u) => (u.view ? s.viewLabels[u.view] ?? u.view : '—') },
        { label: t.rows.handover, value: (u) => handover(u.deliveryDate, locale, now) },
      ],
    },
    {
      title: t.groups.place,
      rows: [
        { label: t.rows.project, value: (u) => (u.project ? pickAr(u.project.name, '—', locale) : '—') },
        { label: t.rows.city, value: (u) => cityLabel(u.project?.city, locale) },
      ],
    },
  ];
}

/** The winning value of a row, or null when there is nothing to tell apart. */
function bestValue(row: Row, units: PublicUnit[]): number | null {
  if (!row.metric || !row.dir || units.length < 2) return null;
  const vals = units.map((u) => row.metric!(u)).filter((n) => Number.isFinite(n) && n > 0);
  if (vals.length < 2 || vals.every((v) => v === vals[0])) return null;
  return row.dir === 'min' ? Math.min(...vals) : Math.max(...vals);
}

function toItem(u: PublicUnit, locale: Locale): CompareItem {
  const project = u.project ? pickAr(u.project.name, '', locale) : '';
  return {
    id: u.id,
    label: [unitTypeLabel(u.type, u.typeName, locale), project].filter(Boolean).join(' · ') || extraT(locale).compare.unitWord(u.code),
    price: u.price,
    coverImage: u.coverImage,
  };
}

/**
 * The comparison: one table — each unit a column headed by its photo, name,
 * place and price; rows grouped (price & payment, areas, finishing, place),
 * the standout value of a row marked «الأفضل»; an empty column invites a
 * fourth… third unit. Scrolls sideways inside its card on a phone.
 */
export function CompareView({ units, terms = {} }: { units: PublicUnit[]; terms?: Record<string, CompareTerms> }) {
  const currency = useCurrency();
  const locale = useSiteLocale();
  const t = extraT(locale).comparePage;
  const c = extraT(locale).compare;
  const router = useRouter();
  const G = groups(locale, terms);

  useEffect(() => {
    writeCompareItems(units.map((u) => toItem(u, locale)));
  }, [units, locale]);

  function removeUnit(id: string) {
    const remaining = units.filter((u) => u.id !== id);
    writeCompareItems(remaining.map((u) => toItem(u, locale)));
    const ids = remaining.map((u) => u.id);
    router.replace((ids.length ? `${routes.compare}?ids=${ids.join(',')}` : routes.compare) as Route);
  }

  const addMoreHref = (units.length ? `${routes.units}?compareIds=${units.map((u) => u.id).join(',')}` : routes.units) as Route;
  const slots = units.length < 3 ? 1 : 0;
  const cols = `minmax(108px,200px) repeat(${units.length + slots}, minmax(190px, 1fr))`;

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-hairline bg-surface shadow-[0_30px_70px_-40px_rgba(0,0,0,0.4)]">
      <div className="overflow-x-auto">
        <div className="min-w-fit" role="table" aria-label={siteT(locale).compare.title}>
          {/* Unit headers */}
          <div className="grid" style={{ gridTemplateColumns: cols }} role="row">
            <div className="sticky start-0 z-10 flex items-end bg-surface p-6" role="columnheader">
              <p className="text-sm font-semibold text-ink-muted">{t.count(formatNumber(units.length, locale))}</p>
            </div>
            {units.map((u) => {
              const project = u.project ? pickAr(u.project.name, '', locale) : '';
              const title = unitTypeLabel(u.type, u.typeName, locale);
              return (
                <div key={u.id} className="border-s border-hairline p-5" role="columnheader">
                  <div className="relative h-40 overflow-hidden rounded-2xl">
                    <CoverImage src={u.coverImage} alt={title} className="h-full" />
                    <button
                      type="button"
                      aria-label={c.removeFromCompare}
                      onClick={() => removeUnit(u.id)}
                      className="absolute end-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-black/65"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <Link href={routes.unit(u.id) as Route} className="mt-4 block font-display text-lg font-semibold text-ink-strong hover:text-navy dark:hover:text-gold-300">
                    {title}
                  </Link>
                  {project && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="line-clamp-1">{project}</span>
                    </p>
                  )}
                  <p className="mt-3 font-display text-[1.45rem] font-semibold text-ink-strong">{formatPrice(u.price, currency, locale)}</p>
                </div>
              );
            })}
            {slots > 0 && (
              <div className="border-s border-hairline p-5" role="columnheader">
                <Link
                  href={addMoreHref}
                  className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-hairline text-ink-muted transition-colors hover:border-gold-400/60 hover:text-ink-strong"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gold-400/15 text-gold-700 dark:text-gold-300">
                    <Plus className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="text-[15px] font-semibold">{t.slotEmpty}</span>
                </Link>
              </div>
            )}
          </div>

          {/* Grouped rows */}
          {G.map((g) => (
            <div key={g.title} role="rowgroup">
              <div className="grid border-t border-hairline bg-surface-soft/70" style={{ gridTemplateColumns: cols }} role="row">
                <div className="sticky start-0 bg-surface-soft px-6 py-3 text-[13px] font-semibold text-gold-700 dark:text-gold-300" role="rowheader">
                  {g.title}
                </div>
                <div style={{ gridColumn: `span ${units.length + slots}` }} />
              </div>
              {g.rows.map((row) => {
                const best = bestValue(row, units);
                return (
                  <div key={row.label} className="grid border-t border-hairline" style={{ gridTemplateColumns: cols }} role="row">
                    <div className="sticky start-0 z-10 flex items-center bg-surface px-4 py-4 text-[13px] text-ink-muted sm:px-6 sm:text-[14px]" role="rowheader">
                      {row.label}
                    </div>
                    {units.map((u) => {
                      const isBest = best != null && row.metric?.(u) === best;
                      return (
                        <div key={u.id} className="flex items-center gap-2 border-s border-hairline px-5 py-4" role="cell">
                          <span className={cn('text-[15px] text-ink-strong', isBest && 'font-semibold')}>{row.value(u, currency)}</span>
                          {isBest && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{t.best}</span>
                          )}
                        </div>
                      );
                    })}
                    {slots > 0 && <div className="border-s border-hairline" />}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Actions */}
          <div className="grid border-t border-hairline" style={{ gridTemplateColumns: cols }} role="row">
            <div className="sticky start-0 bg-surface" />
            {units.map((u) => (
              <div key={u.id} className="flex flex-col gap-2 border-s border-hairline p-5" role="cell">
                <a
                  href={`${routes.contact}?type=visit&unitId=${u.id}`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gold-400 text-sm font-semibold text-[#1B1206] transition-colors hover:bg-gold-300"
                >
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  {t.bookVisit}
                </a>
                <Link
                  href={routes.unit(u.id) as Route}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-surface-soft text-sm font-semibold text-ink-strong transition-colors hover:bg-hairline/60"
                >
                  {t.view}
                </Link>
              </div>
            ))}
            {slots > 0 && <div className="border-s border-hairline" />}
          </div>
        </div>
      </div>
    </div>
  );
}
