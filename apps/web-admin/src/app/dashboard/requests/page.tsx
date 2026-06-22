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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/cn';
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

const PAGE_SIZE = 20;

interface Filters {
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
  searchParams: Promise<Filters>;
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

  return (
    <div className="flex flex-col gap-5 lg:gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="الطلبات"
        description="متابعة طلبات العملاء والاستفسارات التشغيلية المرتبطة بالمشاريع والوحدات."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الطلبات' },
        ]}
      />

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="compact"
        cols={4}
        metrics={[
          {
            label: 'إجمالي الاستفسارات',
            value: grandTotal,
            icon: <MessageSquareText />,
            tone: 'brand',
            primary: true,
          },
          {
            label: 'مفتوح',
            value: openCount,
            icon: <Inbox />,
            tone: 'warning',
          },
          {
            label: 'تم الرد',
            value: respondedCount,
            icon: <CheckCircle2 />,
            tone: 'success',
          },
          {
            label: 'مغلق',
            value: closedCount,
            icon: <Archive />,
            tone: 'info',
          },
        ]}
      />

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {res.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذّر تحميل الاستفسارات: {res.error}</p>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <PremiumFilterBar method="get" action="/dashboard/requests">
        <PremiumFilterField label="الحالة" htmlFor="req-status">
          <Select id="req-status" name="status" inputSize="sm" defaultValue={statusFilter} className="w-40 shrink-0">
            <option value="">الكل</option>
            <option value="OPEN">مفتوح</option>
            <option value="RESPONDED">تم الرد</option>
            <option value="CLOSED">مغلق</option>
          </Select>
        </PremiumFilterField>

        <div className="flex items-center gap-2 ms-auto shrink-0">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {statusFilter && (
            <Link href={'/dashboard/requests' as never}>
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </PremiumFilterBar>

      {/* ── Requests table ───────────────────────────────────────────────────── */}
      <PremiumSectionCard
        icon={<MessageSquareText />}
        title="سجل الاستفسارات"
        description="رسائل الاستفسار الواردة من نموذج التواصل والموقع — من الزوّار والعملاء المسجّلين."
        padded={false}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">
            {total.toLocaleString('ar-EG')} استفسار
          </span>
        }
      >
        {rows.length === 0 && !res.error ? (
          <PremiumEmptyState
            icon={<MessageSquareText />}
            title="لا توجد استفسارات بعد"
            description="ستظهر هنا رسائل الاستفسار الواردة من نموذج التواصل في الموقع، سواء من الزوّار أو العملاء المسجّلين."
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">المُرسِل</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">النوع</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">بيانات الاتصال</th>
                  <th className="text-start py-3 px-4">الرسالة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">السياق</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">الحالة</th>
                  <th className="text-start py-3 ps-4 pe-5 whitespace-nowrap">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((req) => {
                  const contact = contactOf(req);
                  const badge = submitterBadge(req);
                  const status = STATUS_LABEL[req.status] ?? { label: req.status, tone: 'gray' as const };
                  const waDigits = contact.phone?.replace(/\D/g, '') ?? '';
                  const projectName = req.project ? tx(req.project.name) : null;
                  return (
                    <tr
                      key={req.id}
                      className="group border-b border-hairline align-top hover:bg-canvas/40 transition-colors duration-100"
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
        )}
      </PremiumSectionCard>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {res.data && total > PAGE_SIZE && (
        <Pagination
          page={res.data.meta.page}
          pageSize={res.data.meta.pageSize}
          total={total}
          basePath="/dashboard/requests"
          params={{ status: statusFilter || undefined }}
        />
      )}
    </div>
  );
}
