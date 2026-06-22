import Link from 'next/link';
import {
  BadgePercent,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalCommission, PortalProject } from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/icon-button';
import { CodeText } from '@/components/ui/code-text';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerCommissionStatusBadge } from '@/components/badges';
import { CommissionsFilterBar } from '@/components/broker/commissions-filter-bar';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumSectionCard,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  q?: string;
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

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const key of ['q', 'status', 'projectId', 'from', 'to'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [commRes, projectsRes, rPending, rApproved, rRejected] = await Promise.all([
    safe(api.get<Paged<PortalCommission>>(`/portal/commissions?${qs.toString()}`)),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalCommission>>('/portal/commissions?page=1&pageSize=1&status=PENDING')),
    safe(api.get<Paged<PortalCommission>>('/portal/commissions?page=1&pageSize=1&status=APPROVED')),
    safe(api.get<Paged<PortalCommission>>('/portal/commissions?page=1&pageSize=1&status=REJECTED')),
  ]);

  const paged         = commRes.data;
  const rows          = paged?.data ?? [];
  const projects      = projectsRes.data ?? [];
  const pendingCount  = rPending.data?.meta.total  ?? 0;
  const approvedCount = rApproved.data?.meta.total ?? 0;
  const rejectedCount = rRejected.data?.meta.total ?? 0;

  const pageGross = rows.reduce((sum, r) => sum + Number(r.grossAmount || 0), 0);
  const pageNet   = rows.reduce((sum, r) => sum + Number(r.netAmount   || 0), 0);

  return (
    <div className="space-y-5">

      <PremiumPageHero
        title="عمولاتي"
        description="العمولات المستحقة من العقود الموقّعة — تتبّع الإجمالي والصافي وحالة كل عمولة."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'العمولات' },
        ]}
      />

      {commRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          تعذر تحميل العمولات: {commRes.error}
        </div>
      )}

      <PremiumMetricStrip
        variant="compact"
        metrics={[
          { label: 'إجمالي العمولات', value: paged?.meta.total ?? 0, icon: <BadgePercent />, tone: 'brand'   },
          { label: 'قيد الاعتماد',   value: pendingCount,           icon: <Clock />,        tone: 'warning' },
          { label: 'معتمدة',         value: approvedCount,          icon: <CheckCircle2 />, tone: 'success' },
          { label: 'مرفوضة',         value: rejectedCount,          icon: <XCircle />,      tone: 'danger'  },
        ]}
      />

      <CommissionsFilterBar projects={projects} sp={{ q: sp.q, status: sp.status, projectId: sp.projectId, from: sp.from, to: sp.to }} />

      <PremiumSectionCard
        icon={<BadgePercent />}
        title="قائمة العمولات"
        padded={false}
      >
        {rows.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
              <span>عمولة</span>
            </div>
            {pageGross > 0 && (
              <>
                <div className="w-px h-4 bg-hairline" />
                <span>
                  إجمالي:{' '}
                  <span className="font-semibold text-slate-700 tabular-nums">{formatCurrency(pageGross)}</span>
                </span>
                <div className="w-px h-4 bg-hairline" />
                <span>
                  صافي:{' '}
                  <span className="font-semibold text-success-700 tabular-nums">{formatCurrency(pageNet)}</span>
                </span>
              </>
            )}
          </div>
        )}

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">الوحدة / المشروع</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">الصافي</th>
                <th className="text-start font-semibold py-3 px-4">المرجع</th>
                <th className="text-start font-semibold py-3 px-4">تاريخ الاستحقاق</th>
                <th className="py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={<BadgePercent />}
                      title="لا توجد عمولات بعد"
                      description="تظهر هنا فور توقيع أول عقد منبثق من حجوزاتك."
                    />
                  </td>
                </tr>
              )}
              {rows.map((c) => {
                const netAmt    = Number(c.netAmount   || 0);
                const grossAmt  = Number(c.grossAmount || 0);
                const deduction = grossAmt > 0 ? ((grossAmt - netAmt) / grossAmt) * 100 : 0;
                const isApproved = c.status === 'APPROVED';

                return (
                  <tr
                    key={c.id}
                    className={cn(
                      'border-t border-hairline transition-colors align-top',
                      isApproved
                        ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                        : 'hover:bg-surface-muted/40',
                    )}
                  >
                    <td className="py-3 ps-5 pe-4">
                      <CodeText className="text-xs font-semibold text-slate-800">{c.unit?.code ?? '—'}</CodeText>
                      <p className="text-2xs text-slate-500 mt-0.5">
                        {c.project ? tx(c.project.name) : '—'}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <BrokerCommissionStatusBadge status={c.status} />
                    </td>

                    <td className="py-3 px-4">
                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                        {formatCurrency(c.netAmount)}
                      </p>
                      <p className="text-2xs text-slate-400 mt-0.5 tabular-nums">
                        من {formatCurrency(c.grossAmount)}
                        {deduction > 0.1 && ` · خصم ${deduction.toFixed(1)}%`}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-2xs text-brand-700">
                        <BadgePercent className="h-3 w-3 shrink-0" />
                        <CodeText>{c.commissionNumber}</CodeText>
                      </span>
                      {c.contract?.contractNumber && (
                        <p className="mt-0.5">
                          <CodeText className="text-2xs text-slate-400">{c.contract.contractNumber}</CodeText>
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4 text-2xs text-slate-500 whitespace-nowrap">
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
                );
              })}
            </tbody>
          </table>
        </div>

        {paged && paged.meta.total > PAGE_SIZE && (
          <Pagination
            page={paged.meta.page}
            pageSize={paged.meta.pageSize}
            total={paged.meta.total}
            basePath="/portal/commissions"
            params={{ q: sp.q, status: sp.status, projectId: sp.projectId, from: sp.from, to: sp.to }}
          />
        )}
      </PremiumSectionCard>

      <p className="text-2xs text-slate-400 text-center">
        العمولة «معتمدة» تعني أن الإدارة وافقت عليها وستُدرج في دفعتك القادمة. الأرقام مقفلة عند توقيع العقد.
      </p>
    </div>
  );
}
