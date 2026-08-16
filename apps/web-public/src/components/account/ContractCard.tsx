import { FileText, Building2, Home, Wallet, Calendar, CalendarClock, Clock } from 'lucide-react';
import { formatPrice, formatNumber, pickAr, unitTypeLabel } from '@/lib/format';
import type { MeContract } from '@/lib/api-types';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { AccountCard, AccountCardIcon } from '@/components/account/AccountCard';
import { DocumentDownloadByOwner } from '@/components/account/DocumentDownloadByOwner';

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

/** Footer timeline cell: fine gold icon + label + value. */
function FootItem({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-gold-500" strokeWidth={1.5} aria-hidden />
      <span className="text-ink-muted">{label}:</span>
      <span className="font-medium text-ink-strong" dir="auto">
        {value}
      </span>
    </span>
  );
}

export async function ContractCard({ contract }: { contract: MeContract }) {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.contracts;

  const FREQUENCY_ADVERB: Record<string, string> = {
    MONTHLY: m.frequencyMonthly,
    QUARTERLY: m.frequencyQuarterly,
    SEMI_ANNUAL: m.frequencySemiAnnual,
    YEARLY: m.frequencyYearly,
  };

  const project = contract.unit?.building?.phase?.project ?? null;
  const projectName = project ? pickAr(project.name) : '';
  const unitLabel = contract.unit ? `${unitTypeLabel(contract.unit.type)} · ${contract.unit.code}` : '';
  const subtitle = [projectName, unitLabel].filter(Boolean).join(' — ');
  const plan = contract.installmentPlan;

  return (
    <AccountCard accent="gold" className="p-5 sm:p-6">
      {/* ── Header: title (start) ⟷ PDF action (end). Full width, no clamps. ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <AccountCardIcon>
            <FileText className="h-5 w-5" aria-hidden />
          </AccountCardIcon>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-ink-strong">{m.contractPrefix} {contract.contractNumber ?? '—'}</h3>
            {subtitle && (
              <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-muted">
                {contract.unit ? (
                  <Home className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
                ) : (
                  <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
                )}
                <span>{subtitle}</span>
              </p>
            )}
          </div>
        </div>

        {contract.hasDocument === false ? (
          <span className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-xl border border-hairline/60 bg-surface-soft px-3.5 py-2 text-xs font-medium text-ink-muted/60">
            <FileText className="h-4 w-4" aria-hidden />
            {m.documentUnavailable}
          </span>
        ) : (
          <DocumentDownloadByOwner
            ownerType="CONTRACT"
            ownerId={contract.id}
            label={m.downloadPdf}
            emptyLabel={m.documentUnavailable}
            variant="compact"
          />
        )}
      </div>

      {/* ── Financial grid: grounded on a soft shaded panel ── */}
      <div className="my-4 grid grid-cols-1 items-center gap-4 rounded-xl bg-surface-soft/40 p-4 sm:grid-cols-2">
        <div className="min-w-0">
          <span className="mb-0.5 block text-[11px] font-medium text-ink-muted">{m.totalAmount}</span>
          <div className="font-display text-lg font-bold tracking-tight text-ink-strong" dir="auto">
            {formatPrice(contract.totalAmount)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:justify-end">
          <div className="min-w-0">
            <span className="mb-0.5 block text-[11px] font-medium text-ink-muted">{m.downPayment}</span>
            <div className="text-sm font-semibold text-ink-strong" dir="auto">
              {formatPrice(contract.downPayment)}
            </div>
          </div>
          {plan && (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-warning/20 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning">
              <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span dir="auto">
                {formatPrice(plan.monthlyAmount)} / {FREQUENCY_ADVERB[plan.frequency] ?? m.frequencyMonthly}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Timeline footer: dates spread across the width ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline/80 pt-3 text-[11px]">
        <FootItem
          icon={Calendar}
          label={m.signedAtLabel}
          value={contract.signedAt ? formatDate(contract.signedAt, locale) : m.unsignedLabel}
        />
        {plan && <FootItem icon={CalendarClock} label={m.planStartLabel} value={formatDate(plan.startsAt, locale)} />}
        {plan && <FootItem icon={Clock} label={m.durationLabel} value={`${formatNumber(plan.totalMonths)} ${m.monthsSuffix}`} />}
      </div>
    </AccountCard>
  );
}
