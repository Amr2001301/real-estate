import Link from 'next/link';
import { BadgePercent, Eye, Briefcase } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  AdminBrokerCommission,
  Broker,
  Paged,
  Project,
} from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerCommissionStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  brokerId?: string;
  status?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  for (const key of ['brokerId', 'status', 'projectId', 'from', 'to'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [commRes, brokersRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerCommission>>(`/broker-commissions?${qs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

  const paged = commRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];
  const projects = projectsRes.data?.data ?? [];

  const counts = {
    pending: rows.filter((r) => r.status === 'PENDING').length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    rejected: rows.filter((r) => r.status === 'REJECTED').length,
    cancelled: rows.filter((r) => r.status === 'CANCELLED').length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="عمولات الوسطاء"
        description="عمولات تم احتسابها تلقائياً من العقود الموقّعة. تتطلب اعتماد الإدارة قبل الدفع."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'عمولات الوسطاء' },
        ]}
        meta={
          <span className="text-xs text-slate-500">
            في هذه الصفحة: قيد المراجعة {counts.pending} • موافق {counts.approved} •
            مرفوضة {counts.rejected} • ملغاة {counts.cancelled}
          </span>
        }
      />

      {commRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل العمولات: {commRes.error}
        </div>
      )}

      <form
        method="get"
        action="/dashboard/broker-commissions"
        className="rounded-xl border border-hairline bg-white p-3 shadow-xs grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2"
      >
        <Select name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''}>
          <option value="">كل الوسطاء</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.companyName}
            </option>
          ))}
        </Select>
        <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
          <option value="">كل الحالات</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="APPROVED">موافق عليها</option>
          <option value="REJECTED">مرفوضة</option>
          <option value="CANCELLED">ملغاة</option>
        </Select>
        <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {tx(p.name)}
            </option>
          ))}
        </Select>
        <Input
          name="from"
          inputSize="sm"
          type="date"
          defaultValue={sp.from ?? ''}
        />
        <Input
          name="to"
          inputSize="sm"
          type="date"
          defaultValue={sp.to ?? ''}
        />
        <div className="col-span-2 md:col-span-1 flex items-center gap-1.5 justify-end ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          {Object.values(sp).some(Boolean) && (
            <Link href="/dashboard/broker-commissions">
              <Button type="button" variant="ghost" size="sm">
                مسح
              </Button>
            </Link>
          )}
        </div>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">رقم العمولة</th>
                <th className="text-start font-semibold py-3 px-4">الوسيط</th>
                <th className="text-start font-semibold py-3 px-4">العقد</th>
                <th className="text-start font-semibold py-3 px-4">الوحدة / المشروع</th>
                <th className="text-start font-semibold py-3 px-4">الأساس</th>
                <th className="text-start font-semibold py-3 px-4">النسبة</th>
                <th className="text-start font-semibold py-3 px-4">إجمالي</th>
                <th className="text-start font-semibold py-3 px-4">صافي</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ الاستحقاق</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-0">
                    <EmptyState
                      icon={<BadgePercent />}
                      title="لا توجد عمولات بعد"
                      description="تُحتسب العمولات تلقائياً عند توقيع عقد منبثق من حجز وسيط."
                    />
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-hairline hover:bg-surface-muted/40 transition-colors align-top"
                >
                  <td className="py-3 ps-5 pe-4 font-mono text-xs text-slate-700" dir="ltr">
                    {c.commissionNumber}
                  </td>
                  <td className="py-3 px-4">
                    {c.broker ? (
                      <Link
                        href={`/dashboard/brokers/${c.broker.id}` as never}
                        className="text-sm text-slate-900 hover:text-brand-700 inline-flex items-center gap-1.5"
                      >
                        <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                        {c.broker.companyName}
                      </Link>
                    ) : (
                      '—'
                    )}
                    {c.brokerAgent && (
                      <p className="text-2xs text-slate-500 mt-0.5">
                        {c.brokerAgent.fullName}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/dashboard/contracts/${c.contractId}` as never}
                      className="font-mono text-xs text-slate-700 hover:text-brand-700"
                      dir="ltr"
                    >
                      {c.contract?.contractNumber ?? '—'}
                    </Link>
                    {c.reservation?.reservationNumber && (
                      <p className="text-2xs text-slate-500 mt-0.5 font-mono" dir="ltr">
                        من: {c.reservation.reservationNumber}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono text-xs text-slate-700" dir="ltr">
                      {c.unit?.code ?? '—'}
                    </p>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      {c.project ? tx(c.project.name) : '—'}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 tabular-nums">
                    {formatCurrency(c.basisAmount)}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700">
                    {c.commissionPct !== null && c.commissionPct !== undefined
                      ? `${Number(c.commissionPct).toFixed(2)}%`
                      : '—'}
                  </td>
                  <td className="py-3 px-4 font-medium tabular-nums">
                    {formatCurrency(c.grossAmount)}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(c.netAmount)}
                  </td>
                  <td className="py-3 px-4">
                    <BrokerCommissionStatusBadge status={c.status} />
                  </td>
                  <td className="py-3 px-4 text-2xs text-slate-500">
                    {formatDate(c.earnedAt)}
                  </td>
                  <td className="py-3 ps-4 pe-5">
                    <Link href={`/dashboard/broker-commissions/${c.id}` as never}>
                      <IconButton label="عرض" variant="ghost" size="sm">
                        <Eye />
                      </IconButton>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/dashboard/broker-commissions"
            params={{
              brokerId: sp.brokerId,
              status: sp.status,
              projectId: sp.projectId,
              from: sp.from,
              to: sp.to,
            }}
          />
        )}
      </Card>
    </div>
  );
}
