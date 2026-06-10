import Link from 'next/link';
import { FileText, Eye, Briefcase, CheckCircle2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  AdminBrokerContract,
  Broker,
  Paged,
  Project,
  User,
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

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  brokerId?: string;
  projectId?: string;
  salesId?: string;
  signed?: string;
  dateFrom?: string;
  dateTo?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerContractsPage({
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
  for (const key of ['brokerId', 'projectId', 'salesId', 'signed', 'dateFrom', 'dateTo'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [contractsRes, brokersRes, projectsRes, salesRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerContract>>(`/broker-contracts?${qs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
    safe(api.get<Paged<User>>('/users?role=SALES,SALES_MANAGER&pageSize=200')),
  ]);

  const paged = contractsRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];
  const projects = projectsRes.data?.data ?? [];
  const salesUsers = salesRes.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="عقود من الوسطاء"
        description="عقود بيع العملاء الناتجة عن حجوزات أرسلها الوسطاء."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'عقود من الوسطاء' },
        ]}
        actions={
          <Link href="/dashboard/broker-reservations?status=APPROVED">
            <Button variant="outline" size="md">
              تحويل حجز وسيط إلى عقد
            </Button>
          </Link>
        }
      />

      {contractsRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل العقود: {contractsRes.error}
        </div>
      )}

      <form
        method="get"
        action="/dashboard/broker-contracts"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2.5 shadow-xs"
      >
        <Select name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''} className="w-44 shrink-0">
          <option value="">كل الوسطاء</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.companyName}
            </option>
          ))}
        </Select>
        <Select name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''} className="w-40 shrink-0">
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {tx(p.name)}
            </option>
          ))}
        </Select>
        <Select name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''} className="w-44 shrink-0">
          <option value="">كل المندوبين</option>
          {salesUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </Select>
        <Select name="signed" inputSize="sm" defaultValue={sp.signed ?? ''} className="w-36 shrink-0">
          <option value="">كل العقود</option>
          <option value="yes">موقعة</option>
          <option value="no">قيد التوقيع</option>
        </Select>
        <Input
          name="dateFrom"
          inputSize="sm"
          type="date"
          defaultValue={sp.dateFrom ?? ''}
          className="w-36 shrink-0"
        />
        <Input
          name="dateTo"
          inputSize="sm"
          type="date"
          defaultValue={sp.dateTo ?? ''}
          className="w-36 shrink-0"
        />
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          {Object.values(sp).some(Boolean) && (
            <Link href="/dashboard/broker-contracts">
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
                <th className="text-start font-semibold py-3 ps-5 pe-4">رقم العقد</th>
                <th className="text-start font-semibold py-3 px-4">الوسيط</th>
                <th className="text-start font-semibold py-3 px-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">الوحدة</th>
                <th className="text-start font-semibold py-3 px-4">القيمة</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">المندوب</th>
                <th className="text-start font-semibold py-3 px-4">العمولة المُقفلة</th>
                <th className="text-start font-semibold py-3 px-4">التاريخ</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-0">
                    <EmptyState
                      icon={<FileText />}
                      title="لا توجد عقود من الوسطاء"
                      description="ستظهر هنا عقود البيع التي تم إنشاؤها من حجوزات ناتجة عن الوسطاء."
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
                    {c.contractNumber ?? '—'}
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
                    <p className="font-medium text-slate-900">
                      {c.customer?.fullName ?? c.reservation?.lead?.fullName ?? '—'}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono text-xs text-slate-700" dir="ltr">
                      {c.unit?.code ?? '—'}
                    </p>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      {c.unit?.building ? tx(c.unit.building.phase.project.name) : '—'}
                    </p>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(c.totalAmount)}
                  </td>
                  <td className="py-3 px-4">
                    {c.signedAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 text-success-700 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                        موقع
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-warning-50 text-warning-700 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                        قيد التوقيع
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    {c.reservation?.sales?.fullName ?? '—'}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700">
                    {c.reservation?.commissionLockedPct !== null &&
                      c.reservation?.commissionLockedPct !== undefined && (
                        <p>{Number(c.reservation.commissionLockedPct).toFixed(2)}%</p>
                      )}
                    {c.reservation?.commissionLockedAmount !== null &&
                      c.reservation?.commissionLockedAmount !== undefined && (
                        <p className="text-2xs text-slate-500 mt-0.5">
                          {formatCurrency(c.reservation.commissionLockedAmount)}
                        </p>
                      )}
                  </td>
                  <td className="py-3 px-4 text-2xs text-slate-500">
                    {formatDate(c.createdAt)}
                  </td>
                  <td className="py-3 ps-4 pe-5">
                    <Link href={`/dashboard/contracts/${c.id}` as never}>
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
            basePath="/dashboard/broker-contracts"
            params={{
              brokerId: sp.brokerId,
              projectId: sp.projectId,
              salesId: sp.salesId,
              signed: sp.signed,
              dateFrom: sp.dateFrom,
              dateTo: sp.dateTo,
            }}
          />
        )}
      </Card>
    </div>
  );
}
