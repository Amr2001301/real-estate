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

          {/* Unified filter control bar — contracts (start) ⟷ status segmented (end) */}
          <div className="flex flex-col items-stretch gap-4 rounded-xl border border-hairline bg-surface-soft/60 p-3 md:flex-row md:items-center md:justify-between">
            {contracts.length > 1 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-ink-muted">العقد:</span>
                <FilterChip href={buildHref({ contractId: undefined })} active={!activeContractId}>
                  كل العقود
                </FilterChip>
                {contracts.map((c) => (
                  <FilterChip key={c.id} href={buildHref({ contractId: c.id })} active={activeContractId === c.id}>
                    {c.contractNumber ?? `#${c.id.slice(0, 6)}`}
                  </FilterChip>
                ))}
              </div>
            ) : (
              <span aria-hidden />
            )}

            {/* Status segmented control */}
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-hairline/60 bg-surface p-1">
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
                      'shrink-0 whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-bold transition-all',
                      active ? 'bg-navy text-white shadow-sm' : 'text-ink-muted hover:text-ink-strong',
                    )}
                  >
                    {f.label}
                    {typeof count === 'number' && <span className="ms-1 tabular-nums opacity-70">({count})</span>}
                  </Link>
                );
              })}
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

/** Summary cards — warm-luxe surfaces (NOT admin KPI tiles). Totals describe the
 *  installment schedule only; the note clarifies booking amount is separate. */
function SummaryCards({ summary }: { summary: NonNullable<MeInstallmentsResponse['summary']> }) {
  const hasOverdue = Number(summary.overdue) > 0;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem
          icon={CheckCircle2}
          chip="bg-emerald-50 text-emerald-600"
          label="إجمالي المدفوع من الأقساط"
          value={formatPrice(summary.totalPaid)}
          sub={`${summary.counts.paid} قسط مدفوع`}
        />
        <SummaryItem
          icon={Wallet}
          chip="bg-blue-50 text-blue-600"
          label="المتبقي من الأقساط"
          value={formatPrice(summary.remaining)}
          sub={`${summary.counts.pending + summary.counts.overdue} قسط غير مدفوع`}
        />
        <SummaryItem
          icon={AlertCircle}
          chip="bg-rose-50 text-rose-600"
          pulse={hasOverdue}
          label="المتأخرات"
          value={formatPrice(summary.overdue)}
          sub={`${summary.counts.overdue} قسط متأخر`}
        />
        <SummaryItem
          icon={CalendarClock}
          chip="bg-amber-50 text-amber-600"
          label="القسط القادم"
          value={summary.nextDue ? formatPrice(summary.nextDue.amount) : '—'}
          sub={summary.nextDue ? `الاستحقاق: ${formatDate(summary.nextDue.dueDate)}` : 'لا يوجد قسط مستحق'}
        />
      </div>
      <p className="text-[11px] text-ink-muted">
        * هذه الإجماليات تخص جدول الأقساط فقط ولا تتضمن مبلغ الحجز — يظهر مبلغ الحجز في صفحتَي الحجوزات والدفعات.
      </p>
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  chip,
  label,
  value,
  sub,
  pulse,
}: {
  icon: typeof CheckCircle2;
  chip: string;
  label: string;
  value: string;
  sub?: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface p-5 text-right shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
      <div className="min-w-0">
        <div className="mb-1 text-[11px] font-bold text-ink-muted">{label}</div>
        <div className="truncate font-mono text-lg font-black tracking-tight text-ink-strong" dir="auto">
          {value}
        </div>
        {sub && <div className="mt-1 text-[11px] text-ink-muted">{sub}</div>}
      </div>
      <span className={cn('inline-flex shrink-0 items-center justify-center rounded-xl p-3', chip, pulse && 'animate-pulse')}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
    </div>
  );
}

function FilterChip({ href, active, children }: { href: Route; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'bg-navy text-white shadow-sm'
          : 'border border-hairline bg-surface text-ink-strong hover:border-gold-300 hover:text-gold-600',
      )}
    >
      {children}
    </Link>
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
