import type { Route } from 'next';
import Link from 'next/link';
import { Wrench, Home, ArrowLeft } from 'lucide-react';
import { routes } from '@/lib/routes';
import { pickAr, unitTypeLabel } from '@/lib/format';
import type { MeMaintenanceRequest } from '@/lib/api-types';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { StatusBadge } from '@/components/account/StatusBadge';

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function MaintenanceRequestCard({ request }: { request: MeMaintenanceRequest }) {
  const categoryName = request.category ? pickAr(request.category.name) : '';
  const unitLabel = request.unit ? `${unitTypeLabel(request.unit.type)} · ${request.unit.code}` : '';

  return (
    <Link href={`${routes.accountMaintenance}/${request.id}` as Route} className="group block">
      <PremiumCard className="p-5 transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600">
              <Wrench className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="line-clamp-1 text-base font-semibold text-ink-strong">{categoryName || 'طلب صيانة'}</h3>
              {unitLabel && (
                <p className="mt-0.5 line-clamp-1 flex items-center gap-1.5 text-xs text-ink-muted">
                  <Home className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
                  <span className="line-clamp-1">{unitLabel}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <StatusBadge status={request.status} />
            <StatusBadge status={request.reviewStatus} />
            {request.priority && <StatusBadge status={request.priority} />}
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-muted">{request.description}</p>

        <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-xs text-ink-muted">
          <span>{formatDate(request.createdAt)}</span>
          <span className="inline-flex items-center gap-1 font-medium text-gold-600 transition-colors group-hover:text-gold-500">
            عرض التفاصيل
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
          </span>
        </div>
      </PremiumCard>
    </Link>
  );
}
