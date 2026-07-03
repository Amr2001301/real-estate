import Link from 'next/link';
import { BadgePercent, Eye, Briefcase, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  AdminBrokerCommission,
  Broker,
  Paged,
  Project,
} from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { BrokerCommissionStatusBadge } from '@/components/badges';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  brokerId?: string;
  status?: string;
  projectId?: string;
  from?: string;
  to?: string;
  showFilters?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const currency = await getReportsCurrency();
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

  // Page-scoped status counts
  const counts = {
    pending: rows.filter((r) => r.status === 'PENDING').length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    rejected: rows.filter((r) => r.status === 'REJECTED').length,
    cancelled: rows.filter((r) => r.status === 'CANCELLED').length,
  };

  // Page-scoped financial totals
  const totalNet = rows.reduce((acc, r) => acc + Number(r.netAmount ?? 0), 0);
  const totalGross = rows.reduce((acc, r) => acc + Number(r.grossAmount ?? 0), 0);

  const totalCommissions = paged?.meta.total ?? 0;

  // Advanced filter state — URL-based toggle, auto-opens when advanced filters are active
  const hasAdvancedFilters = !!(sp.status || sp.projectId || sp.from || sp.to);
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';
  const hasAnyFilter = !!(sp.brokerId || hasAdvancedFilters);

  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      brokerId: sp.brokerId,
      status: sp.status,
      projectId: sp.projectId,
      from: sp.from,
      to: sp.to,
      showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const q = p.toString();
    return `/dashboard/broker-commissions${q ? `?${q}` : ''}`;
  }

  const toggleFiltersUrl = showFilters
    ? pageUrl({ showFilters: undefined })
    : pageUrl({ showFilters: '1' });

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="عمولات الوسطاء"
        description="متابعة عمولات الوسطاء وحالات الاستحقاق والصرف."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'عمولات الوسطاء' },
        ]}
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          {
            label: 'إجمالي العمولات',
            value: totalCommissions,
            icon: <BadgePercent />,
            tone: 'brand',
            primary: true,
          },
          {
            label: 'قيد المراجعة',
            value: counts.pending,
            icon: <BadgePercent />,
            tone: 'warning',
            sub: 'في هذه الصفحة',
          },
          {
            label: 'موافق عليها',
            value: counts.approved,
            icon: <BadgePercent />,
            tone: 'success',
            sub: 'في هذه الصفحة',
          },
          {
            label: 'إجمالي الصافي',
            value: totalNet > 0 ? formatCurrency(totalNet, currency) : '—',
            icon: <BadgePercent />,
            tone: 'neutral',
            sub: 'في هذه الصفحة',
          },
        ]}
      />

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {commRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل العمولات: {commRes.error}</p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/broker-commissions">
        {/* Hidden inputs preserve advanced values when the panel is collapsed */}
        {!showFilters && sp.status    && <input type="hidden" name="status"    value={sp.status} />}
        {!showFilters && sp.projectId && <input type="hidden" name="projectId" value={sp.projectId} />}
        {!showFilters && sp.from      && <input type="hidden" name="from"      value={sp.from} />}
        {!showFilters && sp.to        && <input type="hidden" name="to"        value={sp.to} />}

        {/* ── Row 1: broker filter + actions (always visible) ───────────────── */}
        <PremiumFilterField label="الوسيط" htmlFor="bcom-broker">
          <Select id="bcom-broker" name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''} className="w-44 shrink-0">
            <option value="">كل الوسطاء</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>{b.companyName}</option>
            ))}
          </Select>
        </PremiumFilterField>

        {/* Action buttons — BEFORE the basis-full panel so ms-auto keeps them in row 1 */}
        <div className="flex items-center gap-2 ms-auto shrink-0">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {hasAnyFilter && (
            <Link href={'/dashboard/broker-commissions' as never}>
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
          <span className="hidden sm:block h-5 w-px bg-hairline shrink-0" />
          <Link
            href={toggleFiltersUrl as never}
            className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 rounded-lg px-2.5 py-1.5 border transition-colors ${
              showFilters
                ? 'bg-brand-50 border-brand-200 text-brand-700'
                : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:border-hairline hover:text-slate-700'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showFilters ? 'إخفاء الفلاتر' : 'فلاتر متقدمة'}
            {hasAdvancedFilters && !showFilters && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">
                !
              </span>
            )}
          </Link>
        </div>

        {/* ── Row 2: advanced panel (basis-full forces a new flex row) ─────── */}
        {showFilters && (
          <div className="w-full basis-full border-t border-hairline pt-3.5 mt-0.5">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="bcom-status" className="text-[11px] font-medium text-slate-400">الحالة</label>
                <Select id="bcom-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
                  <option value="">كل الحالات</option>
                  <option value="PENDING">قيد المراجعة</option>
                  <option value="APPROVED">موافق عليها</option>
                  <option value="REJECTED">مرفوضة</option>
                  <option value="CANCELLED">ملغاة</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bcom-project" className="text-[11px] font-medium text-slate-400">المشروع</label>
                <Select id="bcom-project" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
                  <option value="">كل المشاريع</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{tx(p.name)}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bcom-from" className="text-[11px] font-medium text-slate-400">التاريخ من</label>
                <Input id="bcom-from" name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bcom-to" className="text-[11px] font-medium text-slate-400">التاريخ إلى</label>
                <Input id="bcom-to" name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} />
              </div>
            </div>
          </div>
        )}
      </PremiumFilterBar>

      {/* ── Commissions table ────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<BadgePercent />}
        title="سجل العمولات"
        description="عمولات تُحتسب تلقائيًا عند توقيع عقود ناتجة عن الوسطاء، وتتطلب اعتماد الإدارة قبل الدفع."
        padded={false}
        trailing={
          totalGross > 0 ? (
            <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap" dir="ltr">
              صافي: {formatCurrency(totalNet, currency)}
            </span>
          ) : (
            <span className="text-xs text-slate-400 tabular-nums">
              {totalCommissions.toLocaleString('ar-EG')} عمولة
            </span>
          )
        }
      >
        {rows.length === 0 && !commRes.error ? (
          <PremiumEmptyState
            icon={<BadgePercent />}
            title="لا توجد عمولات بعد"
            description="تُنشأ العمولات تلقائيًا عند توقيع عقد ناتج عن وسيط. لا يتم إنشاؤها يدويًا."
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">رقم العمولة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الوسيط</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">العقد</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الوحدة / المشروع</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الأساس</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">النسبة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">إجمالي</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">صافي</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الحالة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">تاريخ الاستحقاق</th>
                  <th className="text-start py-3 ps-4 pe-5 w-px" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className="align-middle hover:bg-canvas/40 transition-colors duration-100"
                  >
                    {/* Commission number — mono chip */}
                    <td className="py-3 ps-5 pe-4">
                      <span
                        className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 leading-none whitespace-nowrap"
                        dir="ltr"
                      >
                        {c.commissionNumber}
                      </span>
                    </td>

                    {/* Broker — company primary + agent secondary */}
                    <td className="py-3 px-4">
                      {c.broker ? (
                        <Link
                          href={`/dashboard/brokers/${c.broker.id}` as never}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-brand-700 transition-colors"
                        >
                          <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{c.broker.companyName}</span>
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                      {c.brokerAgent && (
                        <p className="text-2xs text-slate-400 mt-0.5 truncate max-w-[180px] ps-5">
                          {c.brokerAgent.fullName}
                        </p>
                      )}
                    </td>

                    {/* Contract — mono chip link + reservation secondary */}
                    <td className="py-3 px-4">
                      {c.contract?.contractNumber ? (
                        <Link
                          href={`/dashboard/contracts/${c.contractId}` as never}
                          className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 leading-none whitespace-nowrap hover:bg-slate-200 transition-colors"
                          dir="ltr"
                        >
                          {c.contract.contractNumber}
                        </Link>
                      ) : (
                        <Link
                          href={`/dashboard/contracts/${c.contractId}` as never}
                          className="text-xs text-slate-500 hover:text-brand-700 transition-colors"
                        >
                          —
                        </Link>
                      )}
                      {c.reservation?.reservationNumber && (
                        <p className="text-2xs text-slate-400 mt-0.5 font-mono whitespace-nowrap" dir="ltr">
                          {c.reservation.reservationNumber}
                        </p>
                      )}
                    </td>

                    {/* Unit / Project — code chip + project muted */}
                    <td className="py-3 px-4">
                      {c.unit?.code ? (
                        <span
                          className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 leading-none whitespace-nowrap"
                          dir="ltr"
                        >
                          {c.unit.code}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                      {c.project && (
                        <p className="text-2xs text-slate-400 mt-1 truncate max-w-[160px]">
                          {tx(c.project.name)}
                        </p>
                      )}
                    </td>

                    {/* Basis amount */}
                    <td className="py-3 px-4">
                      <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap" dir="ltr">
                        {formatCurrency(c.basisAmount, currency)}
                      </span>
                    </td>

                    {/* Commission percentage */}
                    <td className="py-3 px-4">
                      <span className="text-xs font-medium text-slate-600 tabular-nums">
                        {c.commissionPct != null
                          ? `${Number(c.commissionPct).toFixed(2)}%`
                          : '—'}
                      </span>
                    </td>

                    {/* Gross amount */}
                    <td className="py-3 px-4">
                      <span className="text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap" dir="ltr">
                        {formatCurrency(c.grossAmount, currency)}
                      </span>
                    </td>

                    {/* Net amount — strongest, the approval-critical payout figure */}
                    <td className="py-3 px-4">
                      <span className="text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap" dir="ltr">
                        {formatCurrency(c.netAmount, currency)}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="py-3 px-4">
                      <BrokerCommissionStatusBadge status={c.status} />
                    </td>

                    {/* Due date */}
                    <td className="py-3.5 px-4 text-2xs text-slate-400 whitespace-nowrap">
                      {formatDate(c.earnedAt)}
                    </td>

                    {/* Action */}
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
        )}
      </PremiumSectionCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
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
            showFilters: sp.showFilters,
          }}
        />
      )}
    </div>
  );
}
