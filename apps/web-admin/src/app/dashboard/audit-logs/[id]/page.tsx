import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ScrollText } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AuditLogItem } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Map an `entityType` path-prefix → admin route that owns that entity. The
// audit interceptor records URL path segments (e.g. "v1/brokers",
// "v1/broker-payouts") so we match on `endsWith` against a stable suffix.
const RELATED_LINK_MAP: Array<{ match: string; build: (id: string) => string }> = [
  { match: 'brokers', build: (id) => `/dashboard/brokers/${id}` },
  { match: 'broker-users', build: (id) => `/dashboard/brokers/${id}` },
  { match: 'broker-leads', build: (id) => `/dashboard/broker-leads/${id}` },
  { match: 'broker-reservations', build: (id) => `/dashboard/broker-reservations/${id}` },
  { match: 'broker-contracts', build: (id) => `/dashboard/broker-contracts/${id}` },
  { match: 'broker-commissions', build: (id) => `/dashboard/broker-commissions/${id}` },
  { match: 'broker-payouts', build: (id) => `/dashboard/broker-payouts/${id}` },
  { match: 'reservations', build: (id) => `/dashboard/reservations/${id}` },
  { match: 'contracts', build: (id) => `/dashboard/contracts/${id}` },
];

function relatedHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  for (const { match, build } of RELATED_LINK_MAP) {
    if (entityType.endsWith(match)) return build(entityId);
  }
  return null;
}

function jsonPreview(value: unknown): string {
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default async function AuditLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await safe(api.get<AuditLogItem>(`/audit-logs/${id}`));
  if (res.error || !res.data) notFound();
  const log = res.data;

  const link = relatedHref(log.entityType, log.entityId);
  const beforeJson = jsonPreview(log.before);
  const afterJson = jsonPreview(log.after);

  return (
    <div className="space-y-5">
      <PageHeader
        title="تفاصيل سجل التدقيق"
        description="عرض كامل لما تغيّر، من قِبل من، ومن أين."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'سجلات التدقيق', href: '/dashboard/audit-logs' },
          { label: id.slice(0, 8) },
        ]}
        meta={<ScrollText className="h-4 w-4 text-brand-600" />}
        actions={
          <Link href="/dashboard/audit-logs">
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للقائمة
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">المستخدم</h2>
          {log.actor ? (
            <dl className="text-sm space-y-2">
              <div>
                <dt className="text-2xs text-slate-500">الاسم</dt>
                <dd className="font-medium text-slate-900">{log.actor.fullName}</dd>
              </div>
              <div>
                <dt className="text-2xs text-slate-500">الدور</dt>
                <dd className="font-mono text-xs" dir="ltr">{log.actor.role}</dd>
              </div>
              {log.actor.email && (
                <div>
                  <dt className="text-2xs text-slate-500">البريد</dt>
                  <dd className="text-xs" dir="ltr">{log.actor.email}</dd>
                </div>
              )}
              {log.actor.phone && (
                <div>
                  <dt className="text-2xs text-slate-500">الجوال</dt>
                  <dd className="text-xs" dir="ltr">{log.actor.phone}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-500">نظام / غير معروف</p>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">بيانات الطلب</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-2xs text-slate-500">الإجراء</dt>
              <dd className="font-mono text-xs" dir="ltr">{log.action}</dd>
            </div>
            <div>
              <dt className="text-2xs text-slate-500">المساحة</dt>
              <dd className="font-mono text-xs" dir="ltr">{log.entityType}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-2xs text-slate-500">المعرّف</dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-700" dir="ltr">
                  {log.entityId ?? '—'}
                </span>
                {link && (
                  <Link href={link as never}>
                    <Button variant="ghost" size="sm">فتح السجل المرتبط</Button>
                  </Link>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-2xs text-slate-500">IP</dt>
              <dd className="font-mono text-xs text-slate-700" dir="ltr">{log.ip ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-2xs text-slate-500">وقت الحدث</dt>
              <dd className="text-xs">{formatDateTime(log.createdAt)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">القيمة قبل التغيير</h2>
        {beforeJson ? (
          <pre className="max-h-96 overflow-auto rounded-xl border border-hairline bg-surface-muted/40 p-3 text-2xs text-slate-800 leading-relaxed scrollbar-thin" dir="ltr">
            {beforeJson}
          </pre>
        ) : (
          <p className="text-2xs text-slate-500">
            غير متوفر — المعترض الحالي لا يلتقط القيمة السابقة. راجع وثيقة المرحلة 15 للقيود المعروفة.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">القيمة بعد التغيير</h2>
        {afterJson ? (
          <pre className="max-h-[32rem] overflow-auto rounded-xl border border-hairline bg-surface-muted/40 p-3 text-2xs text-slate-800 leading-relaxed scrollbar-thin" dir="ltr">
            {afterJson}
          </pre>
        ) : (
          <p className="text-2xs text-slate-500">غير متوفر</p>
        )}
      </Card>
    </div>
  );
}
