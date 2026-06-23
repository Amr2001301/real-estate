import { redirect } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import {
  CalendarClock, CheckCircle2, Clock, AlertCircle, Building2, Home, Upload, Wallet,
} from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { authFetch, AuthError } from '@/lib/api-auth';
import { pickAr, unitTypeLabel, formatPrice } from '@/lib/format';
import type { MeInstallment, MeInstallmentsResponse } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { AccountCard, type AccountCardAccent } from '@/components/account/AccountCard';
import { UnitFilter, type UnitOption } from '@/components/account/UnitFilter';
import { cn } from '@/lib/cn';

export const metadata = buildMetadata({
  title: 'الأقساط',
  description: 'جدول أقساط عقودك في ديفورا.',
  robots: { index: false, follow: false },
});

const STATUS_LABELS: Record<MeInstallment['status'], { label: string; tone: 'success' | 'accent' | 'muted' | 'error' }> = {
  PENDING: { label: 'قيد الاستحقاق', tone: 'accent' },
  PAID: { label: 'مدفوع', tone: 'success' },
  OVERDUE: { label: 'متأخر', tone: 'error' },
};

const STATUS_TONE_CLS: Record<'success' | 'accent' | 'muted' | 'error', string> = {
  success: 'bg-success/10 text-success ring-1 ring-success/20',
  accent: 'bg-gold-100 text-gold-600 ring-1 ring-gold-200/70',
  muted: 'bg-surface-soft text-ink-muted',
  error: 'bg-error/10 text-error ring-1 ring-error/20',
};

