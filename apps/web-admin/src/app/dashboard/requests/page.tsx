import {
  MessageSquareText,
  Phone,
  Mail,
  MessageCircle,
  AlertCircle,
  Building2,
  Home,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Paged, AdminInfoRequest } from '@/lib/types';
import { formatDateTime, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const PAGE_SIZE = 20;

interface Search {
  page?: string;
}

/** Submitter type derived from userId + role. Guest inquiries have no userId. */
function submitterBadge(req: AdminInfoRequest): { label: string; tone: 'gray' | 'info' | 'success' } {
  if (!req.userId) return { label: 'زائر', tone: 'gray' };
  if (req.user?.role === 'CUSTOMER') return { label: 'عميل (مالك)', tone: 'success' };
  return { label: 'عميل (متصفّح)', tone: 'info' };
}

/** Contact details, preferring the authenticated user then the guest lead. */
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

  const res = await safe(
    api.get<Paged<AdminInfoRequest>>(`/info-requests?page=${page}&pageSize=${PAGE_SIZE}`),
  );

  const rows = res.data?.data ?? [];
  const total = res.data?.meta.total ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="استفسارات العملاء"
        description="رسائل الاستفسار العامة الواردة من نموذج التواصل والموقع — من الزوّار والعملاء المسجّلين. طلبات الزيارة تُدار من صفحة الزيارات."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'استفسارات العملاء' },
        ]}
      />

      {res.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="font-medium">تعذّر تحميل الاستفسارات: {res.error}</p>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
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
                    className="border-t border-hairline align-top hover:bg-surface-muted/40 transition-colors"
                  >
                    <td className="py-3 ps-5 pe-4">
                      <div className="font-semibold text-slate-900">{contact.name}</div>
                      <p className="text-2xs text-slate-400 mt-0.5 font-mono">
                        ID: #{req.id.slice(0, 8).toUpperCase()}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <Badge tone={badge.tone} variant="soft" size="sm">
                        {badge.label}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1.5">
                        {contact.phone ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${contact.phone}`}
                              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-brand-700 font-mono text-xs"
                              dir="ltr"
                            >
                              <Phone className="h-3 w-3 text-slate-400" />
                              {contact.phone}
                            </a>
                            <a
                              href={`https://wa.me/${waDigits}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="مراسلة عبر واتساب"
                              className="inline-flex items-center text-success-600 hover:text-success-700"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        ) : null}
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="inline-flex items-center gap-1.5 text-slate-700 hover:text-brand-700 text-xs"
                            dir="ltr"
                          >
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span className="truncate max-w-[200px]">{contact.email}</span>
                          </a>
                        ) : null}
                        {!contact.phone && !contact.email && (
                          <span className="text-slate-400 text-xs">لا توجد بيانات اتصال</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <p className="line-clamp-2 text-slate-700 whitespace-pre-wrap">{req.message}</p>
                      {req.message.length > 120 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-2xs font-medium text-brand-600 hover:text-brand-700">
                            عرض كامل
                          </summary>
                          <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-600">
                            {req.message}
                          </p>
                        </details>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {projectName ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{projectName}</span>
                        </div>
                      ) : null}
                      {req.unit ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                          <Home className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono">{req.unit.code}</span>
                        </div>
                      ) : null}
                      {!projectName && !req.unit && <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <Badge tone={status.tone} variant="soft" size="sm" dot>
                        {status.label}
                      </Badge>
                    </td>
                    <td className="py-3 ps-4 pe-5 text-slate-500 text-xs whitespace-nowrap">
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
          />
        )}
      </Card>
    </div>
  );
}
