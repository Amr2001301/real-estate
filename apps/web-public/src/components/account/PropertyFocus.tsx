import { Home, Building2, Wrench, CheckCircle2 } from 'lucide-react';
import { Price } from '@/components/currency/CurrencyProvider';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';
import { pickAr, unitTypeLabel, formatNumber, formatDateShort } from '@/lib/format';
import type { MeContract, MeInstallment } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { DocumentDownloadByOwner } from '@/components/account/DocumentDownloadByOwner';
import { getLocale } from '@/lib/locale';
import { accountT } from '@/messages/account';

/** Strict vertical micro-stack used inside the contract sub-grid. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-start gap-1 text-right">
      <span className="text-[11px] font-bold text-ink-muted">{label}</span>
      <span className="text-xs font-black text-ink-strong" dir="auto">
        {value}
      </span>
    </div>
  );
}

// Secondary pill — soft by default, inverts to navy on hover. Shared by the two
// bottom actions so they read as a matched pair.
const SECONDARY_PILL =
  'inline-flex h-auto items-center gap-1.5 rounded-xl border border-hairline bg-surface-soft px-4 py-2 text-xs font-bold text-ink-strong transition-all duration-200 hover:border-navy hover:bg-navy hover:text-white';

/**
 * Owner-first after-sales card: a 65/35 split — the asset & contract identity
 * panel (start) and an isolated next-payment invoice box (end).
 */
export async function PropertyFocus({
  contract,
  nextInstallment,
  unpaidCount,
}: {
  contract: MeContract;
  nextInstallment: MeInstallment | null;
  unpaidCount: number;
}) {
  const locale = await getLocale();
  const t = accountT(locale).focus;
  const formatDate = (iso: string | null) => formatDateShort(iso, locale);
  const unit = contract.unit;
  const project = unit?.building?.phase?.project ?? null;
  const projectName = project ? pickAr(project.name, '', locale) : '';
  const unitLabel = unit ? `${unitTypeLabel(unit.type, null, locale)} · ${unit.code}` : '';
  const title = projectName || unitLabel || t.yours;
  const plan = contract.installmentPlan;
  const overdue = nextInstallment?.status === 'OVERDUE';

  return (
    <div className="relative flex flex-col items-stretch justify-between gap-6 overflow-hidden rounded-3xl border border-hairline bg-surface p-6 shadow-card lg:flex-row">
      {/* Soft gold corner glow — the account gold-glow card language. */}
      <span
        className="pointer-events-none absolute -left-16 -top-20 h-44 w-44 rounded-full bg-gold-200/25 blur-3xl"
        aria-hidden
      />
      {/* ── Asset & contract panel (~65%) ── */}
      <div className="relative flex w-full flex-col justify-between lg:w-2/3">
        <div>
          {/* Asset header */}
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-700">
              <Home className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="line-clamp-1 text-lg font-black text-ink-strong">{title}</h2>
              {unitLabel && (
                <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-gold-100/70 px-2.5 py-1 text-xs font-semibold text-gold-600 ring-1 ring-gold-200/60">
                  <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {unitLabel}
                </span>
              )}
            </div>
          </div>

          {/* Contract sub-grid */}
          <div className="my-2 grid grid-cols-3 gap-4 border-y border-hairline/80 py-4">
            <Stat label={t.contractNo} value={contract.contractNumber ?? '—'} />
            <Stat
              label={t.signedAt}
              value={contract.signedAt ? formatDate(contract.signedAt) : t.unsigned}
            />
            {plan && <Stat label={t.plan} value={t.months(formatNumber(plan.totalMonths, locale))} />}
          </div>
        </div>

        {/* Secondary actions */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {unit?.id && (
            <ButtonLink
              href={`${routes.accountMaintenanceNew}?unitId=${unit.id}`}
              variant="ghost"
              size="sm"
              className={SECONDARY_PILL}
            >
              <Wrench className="h-4 w-4" aria-hidden />
              {t.maintenance}
            </ButtonLink>
          )}
          <DocumentDownloadByOwner
            ownerType="CONTRACT"
            ownerId={contract.id}
            label={t.viewContract}
            emptyLabel={t.contractMissing}
            variant="dark"
          />
        </div>
      </div>

      {/* ── Next-payment invoice box (~35%) ── */}
      <div
        className={cn(
          'relative flex w-full flex-col items-center justify-between rounded-2xl border p-5 text-center lg:w-1/3',
          overdue ? 'border-error/20 bg-error/[0.05]' : 'border-gold-200/70 bg-gold-100/30',
        )}
      >
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
            {t.nextInstallment}
          </span>

          {nextInstallment ? (
            <>
              <div className="my-1 font-display text-2xl font-black text-ink-strong" dir="auto">
                <Price value={nextInstallment.amount} />
              </div>
              {overdue ? (
                <span className="inline-flex items-center rounded-lg bg-error/10 px-2.5 py-1 text-[10px] font-bold text-error shadow-sm">
                  {t.overdue(formatDate(nextInstallment.dueDate))}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-lg bg-gold-100 px-2.5 py-1 text-[10px] font-bold text-gold-600 shadow-sm">
                  {t.dueOn(formatDate(nextInstallment.dueDate))}
                </span>
              )}
              {unpaidCount > 1 && (
                <p className="mt-2 text-[11px] text-ink-muted">
                  {t.remaining(formatNumber(unpaidCount, locale))}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="my-1 flex items-center gap-1.5 text-base font-bold text-ink-strong">
                <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
                {t.noneDue}
              </div>
              <p className="text-[11px] text-ink-muted">{t.clean}</p>
            </>
          )}
        </div>

        <ButtonLink
          href={nextInstallment ? routes.accountInstallments : routes.accountDeposits}
          variant="primary"
          size="sm"
          className="mt-4 h-auto w-full justify-center rounded-xl py-2.5 text-xs font-black tracking-wide shadow-md"
        >
          {nextInstallment ? t.viewInstallments : t.payments}
        </ButtonLink>
      </div>
    </div>
  );
}
