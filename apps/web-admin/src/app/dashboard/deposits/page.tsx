import Link from 'next/link';
import { DollarSign, TrendingUp, CreditCard, Landmark, Wallet } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PagedDeposits, Deposit, DepositType, Paged } from '@/lib/types';
import { formatCurrency, formatDate, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { KpiCard } from '@/components/ui/kpi-card';
import { FilterBar, FilterField } from '@/components/ui/toolbar';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/table';
import { Pagination } from '@/components/ui/pagination';
import { VerifyToggle } from './verify-toggle';

export const dynamic = 'force-dynamic';

interface ProjectOption { id: string; name: { ar: string; en: string } }

const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'مبلغ الحجز',
  DOWN_PAYMENT: 'دفعة أولى',
  INSTALLMENT: 'قسط شهري',
  FINAL_PAYMENT: 'دفعة أخيرة',
};

const DEPOSIT_TYPE_CLS: Record<DepositType, string> = {
  BOOKING_AMOUNT: 'bg-indigo-100 text-indigo-700',
  DOWN_PAYMENT: 'bg-amber-100 text-amber-700',
  INSTALLMENT: 'bg-slate-100 text-slate-600',
  FINAL_PAYMENT: 'bg-purple-100 text-purple-700',
};

function getCustomerName(d: Deposit): string {
  if (d.contract?.customer?.fullName) return d.contract.customer.fullName;
  if (d.reservation?.client?.fullName) return d.reservation.client.fullName;
  if (d.reservation?.lead?.fullName) return d.reservation.lead.fullName;
  return '—';
}

function getUnitCode(d: Deposit): string {
  return d.contract?.unit?.code ?? d.reservation?.unit?.code ?? '—';
}

function getDueDate(d: Deposit): string | null {
  if (d.installment?.dueDate) return d.installment.dueDate;
  if (d.type === 'BOOKING_AMOUNT' && d.reservation) {
    return d.reservation.expiresAt ?? d.reservation.createdAt ?? null;
  }
  return null;
}

function getDueDateTitle(d: Deposit): string | undefined {
  if (d.type === 'BOOKING_AMOUNT') {
    return d.reservation?.expiresAt ? 'موعد انتهاء الحجز' : 'مستحق عند الحجز';
  }
  return undefined;
}

function buildApiUrl(sp: Record<string, string | undefined>, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (sp.type) params.set('type', sp.type);
  if (sp.projectId) params.set('projectId', sp.projectId);
  if (sp.q) params.set('q', sp.q);
  if (sp.ref) params.set('ref', sp.ref);
  if (sp.paidAtFrom) params.set('paidAtFrom', sp.paidAtFrom);
  if (sp.paidAtTo) params.set('paidAtTo', sp.paidAtTo);
  if (sp.dueDateFrom) params.set('dueDateFrom', sp.dueDateFrom);
  if (sp.dueDateTo) params.set('dueDateTo', sp.dueDateTo);
  if (sp.verified) params.set('verified', sp.verified);
  return `/deposits?${params.toString()}`;
}


