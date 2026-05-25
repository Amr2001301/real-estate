import { Home, Building2, Wrench, Download } from 'lucide-react';
import { formatNumber, pickAr, unitTypeLabel } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { MeContract } from '@/lib/api-types';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { ButtonLink } from '@/components/ui/Button';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink-strong" dir="auto">
        {value}
      </div>
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
    <PremiumCard className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70">
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

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-hairline pt-4">
        <Fact label="رقم العقد" value={contract.contractNumber ?? '—'} />
        <Fact label="تاريخ التوقيع" value={contract.signedAt ? formatDate(contract.signedAt) : 'غير موقّع'} />
        {plan && <Fact label="خطة التقسيط" value={`${formatNumber(plan.totalMonths)} شهرًا`} />}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 pt-1">
        {unit?.id ? (
          <ButtonLink href={`${routes.accountMaintenanceNew}?unitId=${unit.id}`} variant="primary" size="sm">
            <Wrench className="h-4 w-4" aria-hidden />
            طلب صيانة
          </ButtonLink>
        ) : null}

        {contract.pdfUrl ? (
          <a
            href={contract.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink-strong transition-colors hover:border-gold-300 hover:text-gold-600"
          >
            <Download className="h-4 w-4" aria-hidden />
            عرض العقد PDF
          </a>
        ) : (
          <span className="rounded-full bg-surface-soft px-3.5 py-2 text-xs font-medium text-ink-muted">
            العقد غير متاح بعد
          </span>
        )}
      </div>
    </PremiumCard>
  );
}
