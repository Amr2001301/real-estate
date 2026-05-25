import { FileText, Download, Building2, Home } from 'lucide-react';
import { formatPrice, formatNumber, pickAr, unitTypeLabel } from '@/lib/format';
import type { MeContract } from '@/lib/api-types';
import { PremiumCard } from '@/components/ui/PremiumCard';

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: 'شهري',
  QUARTERLY: 'ربع سنوي',
  SEMI_ANNUAL: 'نصف سنوي',
  YEARLY: 'سنوي',
};

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

export function ContractCard({ contract }: { contract: MeContract }) {
  const project = contract.unit?.building?.phase?.project ?? null;
  const projectName = project ? pickAr(project.name) : '';
  const unitLabel = contract.unit ? `${unitTypeLabel(contract.unit.type)} · ${contract.unit.code}` : '';
  const subtitle = [projectName, unitLabel].filter(Boolean).join(' — ');
  const plan = contract.installmentPlan;

  return (
    <PremiumCard className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600">
            <FileText className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-base font-semibold text-ink-strong">
              عقد رقم {contract.contractNumber ?? '—'}
            </h3>
            {subtitle && (
              <p className="mt-0.5 line-clamp-1 flex items-center gap-1.5 text-xs text-ink-muted">
                {contract.unit ? <Home className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden /> : <Building2 className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />}
                <span className="line-clamp-1">{subtitle}</span>
              </p>
            )}
          </div>
        </div>

        {/* Download (display/download only — no editing/signing/payment) */}
        {contract.pdfUrl ? (
          <a
            href={contract.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink-strong transition-colors hover:border-gold-300 hover:text-gold-600"
          >
            <Download className="h-4 w-4" aria-hidden />
            تحميل العقد PDF
          </a>
        ) : (
          <span className="shrink-0 rounded-full bg-surface-soft px-3.5 py-2 text-xs font-medium text-ink-muted">
            العقد غير متاح بعد
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-hairline pt-4 sm:grid-cols-3">
        <Fact label="إجمالي العقد" value={formatPrice(contract.totalAmount)} />
        <Fact label="الدفعة الأولى" value={formatPrice(contract.downPayment)} />
        <Fact label="تاريخ التوقيع" value={contract.signedAt ? formatDate(contract.signedAt) : 'غير موقّع'} />
        {plan && (
          <>
            <Fact label="عدد الأشهر" value={`${formatNumber(plan.totalMonths)} شهرًا`} />
            <Fact label="القسط" value={`${formatPrice(plan.monthlyAmount)}${FREQUENCY_LABELS[plan.frequency] ? ` / ${FREQUENCY_LABELS[plan.frequency]}` : ''}`} />
            <Fact label="بداية الخطة" value={formatDate(plan.startsAt)} />
          </>
        )}
      </div>
    </PremiumCard>
  );
}
