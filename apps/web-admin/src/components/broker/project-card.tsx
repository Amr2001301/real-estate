import Link from 'next/link';
import {
  MapPin,
  CalendarRange,
  Star,
  Layers,
} from 'lucide-react';
import type { PortalProject } from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProjectStatusBadge } from '@/components/badges';
import { ProjectImageLightbox } from '@/components/broker/project-image-lightbox';
import { cn } from '@/lib/cn';

// ── ProjectCard ───────────────────────────────────────────────────────────────
// 3-zone RTL layout: [Image right] | [Content center] | [Action left]
// Mobile: stacks as Image → Content → Action row
export function ProjectCard({ p }: { p: PortalProject }) {
  const commissionPct =
    p.access.commissionPct !== null && p.access.commissionPct !== undefined
      ? Number(p.access.commissionPct) : null;
  const fixedAmount =
    p.access.fixedAmountPerUnit !== null && p.access.fixedAmountPerUnit !== undefined
      ? Number(p.access.fixedAmountPerUnit) : null;

  const commissionLabel = commissionPct !== null
    ? `${commissionPct.toFixed(2)}%`
    : fixedAmount !== null
      ? `${fixedAmount.toLocaleString('ar-EG')} ج.م`
      : null;

  const description  = tx(p.project.description);
  const services     = (p.project.services ?? []).map((s) => tx(s)).filter(Boolean);
  const hasDateRange = p.access.startsAt || p.access.endsAt;
  const isPublished  = p.project.status === 'PUBLISHED';

  const accentStyle: React.CSSProperties = isPublished
    ? { borderInlineStartWidth: 4, borderInlineStartColor: '#C8A24B' }
    : { borderInlineStartWidth: 4, borderInlineStartColor: '#cbd5e1' };

  return (
    <Card className="overflow-hidden flex flex-col sm:flex-row group" style={accentStyle}>

      {/* Zone 1: Image — first in DOM = rightmost in RTL flex-row */}
      <div className="relative sm:w-40 lg:w-48 shrink-0 h-40 sm:h-auto self-stretch overflow-hidden bg-gradient-to-br from-brand-50 to-amber-50/60">
        <ProjectImageLightbox
          media={p.project.media ?? []}
          projectName={tx(p.project.name)}
        />

        {/* Badges — outer corner (start = right in RTL) */}
        <div className="absolute top-2 start-2 z-20 flex flex-col gap-1 items-start pointer-events-none">
          <ProjectStatusBadge status={p.project.status} />
          {p.project.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/90 text-white px-2 py-0.5 text-2xs font-semibold backdrop-blur-sm">
              <Star className="h-2.5 w-2.5 fill-current" />
              مميز
            </span>
          )}
        </div>

        {(p.project.media?.length ?? 0) > 1 && (
          <span className="absolute bottom-2 start-2 z-20 inline-flex items-center gap-1 rounded-lg bg-black/45 text-white px-1.5 py-0.5 text-2xs backdrop-blur-sm pointer-events-none">
            <Layers className="h-2.5 w-2.5" />
            {p.project.media!.length}
          </span>
        )}
      </div>

      {/* Zone 2: Main content */}
      <div className="flex flex-col justify-start gap-1.5 flex-1 min-w-0 px-5 py-4 sm:py-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 leading-snug">
            {tx(p.project.name)}
          </h3>
          {description && (
            <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
            {p.project.city}
          </span>
          {hasDateRange && (
            <span className="flex items-center gap-1 text-2xs text-slate-400" dir="ltr">
              <CalendarRange className="h-3 w-3 shrink-0" />
              <span className="tabular-nums">
                {p.access.startsAt ? formatDate(p.access.startsAt) : '—'}
                {' – '}
                {p.access.endsAt ? formatDate(p.access.endsAt) : '—'}
              </span>
            </span>
          )}
        </div>

        {services.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {services.slice(0, 5).map((s, i) => (
              <span
                key={i}
                className="inline-block rounded-md bg-slate-100 text-slate-600 text-2xs font-medium px-2 py-0.5"
              >
                {s}
              </span>
            ))}
            {services.length > 5 && (
              <span className="inline-block rounded-md bg-slate-100 text-slate-400 text-2xs px-2 py-0.5">
                +{services.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Zone 3: Action column — leftmost in RTL */}
      <div className={cn(
        'flex shrink-0 items-center',
        'border-t sm:border-t-0 sm:border-s border-hairline',
        'px-4 py-3 sm:py-5 sm:px-4',
        'gap-3 flex-row sm:flex-col sm:justify-center sm:w-32 lg:w-36',
        'bg-slate-50/60',
      )}>
        <div className="text-center flex-1 sm:flex-none">
          <p className="text-2xs text-slate-400 font-medium leading-none mb-1.5">عمولة الوسيط</p>
          {commissionLabel ? (
            <p className="text-2xl font-black text-amber-700 tabular-nums leading-none">
              {commissionLabel}
            </p>
          ) : (
            <p className="text-xs text-slate-400 font-medium">الافتراضية</p>
          )}
        </div>

        <Link
          href={`/portal/units?projectId=${p.project.id}` as never}
          className="shrink-0 sm:w-full"
        >
          <Button variant="primary" size="sm" className="sm:w-full">
            تصفح الوحدات
          </Button>
        </Link>

        <span className={cn(
          'hidden sm:flex items-center justify-center gap-1.5 text-2xs font-medium',
          p.access.active ? 'text-emerald-600' : 'text-slate-400',
        )}>
          <span className={cn(
            'inline-block h-1.5 w-1.5 rounded-full shrink-0',
            p.access.active ? 'bg-emerald-500' : 'bg-slate-300',
          )} />
          {p.access.active ? 'جاهز للتسويق' : 'موقوف'}
        </span>
      </div>

    </Card>
  );
}
