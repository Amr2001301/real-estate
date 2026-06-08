import Link from 'next/link';
import { Plus, FileText, CheckCircle2, Link2, Unlink, Eye } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import type { Paged } from '@/lib/types';
import { formatCurrency, formatDate, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Pagination } from '@/components/ui/pagination';
import { DataTable } from '@/components/table';

export const dynamic = 'force-dynamic';

interface ContractRow {
  id: string;
  contractNumber: string | null;
  totalAmount: string | number;
  downPayment: string | number;
  signedAt: string | null;
  createdAt: string;
  customer: { id: string; fullName: string; phone: string | null } | null;
  unit: {
    id: string;
    code: string;
    type: string;
    building?: {
      phase?: {
        project?: { id: string; name: { ar: string; en: string } } | null;
      } | null;
    } | null;
  } | null;
  reservation: { id: string; reservationNumber: string | null } | null;
  installmentPlan: {
    id: string;
    totalMonths: number;
    monthlyAmount: string | number;
  } | null;
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    signed?: string;
    hasReservation?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);
  const pageSize = 20;

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (sp.q) qs.set('q', sp.q);
  if (sp.signed) qs.set('signed', sp.signed);
  if (sp.hasReservation) qs.set('hasReservation', sp.hasReservation);

  const [contractsRes, allRes] = await Promise.all([
    safe(api.get<Paged<ContractRow>>(`/contracts?${qs}`)),
    safe(api.get<Paged<ContractRow>>('/contracts?pageSize=1')),
  ]);

  const contracts = contractsRes.data?.data ?? [];
  const meta = contractsRes.data?.meta;
  const totalContracts = allRes.data?.meta.total ?? 0;

  // Derive KPI counts from current filtered set for signed / reservation stats
  // (approximate — full count would need a dedicated stats endpoint)
  const signedCount = contracts.filter((c) => c.signedAt).length;
  const withReservationCount = contracts.filter((c) => c.reservation).length;

  // Manual contract creation (contracts:upload) is ADMIN-only; SALES reads.
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';

  return (
    <div className="space-y-5">
      <PageHeader
        title="العقود"
        description="عرض وإدارة عقود البيع المرتبطة بالوحدات والعملاء."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'العقود' },
        ]}
        actions={
          isAdmin ? (
            <Link href="/dashboard/contracts/new">
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                عقد يدوي
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <PageKpiCard
          label="إجمالي العقود"
          value={totalContracts}
          icon={<FileText />}
          tone="brand"
        />
        <PageKpiCard
          label="عقود موقّعة (الصفحة الحالية)"
          value={signedCount}
          icon={<CheckCircle2 />}
          tone="success"
          sub={`من ${contracts.length} عقد في هذه الصفحة`}
        />
        <PageKpiCard
          label="محوّلة من حجز (الصفحة الحالية)"
          value={withReservationCount}
          icon={<Link2 />}
          tone="info"
          sub={`من ${contracts.length} عقد في هذه الصفحة`}
        />
      </div>

      {/* Filter strip */}
      <form method="get" action="/dashboard/contracts" className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-white px-3 py-2.5 shadow-soft">
        <Input
          name="q"
          inputSize="sm"
          placeholder="رقم العقد، العميل، الوحدة…"
          defaultValue={sp.q ?? ''}
          className="flex-1 min-w-[160px]"
        />
        <Select name="signed" inputSize="sm" defaultValue={sp.signed ?? ''} className="w-36 shrink-0">
          <option value="">كل التوقيع</option>
          <option value="yes">موقّع</option>
          <option value="no">غير موقّع</option>
        </Select>
        <Select name="hasReservation" inputSize="sm" defaultValue={sp.hasReservation ?? ''} className="w-36 shrink-0">
          <option value="">كل المصادر</option>
          <option value="yes">من حجز</option>
          <option value="no">يدوي</option>
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {(sp.q || sp.signed || sp.hasReservation) && (
            <Link href="/dashboard/contracts">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      {contractsRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {contractsRes.error}
        </div>
      )}

      <DataTable
        rowKey={(c) => c.id}
        rows={contracts}
        emptyMessage="لا توجد عقود تطابق الفلاتر الحالية"
        columns={[
          {
            key: 'number',
            header: 'رقم العقد',
            cell: (c) => (
              <Link
                href={`/dashboard/contracts/${c.id}`}
                title="عرض تفاصيل العقد"
                className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors"
              >
                {c.contractNumber ?? c.id.slice(0, 8)}
              </Link>
            ),
          },
          {
            key: 'customer',
            header: 'العميل',
            cell: (c) => (
              <div>
                <p className="font-medium text-slate-900">{c.customer?.fullName ?? '—'}</p>
                {c.customer?.phone && (
                  <p className="text-xs text-slate-500 font-mono" dir="ltr">{c.customer.phone}</p>
                )}
              </div>
            ),
          },
          {
            key: 'unit',
            header: 'الوحدة',
            cell: (c) => (
              <div>
                <p className="font-medium">{c.unit?.code ?? '—'} · {c.unit?.type ?? ''}</p>
                <p className="text-xs text-slate-400">
                  {tx(c.unit?.building?.phase?.project?.name) || '—'}
                </p>
              </div>
            ),
          },
          {
            key: 'amounts',
            header: 'الإجمالي / المقدم',
            cell: (c) => (
              <div className="tabular-nums text-sm">
                <p className="font-semibold">{formatCurrency(c.totalAmount)}</p>
                {Number(c.downPayment) > 0 && (
                  <p className="text-xs text-slate-400">مقدم: {formatCurrency(c.downPayment)}</p>
                )}
              </div>
            ),
          },
          {
            key: 'plan',
            header: 'خطة التقسيط',
            cell: (c) =>
              c.installmentPlan ? (
                <span className="inline-flex items-center gap-1 text-xs text-success-700 bg-success-50 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  {c.installmentPlan.totalMonths} شهر
                </span>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              ),
          },
          {
            key: 'source',
            header: 'المصدر',
            cell: (c) =>
              c.reservation ? (
                <Link
                  href={`/dashboard/reservations/${c.reservation.id}`}
                  className="inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 transition-colors"
                >
                  <Link2 className="h-3 w-3" />
                  {c.reservation.reservationNumber ?? c.reservation.id.slice(0, 8)}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Unlink className="h-3 w-3" />
                  يدوي
                </span>
              ),
          },
          {
            key: 'signed',
            header: 'التوقيع',
            cell: (c) =>
              c.signedAt ? (
                <span className="text-xs text-success-700">{formatDate(c.signedAt)}</span>
              ) : (
                <span className="text-xs text-slate-400">غير موقّع</span>
              ),
          },
          {
            key: 'created',
            header: 'تاريخ الإنشاء',
            cell: (c) => <span className="text-xs text-slate-500">{formatDate(c.createdAt)}</span>,
          },
          {
            key: 'actions',
            header: '',
            cell: (c) => (
              <Link href={`/dashboard/contracts/${c.id}`}>
                <IconButton label="عرض تفاصيل العقد" variant="outline" size="sm">
                  <Eye />
                </IconButton>
              </Link>
            ),
          },
        ]}
      />

      {meta && (
        <Pagination
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          basePath="/dashboard/contracts"
          params={{ q: sp.q, signed: sp.signed, hasReservation: sp.hasReservation }}
        />
      )}
    </div>
  );
}
