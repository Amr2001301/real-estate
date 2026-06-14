import Link from 'next/link';
import {
  Plus,
  BookmarkCheck,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  BadgePercent,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalProject, PortalReservation } from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { ReservationStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  status?: string;
  projectId?: string;
}

const PAGE_SIZE = 20;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default async function PortalReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.status)    qs.set('status', sp.status);
  if (sp.projectId) qs.set('projectId', sp.projectId);

  const [resRes, projectsRes, rPending, rApproved, rConverted] = await Promise.all([
    safe(api.get<Paged<PortalReservation>>(`/portal/reservations?${qs.toString()}`)),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalReservation>>('/portal/reservations?page=1&pageSize=1&status=PENDING')),
    safe(api.get<Paged<PortalReservation>>('/portal/reservations?page=1&pageSize=1&status=APPROVED')),
    safe(api.get<Paged<PortalReservation>>('/portal/reservations?page=1&pageSize=1&status=CONVERTED')),
  ]);

  const paged         = resRes.data;
  const rows          = paged?.data ?? [];
  const projects      = projectsRes.data ?? [];
  const totalAll      = paged?.meta.total ?? 0;
  const pendingCount  = rPending.data?.meta.total  ?? 0;
  const approvedCount = rApproved.data?.meta.total ?? 0;
  const convertedCount= rConverted.data?.meta.total ?? 0;

  return (
    <div className="space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="حجوزاتي"
        description="الحجوزات التي قمت بإنشائها عبر البوابة — تابع الحالة والعمولة المُقفلة."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الحجوزات' },
        ]}
        actions={
          <Link href="/portal/reservations/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              حجز جديد
            </Button>
          </Link>
        }
      />

      {resRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الحجوزات: {resRes.error}
        </div>
      )}

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PageKpiCard label="إجمالي الحجوزات" value={totalAll}       icon={<BookmarkCheck />}  tone="brand"   />
        <PageKpiCard label="قيد المراجعة"    value={pendingCount}  icon={<Clock />}          tone="warning" />
        <PageKpiCard label="تمت الموافقة"    value={approvedCount} icon={<CheckCircle2 />}   tone="success" />
        <PageKpiCard label="محوّل إلى عقد"   value={convertedCount} icon={<ArrowRightLeft />} tone="info"    />
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <form
        method="get"
        action="/portal/reservations"
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
          <option value="APPROVED">تمت الموافقة</option>
          <option value="REJECTED">مرفوض</option>
          <option value="CANCELLED">ملغى</option>
          <option value="EXPIRED">منتهي</option>
          <option value="CONVERTED">محوّل إلى عقد</option>
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
        <div className="flex items-center gap-1.5 ms-auto">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {(sp.status || sp.projectId) && (
            <Link href="/portal/reservations">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {rows.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
            <span>حجز مطابق للتصفية</span>
          </div>
        )}

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">رقم الحجز</th>
                <th className="text-start font-semibold py-3 px-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">الوحدة / المشروع</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">العمولة المُقفلة</th>
                <th className="text-start font-semibold py-3 px-4">المندوب</th>
                <th className="text-start font-semibold py-3 px-4">التاريخ</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      icon={<BookmarkCheck />}
                      title="لا توجد حجوزات بعد"
                      description="أنشئ أول حجز من فرصة معتمدة على وحدة متاحة."
                      action={
                        <Link href="/portal/reservations/new">
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Plus className="h-4 w-4" />}
                          >
                            حجز جديد
                          </Button>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const clientName = r.lead?.fullName;
                return (
                  <tr
                    key={r.id}
                    className="border-t border-hairline hover:bg-surface-muted/40 transition-colors"
                  >
                    {/* Reservation number */}
                    <td className="py-3 ps-5 pe-4">
                      <span className="font-mono text-xs text-brand-700 font-semibold" dir="ltr">
                        {r.reservationNumber ?? '—'}
                      </span>
                    </td>

                    {/* Client */}
                    <td className="py-3 px-4">
                      {clientName ? (
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs shrink-0">
                            {initials(clientName)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 text-xs">{clientName}</p>
                            {r.lead?.phone && (
                              <p className="text-2xs text-slate-400 mt-0.5" dir="ltr">{r.lead.phone}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Unit / Project */}
                    <td className="py-3 px-4">
                      <p className="font-mono text-xs text-slate-800 font-semibold" dir="ltr">
                        {r.unit?.code ?? '—'}
                      </p>
                      <p className="text-2xs text-slate-500 mt-0.5">
                        {r.unit?.building ? tx(r.unit.building.phase.project.name) : '—'}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <ReservationStatusBadge status={r.status} />
                    </td>

                    {/* Locked commission */}
                    <td className="py-3 px-4">
                      {r.commissionLockedPct != null ? (
                        <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ring-amber-100">
                          <BadgePercent className="h-3 w-3" />
                          {Number(r.commissionLockedPct).toFixed(2)}%
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                      {r.commissionLockedAmount != null && (
                        <p className="text-2xs text-slate-500 mt-1 tabular-nums">
                          {formatCurrency(r.commissionLockedAmount)}
                        </p>
                      )}
                    </td>

                    {/* Sales agent */}
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {r.sales?.fullName ?? '—'}
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-2xs text-slate-500 whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </td>

                    {/* Action */}
                    <td className="py-3 ps-4 pe-5">
                      <Link href={`/portal/reservations/${r.id}` as never}>
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
            basePath="/portal/reservations"
            params={{ status: sp.status, projectId: sp.projectId }}
          />
        )}
      </Card>
    </div>
  );
}
