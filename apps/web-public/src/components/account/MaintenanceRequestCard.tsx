import type { Route } from 'next';
import Link from 'next/link';
import { Wrench, Home } from 'lucide-react';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';
import { pickAr, unitTypeLabel, formatDateShort } from '@/lib/format';
import type { MeMaintenanceRequest } from '@/lib/api-types';
import { AccountCard, type AccountCardAccent } from '@/components/account/AccountCard';
import { getLocale } from '@/lib/locale';
import { accountT } from '@/messages/account';

// Soft minimal pills — light tint + matching border (theme tokens → dark-safe).
const SLATE = 'bg-surface-soft/80 text-ink-muted border border-hairline/60';
const SUCCESS = 'bg-success/10 text-success border border-success/20';
const AMBER = 'bg-warning/10 text-warning border border-warning/20';
const GOLD = 'bg-gold-100/80 text-gold-600 border border-gold-200/50';
const ERROR = 'bg-error/10 text-error border border-error/20';

/** Status / review / priority enums → label (messages/account.ts) + luxury tint. */
const TAG_CLASS: Record<string, string> = {
  // MaintenanceStatus
  OPEN: GOLD, ASSIGNED: GOLD, IN_PROGRESS: GOLD, RESOLVED: SUCCESS, CLOSED: SLATE, CANCELLED: SLATE,
  // Review status
  PENDING_REVIEW: GOLD, APPROVED: SUCCESS, REJECTED: ERROR,
  // Priority
  LOW: SLATE, MEDIUM: AMBER, HIGH: GOLD, URGENT: ERROR,
};

export async function MaintenanceTag({ status }: { status: string }) {
  const labels = accountT(await getLocale()).status;
  const t = { label: labels[status] ?? status, cls: TAG_CLASS[status] ?? SLATE };
  return (
    <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold', t.cls)}>
      {t.label}
    </span>
  );
}

export async function MaintenanceRequestCard({ request }: { request: MeMaintenanceRequest }) {
  const locale = await getLocale();
  const categoryName = request.category ? pickAr(request.category.name, '', locale) : '';
  const unitLabel = request.unit ? `${unitTypeLabel(request.unit.type, null, locale)} · ${request.unit.code}` : '';
  const accent: AccountCardAccent =
    request.status === 'RESOLVED'
      ? 'success'
      : request.status === 'CLOSED' || request.status === 'CANCELLED'
        ? 'muted'
        : 'gold';

  return (
    <Link href={`${routes.accountMaintenance}/${request.id}` as Route} className="block">
      <AccountCard accent={accent} className="p-5">
        <div className="grid w-full grid-cols-1 items-center gap-4 md:grid-cols-12">
          {/* Col 1 — identity (far right) */}
          <div className="flex items-center gap-3 md:col-span-3">
            <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-warning/10 p-2.5 text-warning ring-1 ring-warning/20">
              <Wrench className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="line-clamp-1 text-sm font-black text-ink-strong">{categoryName || accountT(locale).maintenanceCard.request}</h3>
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
            <MaintenanceTag status={request.status} />
            <MaintenanceTag status={request.reviewStatus} />
            {request.priority && <MaintenanceTag status={request.priority} />}
          </div>

          {/* Col 4 — timeline (far left) */}
          <div className="md:col-span-2 md:flex md:justify-end">
            <span className="font-mono text-[11px] font-bold text-ink-muted" dir="auto">
              {formatDateShort(request.createdAt, locale)}
            </span>
          </div>
        </div>
      </AccountCard>
    </Link>
  );
}
