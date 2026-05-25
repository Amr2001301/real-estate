import type { Route } from 'next';
import Link from 'next/link';
import { Building2, Home, MessageSquareText, Clock, ArrowLeft } from 'lucide-react';
import { routes } from '@/lib/routes';
import { pickAr, cityLabel, unitTypeLabel } from '@/lib/format';
import type { MeInfoRequest } from '@/lib/api-types';
import { PremiumCard } from '@/components/ui/PremiumCard';

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function InfoRequestCard({ request }: { request: MeInfoRequest }) {
  const projectName = request.project ? pickAr(request.project.name) : '';
  const unitLabel = request.unit ? `${unitTypeLabel(request.unit.type)} · ${request.unit.code}` : '';
  const title = projectName || unitLabel || 'استفسار عام';
  const subtitle = projectName ? unitLabel || cityLabel(request.project?.city) : '';

  const Icon = request.unit ? Home : request.project ? Building2 : MessageSquareText;

  const detailHref: Route | null = request.unit
    ? (routes.unit(request.unit.id) as Route)
    : request.project
      ? (routes.project(request.project.id) as Route)
      : null;

  return (
    <PremiumCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600">
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-base font-semibold text-ink-strong">{title}</h3>
            {subtitle && <p className="line-clamp-1 text-xs text-ink-muted">{subtitle}</p>}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
          <Clock className="h-3.5 w-3.5 text-gold-500" aria-hidden />
          {formatDateTime(request.createdAt)}
        </span>
      </div>

      <p className="mt-3 rounded-xl bg-surface-soft px-3.5 py-2.5 text-sm leading-relaxed text-ink-muted">
        {request.message}
      </p>

      {detailHref && (
        <Link
          href={detailHref}
          className="group mt-4 inline-flex items-center gap-1 text-sm font-medium text-gold-600 transition-colors hover:text-gold-500"
        >
          عرض التفاصيل
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        </Link>
      )}
    </PremiumCard>
  );
}
