import Link from 'next/link';
import {
  MapPin,
  CalendarRange,
  Star,
  Layers,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import type { PortalProject } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { ProjectStatusBadge } from '@/components/badges';
import { ProjectImageLightbox } from '@/components/broker/project-image-lightbox';
import { cn } from '@/lib/cn';

export function ProjectCard({ p, symbol = 'ج.م' }: { p: PortalProject; symbol?: string }) {
  const commissionPct =
    p.access.commissionPct !== null && p.access.commissionPct !== undefined
      ? Number(p.access.commissionPct) : null;
  const fixedAmount =
    p.access.fixedAmountPerUnit !== null && p.access.fixedAmountPerUnit !== undefined
      ? Number(p.access.fixedAmountPerUnit) : null;

  const commissionLabel = commissionPct !== null
    ? `${commissionPct.toFixed(2)}%`
    : fixedAmount !== null
      ? `${fixedAmount.toLocaleString('ar-EG')} ${symbol}`
      : null;

  const description  = tx(p.project.description);
  const services     = (p.project.services ?? []).map((s) => tx(s)).filter(Boolean);
  const hasDateRange = p.access.startsAt || p.access.endsAt;
  const isPublished  = p.project.status === 'PUBLISHED';

  return (
    <div className="relative bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden flex flex-col sm:flex-row group hover:shadow-md transition-shadow duration-200">

      {/* Gold top bar for published */}
      <div className={cn(
        'absolute inset-x-0 top-0 h-[3px] z-10',
        isPublished
          ? 'bg-gradient-to-l from-brand-300 via-brand-500 to-brand-300'
          : 'bg-slate-200',
      )} />

      {/* Zone 1: Image */}
      <div className="relative sm:w-52 lg:w-60 shrink-0 h-44 sm:h-auto self-stretch overflow-hidden bg-gradient-to-br from-brand-50 to-amber-50/60">
        <ProjectImageLightbox
          media={p.project.media ?? []}
          projectName={tx(p.project.name)}
        />
        {/* Badges */}
        <div className="absolute top-3 start-3 z-20 flex flex-col gap-1.5 items-start pointer-events-none">
          <ProjectStatusBadge status={p.project.status} />
          {p.project.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/90 text-white px-2 py-0.5 text-2xs font-bold backdrop-blur-sm shadow-sm">
              <Star className="h-2.5 w-2.5 fill-current" />
              مميز
            </span>
          )}
        </div>
        {(p.project.media?.length ?? 0) > 1 && (
          <span className="absolute bottom-3 start-3 z-20 inline-flex items-center gap-1 rounded-lg bg-black/50 text-white px-2 py-1 text-2xs backdrop-blur-sm pointer-events-none">
            <Layers className="h-2.5 w-2.5" />
            {p.project.media!.length}
          </span>
        )}
      </div>

      {/* Zone 2: Main content */}
      <div className="flex flex-col justify-center gap-2.5 flex-1 min-w-0 px-6 py-5">

        {/* Title + meta */}
        <div>
          <h3 className="text-[16px] font-extrabold text-navy leading-snug">
            {tx(p.project.name)}
          </h3>
          {description && (
            <p className="mt-1.5 text-[12px] text-slate-500 line-clamp-2 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* City + date range */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-600 font-medium">
            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            {p.project.city}
          </span>
          {hasDateRange && (
            <span className="inline-flex items-center gap-1.5 text-2xs text-slate-400" dir="ltr">
              <CalendarRange className="h-3 w-3 shrink-0" />
              <span className="tabular-nums">
                {p.access.startsAt ? formatDate(p.access.startsAt) : '—'}
                {' – '}
                {p.access.endsAt ? formatDate(p.access.endsAt) : '—'}
              </span>
            </span>
          )}
        </div>

        {/* Service chips */}
        {services.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {services.slice(0, 6).map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-lg bg-slate-100 text-slate-600 text-[11px] font-medium px-2.5 py-1"
              >
                {s}
              </span>
            ))}
            {services.length > 6 && (
              <span className="inline-flex items-center rounded-lg bg-slate-100 text-slate-400 text-[11px] px-2.5 py-1">
                +{services.length - 6}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Zone 3: Action column */}
      <div className={cn(
        'flex shrink-0 flex-col items-center justify-center gap-3',
        'border-t sm:border-t-0 sm:border-s border-hairline',
        'px-5 py-4 sm:py-5 sm:w-36 lg:w-40',
        'bg-canvas/50',
      )}>
        {/* Commission box */}
        <div className="w-full rounded-[14px] bg-amber-50 border border-amber-100 px-3 py-3 text-center">
          <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide leading-none mb-1.5">
            عمولة الوسيط
          </p>
          {commissionLabel ? (
            <p className="text-[24px] font-black text-amber-700 tabular-nums leading-none">
              {commissionLabel}
            </p>
          ) : (
            <p className="text-xs text-slate-400 font-medium">الافتراضية</p>
          )}
        </div>

        {/* CTA */}
        <Link href={`/portal/units?projectId=${p.project.id}` as never} className="w-full">
          <Button variant="primary" size="sm" className="w-full">
            تصفح الوحدات
          </Button>
        </Link>

        {/* Status indicator */}
        <span className={cn(
          'inline-flex items-center gap-1.5 text-[11px] font-semibold',
          p.access.active ? 'text-emerald-600' : 'text-slate-400',
        )}>
          {p.access.active
            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            : <Clock className="h-3.5 w-3.5 shrink-0" />
          }
          {p.access.active ? 'جاهز للتسويق' : 'موقوف'}
        </span>
      </div>

    </div>
  );
}
