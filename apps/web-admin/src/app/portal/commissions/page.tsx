import Link from 'next/link';
import { BadgePercent, Eye } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  Paged,
  PortalCommission,
  PortalProject,
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
  status?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 20;

export default async function PortalCommissionsPage({
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
  for (const key of ['status', 'projectId', 'from', 'to'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [commRes, projectsRes] = await Promise.all([
    safe(api.get<Paged<PortalCommission>>(`/portal/commissions?${qs.toString()}`)),
    safe(api.get<PortalProject[]>('/portal/projects')),
  ]);

  const paged = commRes.data;
  const rows = paged?.data ?? [];
  const projects = projectsRes.data ?? [];

  const totalGross = rows.reduce(
    (sum, r) => sum + Number(r.grossAmount || 0),
    0,
  );
  const totalNet = rows.reduce((sum, r) => sum + Number(r.netAmount || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="عمولاتي"
        description="العمولات المستحقة من العقود الموقّعة، مع حالة كل عمولة."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'العمولات' },
        ]}
        meta={
          rows.length > 0 ? (
            <span className="text-xs text-slate-600 tabular-nums">
              في هذه الصفحة — إجمالي: {formatCurrency(totalGross)} • صافي:{' '}
              {formatCurrency(totalNet)}
            </span>
          ) : undefined
        }
      />

      {commRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل العمولات: {commRes.error}
        </div>
      )}

      <form
        method="get"
        action="/portal/commissions"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 shadow-xs"
      >
        <Select
          name="status"
          inputSize="sm"
          defaultValue={sp.status ?? ''}
          className="w-44 shrink-0"
        >
          <option value="">كل الحالات</option>
          <option value="PENDING">قيد المراجعة</option>
          <option value="APPROVED">موافق عليها</option>
          <option value="REJECTED">مرفوضة</option>
          <option value="CANCELLED">ملغاة</option>
        </Select>
        <Select
          name="projectId"
          inputSize="sm"
          defaultValue={sp.projectId ?? ''}
          className="w-56 shrink-0"
        >
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.project.id} value={p.project.id}>
              {tx(p.project.name)}
            </option>
          ))}
        </Select>
        <Input
          name="from"
          inputSize="sm"
          type="date"
          defaultValue={sp.from ?? ''}
          className="w-40 shrink-0"
        />
        <Input
          name="to"
          inputSize="sm"
          type="date"
          defaultValue={sp.to ?? ''}
          className="w-40 shrink-0"
        />
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">
            تصفية
          </Button>
          {(sp.status || sp.projectId || sp.from || sp.to) && (
            <Link href="/portal/commissions">
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
                <th className="text-start font-semibold py-3 px-4">العقد</th>
                <th className="text-start font-semibold py-3 px-4">الوحدة / المشروع</th>
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
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      icon={<BadgePercent />}
                      title="لا توجد عمولات بعد"
                      description="تظهر هنا فور توقيع أول عقد منبثق من حجوزاتك."
                    />
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-hairline hover:bg-surface-muted/40 transition-colors"
                >
                  <td className="py-3 ps-5 pe-4 font-mono text-xs text-slate-700" dir="ltr">
                    {c.commissionNumber}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 font-mono" dir="ltr">
                    {c.contract?.contractNumber ?? '—'}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono text-xs text-slate-700" dir="ltr">
                      {c.unit?.code ?? '—'}
                    </p>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      {c.project ? tx(c.project.name) : '—'}
                    </p>
                  </td>
                  <td className="py-3 px-4 tabular-nums">
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
                    <Link href={`/portal/commissions/${c.id}` as never}>
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
            basePath="/portal/commissions"
            params={{
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
