import Link from 'next/link';
import {
  Plus,
  BookmarkCheck,
  Eye,
  Clock,
  CheckCircle2,
  ArrowRightLeft,
  BadgePercent,
  Phone,
  AlertCircle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, PortalProject, PortalReservation } from '@/lib/types';
import { tx, formatDate, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { CodeText } from '@/components/ui/code-text';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { ReservationsFilterBar } from '@/components/broker/reservations-filter-bar';
import { ReservationStatusBadge } from '@/components/badges';
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

const AVATAR_COLORS = [
  'bg-slate-100 text-slate-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];

function avatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0]!;
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length]!;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default async function PortalReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const currency = await getReportsCurrency();
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.q)         qs.set('q', sp.q);
  if (sp.status)    qs.set('status', sp.status);
  if (sp.projectId) qs.set('projectId', sp.projectId);
  if (sp.from)      qs.set('from', sp.from);
  if (sp.to)        qs.set('to', sp.to);

  const [resRes, projectsRes, rPending, rApproved, rConverted] = await Promise.all([
    safe(api.get<Paged<PortalReservation>>(`/portal/reservations?${qs.toString()}`)),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalReservation>>('/portal/reservations?page=1&pageSize=1&status=PENDING')),
    safe(api.get<Paged<PortalReservation>>('/portal/reservations?page=1&pageSize=1&status=APPROVED')),
    safe(api.get<Paged<PortalReservation>>('/portal/reservations?page=1&pageSize=1&status=CONVERTED')),
  ]);

  const paged          = resRes.data;
  const rows           = paged?.data ?? [];
  const projects       = projectsRes.data ?? [];
  const pendingCount   = rPending.data?.meta.total   ?? 0;
  const approvedCount  = rApproved.data?.meta.total  ?? 0;
  const convertedCount = rConverted.data?.meta.total ?? 0;

  return (
    <div className="space-y-5">

      <PremiumPageHero
        title="حجوزاتي"
        description="الحجوزات التي أنشأتها عبر البوابة — تابع الحالة والعمولة المُقفلة."
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
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          تعذر تحميل الحجوزات: {resRes.error}
        </div>
      )}

      <PremiumMetricStrip
        variant="compact"
        metrics={[
          { label: 'إجمالي الحجوزات', value: paged?.meta.total ?? 0, icon: <BookmarkCheck />,  tone: 'brand'   },
          { label: 'قيد المراجعة',    value: pendingCount,            icon: <Clock />,          tone: 'warning' },
          { label: 'تمت الموافقة',    value: approvedCount,           icon: <CheckCircle2 />,   tone: 'success' },
          { label: 'محوّل إلى عقد',   value: convertedCount,          icon: <ArrowRightLeft />, tone: 'info'    },
        ]}
      />

      <ReservationsFilterBar
        projects={projects}
        sp={{ q: sp.q, status: sp.status, projectId: sp.projectId, from: sp.from, to: sp.to }}
      />

      <PremiumSectionCard
        icon={<BookmarkCheck />}
        title="قائمة الحجوزات"
        padded={false}
      >
        {rows.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-hairline bg-surface-muted/30 text-xs text-slate-500">
            <span className="font-bold text-slate-700">{paged?.meta.total?.toLocaleString()}</span>
            <span>حجز</span>
          </div>
        )}

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">العميل</th>
                <th className="text-start font-semibold py-3 px-4">الوحدة / المشروع</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 px-4">العمولة المُقفلة</th>
                <th className="text-start font-semibold py-3 px-4">رقم الحجز</th>
                <th className="text-start font-semibold py-3 px-4">التاريخ</th>
                <th className="py-3 ps-4 pe-5 w-px"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
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
                const clientName  = r.lead?.fullName ?? r.client?.fullName;
                const clientPhone = r.lead?.phone ?? r.client?.phone ?? undefined;
                const isConverted = r.status === 'CONVERTED';
                const isApproved  = r.status === 'APPROVED';

                return (
                  <tr
                    key={r.id}
                    className={cn(
                      'border-t border-hairline transition-colors align-top',
                      isConverted
                        ? 'bg-emerald-50/25 hover:bg-emerald-50/50'
                        : isApproved
                          ? 'bg-blue-50/20 hover:bg-blue-50/40'
                          : 'hover:bg-surface-muted/40',
                    )}
                  >
                    <td className="py-3 ps-5 pe-4">
                      {clientName ? (
                        <div className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              'h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0',
                              avatarColor(clientName),
                            )}
                          >
                            {initials(clientName)}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900 text-xs">{clientName}</p>
                            {clientPhone && (
                              <a
                                href={`tel:${clientPhone}`}
                                className="text-2xs text-slate-500 mt-0.5 inline-flex items-center gap-1 hover:text-brand-700 transition-colors"
                                dir="ltr"
                              >
                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                {clientPhone}
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <CodeText className="text-xs font-semibold text-slate-800">{r.unit?.code ?? '—'}</CodeText>
                      <p className="text-2xs text-slate-500 mt-0.5">
                        {r.unit?.building ? tx(r.unit.building.phase.project.name) : '—'}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <ReservationStatusBadge status={r.status} />
                    </td>

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
                          {formatCurrency(r.commissionLockedAmount, currency)}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <CodeText className="text-2xs text-slate-500">{r.reservationNumber ?? '—'}</CodeText>
                    </td>

                    <td className="py-3 px-4 text-2xs text-slate-500 whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </td>

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
            params={{ q: sp.q, status: sp.status, projectId: sp.projectId, from: sp.from, to: sp.to }}
          />
        )}
      </PremiumSectionCard>
    </div>
  );
}
