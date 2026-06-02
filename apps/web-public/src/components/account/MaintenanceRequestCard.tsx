import type { Route } from 'next';
import Link from 'next/link';
import { Wrench, Home } from 'lucide-react';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';
import { pickAr, unitTypeLabel } from '@/lib/format';
import type { MeMaintenanceRequest } from '@/lib/api-types';
import { AccountCard, type AccountCardAccent } from '@/components/account/AccountCard';

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

// Soft minimal pills — light tint + matching border (theme tokens → dark-safe).
const SLATE = 'bg-surface-soft/80 text-ink-muted border border-hairline/60';
const SUCCESS = 'bg-success/10 text-success border border-success/20';
const AMBER = 'bg-warning/10 text-warning border border-warning/20';
const GOLD = 'bg-gold-100/80 text-gold-600 border border-gold-200/50';
const ERROR = 'bg-error/10 text-error border border-error/20';

/** Status / review / priority enums → Arabic label + luxury tint. */
const TAG: Record<string, { label: string; cls: string }> = {
  // MaintenanceStatus
  OPEN: { label: 'مفتوح', cls: GOLD },
  ASSIGNED: { label: 'تم الإسناد', cls: GOLD },
  IN_PROGRESS: { label: 'قيد التنفيذ', cls: GOLD },
  RESOLVED: { label: 'تم الحل', cls: SUCCESS },
  CLOSED: { label: 'مغلق', cls: SLATE },
  CANCELLED: { label: 'ملغى', cls: SLATE },
  // Review status
  PENDING_REVIEW: { label: 'بانتظار المراجعة', cls: GOLD },
  APPROVED: { label: 'تمت الموافقة', cls: SUCCESS },
  REJECTED: { label: 'مرفوض', cls: ERROR },
  // Priority
  LOW: { label: 'أولوية منخفضة', cls: SLATE },
  MEDIUM: { label: 'أولوية متوسطة', cls: AMBER },
  HIGH: { label: 'أولوية عالية', cls: GOLD },
  URGENT: { label: 'عاجلة', cls: ERROR },
};

function Tag({ status }: { status: string }) {
  const t = TAG[status] ?? { label: status, cls: SLATE };
  return (
    <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold', t.cls)}>
      {t.label}
    </span>
  );
}

export function MaintenanceRequestCard({ request }: { request: MeMaintenanceRequest }) {
  const categoryName = request.category ? pickAr(request.category.name) : '';
  const unitLabel = request.unit ? `${unitTypeLabel(request.unit.type)} · ${request.unit.code}` : '';
  const accent: AccountCardAccent =
    request.status === 'RESOLVED'
      ? 'success'
      : request.status === 'CLOSED' || request.status === 'CANCELLED'
        ? 'muted'
        : 'gold';

  return (
    <Link href={`${routes.accountMaintenance}/${request.id}` as Route} className="block">
      <AccountCard accent={accent} interactive className="p-5">
        <div className="grid w-full grid-cols-1 items-center gap-4 md:grid-cols-12">
          {/* Col 1 — identity (far right) */}
          <div className="flex items-center gap-3 md:col-span-3">
            <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-warning/10 p-2.5 text-warning ring-1 ring-warning/20">
              <Wrench className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="line-clamp-1 text-sm font-black text-ink-strong">{categoryName || 'طلب صيانة'}</h3>
              {unitLabel && (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-ink-muted">
                  <Home className="h-3 w-3 shrink-0 text-gold-500" aria-hidden />
                  <span className="line-clamp-1">{unitLabel}</span>
                </p>
              )}
            </div>
          </div>

          {/* Col 2 — raw description, separated by a hairline rule */}
          <div className="min-w-0 md:col-span-4 md:border-s md:border-hairline/80 md:ps-4">
            <p className="max-w-[200px] truncate text-right text-sm font-semibold text-ink-muted" dir="auto">
              {request.description}
            </p>
          </div>

          {/* Col 3 — status matrix, single horizontal row (never wraps) */}
          <div className="flex shrink-0 flex-row flex-nowrap items-center gap-2 md:col-span-3 md:justify-center">
            <Tag status={request.status} />
            <Tag status={request.reviewStatus} />
            {request.priority && <Tag status={request.priority} />}
          </div>

          {/* Col 4 — timeline (far left) */}
          <div className="md:col-span-2 md:flex md:justify-end">
            <span className="font-mono text-[11px] font-bold text-ink-muted" dir="auto">
              {formatDate(request.createdAt)}
            </span>
          </div>
        </div>
      </AccountCard>
    </Link>
  );
}
