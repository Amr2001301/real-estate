import Link from 'next/link';
import { Users, Eye, Mail, Phone, Briefcase } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  AdminBrokerLead,
  Broker,
  Paged,
  Project,
  User,
} from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import {
  BrokerLeadStatusBadge,
  LeadStageBadge,
} from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  brokerId?: string;
  brokerApprovalStatus?: string;
  stage?: string;
  projectId?: string;
  assignedSalesId?: string;
  q?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerLeadsPage({
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
  for (const key of [
    'brokerId',
    'brokerApprovalStatus',
    'stage',
    'projectId',
    'assignedSalesId',
    'q',
  ] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [leadsRes, brokersRes, projectsRes, salesRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerLead>>(`/broker-leads?${qs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
    safe(api.get<Paged<User>>('/users?role=SALES&pageSize=200')),
  ]);

  const paged = leadsRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];
  const projects = projectsRes.data?.data ?? [];
  const salesUsers = salesRes.data?.data ?? [];

  const counts = {
    pending: rows.filter((r) => r.brokerApprovalStatus === 'PENDING').length,
    approved: rows.filter((r) => r.brokerApprovalStatus === 'APPROVED').length,
    rejected: rows.filter((r) => r.brokerApprovalStatus === 'REJECTED').length,
    duplicate: rows.filter((r) => r.brokerApprovalStatus === 'DUPLICATE').length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="فرص من الوسطاء"
        description="فرص أرسلها الوسطاء وتحتاج إلى مراجعة الإدارة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'فرص من الوسطاء' },
        ]}
        meta={
          <span className="text-xs text-slate-500">
            في هذه الصفحة: قيد المراجعة {counts.pending} • معتمد {counts.approved}{' '}
            • مرفوض {counts.rejected} • مكرر {counts.duplicate}
          </span>
        }
      />

      {leadsRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الفرص: {leadsRes.error}
        </div>
      )}

      <form
        method="get"
        action="/dashboard/broker-leads"
        className="rounded-xl border border-hairline bg-white p-3 shadow-xs grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2"
      >
        <Input
          name="q"
          inputSize="sm"
          placeholder="بحث: اسم / هاتف / بريد"
          defaultValue={sp.q ?? ''}
          className="md:col-span-2"
        />
        <Select
          name="brokerId"
          inputSize="sm"
          defaultValue={sp.brokerId ?? ''}
        >
          <option value="">كل الوسطاء</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.companyName}
            </option>
          ))}
        </Select>
        <Select
          name="brokerApprovalStatus"
          inputSize="sm"
          defaultValue={sp.brokerApprovalStatus ?? ''}
        >
          <option value="">كل حالات المراجعة</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="APPROVED">موافق عليه</option>
          <option value="REJECTED">مرفوض</option>
          <option value="DUPLICATE">مكرر</option>
        </Select>
        <Select
          name="stage"
          inputSize="sm"
          defaultValue={sp.stage ?? ''}
        >
          <option value="">كل المراحل</option>
          <option value="NEW">جديد</option>
          <option value="INTERESTED">مهتم</option>
          <option value="VISIT">زيارة</option>
          <option value="NEGOTIATION">تفاوض</option>
          <option value="WON">فوز</option>
          <option value="LOST">خسارة</option>
        </Select>
        <Select
          name="projectId"
          inputSize="sm"
          defaultValue={sp.projectId ?? ''}
        >
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {tx(p.name)}
            </option>
          ))}
        </Select>
        <Select
          name="assignedSalesId"
          inputSize="sm"
          defaultValue={sp.assignedSalesId ?? ''}
        >
          <option value="">كل المبيعات</option>
          {salesUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </Select>
        <div className="col-span-2 md:col-span-1 flex items-center gap-1.5 justify-end ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          {Object.values(sp).some(Boolean) && (
            <Link href="/dashboard/broker-leads">
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
                <th className="text-start font-semibold py-3 ps-5 pe-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">الوسيط</th>
                <th className="text-start font-semibold py-3 px-4">المشروع</th>
                <th className="text-start font-semibold py-3 px-4">المراجعة</th>
                <th className="text-start font-semibold py-3 px-4">المرحلة</th>
                <th className="text-start font-semibold py-3 px-4">المبيعات</th>
                <th className="text-start font-semibold py-3 px-4">التاريخ</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      icon={<Users />}
                      title="لا توجد فرص من الوسطاء"
                      description="ستظهر هنا فور إرسال الوسطاء أول فرصة."
                    />
                  </td>
                </tr>
              )}
              {rows.map((l) => (
                <tr
                  key={l.id}
                  className="border-t border-hairline align-middle hover:bg-surface-muted/40 transition-colors"
                >
                  <td className="py-3 ps-5 pe-4">
                    <p className="font-semibold text-slate-900 truncate max-w-[180px]">
                      {l.fullName}
                    </p>
                    <div className="mt-0.5 flex flex-col gap-0.5 text-2xs text-slate-500" dir="ltr">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400 shrink-0" /> {l.phone}
                      </span>
                      {l.email && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{l.email}</span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/dashboard/brokers/${l.brokerId}` as never}
                      className="text-sm text-slate-900 hover:text-brand-700 inline-flex items-center gap-1.5"
                    >
                      <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[160px]">{l.broker?.companyName ?? '—'}</span>
                    </Link>
                    {l.brokerAgent && (
                      <p className="text-2xs text-slate-500 mt-0.5 truncate max-w-[180px]">
                        {l.brokerAgent.fullName}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-slate-700 truncate max-w-[180px]">
                      {l.projectInterest ? tx(l.projectInterest.name) : '—'}
                    </p>
                    {l.unitInterest && (
                      <p className="text-2xs text-slate-400 font-mono mt-0.5" dir="ltr">
                        {l.unitInterest.code}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {l.brokerApprovalStatus && (
                      <BrokerLeadStatusBadge status={l.brokerApprovalStatus} />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <LeadStageBadge stage={l.stage} />
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 truncate max-w-[140px]">
                    {l.assignedSales?.fullName ?? '—'}
                  </td>
                  <td className="py-3 px-4 text-2xs text-slate-500 whitespace-nowrap">
                    {formatDate(l.brokerSubmittedAt ?? l.createdAt)}
                  </td>
                  <td className="py-3 ps-4 pe-5">
                    <Link href={`/dashboard/broker-leads/${l.id}` as never}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        leftIcon={<Eye className="h-3.5 w-3.5" />}
                      >
                        عرض
                      </Button>
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
            basePath="/dashboard/broker-leads"
            params={{
              q: sp.q,
              brokerId: sp.brokerId,
              brokerApprovalStatus: sp.brokerApprovalStatus,
              stage: sp.stage,
              projectId: sp.projectId,
              assignedSalesId: sp.assignedSalesId,
            }}
          />
        )}
      </Card>
    </div>
  );
}
