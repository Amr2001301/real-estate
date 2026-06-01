import { Home, Building2, Wrench } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber, pickAr, unitTypeLabel } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { MeContract } from '@/lib/api-types';
import { AccountCard } from '@/components/account/AccountCard';
import { ButtonLink } from '@/components/ui/Button';
import { DocumentDownloadByOwner } from '@/components/account/DocumentDownloadByOwner';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function Fact({
  label,
  value,
  align = 'start',
  valueClassName,
}: {
  label: string;
  value: string;
  /** Which edge the block hugs — `start` (right in RTL) or `end` (left). */
  align?: 'start' | 'end';
  valueClassName?: string;
}) {
  return (
    <div className={cn('min-w-0', align === 'end' ? 'text-end' : 'text-start')}>
      <span className="block text-[11px] font-medium text-ink-muted">{label}</span>
      {/* No dir="auto": text-align controls the edge so the value sits flush
          under its label instead of bidi-drifting to the other side. */}
      <div className={cn('mt-0.5 text-xs font-semibold text-ink-strong', valueClassName)}>{value}</div>
    </div>
  );
}

/**
 * Asset/unit view derived from a contract (the customer owns the unit the
 * contract is for). Distinct from the contracts page (documents/financials):
 * here the unit is the headline, with a quick maintenance CTA. No reservation
 * status, no broker, no payment.
 */
export function PropertyCard({ contract }: { contract: MeContract }) {
  const unit = contract.unit;
  const project = unit?.building?.phase?.project ?? null;
  const projectName = project ? pickAr(project.name) : '';
  const unitLabel = unit ? `${unitTypeLabel(unit.type)} · ${unit.code}` : '';
  const title = projectName || unitLabel || 'وحدة';
  const plan = contract.installmentPlan;

  return (
    <AccountCard accent="gold" className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start gap-3">
        {/* Abstract premium thumbnail — neutral geometric tile, not a circle */}
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-soft text-ink-muted">
          <Home className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-base font-semibold text-ink-strong">{title}</h3>
          {unitLabel && projectName && (
            <p className="mt-0.5 line-clamp-1 flex items-center gap-1.5 text-xs text-ink-muted">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
              <span className="line-clamp-1">{unitLabel}</span>
            </p>
          )}
        </div>
      </div>

      {/* Strict geometric 2-column micro-grid — blocks hug opposite edges */}
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-b border-hairline pb-3 mb-3">
        <Fact
          label="رقم العقد"
          value={contract.contractNumber ?? '—'}
          align="start"
          valueClassName="font-bold tracking-wide font-mono"
        />
        <Fact
          label="تاريخ التوقيع"
          value={contract.signedAt ? formatDate(contract.signedAt) : 'غير موقّع'}
          align="end"
          valueClassName="font-semibold text-ink"
        />
        {plan && (
          <Fact label="خطة التقسيط" value={`${formatNumber(plan.totalMonths)} شهرًا`} align="start" />
        )}
      </div>

      {/* Luxury action row — dark primary ⟷ low-profile download */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        {unit?.id ? (
          <ButtonLink
            href={`${routes.accountMaintenanceNew}?unitId=${unit.id}`}
            variant="primary"
            size="sm"
            className="h-auto rounded-xl px-3.5 py-2 text-xs font-semibold shadow-sm"
          >
            <Wrench className="h-4 w-4" aria-hidden />
            طلب صيانة
          </ButtonLink>
        ) : (
          <span aria-hidden />
        )}

        <DocumentDownloadByOwner
          ownerType="CONTRACT"
          ownerId={contract.id}
          label="عرض العقد PDF"
          emptyLabel="العقد غير متاح بعد"
          variant="compact"
        />
      </div>
    </AccountCard>
  );
}
