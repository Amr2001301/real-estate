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
import { AccountCard, AccountCardIcon, type AccountCardAccent } from '@/components/account/AccountCard';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
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
  success: 'bg-success/10 text-success',
  accent: 'bg-gold-100 text-gold-600 ring-1 ring-gold-200/70',
  muted: 'bg-surface-soft text-ink-muted',
  error: 'bg-error/10 text-error ring-1 ring-error/20',
};

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

function fmtMonthYear(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function statusIcon(status: MeInstallment['status']) {
  if (status === 'PAID') return CheckCircle2;
  if (status === 'OVERDUE') return AlertCircle;
  return CalendarClock;
}

const AMT_FMT = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 });
function fmtAmt(s: string | null | undefined): string {
  if (!s) return '—';
  const n = Number(s);
  if (!Number.isFinite(n)) return '—';
  return AMT_FMT.format(Math.round(n));
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
        <AccountPageHeader
          title="جدول الأقساط"
          description="مواعيد دفع الأقساط، الحالة، وإمكانية إرسال إثبات الدفع."
        />
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

  const buildHref = (overrides: { status?: string; contractId?: string }): Route => {
    const params = new URLSearchParams();
    const status = 'status' in overrides ? overrides.status : activeStatus;
    const contractId = 'contractId' in overrides ? overrides.contractId : activeContractId;
    if (status) params.set('status', status);
    if (contractId) params.set('contractId', contractId);
    const query = params.toString();
    return (query ? `${routes.accountInstallments}?${query}` : routes.accountInstallments) as Route;
  };

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

  const scheduleEmpty = (summary?.counts.total ?? installments.length) === 0;

  return (
    <div className="space-y-8">
      <AccountPageHeader
        title="جدول الأقساط"
        description="مواعيد دفع الأقساط، الحالة، وإمكانية إرسال إثبات الدفع للأقساط غير المدفوعة."
      />

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
          {summary && <SummaryStrip summary={summary} />}

          {/* Filter row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {contracts.length > 1 && (
              <UnitFilter
                options={unitOptions}
                activeContractId={activeContractId}
                activeStatus={activeStatus}
              />
            )}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 sm:ms-auto">
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
                      'inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                      active
                        ? 'bg-navy text-white shadow-sm'
                        : 'border border-hairline bg-surface text-ink-muted hover:border-navy/20 hover:text-ink-strong',
                    )}
                  >
                    {f.label}
                    {typeof count === 'number' && (
                      <span className={cn('tabular-nums text-[11px]', active ? 'opacity-70' : 'opacity-50')}>
                        {count}
                      </span>
                    )}
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
            <div className="space-y-4">
              {installments.map((inst) => (
                <InstallmentCard key={inst.id} installment={inst} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Shared data block — label above, content below, hairline separator on start edge at md+. */
function Block({
  label,
  separator,
  children,
}: {
  label: string;
  separator?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0', separator && 'md:border-s md:border-hairline/70 md:ps-6')}>
      <div className="mb-1 text-xs font-medium tracking-wide text-ink-muted">{label}</div>
      {children}
    </div>
  );
}

/** One financial metric inside the summary strip. */
function SummaryBlock({
  icon: Icon,
  label,
  value,
  sub,
  separator,
  overdue,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  sub?: string;
  separator?: boolean;
  overdue?: boolean;
}) {
  return (
    <div className={cn('min-w-0', separator && 'sm:border-s sm:border-hairline/70 sm:ps-8')}>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
        <Icon className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
        {label}
      </div>
      <div
        className={cn(
          'text-xl font-black tracking-tight tabular-nums',
          overdue ? 'text-error' : 'text-ink-strong',
        )}
        dir="auto"
      >
        {value}
        {value !== '—' && (
          <span className="ms-1.5 text-xs font-semibold text-ink-muted/60">ج.م</span>
        )}
      </div>
      {sub && <div className="mt-1 text-[11px] text-ink-muted/70">{sub}</div>}
    </div>
  );
}

/** Single AccountCard containing all four financial KPIs in one horizontal row. */
function SummaryStrip({ summary }: { summary: NonNullable<MeInstallmentsResponse['summary']> }) {
  const hasOverdue = Number(summary.overdue) > 0;
  return (
    <AccountCard accent="gold" className="p-5 sm:p-7">
      <div className="grid grid-cols-2 gap-y-6 gap-x-4 sm:grid-cols-4">
        <SummaryBlock
          icon={CheckCircle2}
          label="إجمالي المدفوع"
          value={fmtAmt(summary.totalPaid)}
          sub={`${summary.counts.paid} قسط مدفوع`}
        />
        <SummaryBlock
          icon={Wallet}
          label="المتبقي"
          value={fmtAmt(summary.remaining)}
          sub={`${summary.counts.pending + summary.counts.overdue} قسط غير مدفوع`}
          separator
        />
        <SummaryBlock
          icon={AlertCircle}
          label="المتأخرات"
          value={fmtAmt(summary.overdue)}
          sub={`${summary.counts.overdue} قسط متأخر`}
          separator
          overdue={hasOverdue}
        />
        <SummaryBlock
          icon={CalendarClock}
          label="القسط القادم"
          value={fmtAmt(summary.nextDue?.amount ?? null)}
          sub={
            summary.nextDue
              ? `الاستحقاق: ${formatDate(summary.nextDue.dueDate)}`
              : 'لا يوجد مستحق'
          }
          separator
        />
      </div>
    </AccountCard>
  );
}

/** Single installment — mirrors the ReservationCard layout. */
function InstallmentCard({ installment }: { installment: MeInstallment }) {
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
    <AccountCard accent={accent} className="p-5 sm:p-6">
      {/* ── Header: icon + title/subtitle + status badge ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AccountCardIcon>
            <Icon className="h-5 w-5" aria-hidden />
          </AccountCardIcon>
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-base font-semibold text-ink-strong">
              قسط {fmtMonthYear(installment.dueDate)}
            </h3>
            {subtitle && (
              <p className="mt-0.5 line-clamp-1 flex items-center gap-1.5 text-xs text-ink-muted">
                {contract?.unit ? (
                  <Home className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
                ) : (
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
                )}
                <span className="line-clamp-1">{subtitle}</span>
              </p>
            )}
          </div>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium',
            STATUS_TONE_CLS[tone],
          )}
        >
          {label}
        </span>
      </div>

      {/* ── Three balanced data blocks ── */}
      <div className="mt-5 grid grid-cols-1 gap-6 border-t border-hairline pt-5 sm:grid-cols-3 sm:items-center sm:gap-0">
        <Block label="مبلغ القسط">
          <div className="text-sm font-semibold text-ink-strong" dir="auto">
            {formatPrice(installment.amount)}
          </div>
        </Block>
        <Block label="تاريخ الاستحقاق" separator>
          <div className="text-sm font-semibold text-ink-strong" dir="auto">
            {formatDate(installment.dueDate)}
          </div>
        </Block>
        <Block label={installment.paidAt ? 'تاريخ السداد' : 'الحالة'} separator>
          {installment.paidAt ? (
            <div className="text-sm font-semibold text-ink-strong" dir="auto">
              {formatDate(installment.paidAt)}
            </div>
          ) : (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                STATUS_TONE_CLS[tone],
              )}
            >
              {label}
            </span>
          )}
        </Block>
      </div>

      {/* ── Footer: action or paid confirmation ── */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        {canSubmit ? (
          <Link
            href={
              {
                pathname: routes.accountDeposits,
                query: {
                  submit: 'proof',
                  installmentId: installment.id,
                  amount: installment.amount,
                },
              } as unknown as Route
            }
            className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-navy/90 active:scale-95"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            إرسال إثبات الدفع
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            تم السداد والتحقق
          </span>
        )}
        {contract?.contractNumber && (
          <span className="rounded-md bg-surface-soft px-2 py-0.5 font-mono text-[11px] font-medium text-ink-muted">
            {contract.contractNumber}
          </span>
        )}
      </div>
    </AccountCard>
  );
}
