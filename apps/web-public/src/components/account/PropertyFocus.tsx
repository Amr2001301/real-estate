import { Home, Building2, Wrench, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';
import { pickAr, unitTypeLabel, formatPrice, formatNumber } from '@/lib/format';
import type { MeContract, MeInstallment } from '@/lib/api-types';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DocumentDownloadByOwner } from '@/components/account/DocumentDownloadByOwner';

// Warm gold corner glow — same family as the homepage feature surfaces.
const GLOW = {
  background: 'radial-gradient(circle at 100% 0%, rgba(200,162,75,0.12), transparent 55%)',
} as const;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'long' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-ink-strong" dir="auto">
        {value}
      </dd>
    </div>
  );
}

/**
 * Owner-first focus band. A property owner opens the portal to know two things:
 * what they own and what they owe next. The right (start) side is the owned
 * unit derived from the primary contract; the left (end) side is the single
 * most urgent upcoming installment with a clear next action. Stays in the
 * Warm-Luxe light language — no dark surfaces.
 */
export function PropertyFocus({
  contract,
  nextInstallment,
  unpaidCount,
}: {
  contract: MeContract;
  nextInstallment: MeInstallment | null;
  unpaidCount: number;
}) {
  const unit = contract.unit;
  const project = unit?.building?.phase?.project ?? null;
  const projectName = project ? pickAr(project.name) : '';
  const unitLabel = unit ? `${unitTypeLabel(unit.type)} · ${unit.code}` : '';
  const title = projectName || unitLabel || 'وحدتك';
  const plan = contract.installmentPlan;
  const overdue = nextInstallment?.status === 'OVERDUE';

  return (
    <PremiumCard className="relative overflow-hidden">
      <span className="pointer-events-none absolute inset-0" style={GLOW} aria-hidden />

      <div className="relative grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ── What you own ── */}
        <div className="p-6 sm:p-7">
          <span className="text-sm font-medium text-gold-600">عقارك</span>
          <div className="mt-3 flex items-start gap-3.5">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70">
              <Home className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="line-clamp-1 text-xl font-bold text-ink-strong sm:text-2xl">{title}</h2>
              {unitLabel && projectName && (
                <p className="mt-1 line-clamp-1 flex items-center gap-1.5 text-sm text-ink-muted">
                  <Building2 className="h-4 w-4 shrink-0 text-gold-500" aria-hidden />
                  <span className="line-clamp-1">{unitLabel}</span>
                </p>
              )}
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-hairline pt-4 sm:grid-cols-3">
            <Fact label="رقم العقد" value={contract.contractNumber ?? '—'} />
            <Fact label="تاريخ التوقيع" value={contract.signedAt ? formatDate(contract.signedAt) : 'غير موقّع'} />
            {plan && <Fact label="خطة التقسيط" value={`${formatNumber(plan.totalMonths)} شهرًا`} />}
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {unit?.id && (
              <ButtonLink href={`${routes.accountMaintenanceNew}?unitId=${unit.id}`} variant="primary" size="sm">
                <Wrench className="h-4 w-4" aria-hidden />
                طلب صيانة
              </ButtonLink>
            )}
            <DocumentDownloadByOwner
              ownerType="CONTRACT"
              ownerId={contract.id}
              label="عرض العقد PDF"
              emptyLabel="العقد غير متاح بعد"
            />
          </div>
        </div>

        {/* ── What you owe next ── */}
        <div
          className={cn(
            // Gold tint must adapt to the theme: the gold scale is literal, so
            // a flat gold-50 fill would stay light-on-dark. A low-opacity
            // gold-400 wash reads as a warm tint over either canvas.
            'flex flex-col border-t border-hairline p-6 sm:p-7 md:border-s md:border-t-0',
            overdue ? 'bg-error/[0.05]' : 'bg-gold-400/[0.07]',
          )}
        >
          <span className={cn('text-sm font-medium', overdue ? 'text-error' : 'text-gold-600')}>القسط القادم</span>

          {nextInstallment ? (
            <>
              <div className="mt-2 font-display text-3xl font-bold leading-none text-ink-strong">
                {formatPrice(nextInstallment.amount)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                {overdue ? (
                  <Badge tone="warning" className="!bg-error/10 !text-error">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    متأخر
                  </Badge>
                ) : (
                  <span>مستحق في</span>
                )}
                <span className="font-medium text-ink-strong" dir="auto">
                  {formatDate(nextInstallment.dueDate)}
                </span>
              </div>
              {unpaidCount > 1 && (
                <p className="mt-2 text-xs text-ink-muted">{formatNumber(unpaidCount)} أقساط متبقية</p>
              )}
              <div className="mt-auto pt-5">
                <ButtonLink href={routes.accountInstallments} variant="gold" size="sm">
                  عرض الأقساط
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </ButtonLink>
              </div>
            </>
          ) : (
            <>
              <div className="mt-2 flex items-center gap-2 text-base font-semibold text-ink-strong">
                <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
                لا أقساط مستحقة
              </div>
              <p className="mt-1.5 text-sm text-ink-muted">سجلّك خالٍ من المستحقات الحالية.</p>
              <div className="mt-auto pt-5">
                <ButtonLink href={routes.accountDeposits} variant="outline" size="sm">
                  سجل المدفوعات
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </ButtonLink>
              </div>
            </>
          )}
        </div>
      </div>
    </PremiumCard>
  );
}
