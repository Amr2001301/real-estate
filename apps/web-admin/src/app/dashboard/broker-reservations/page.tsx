import Link from 'next/link';
import { BookmarkCheck, Eye, Briefcase, Phone, Plus, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  AdminBrokerReservation,
  Broker,
  Paged,
  Project,
  User,
} from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { ReservationStatusBadge } from '@/components/badges';
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
  salesId?: string;
  showFilters?: string;
}

const PAGE_SIZE = 20;

export default async function AdminBrokerReservationsPage({
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
  for (const key of ['brokerId', 'status', 'projectId', 'salesId'] as const) {
    const v = sp[key];
    if (v) qs.set(key, v);
  }

  const [resRes, brokersRes, projectsRes, salesRes] = await Promise.all([
    safe(api.get<Paged<AdminBrokerReservation>>(`/broker-reservations?${qs.toString()}`)),
    safe(api.get<Paged<Broker>>('/brokers?pageSize=200')),
    safe(api.get<Paged<Project>>('/projects?pageSize=200')),
    safe(api.get<Paged<User>>('/users?role=SALES,SALES_MANAGER&pageSize=200')),
  ]);

  const paged = resRes.data;
  const rows = paged?.data ?? [];
  const brokers = brokersRes.data?.data ?? [];
  const projects = projectsRes.data?.data ?? [];
  const salesUsers = salesRes.data?.data ?? [];

  // Page-scoped status counts
  const counts = {
    pending: rows.filter((r) => r.status === 'PENDING').length,
    approved: rows.filter((r) => r.status === 'APPROVED').length,
    converted: rows.filter((r) => r.status === 'CONVERTED').length,
    failed: rows.filter((r) => r.status === 'REJECTED' || r.status === 'CANCELLED').length,
  };

  // Page-scoped commission total (safely derived from existing row data)
  const totalCommission = rows.reduce(
    (acc, r) => acc + Number(r.commissionLockedAmount ?? 0),
    0,
  );

  const totalReservations = paged?.meta.total ?? 0;

  // Advanced filter state — URL-based toggle, auto-opens when advanced filters are active
  const hasAdvancedFilters = !!(sp.status || sp.projectId || sp.salesId);
  const showFilters = hasAdvancedFilters || sp.showFilters === '1';
  const hasAnyFilter = !!(sp.brokerId || hasAdvancedFilters);

  function pageUrl(overrides: Record<string, string | undefined>): string {
    const base: Record<string, string | undefined> = {
      brokerId: sp.brokerId,
      status: sp.status,
      projectId: sp.projectId,
      salesId: sp.salesId,
      showFilters: sp.showFilters,
    };
    const merged = { ...base, ...overrides };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) { if (v) p.set(k, v); }
    const q = p.toString();
    return `/dashboard/broker-reservations${q ? `?${q}` : ''}`;
  }

  const toggleFiltersUrl = showFilters
    ? pageUrl({ showFilters: undefined })
    : pageUrl({ showFilters: '1' });

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="حجوزات الوسطاء"
        description="متابعة الحجوزات المرتبطة بالوسطاء وحالاتها عبر المشاريع والوحدات."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'حجوزات الوسطاء' },
        ]}
        actions={
          <Link href={'/dashboard/broker-reservations/new' as never}>
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              إنشاء حجز نيابة عن وسيط
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
            label: 'إجمالي الحجوزات',
            value: totalReservations,
            icon: <BookmarkCheck />,
            tone: 'brand',
            primary: true,
          },
          {
            label: 'قيد المراجعة',
            value: counts.pending,
            icon: <BookmarkCheck />,
            tone: 'warning',
            sub: 'في هذه الصفحة',
          },
          {
            label: 'تمت الموافقة',
            value: counts.approved,
            icon: <BookmarkCheck />,
            tone: 'success',
            sub: 'في هذه الصفحة',
          },
          {
            label: 'محوّل إلى عقد',
            value: counts.converted,
            icon: <BookmarkCheck />,
            tone: 'info',
            sub: 'في هذه الصفحة',
          },
        ]}
      />

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {resRes.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذر تحميل الحجوزات: {resRes.error}</p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/broker-reservations">
        {/* Hidden inputs preserve advanced values when the panel is collapsed */}
        {!showFilters && sp.status    && <input type="hidden" name="status"    value={sp.status} />}
        {!showFilters && sp.projectId && <input type="hidden" name="projectId" value={sp.projectId} />}
        {!showFilters && sp.salesId   && <input type="hidden" name="salesId"   value={sp.salesId} />}

        {/* ── Row 1: broker filter + actions (always visible) ───────────────── */}
        <PremiumFilterField label="الوسيط" htmlFor="bres-broker">
          <Select id="bres-broker" name="brokerId" inputSize="sm" defaultValue={sp.brokerId ?? ''} className="w-44 shrink-0">
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
            <Link href={'/dashboard/broker-reservations' as never}>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="bres-status" className="text-[11px] font-medium text-slate-400">الحالة</label>
                <Select id="bres-status" name="status" inputSize="sm" defaultValue={sp.status ?? ''}>
                  <option value="">كل الحالات</option>
                  <option value="PENDING">قيد المراجعة</option>
                  <option value="APPROVED">تمت الموافقة</option>
                  <option value="REJECTED">مرفوض</option>
                  <option value="CANCELLED">ملغى</option>
                  <option value="EXPIRED">منتهي</option>
                  <option value="CONVERTED">محوّل إلى عقد</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bres-project" className="text-[11px] font-medium text-slate-400">المشروع</label>
                <Select id="bres-project" name="projectId" inputSize="sm" defaultValue={sp.projectId ?? ''}>
                  <option value="">كل المشاريع</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{tx(p.name)}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="bres-sales" className="text-[11px] font-medium text-slate-400">المندوب الداخلي</label>
                <Select id="bres-sales" name="salesId" inputSize="sm" defaultValue={sp.salesId ?? ''}>
                  <option value="">كل المندوبين</option>
                  {salesUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        )}
      </PremiumFilterBar>

      {/* ── Reservations table ───────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<BookmarkCheck />}
        title="قائمة الحجوزات"
        description="حجوزات عملاء نشأت من بوابة الوسيط وتحتاج إلى مراجعة داخلية."
        padded={false}
        trailing={
          totalCommission > 0 ? (
            <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap" dir="ltr">
              عمولة مقفلة: {formatCurrency(totalCommission, currency)}
            </span>
          ) : (
            <span className="text-xs text-slate-400 tabular-nums">
              {totalReservations.toLocaleString('ar-EG')} حجز
            </span>
          )
        }
      >
        {rows.length === 0 && !resRes.error ? (
          <PremiumEmptyState
            icon={<BookmarkCheck />}
            title="لا توجد حجوزات من الوسطاء"
            description="ستظهر هنا فور إرسال الوسطاء أول حجز."
            action={
              <Link href={'/dashboard/broker-reservations/new' as never}>
                <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                  إنشاء حجز نيابة عن وسيط
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
                  <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">رقم الحجز</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الوسيط</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">العميل</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الوحدة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الحالة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">المندوب الداخلي</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">العمولة المُقفلة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">تاريخ الإنشاء</th>
                  <th className="text-start py-3 ps-4 pe-5 w-px" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="align-middle hover:bg-canvas/40 transition-colors duration-100"
                  >
                    {/* Reservation number — mono chip */}
                    <td className="py-3.5 ps-5 pe-4">
                      {r.reservationNumber ? (
                        <span
                          className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 leading-none"
                          dir="ltr"
                        >
                          {r.reservationNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Broker */}
                    <td className="py-3.5 px-4">
                      {r.broker ? (
                        <Link
                          href={`/dashboard/brokers/${r.broker.id}` as never}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-brand-700 transition-colors"
                        >
                          <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{r.broker.companyName}</span>
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                      {r.brokerAgent && (
                        <p className="text-2xs text-slate-400 mt-0.5 truncate max-w-[180px] ps-5">
                          {r.brokerAgent.fullName}
                        </p>
                      )}
                    </td>

                    {/* Client */}
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900 truncate max-w-[180px]">
                        {r.lead?.fullName ?? r.client?.fullName ?? '—'}
                      </p>
                      <span
                        className="mt-0.5 inline-flex items-center gap-1 text-2xs text-slate-400"
                        dir="ltr"
                      >
                        <Phone className="h-3 w-3 shrink-0" />
                        {r.lead?.phone ?? r.client?.phone ?? '—'}
                      </span>
                    </td>

                    {/* Unit */}
                    <td className="py-3.5 px-4">
                      {r.unit?.code ? (
                        <span
                          className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 leading-none"
                          dir="ltr"
                        >
                          {r.unit.code}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                      {r.unit?.building && (
                        <p className="text-2xs text-slate-400 mt-1 truncate max-w-[160px]">
                          {tx(r.unit.building.phase.project.name)}
                        </p>
                      )}
                    </td>

                    {/* Status badge */}
                    <td className="py-3.5 px-4">
                      <ReservationStatusBadge status={r.status} />
                    </td>

                    {/* Sales admin */}
                    <td className="py-3.5 px-4">
                      {r.sales ? (
                        <span className="block text-xs text-slate-600 truncate max-w-[140px]">
                          {r.sales.fullName}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-400">
                          غير معيّن
                        </span>
                      )}
                    </td>

                    {/* Locked commission */}
                    <td className="py-3.5 px-4">
                      {r.commissionLockedPct != null ? (
                        <>
                          <p className="text-xs font-semibold text-slate-800 tabular-nums">
                            {Number(r.commissionLockedPct).toFixed(2)}%
                          </p>
                          {r.commissionLockedAmount != null && (
                            <p className="text-2xs text-slate-400 tabular-nums mt-0.5">
                              {formatCurrency(r.commissionLockedAmount, currency)}
                            </p>
                          )}
                        </>
                      ) : r.commissionLockedAmount != null ? (
                        <>
                          <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-2xs font-medium text-teal-700">
                            مبلغ ثابت
                          </span>
                          <p className="text-2xs text-slate-400 tabular-nums mt-0.5">
                            {formatCurrency(r.commissionLockedAmount, currency)}
                          </p>
                        </>
                      ) : (
                        <span className="text-slate-400 text-xs">غير محددة</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-2xs text-slate-400 whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 ps-4 pe-5">
                      <Link href={`/dashboard/reservations/${r.id}` as never}>
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
          basePath="/dashboard/broker-reservations"
          params={{
            brokerId: sp.brokerId,
            status: sp.status,
            projectId: sp.projectId,
            salesId: sp.salesId,
            showFilters: sp.showFilters,
          }}
        />
      )}
    </div>
  );
}
