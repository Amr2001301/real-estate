import Link from 'next/link';
import { FileText, Eye, Briefcase, CheckCircle2, ArrowRightLeft, Phone } from 'lucide-react';
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

      {/* Contract summary strip — page-scoped counts and totals */}
      {paged && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
          {/* Total — filter-wide prominent count */}
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xl font-bold text-slate-900 tabular-nums leading-none">
              {totalContracts}
            </span>
            <span className="text-2xs font-medium text-slate-400">عقد</span>
          </div>

          <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />

          {/* Signed / pending breakdown */}
          <div className="flex flex-wrap items-center gap-1.5">
            <ReviewChip label="موقّع" count={counts.signed} className="bg-success-50 text-success-700" />
            <ReviewChip label="قيد التوقيع" count={counts.pending} className="bg-warning-50 text-warning-700" />
          </div>

          {/* Total contract value */}
          {totalValue > 0 && (
            <>
              <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-2xs text-slate-400 whitespace-nowrap">إجمالي قيمة العقود</span>
                <span className="text-sm font-semibold text-slate-800 tabular-nums whitespace-nowrap" dir="ltr">
                  {formatCurrency(totalValue)}
                </span>
              </div>
            </>
          )}

          {/* Locked commission total */}
          {totalCommission > 0 && (
            <>
              <div className="w-px h-5 bg-hairline shrink-0 hidden sm:block" aria-hidden />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-2xs text-slate-400 whitespace-nowrap">إجمالي العمولة المقفلة</span>
                <span className="text-sm font-semibold text-slate-800 tabular-nums whitespace-nowrap" dir="ltr">
                  {formatCurrency(totalCommission)}
                </span>
              </div>
            </>
          )}

          <span className="ms-auto text-2xs text-slate-400 hidden sm:inline">في هذه الصفحة</span>
        </div>
      )}

      {contractsRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل العقود: {contractsRes.error}
        </div>
      )}

      {/* Filter bar */}
      <form
        method="get"
        action="/dashboard/broker-contracts"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface px-3 py-2.5 shadow-xs"
      >
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
        <Select
          name="salesId"
          inputSize="sm"
          defaultValue={sp.salesId ?? ''}
          className="w-44 shrink-0"
        >
          <option value="">كل المندوبين</option>
          {salesUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </Select>
        <Select
          name="signed"
          inputSize="sm"
          defaultValue={sp.signed ?? ''}
          className="w-36 shrink-0"
        >
          <option value="">كل العقود</option>
          <option value="yes">موقّعة</option>
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

      {/* Contract registry table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 border-b border-hairline text-2xs font-semibold uppercase tracking-wide text-slate-500">
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
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-0">
                    <EmptyState
                      icon={<FileText />}
                      title="لا توجد عقود من الوسطاء"
                      description="ستظهر هنا عقود البيع التي تم إنشاؤها من حجوزات ناتجة عن الوسطاء."
                      action={
                        <Link href="/dashboard/broker-reservations?status=APPROVED">
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<ArrowRightLeft className="h-4 w-4" />}
                          >
                            تحويل حجز وسيط إلى عقد
                          </Button>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="align-middle hover:bg-surface-muted/40 transition-colors"
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

                  {/* Contract value — strongest financial value in the row */}
                  <td className="py-3.5 px-4">
                    <p className="text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap" dir="ltr">
                      {formatCurrency(c.totalAmount)}
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
                            {formatCurrency(c.reservation.commissionLockedAmount)}
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
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
      <span className="font-bold tabular-nums">{count}</span>
    </span>
  );
}