export default async function DepositsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 20;

  const [depositsRes, projectsRes] = await Promise.all([
    safe(api.get<PagedDeposits>(buildApiUrl(sp, page, pageSize))),
    safe(api.get<Paged<ProjectOption>>('/projects?pageSize=100')),
  ]);

  const deposits = depositsRes.data;
  const totals = deposits?.totals;
  const projects: ProjectOption[] = projectsRes.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="الدفعات"
        description="سجل جميع الدفعات المالية على الحجوزات والعقود."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الدفعات' },
        ]}
        actions={
          <Link
            href="/dashboard/deposits/new"
            className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm hover:bg-brand-700"
          >
            + تسجيل دفعة
          </Link>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          tone="brand"
          label="إجمالي المحصّل"
          icon={<DollarSign />}
          value={totals ? formatCurrency(totals.totalAmount) : '—'}
          sub={totals ? `${totals.count} دفعة` : undefined}
        />
        <KpiCard
          tone="info"
          label="مبالغ الحجز"
          icon={<Landmark />}
          value={totals ? formatCurrency(totals.bookingAmount) : '—'}
        />
        <KpiCard
          tone="warning"
          label="الدفعات الأولى"
          icon={<TrendingUp />}
          value={totals ? formatCurrency(totals.downPayment) : '—'}
        />
        <KpiCard
          tone="neutral"
          label="الأقساط الشهرية"
          icon={<CreditCard />}
          value={totals ? formatCurrency(totals.installment) : '—'}
        />
        <KpiCard
          tone="accent"
          label="الدفعات الأخيرة"
          icon={<Wallet />}
          value={totals ? formatCurrency(totals.finalPayment) : '—'}
        />
        <KpiCard
          tone="success"
          label="عدد الدفعات"
          value={totals ? totals.count.toLocaleString('ar-EG') : '—'}
        />
      </div>

      {/* Filter Bar */}
      <FilterBar method="get" action="/dashboard/deposits">
        <FilterField label="نوع الدفعة" htmlFor="type">
          <Select id="type" name="type" inputSize="sm" defaultValue={sp.type ?? ''}>
            <option value="">الكل</option>
            <option value="BOOKING_AMOUNT">مبلغ الحجز</option>
            <option value="DOWN_PAYMENT">دفعة أولى</option>
            <option value="INSTALLMENT">قسط شهري</option>
            <option value="FINAL_PAYMENT">دفعة أخيرة</option>
          </Select>
        </FilterField>

        <FilterField label="المشروع" htmlFor="projectId">
          <Select id="projectId" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
            <option value="">كل المشاريع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{tx(p.name)}</option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="العميل" htmlFor="q">
          <Input
            id="q"
            name="q"
            inputSize="sm"
            placeholder="ابحث باسم العميل"
            defaultValue={sp.q ?? ''}
          />
        </FilterField>

        <FilterField label="المرجع" htmlFor="ref">
          <Input
            id="ref"
            name="ref"
            inputSize="sm"
            placeholder="رقم العقد أو الحجز"
            defaultValue={sp.ref ?? ''}
          />
        </FilterField>

        <FilterField label="تاريخ الدفع من" htmlFor="paidAtFrom">
          <Input
            id="paidAtFrom"
            name="paidAtFrom"
            type="date"
            inputSize="sm"
            defaultValue={sp.paidAtFrom ?? ''}
          />
        </FilterField>

        <FilterField label="تاريخ الدفع إلى" htmlFor="paidAtTo">
          <Input
            id="paidAtTo"
            name="paidAtTo"
            type="date"
            inputSize="sm"
            defaultValue={sp.paidAtTo ?? ''}
          />
        </FilterField>

        <FilterField label="تاريخ الاستحقاق من" htmlFor="dueDateFrom">
          <Input
            id="dueDateFrom"
            name="dueDateFrom"
            type="date"
            inputSize="sm"
            defaultValue={sp.dueDateFrom ?? ''}
          />
        </FilterField>

        <FilterField label="تاريخ الاستحقاق إلى" htmlFor="dueDateTo">
          <Input
            id="dueDateTo"
            name="dueDateTo"
            type="date"
            inputSize="sm"
            defaultValue={sp.dueDateTo ?? ''}
          />
        </FilterField>

        <FilterField label="التحقق" htmlFor="verified">
          <Select id="verified" name="verified" inputSize="sm" defaultValue={sp.verified ?? ''}>
            <option value="">الكل</option>
            <option value="true">متحقق</option>
            <option value="false">غير متحقق</option>
          </Select>
        </FilterField>

        <div className="flex items-end gap-2">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          <Link href="/dashboard/deposits">
            <Button type="button" variant="secondary" size="sm">إعادة تعيين</Button>
          </Link>
        </div>
      </FilterBar>

      {depositsRes.error && (
        <div className="rounded-lg bg-red-50 text-red-700 p-4 text-sm">{depositsRes.error}</div>
      )}

      {deposits && (
        <>
          <DataTable
            rowKey={(d) => d.id}
            rows={deposits.data}
            emptyMessage="لا توجد دفعات تطابق الفلاتر المختارة"
            columns={[
              {
                key: 'type',
                header: 'نوع الدفعة',
                cell: (d) => {
                  const type = d.type ?? 'INSTALLMENT';
                  return (
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${DEPOSIT_TYPE_CLS[type as DepositType] ?? 'bg-slate-100 text-slate-600'}`}
                    >
                      {DEPOSIT_TYPE_LABELS[type as DepositType] ?? type}
                    </span>
                  );
                },
              },
              {
                key: 'customer',
                header: 'العميل',
                cell: (d) => getCustomerName(d),
              },
              {
                key: 'unit',
                header: 'الوحدة',
                cell: (d) => (
                  <span className="font-mono text-xs">{getUnitCode(d)}</span>
                ),
              },
              {
                key: 'reference',
                header: 'المرجع',
                cell: (d) => {
                  if (d.contractId && d.contract) {
                    return (
                      <Link
                        href={`/dashboard/contracts/${d.contractId}`}
                        className="text-brand-600 hover:underline text-xs font-mono"
                      >
                        {d.contract.contractNumber ?? `#${d.contractId.slice(0, 8)}`}
                      </Link>
                    );
                  }
                  if (d.reservationId && d.reservation) {
                    return (
                      <Link
                        href={`/dashboard/reservations/${d.reservationId}`}
                        className="text-indigo-600 hover:underline text-xs font-mono"
                      >
                        {d.reservation.reservationNumber ?? `#${d.reservationId.slice(0, 8)}`}
                      </Link>
                    );
                  }
                  return <span className="text-slate-400 text-xs">—</span>;
                },
              },
              {
                key: 'dueDate',
                header: 'تاريخ الاستحقاق',
                cell: (d) => {
                  const date = getDueDate(d);
                  if (!date) return <span className="text-xs text-slate-400">—</span>;
                  return (
                    <span className="text-xs text-slate-600" title={getDueDateTitle(d)}>
                      {formatDate(date)}
                    </span>
                  );
                },
              },
              { key: 'amount', header: 'المبلغ', cell: (d) => formatCurrency(d.amount) },
              { key: 'paidAt', header: 'تاريخ الدفع', cell: (d) => formatDate(d.paidAt) },
              {
                key: 'receipt',
                header: 'الإيصال',
                cell: (d) =>
                  d.receiptUrl ? (
                    <a
                      href={d.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:underline text-xs"
                    >
                      عرض
                    </a>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'verified',
                header: 'التحقق',
                cell: (d) => (
                  <VerifyToggle id={d.id} contractId={d.contractId ?? null} verified={d.verified} />
                ),
              },
            ]}
          />

          <Pagination
            basePath="/dashboard/deposits"
            page={page}
            pageSize={pageSize}
            total={deposits.meta.total}
            params={{
              type: sp.type,
              projectId: sp.projectId,
              q: sp.q,
              ref: sp.ref,
              paidAtFrom: sp.paidAtFrom,
              paidAtTo: sp.paidAtTo,
              dueDateFrom: sp.dueDateFrom,
              dueDateTo: sp.dueDateTo,
              verified: sp.verified,
            }}
          />
        </>
      )}
    </div>
  );
}