// Allowed list filters → backend Installment.status (omitted for "all").
const FILTERS = [
  { key: 'all', label: 'الكل', status: undefined },
  { key: 'PAID', label: 'مدفوع', status: 'PAID' as const },
  { key: 'PENDING', label: 'قيد الاستحقاق', status: 'PENDING' as const },
  { key: 'OVERDUE', label: 'متأخر', status: 'OVERDUE' as const },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function statusIcon(status: MeInstallment['status']) {
  if (status === 'PAID') return CheckCircle2;
  if (status === 'OVERDUE') return AlertCircle;
  return Clock;
}

export default async function AccountInstallmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const statusParam = firstStr(sp.status).toUpperCase();
  const activeStatus = (['PAID', 'PENDING', 'OVERDUE'] as const).find((s) => s === statusParam);
  const activeContractId = firstStr(sp.contractId) || undefined;

  const qs = new URLSearchParams({ page: '1', pageSize: '200' });
  if (activeStatus) qs.set('status', activeStatus);
  if (activeContractId) qs.set('contractId', activeContractId);

  let result: MeInstallmentsResponse;
  try {
    result = await authFetch<MeInstallmentsResponse>(`/me/installments?${qs.toString()}`);
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        <Header />
        <ErrorState
          title="تعذّر تحميل الأقساط حاليًا"
          message="يرجى المحاولة مرة أخرى بعد لحظات."
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const installments = result.data;
  const summary = result.summary;
  const contracts = summary?.contracts ?? [];
  const activeFilterKey = activeStatus ?? 'all';

  // Build a filter/contract href that preserves the other dimension.
  const buildHref = (overrides: { status?: string; contractId?: string }): Route => {
    const params = new URLSearchParams();
    const status = 'status' in overrides ? overrides.status : activeStatus;
    const contractId = 'contractId' in overrides ? overrides.contractId : activeContractId;
    if (status) params.set('status', status);
    if (contractId) params.set('contractId', contractId);
    const query = params.toString();
    return (query ? `${routes.accountInstallments}?${query}` : routes.accountInstallments) as Route;
  };

  // Derive unit info from loaded installments (dedup by contractId).
  // Falls back to contractNumber when unit is missing from this batch.
  const contractUnitMap = new Map<string, { code: string; type: string } | null>();
  for (const inst of installments) {
    const c = inst.plan?.contract;
    if (c && !contractUnitMap.has(c.id)) {
      contractUnitMap.set(c.id, c.unit ? { code: c.unit.code, type: c.unit.type } : null);
    }
  }
  const unitOptions: UnitOption[] = contracts.map((c) => {
    const unit = contractUnitMap.get(c.id) ?? null;
    return {
      contractId: c.id,
      label: unit
        ? `${unit.code} — ${unitTypeLabel(unit.type)}`
        : (c.contractNumber ?? `#${c.id.slice(0, 6)}`),
    };
  });

  // Nothing on the whole schedule (not just an empty filter result).
  const scheduleEmpty = (summary?.counts.total ?? installments.length) === 0;

  return (
    <div className="space-y-8">
      <Header />

      {scheduleEmpty ? (
        <EmptyState
          title="لا توجد أقساط بعد"
          message="ستظهر هنا أقساط عقدك مع تاريخ كل قسط وحالته."
          icon={<CalendarClock className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.accountContracts} variant="outline" size="md">
              عرض عقودي
            </ButtonLink>
          }
        />
      ) : (
        <>
          {summary && <SummaryCards summary={summary} />}

          {/* Unified filter panel */}
          <div className="rounded-2xl border border-hairline bg-surface-soft/50 px-5 py-3 shadow-[0_1px_4px_rgb(15,30,51,0.04)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">

              {/* ── Right group: unit dropdown ────────────────────────────────── */}
              {contracts.length > 1 ? (
                <UnitFilter
                  options={unitOptions}
                  activeContractId={activeContractId}
                  activeStatus={activeStatus}
                />
              ) : (
                <span aria-hidden />
              )}

              {/* ── Left group: payment-status segmented control ──────────────── */}
              <div className="flex shrink-0 self-start overflow-x-auto rounded-xl border border-hairline/60 bg-surface p-[3px] shadow-[inset_0_1px_2px_rgb(15,30,51,0.04)] lg:self-auto">
                {FILTERS.map((f) => {
                  const count =
                    f.key === 'all'
                      ? summary?.counts.total
                      : f.key === 'PAID'
                        ? summary?.counts.paid
                        : f.key === 'PENDING'
                          ? summary?.counts.pending
                          : summary?.counts.overdue;
                  const active = activeFilterKey === f.key;
                  return (
                    <Link
                      key={f.key}
                      href={buildHref({ status: f.status })}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'inline-flex h-[calc(2.25rem-6px)] shrink-0 items-center whitespace-nowrap rounded-[0.5rem] px-3.5 text-xs font-bold transition-all duration-200',
                        active
                          ? 'bg-navy text-white shadow-sm'
                          : 'text-ink-muted hover:text-ink-strong',
                      )}
                    >
                      {f.label}
                      {typeof count === 'number' && (
                        <span className="ms-1 tabular-nums opacity-70">({count})</span>
                      )}
                    </Link>
                  );
                })}
              </div>

            </div>
          </div>

          {installments.length === 0 ? (
            <EmptyState
              title="لا توجد أقساط بهذا التصنيف"
              message="جرّب تصفية مختلفة لعرض بقية الأقساط."
              icon={<CalendarClock className="h-6 w-6" aria-hidden />}
              action={
                <ButtonLink href={routes.accountInstallments} variant="outline" size="md">
                  عرض كل الأقساط
                </ButtonLink>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {installments.map((inst) => (
                <InstallmentRow key={inst.id} installment={inst} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Header() {
  return (
    <AccountPageHeader
      title="جدول الأقساط"
      description="مواعيد دفع الأقساط، الحالة، وإمكانية إرسال إثبات الدفع للأقساط غير المدفوعة."
    />
  );
}

/**
 * Format an amount string as whole SAR: strips sub-riyal decimal noise so that
 * e.g. "13439000.08" → "١٣،٤٣٩،٠٠٠" instead of the 12-char "١٣،٤٣٩،٠٠٠،٠٨".
 */
const AMT_FMT = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 });
function fmtAmt(s: string | null | undefined): string {
  if (!s) return '—';
  const n = Number(s);
  if (!Number.isFinite(n)) return '—';
  return AMT_FMT.format(Math.round(n));
}

/** Summary cards — warm-luxe surfaces (NOT admin KPI tiles). Totals describe the
 *  installment schedule only; the note clarifies booking amount is separate. */
function SummaryCards({ summary }: { summary: NonNullable<MeInstallmentsResponse['summary']> }) {
  const hasOverdue = Number(summary.overdue) > 0;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem
          icon={CheckCircle2}
          chip="bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60"
          label="إجمالي المدفوع من الأقساط"
          amount={summary.totalPaid}
          sub={`${summary.counts.paid} قسط مدفوع`}
        />
        <SummaryItem
          icon={Wallet}
          chip="bg-blue-50 text-blue-600 ring-1 ring-blue-200/60"
          label="المتبقي من الأقساط"
          amount={summary.remaining}
          sub={`${summary.counts.pending + summary.counts.overdue} قسط غير مدفوع`}
        />
        <SummaryItem
          icon={AlertCircle}
          chip="bg-rose-50 text-rose-600 ring-1 ring-rose-200/60"
          pulse={hasOverdue}
          label="المتأخرات"
          amount={summary.overdue}
          sub={`${summary.counts.overdue} قسط متأخر`}
        />
        <SummaryItem
          icon={CalendarClock}
          chip="bg-amber-50 text-amber-600 ring-1 ring-amber-200/60"
          label="القسط القادم"
          amount={summary.nextDue?.amount ?? null}
          sub={summary.nextDue ? `الاستحقاق: ${formatDate(summary.nextDue.dueDate)}` : 'لا يوجد قسط مستحق'}
        />
      </div>
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  chip,
  label,
  amount,
  sub,
  pulse,
}: {
  icon: typeof CheckCircle2;
  chip: string;
  label: string;
  amount: string | null;
  sub?: string;
  pulse?: boolean;
}) {
  const formatted = fmtAmt(amount);
  const isBlank = formatted === '—';

  // Scale font down for long Arabic-numeral strings to prevent overflow.
  // After decimal-strip, worst case is ~10 chars (e.g. "١٣،٤٣٩،٠٠٠").
  const valCls = cn(
    'font-display font-black leading-none tracking-tight text-ink-strong',
    !isBlank && formatted.length > 9 ? 'text-[1.25rem]'
    : !isBlank && formatted.length > 6 ? 'text-[1.5rem]'
    : 'text-[1.75rem]',
  );

  return (
    // dir="rtl" explicit so the card is self-contained regardless of parent context
    <div
      className="flex flex-col rounded-2xl border border-hairline bg-surface p-5 shadow-[0_1px_6px_rgb(15,30,51,0.05)]"
      dir="rtl"
    >
      {/* Top row: icon badge (RTL start = right) + label/subtitle to its left */}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            chip,
            pulse && 'animate-pulse',
          )}
        >
          <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 text-start">
          <div className="text-[13px] font-bold leading-snug text-ink-strong">{label}</div>
          {sub && <div className="mt-px text-[11px] font-medium text-ink-muted/65">{sub}</div>}
        </div>
      </div>

      {/* Value — adaptive size prevents overflow; split spans prevent bidi reordering */}
      <div className="mt-[14px] text-start">
        {isBlank ? (
          <span className="font-display text-[1.75rem] font-black leading-none text-ink-muted">—</span>
        ) : (
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap" dir="rtl">
            <span className={valCls}>{formatted}</span>
            <span className="text-[0.8125rem] font-bold text-ink-muted/60">ر.س</span>
          </span>
        )}
      </div>
    </div>
  );
}


function InstallmentRow({ installment }: { installment: MeInstallment }) {
  const contract = installment.plan?.contract ?? null;
  const project = contract?.unit?.building?.phase?.project ?? null;
  const projectName = project ? pickAr(project.name) : '';
  const unitLabel = contract?.unit
    ? `${unitTypeLabel(contract.unit.type)} · ${contract.unit.code}`
    : '';
  const subtitle = [projectName, unitLabel].filter(Boolean).join(' — ');
  const { label, tone } = STATUS_LABELS[installment.status];
  const Icon = statusIcon(installment.status);
  const canSubmit = installment.status !== 'PAID';
  const accent: AccountCardAccent =
    installment.status === 'PAID' ? 'success' : installment.status === 'OVERDUE' ? 'error' : 'gold';

  return (
    <AccountCard accent={accent} interactive className="flex h-full flex-col p-5">
      {/* ── Top row: status pill (start) ⟷ contract code tag (end) ── */}
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold',
            STATUS_TONE_CLS[tone],
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </span>
        {contract?.contractNumber && (
          <span className="rounded-md bg-surface-soft px-2 py-0.5 font-mono text-[11px] font-bold text-ink-muted">
            {contract.contractNumber}
          </span>
        )}
      </div>

      {/* ── Hero centerpiece: amount + property ── */}
      <div className="my-4 flex flex-col items-center justify-center rounded-xl border border-hairline/70 bg-surface-soft/50 p-4 text-center">
        <div className="font-display text-xl font-black tracking-tight text-ink-strong" dir="auto">
          {formatPrice(installment.amount)}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-ink">
          {contract?.unit ? (
            <Home className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
          ) : (
            <Building2 className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
          )}
          <span className="line-clamp-1">{subtitle || 'وحدة'}</span>
        </p>
      </div>

      {/* ── Timeline metadata ── */}
      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-hairline/70 pt-3 text-[11px] text-ink-muted">
        <span dir="auto">الاستحقاق: {formatDate(installment.dueDate)}</span>
        <span className="text-end" dir="auto">
          {installment.paidAt ? `السداد: ${formatDate(installment.paidAt)}` : 'الحالة: لم يُسدّد'}
        </span>
      </div>

      {/* ── Action ── */}
      {canSubmit ? (
        <Link
          href={
            {
              pathname: routes.accountDeposits,
              query: { submit: 'proof', installmentId: installment.id, amount: installment.amount },
            } as unknown as Route
          }
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-navy py-2.5 text-xs font-medium text-white transition-all hover:bg-navy-700"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          إرسال إثبات الدفع
        </Link>
      ) : (
        <span className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-success/[0.06] py-2 text-xs font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          تم السداد والتحقق
        </span>
      )}
    </AccountCard>
  );
}
