import Link from 'next/link';
import { Users, Eye, Phone, Briefcase } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  AdminBrokerLead,
  Broker,
  Paged,
  Project,
} from '@/lib/types';
import { tx, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
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
    'q',
  ] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [leadsRes, brokersRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerLead>>(`/broker-leads?${qs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
  ]);

  const paged = leadsRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];
  const projects = projectsRes.data?.data ?? [];

  // Page-scoped counts (current page rows only)
  const counts = {
    pending: rows.filter((r) => r.brokerApprovalStatus === 'PENDING').length,
    approved: rows.filter((r) => r.brokerApprovalStatus === 'APPROVED').length,
    rejected: rows.filter((r) => r.brokerApprovalStatus === 'REJECTED').length,
    duplicate: rows.filter((r) => r.brokerApprovalStatus === 'DUPLICATE').length,
    noSales: rows.filter((r) => !r.assignedSales).length,
  };

  const totalLeads = paged?.meta.total ?? 0;

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
      />

      {/* Status summary strip — page-scoped counts */}
      {paged && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
          {/* Total — most prominent element in the strip */}
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xl font-bold text-slate-900 tabular-nums leading-none">{totalLeads}</span>
            <span className="text-2xs font-medium text-slate-400">فرصة</span>
          </div>

          <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />

          {/* Status breakdown — always render all 4 so zero counts are visible */}
          <div className="flex flex-wrap items-center gap-1.5">
            <ReviewChip label="قيد المراجعة" count={counts.pending} className="bg-warning-50 text-warning-700" />
            <ReviewChip label="موافق عليه" count={counts.approved} className="bg-success-50 text-success-700" />
            <ReviewChip label="مرفوض" count={counts.rejected} className="bg-danger-50 text-danger-700" />
            <ReviewChip label="مكرر" count={counts.duplicate} className="bg-purple-50 text-purple-700" />
            {counts.noSales > 0 && (
              <ReviewChip label="بدون مندوب" count={counts.noSales} className="bg-slate-100 text-slate-500" />
            )}
          </div>

          <span className="ms-auto text-2xs text-slate-400 hidden sm:inline">في هذه الصفحة</span>
        </div>
      )}

      {leadsRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الفرص: {leadsRes.error}
        </div>
      )}

      {/* Filter bar */}
      <form
        method="get"
        action="/dashboard/broker-leads"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2.5 shadow-xs"
      >
        <Input
          name="q"
          inputSize="sm"
          placeholder="بحث: اسم / هاتف / بريد"
          defaultValue={sp.q ?? ''}
          className="w-52 shrink-0"
        />
        <Select
          name="brokerId"
          inputSize="sm"
          defaultValue={sp.brokerId ?? ''}
          className="w-44 shrink-0"
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
          className="w-44 shrink-0"
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
          className="w-36 shrink-0"
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
          className="w-40 shrink-0"
        >
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {tx(p.name)}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1.5 ms-auto">
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

      {/* Lead review queue */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 border-b border-hairline text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">الوسيط</th>
                <th className="text-start font-semibold py-3 px-4">المشروع</th>
                <th className="text-start font-semibold py-3 px-4">المراجعة</th>
                <th className="text-start font-semibold py-3 px-4">المرحلة</th>
                <th className="text-start font-semibold py-3 px-4">المبيعات</th>
                <th className="text-start font-semibold py-3 px-4">التاريخ</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
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
                  className="align-middle hover:bg-surface-muted/40 transition-colors"
                >
                  {/* Client */}
                  <td className="py-3.5 ps-5 pe-4">
                    <p className="font-semibold text-slate-900 truncate max-w-[180px]">
                      {l.fullName}
                    </p>
                    <span
                      className="mt-0.5 inline-flex items-center gap-1 text-2xs text-slate-400"
                      dir="ltr"
                    >
                      <Phone className="h-3 w-3 shrink-0" />
                      {l.phone}
                    </span>
                  </td>

                  {/* Broker */}
                  <td className="py-3.5 px-4">
                    <Link
                      href={`/dashboard/brokers/${l.brokerId}` as never}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-brand-700 transition-colors"
                    >
                      <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[160px]">
                        {l.broker?.companyName ?? '—'}
                      </span>
                    </Link>
                    {l.brokerAgent && (
                      <p className="text-2xs text-slate-400 mt-0.5 truncate max-w-[180px] ps-5">
                        {l.brokerAgent.fullName}
                      </p>
                    )}
                  </td>

                  {/* Project */}
                  <td className="py-3.5 px-4">
                    <p className="text-slate-600 text-sm truncate max-w-[180px]">
                      {l.projectInterest ? (
                        tx(l.projectInterest.name)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </p>
                    {l.unitInterest && (
                      <p className="text-2xs text-slate-400 font-mono mt-0.5" dir="ltr">
                        {l.unitInterest.code}
                      </p>
                    )}
                  </td>

                  {/* Review status */}
                  <td className="py-3.5 px-4">
                    {l.brokerApprovalStatus ? (
                      <BrokerLeadStatusBadge status={l.brokerApprovalStatus} />
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>

                  {/* Stage */}
                  <td className="py-3.5 px-4">
                    <LeadStageBadge stage={l.stage} />
                  </td>

                  {/* Assigned sales */}
                  <td className="py-3.5 px-4">
                    {l.assignedSales ? (
                      <span className="block text-xs text-slate-700 truncate max-w-[140px]">
                        {l.assignedSales.fullName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-400">
                        غير معيّن
                      </span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 text-2xs text-slate-400 whitespace-nowrap">
                    {formatDate(l.brokerSubmittedAt ?? l.createdAt)}
                  </td>

                  {/* Action */}
                  <td className="py-3.5 ps-4 pe-5">
                    <Link href={`/dashboard/broker-leads/${l.id}` as never}>
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
            basePath="/dashboard/broker-leads"
            params={{
              q: sp.q,
              brokerId: sp.brokerId,
              brokerApprovalStatus: sp.brokerApprovalStatus,
              stage: sp.stage,
              projectId: sp.projectId,
            }}
          />
        )}
      </Card>
    </div>
  );
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function ReviewChip({
  label,
  count,
  className,
}: {
  label: string;
  count: number;
  className: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
      <span className="font-bold tabular-nums">{count}</span>
    </span>
  );
}
