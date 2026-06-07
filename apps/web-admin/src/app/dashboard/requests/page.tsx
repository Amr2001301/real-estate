import Link from 'next/link';
import {
  MessageSquareText,
  Phone,
  Mail,
  MessageCircle,
  AlertCircle,
  Building2,
  Home,
  Inbox,
  CheckCircle2,
  Archive,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, AdminInfoRequest } from '@/lib/types';
import { formatDateTime, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PAGE_SIZE = 20;

interface Search {
  page?: string;
  status?: string;
}

function submitterBadge(req: AdminInfoRequest): { label: string; tone: 'gray' | 'info' | 'success' } {
  if (!req.userId) return { label: 'زائر', tone: 'gray' };
  if (req.user?.role === 'CUSTOMER') return { label: 'عميل (مالك)', tone: 'success' };
  return { label: 'عميل (متصفّح)', tone: 'info' };
}

function contactOf(req: AdminInfoRequest): { name: string; phone: string | null; email: string | null } {
  return {
    name: req.user?.fullName ?? req.lead?.fullName ?? 'زائر بدون اسم',
    phone: req.user?.phone ?? req.lead?.phone ?? null,
    email: req.user?.email ?? req.lead?.email ?? null,
  };
}

const STATUS_LABEL: Record<string, { label: string; tone: 'warning' | 'info' | 'gray' }> = {
  OPEN: { label: 'مفتوح', tone: 'warning' },
  RESPONDED: { label: 'تم الرد', tone: 'info' },
  CLOSED: { label: 'مغلق', tone: 'gray' },
};

export default async function InfoRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const statusFilter = sp.status ?? '';

  const pageQs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (statusFilter) pageQs.set('status', statusFilter);

  // Two fetches: paginated display + wide snapshot for accurate KPI counts.
  const [res, snapshotRes] = await Promise.all([
    safe(api.get<Paged<AdminInfoRequest>>(`/info-requests?${pageQs.toString()}`)),
    safe(api.get<Paged<AdminInfoRequest>>('/info-requests?pageSize=500')),
  ]);

  const rows = res.data?.data ?? [];
  const total = res.data?.meta.total ?? 0;
  const snapshot = snapshotRes.data?.data ?? [];
  const grandTotal = snapshotRes.data?.meta.total ?? snapshot.length;
  const openCount = snapshot.filter((r) => r.status === 'OPEN').length;
  const respondedCount = snapshot.filter((r) => r.status === 'RESPONDED').length;
  const closedCount = snapshot.filter((r) => r.status === 'CLOSED').length;

  function chipHref(status: string): string {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    return `/dashboard/requests${p.toString() ? `?${p.toString()}` : ''}`;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="استفسارات العملاء"
        description="رسائل الاستفسار الواردة من نموذج التواصل والموقع — من الزوّار والعملاء المسجّلين."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'استفسارات العملاء' },
        ]}
      />

      {/* ── KPI strip ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <PageKpiCard
          label="إجمالي الاستفسارات"
          value={grandTotal}
          icon={<MessageSquareText />}
          tone="brand"
        />
        <PageKpiCard
          label="مفتوح"
          value={openCount}
          icon={<Inbox />}
          tone="warning"
        />
        <PageKpiCard
          label="تم الرد"
          value={respondedCount}
          icon={<CheckCircle2 />}
          tone="success"
        />
        <PageKpiCard
          label="مغلق"
          value={closedCount}
          icon={<Archive />}
          tone="info"
        />
      </div>

      {res.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذّر تحميل الاستفسارات: {res.error}</p>
        </div>
      )}

      {/* ── Status filter chips ──────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { status: '', label: 'الكل', count: grandTotal },
            { status: 'OPEN', label: 'مفتوح', count: openCount },
            { status: 'RESPONDED', label: 'تم الرد', count: respondedCount },
            { status: 'CLOSED', label: 'مغلق', count: closedCount },
          ] as const
        ).map(({ status, label, count }) => {
          const isActive = statusFilter === status;
          return (
            <Link
              key={status || 'all'}
              href={chipHref(status) as never}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                isActive
                  ? 'bg-navy text-white border-navy shadow-sm'
                  : 'bg-white border-hairline text-slate-600 hover:border-brand-300 hover:text-brand-700',
              )}
            >
              {label}
              <span
                className={cn(
                  'inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums',
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600',
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── Table ───────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-xs text-slate-500">
              <tr>
                <th className="text-start font-semibold py-3 ps-5 pe-4">المُرسِل</th>
                <th className="text-start font-semibold py-3 px-4">النوع</th>
                <th className="text-start font-semibold py-3 px-4">بيانات الاتصال</th>
                <th className="text-start font-semibold py-3 px-4">الرسالة</th>
                <th className="text-start font-semibold py-3 px-4">السياق</th>
                <th className="text-start font-semibold py-3 px-4">الحالة</th>
                <th className="text-start font-semibold py-3 ps-4 pe-5">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !res.error && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      icon={<MessageSquareText />}
                      title="لا توجد استفسارات بعد"
                      description="ستظهر هنا رسائل الاستفسار الواردة من نموذج التواصل في الموقع، سواء من الزوّار أو العملاء المسجّلين."
                    />
                  </td>
                </tr>
              )}
              {rows.map((req) => {
                const contact = contactOf(req);
                const badge = submitterBadge(req);
                const status = STATUS_LABEL[req.status] ?? { label: req.status, tone: 'gray' as const };
                const waDigits = contact.phone?.replace(/\D/g, '') ?? '';
                const projectName = req.project ? tx(req.project.name) : null;
                return (
                  <tr
                    key={req.id}
                    className="group border-t border-hairline align-top hover:bg-brand-50/20 transition-colors"
                  >
                    {/* Sender */}
                    <td className="py-3.5 ps-5 pe-4 min-w-[160px]">
                      <p className="font-semibold text-[13px] text-slate-900 leading-snug">
                        {contact.name}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400 mt-0.5 leading-none">
                        #{req.id.slice(0, 8).toUpperCase()}
                      </p>
                    </td>

                    {/* Type badge */}
                    <td className="py-3.5 px-4">
                      <Badge tone={badge.tone} variant="soft" size="sm">
                        {badge.label}
                      </Badge>
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4 min-w-[210px]">
                      <div className="flex flex-col gap-1.5">
                        {contact.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <a
                              href={`tel:${contact.phone}`}
                              className="font-mono text-xs text-slate-700 hover:text-brand-700 transition-colors"
                              dir="ltr"
                            >
                              {contact.phone}
                            </a>
                            {waDigits && (
                              <a
                                href={`https://wa.me/${waDigits}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="واتساب"
                                title={`واتساب: ${contact.phone}`}
                                className="shrink-0 text-success-600 hover:text-success-700 transition-colors"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        ) : null}
                        {contact.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <a
                              href={`mailto:${contact.email}`}
                              className="text-xs text-slate-600 hover:text-brand-700 transition-colors truncate max-w-[170px]"
                              dir="ltr"
                            >
                              {contact.email}
                            </a>
                          </div>
                        ) : null}
                        {!contact.phone && !contact.email && (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </div>
                    </td>

                    {/* Message */}
                    <td className="py-3.5 px-4 max-w-[280px]">
                      <p className="text-xs text-slate-700 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                        {req.message}
                      </p>
                    </td>

                    {/* Context (project / unit) */}
                    <td className="py-3.5 px-4 min-w-[140px]">
                      {projectName ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{projectName}</span>
                        </div>
                      ) : null}
                      {req.unit ? (
                        <div className={cn('flex items-center gap-1.5', projectName ? 'mt-1' : '')}>
                          <Home className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {req.unit.code}
                          </span>
                        </div>
                      ) : null}
                      {!projectName && !req.unit && (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <Badge tone={status.tone} variant="soft" size="sm" dot>
                        {status.label}
                      </Badge>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 ps-4 pe-5 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(req.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {res.data && total > PAGE_SIZE && (
          <Pagination
            page={res.data.meta.page}
            pageSize={res.data.meta.pageSize}
            total={total}
            basePath="/dashboard/requests"
            params={{ status: statusFilter || undefined }}
          />
        )}
      </Card>
    </div>
  );
}
