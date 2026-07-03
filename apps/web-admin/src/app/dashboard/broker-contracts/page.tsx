import Link from 'next/link';
import { FileText, Eye, Briefcase, CheckCircle2, ArrowRightLeft, Phone, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  AdminBrokerContract,
  Broker,
  Paged,
  Project,
  User,
} from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
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
  projectId?: string;
  salesId?: string;
  signed?: string;
  dateFrom?: string;
  dateTo?: string;
  showFilters?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerContractsPage({
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

  // Page-scoped status counts
  const counts = {
    signed: rows.filter((r) => r.signedAt).length,
    pending: rows.filter((r) => !r.signedAt).length,
  };

  // Page-scoped financial totals (safely derived from already-fetched rows)
  const totalValue = rows.reduce((acc, r) => acc + Number(r.totalAmount ?? 0), 0);
  const totalCommission = rows.reduce(
    (acc, r) => acc + Number(r.reservation?.commissionLockedAmount ?? 0),
    0,
  );

  const totalContracts = paged?.meta.total ?? 0;

  // Advanced filter state — URL-based toggle, auto-opens when advanced filters are active
  const hasAdvancedFilters = !!(sp.projectId || sp.salesId || sp.signed || sp.dateFrom || sp.dateTo);
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';
  const hasAnyFilter = !!(sp.brokerId || hasAdvancedFilters);

  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      brokerId: sp.brokerId,
      projectId: sp.projectId,
      salesId: sp.salesId,
      signed: sp.signed,
      dateFrom: sp.dateFrom,
      dateTo: sp.dateTo,
      showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const q = p.toString();
    return `/dashboard/broker-contracts${q ? `?${q}` : ''}`;
  }

  const toggleFiltersUrl = showFilters
    ? pageUrl({ showFilters: undefined })
    : pageUrl({ showFilters: '1' });

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="عقود الوسطاء"
        description="إدارة العقود المرتبطة بالوسطاء ومتابعة حالاتها."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'عقود الوسطاء' },
        ]}
        actions={
          <Link href={'/dashboard/broker-reservations?status=APPROVED' as never}>
            <Button
              variant="primary"
              size="md"
              leftIcon={<ArrowRightLeft className="h-4 w-4" />}
            >
              تحويل حجز وسيط إلى عقد
            </Button>
          </Link>
        }
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          {
            label: 'إجمالي العقود',
            value: totalContracts,
            icon: <FileText />,
            tone: 'brand',
            primary: true,
          },
          {
            label: 'موقّعة',
            value: counts.signed,
            icon: <CheckCircle2 />,
            tone: 'success',
            sub: 'في هذه الصفحة',
          },
          {
            label: 'قيد التوقيع',
            value: counts.pending,
            icon: <FileText />,
            tone: 'warning',
            sub: 'في هذه الصفحة',
          },
          {
            label: 'إجمالي قيمة العقود',
            value: totalValue > 0 ? formatCurrency(totalValue, currency) : '—',
            icon: <FileText />,
            tone: 'neutral',
            sub: 'في هذه الصفحة',
          },
        ]}
      />

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {contractsRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل العقود: {contractsRes.error}</p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/broker-contracts">
        {/* Hidden inputs preserve advanced values when the panel is collapsed */}
        {!showFilters && sp.projectId && <input type="hidden" name="projectId" value={sp.projectId} />}
        {!showFilters && sp.salesId   && <input type="hidden" name="salesId"   value={sp.salesId} />}
        {!showFilters && sp.signed    && <input type="hidden" name="signed"    value={sp.signed} />}
        {!showFilters && sp.dateFrom  && <input type="hidden" name="dateFrom"  value={sp.dateFrom} />}
        {!showFilters && sp.dateTo    && <input type="hidden" name="dateTo"    value={sp.dateTo} />}

        {/* ── Row 1: main filter + actions (always visible) ─────────────────── */}
        <PremiumFilterField label="الوسيط" htmlFor="bc-broker">
          <Select id="bc-broker" name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''} className="w-44 shrink-0">
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
            <Link href={'/dashboard/broker-contracts' as never}>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="bc-project" className="text-[11px] font-medium text-slate-400">المشروع</label>
                <Select id="bc-project" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
                  <option value="">كل المشاريع</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{tx(p.name)}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bc-sales" className="text-[11px] font-medium text-slate-400">المندوب</label>
                <Select id="bc-sales" name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''}>
                  <option value="">كل المندوبين</option>
                  {salesUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bc-signed" className="text-[11px] font-medium text-slate-400">الحالة</label>
                <Select id="bc-signed" name="signed" inputSize="sm" defaultValue={sp.signed ?? ''}>
                  <option value="">كل العقود</option>
                  <option value="yes">موقّعة</option>
                  <option value="no">قيد التوقيع</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bc-datefrom" className="text-[11px] font-medium text-slate-400">التاريخ من</label>
                <Input id="bc-datefrom" name="dateFrom" inputSize="sm" type="date" defaultValue={sp.dateFrom ?? ''} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bc-dateto" className="text-[11px] font-medium text-slate-400">التاريخ إلى</label>
                <Input id="bc-dateto" name="dateTo" inputSize="sm" type="date" defaultValue={sp.dateTo ?? ''} />
              </div>
            </div>
          </div>
        )}
      </PremiumFilterBar>

      {/* ── Contracts table ──────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<FileText />}
        title="سجل العقود"
        description="عقود بيع العملاء الناتجة عن حجوزات أرسلها الوسطاء."
        padded={false}
        trailing={
          totalCommission > 0 ? (
            <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap" dir="ltr">
              عمولة مقفلة: {formatCurrency(totalCommission, currency)}
            </span>
          ) : (
            <span className="text-xs text-slate-400 tabular-nums">
              {totalContracts.toLocaleString('ar-EG')} عقد
            </span>
          )
        }
      >
        {rows.length === 0 && !contractsRes.error ? (
          <PremiumEmptyState
            icon={<FileText />}
            title="لا توجد عقود من الوسطاء"
            description="ستظهر هنا عقود البيع التي تم إنشاؤها من حجوزات ناتجة عن الوسطاء."
            action={
              <Link href={'/dashboard/broker-reservations?status=APPROVED' as never}>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<ArrowRightLeft className="h-4 w-4" />}
                >
                  تحويل حجز وسيط إلى عقد
                </Button>
              </Link>
            }
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">رقم العقد</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الوسيط</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">العميل</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الوحدة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">القيمة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الحالة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">المندوب</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">العمولة المُقفلة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">التاريخ</th>
                  <th className="text-start py-3 ps-4 pe-5 w-px" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className="align-middle hover:bg-canvas/40 transition-colors duration-100"
                  >
                    {/* Contract number — mono chip */}
                    <td className="py-3.5 ps-5 pe-4">
                      {c.contractNumber ? (
                        <span
                          className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 leading-none"
                          dir="ltr"
                        >
                          {c.contractNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Broker — company primary + agent secondary */}
                    <td className="py-3.5 px-4">
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

                    {/* Client — name primary + phone secondary */}
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900 truncate max-w-[180px]">
                        {c.customer?.fullName ?? c.reservation?.lead?.fullName ?? '—'}
                      </p>
                      {(c.customer?.phone ?? c.reservation?.lead?.phone) && (
                        <span
                          className="mt-0.5 inline-flex items-center gap-1 text-2xs text-slate-400"
                          dir="ltr"
                        >
                          <Phone className="h-3 w-3 shrink-0" />
                          {c.customer?.phone ?? c.reservation?.lead?.phone}
                        </span>
                      )}
                    </td>

                    {/* Unit — code chip + project secondary */}
                    <td className="py-3.5 px-4">
                      {c.unit?.code ? (
                        <span
                          className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 leading-none"
                          dir="ltr"
                        >
                          {c.unit.code}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                      {c.unit?.building && (
                        <p className="text-2xs text-slate-400 mt-1 truncate max-w-[160px]">
                          {tx(c.unit.building.phase.project.name)}
                        </p>
                      )}
                    </td>

                    {/* Contract value */}
                    <td className="py-3.5 px-4">
                      <p className="text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap" dir="ltr">
                        {formatCurrency(c.totalAmount, currency)}
                      </p>
                    </td>

                    {/* Status badge */}
                    <td className="py-3.5 px-4">
                      {c.signedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 text-success-700 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          موقّع
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-warning-50 text-warning-700 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">
                          قيد التوقيع
                        </span>
                      )}
                    </td>

                    {/* Sales admin */}
                    <td className="py-3.5 px-4">
                      {c.reservation?.sales ? (
                        <span className="block text-xs text-slate-600 truncate max-w-[140px]">
                          {c.reservation.sales.fullName}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-400">
                          غير معيّن
                        </span>
                      )}
                    </td>

                    {/* Locked commission — % bold, amount muted */}
                    <td className="py-3.5 px-4">
                      {c.reservation?.commissionLockedPct != null ? (
                        <>
                          <p className="text-xs font-semibold text-slate-800 tabular-nums">
                            {Number(c.reservation.commissionLockedPct).toFixed(2)}%
                          </p>
                          {c.reservation.commissionLockedAmount != null && (
                            <p className="text-2xs text-slate-400 tabular-nums mt-0.5 whitespace-nowrap" dir="ltr">
                              {formatCurrency(c.reservation.commissionLockedAmount, currency)}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-400">
                          غير مقفلة
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-2xs text-slate-400 whitespace-nowrap">
                      {formatDate(c.createdAt)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 ps-4 pe-5">
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
        )}
      </PremiumSectionCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
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
            showFilters: sp.showFilters,
          }}
        />
      )}
    </div>
  );
}
