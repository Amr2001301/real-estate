import Link from 'next/link';
import { Eye, ScrollText } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AuditLogItem, Paged } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  actorId?: string;
  action?: string;
  entityType?: string;
  q?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 25;

const ACTION_OPTIONS = ['POST', 'PATCH', 'PUT', 'DELETE'] as const;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const k of ['actorId', 'action', 'entityType', 'q', 'from', 'to'] as const) {
    if (sp[k]) qs.set(k, sp[k]!);
  }

  const res = await safe(api.get<Paged<AuditLogItem>>(`/audit-logs?${qs.toString()}`));
  const rows = res.data?.data ?? [];
  const meta = res.data?.meta;

  return (
    <div className="space-y-5">
      <PageHeader
        title="سجلات التدقيق"
        description="كل إجراء معدِّل يُكتب هنا تلقائيًا. الفلاتر تحفظ في رابط الصفحة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'سجلات التدقيق' },
        ]}
        meta={<ScrollText className="h-4 w-4 text-brand-600" />}
      />

      {res.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل السجلات: {res.error}
        </div>
      )}

      <form
        method="get"
        action="/dashboard/audit-logs"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 rounded-xl border border-hairline bg-white p-3 shadow-xs"
      >
        <Input
          name="q"
          inputSize="sm"
          placeholder="بحث (إجراء / نوع / id / IP)"
          defaultValue={sp.q ?? ''}
          className="col-span-2"
        />
        <Select name="action" inputSize="sm" defaultValue={sp.action ?? ''}>
          <option value="">كل الإجراءات</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>
        <Input
          name="entityType"
          inputSize="sm"
          placeholder="نوع المساحة (مثال: brokers)"
          defaultValue={sp.entityType ?? ''}
          dir="ltr"
        />
        <Input name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} />
        <Input name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} />
        <Input
          name="actorId"
          inputSize="sm"
          placeholder="معرّف المستخدم (UUID)"
          defaultValue={sp.actorId ?? ''}
          dir="ltr"
          className="col-span-2 md:col-span-3 lg:col-span-2"
        />
        <div className="col-span-2 md:col-span-3 lg:col-span-4 flex items-center justify-end gap-1.5">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {(sp.q || sp.action || sp.entityType || sp.actorId || sp.from || sp.to) && (
            <Link href="/dashboard/audit-logs">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<ScrollText />}
            title="لا توجد سجلات تدقيق"
            description="جرّب توسيع نطاق التاريخ أو إزالة الفلاتر."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-start font-semibold py-3 ps-5 pe-4">الوقت</th>
                  <th className="text-start font-semibold py-3 px-4">المستخدم</th>
                  <th className="text-start font-semibold py-3 px-4">الإجراء</th>
                  <th className="text-start font-semibold py-3 px-4">المساحة</th>
                  <th className="text-start font-semibold py-3 px-4">المعرّف</th>
                  <th className="text-start font-semibold py-3 px-4">IP</th>
                  <th className="text-end font-semibold py-3 ps-4 pe-5">تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-hairline align-top hover:bg-surface-muted/40 transition-colors">
                    <td className="py-3 ps-5 pe-4 text-xs whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                    <td className="py-3 px-4">
                      {row.actor ? (
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{row.actor.fullName}</p>
                          <p className="text-2xs text-slate-500 mt-0.5 font-mono" dir="ltr">{row.actor.role}</p>
                        </div>
                      ) : (
                        <span className="text-2xs text-slate-400">نظام / غير معروف</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs" dir="ltr">{row.action}</td>
                    <td className="py-3 px-4 font-mono text-xs" dir="ltr">{row.entityType}</td>
                    <td className="py-3 px-4 font-mono text-2xs text-slate-600" dir="ltr">
                      {row.entityId ? `${row.entityId.slice(0, 8)}…` : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-2xs text-slate-600" dir="ltr">{row.ip ?? '—'}</td>
                    <td className="py-3 ps-4 pe-5 text-end">
                      <Link href={`/dashboard/audit-logs/${row.id}`}>
                        <Button variant="ghost" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />}>
                          عرض
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {meta && meta.total > meta.pageSize && (
        <Pagination
          basePath="/dashboard/audit-logs"
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          params={{
            actorId: sp.actorId,
            action: sp.action,
            entityType: sp.entityType,
            q: sp.q,
            from: sp.from,
            to: sp.to,
          }}
        />
      )}
    </div>
  );
}
