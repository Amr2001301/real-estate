import Link from 'next/link';
import { ExternalLink, Eye, FileText, Plus } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  DocumentCategory,
  DocumentItem,
  DocumentOwnerType,
  Paged,
} from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import {
  CATEGORY_LABEL,
  OWNER_TYPE_LABEL,
  formatFileSize,
  ownerHref,
} from '@/components/documents/labels';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  ownerType?: DocumentOwnerType;
  ownerId?: string;
  category?: DocumentCategory;
  q?: string;
  from?: string;
  to?: string;
  ok?: string;
  err?: string;
}

const PAGE_SIZE = 25;

const OWNER_TYPES: DocumentOwnerType[] = [
  'PROJECT',
  'UNIT',
  'LEAD',
  'RESERVATION',
  'CONTRACT',
  'DEPOSIT',
  'BROKER',
  'BROKER_COMMISSION',
  'BROKER_PAYOUT',
  'USER',
  'OTHER',
];

const CATEGORIES: DocumentCategory[] = [
  'CONTRACT',
  'RECEIPT',
  'INVOICE',
  'BROKER_AGREEMENT',
  'COMMISSION_STATEMENT',
  'PAYOUT_RECEIPT',
  'ID_DOCUMENT',
  'LEGAL',
  'FINANCIAL',
  'IMAGE',
  'OTHER',
];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const k of ['ownerType', 'ownerId', 'category', 'q', 'from', 'to'] as const) {
    if (sp[k]) qs.set(k, sp[k]!);
  }

  const res = await safe(api.get<Paged<DocumentItem>>(`/documents?${qs.toString()}`));
  const items = res.data?.data ?? [];
  const meta = res.data?.meta;

  return (
    <div className="space-y-5">
      <PageHeader
        title="مركز المستندات"
        description="إدارة ومراجعة جميع المستندات المرتبطة بالكيانات الإدارية. التحميلات الجديدة تحفظ تلقائيًا في سجل التدقيق."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المستندات' },
        ]}
        meta={<FileText className="h-4 w-4 text-brand-600" />}
        actions={
          <Link href="/dashboard/documents/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              إضافة مستند
            </Button>
          </Link>
        }
      />

      {sp.ok && (
        <div className="rounded-2xl bg-success-50 border border-success-100 text-success-700 p-4 text-sm">
          تم حذف المستند.
        </div>
      )}
      {sp.err && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {sp.err}
        </div>
      )}
      {res.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل المستندات: {res.error}
        </div>
      )}

      <form
        method="get"
        action="/dashboard/documents"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 rounded-xl border border-hairline bg-white p-3 shadow-xs"
      >
        <Input
          name="q"
          inputSize="sm"
          placeholder="بحث (عنوان / وصف / اسم الملف)"
          defaultValue={sp.q ?? ''}
          className="col-span-2"
        />
        <Select name="ownerType" inputSize="sm" defaultValue={sp.ownerType ?? ''}>
          <option value="">كل المالكين</option>
          {OWNER_TYPES.map((t) => (
            <option key={t} value={t}>{OWNER_TYPE_LABEL[t]}</option>
          ))}
        </Select>
        <Select name="category" inputSize="sm" defaultValue={sp.category ?? ''}>
          <option value="">كل التصنيفات</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </Select>
        <Input name="from" inputSize="sm" type="date" defaultValue={sp.from ?? ''} />
        <Input name="to" inputSize="sm" type="date" defaultValue={sp.to ?? ''} />
        <Input
          name="ownerId"
          inputSize="sm"
          placeholder="معرّف المالك (UUID)"
          defaultValue={sp.ownerId ?? ''}
          dir="ltr"
          className="col-span-2 md:col-span-3"
        />
        <div className="col-span-2 md:col-span-3 lg:col-span-3 flex items-center gap-1.5 justify-end">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {(sp.q || sp.ownerType || sp.ownerId || sp.category || sp.from || sp.to) && (
            <Link href="/dashboard/documents">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="لا توجد مستندات"
            description="ابدأ بإضافة أول مستند من زر «إضافة مستند» أعلى الصفحة."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted/60 text-2xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-start font-semibold py-3 ps-5 pe-4">العنوان</th>
                  <th className="text-start font-semibold py-3 px-4">التصنيف</th>
                  <th className="text-start font-semibold py-3 px-4">المالك</th>
                  <th className="text-start font-semibold py-3 px-4">الحجم</th>
                  <th className="text-start font-semibold py-3 px-4">رفع بواسطة</th>
                  <th className="text-start font-semibold py-3 px-4">الوقت</th>
                  <th className="text-end font-semibold py-3 ps-4 pe-5">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const oHref = ownerHref(row.ownerType, row.ownerId);
                  return (
                    <tr key={row.id} className="border-t border-hairline hover:bg-surface-muted/40 align-top transition-colors">
                      <td className="py-3 ps-5 pe-4 min-w-0">
                        <Link href={`/dashboard/documents/${row.id}`} className="font-medium text-slate-900 hover:text-brand-700 truncate block max-w-xs">
                          {row.title}
                        </Link>
                        {row.fileName && (
                          <p className="text-2xs text-slate-500 mt-0.5 font-mono truncate" dir="ltr">{row.fileName}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">{CATEGORY_LABEL[row.category]}</td>
                      <td className="py-3 px-4 text-xs">
                        <p>{OWNER_TYPE_LABEL[row.ownerType]}</p>
                        {oHref ? (
                          <Link href={oHref as never} className="text-2xs text-brand-700 hover:text-brand-800 font-mono" dir="ltr">
                            {row.ownerId.slice(0, 8)}…
                          </Link>
                        ) : (
                          <span className="text-2xs text-slate-500 font-mono" dir="ltr">{row.ownerId.slice(0, 8)}…</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs tabular-nums">{formatFileSize(row.sizeBytes)}</td>
                      <td className="py-3 px-4 text-xs">{row.uploadedBy?.fullName ?? '—'}</td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                      <td className="py-3 ps-4 pe-5 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <a href={row.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>
                              فتح
                            </Button>
                          </a>
                          <Link href={`/dashboard/documents/${row.id}`}>
                            <Button variant="ghost" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />}>
                              تفاصيل
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {meta && meta.total > meta.pageSize && (
        <Pagination
          basePath="/dashboard/documents"
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          params={{
            ownerType: sp.ownerType,
            ownerId: sp.ownerId,
            category: sp.category,
            q: sp.q,
            from: sp.from,
            to: sp.to,
          }}
        />
      )}
    </div>
  );
}
