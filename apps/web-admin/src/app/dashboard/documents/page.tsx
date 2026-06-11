import Link from 'next/link';
import type { ReactNode } from 'react';
import { Clock, ExternalLink, Eye, FileText, List, Plus } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  DocumentCategory,
  DocumentItem,
  DocumentOwnerType,
  Paged,
} from '@/lib/types';
import { formatDateTime, formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge, type BadgeTone } from '@/components/ui/badge';
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
  category?: DocumentCategory;
  q?: string;
  sortOrder?: 'asc' | 'desc';
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
  'MAINTENANCE_REQUEST',
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

// ── Badge tone maps (display-only — do not affect backend enums) ──────────────

const CATEGORY_TONE: Record<DocumentCategory, BadgeTone> = {
  IMAGE:                'gray',
  CONTRACT:             'info',
  RECEIPT:              'success',
  INVOICE:              'success',
  BROKER_AGREEMENT:     'purple',
  COMMISSION_STATEMENT: 'purple',
  PAYOUT_RECEIPT:       'success',
  ID_DOCUMENT:          'warning',
  LEGAL:                'info',
  FINANCIAL:            'success',
  OTHER:                'gray',
};

const OWNER_TYPE_TONE: Record<DocumentOwnerType, BadgeTone> = {
  PROJECT:             'brand',
  UNIT:                'brand',
  LEAD:                'info',
  RESERVATION:         'brand',
  CONTRACT:            'info',
  DEPOSIT:             'success',
  BROKER:              'purple',
  BROKER_COMMISSION:   'purple',
  BROKER_PAYOUT:       'success',
  MAINTENANCE_REQUEST: 'warning',
  USER:                'gray',
  OTHER:               'gray',
};

// Shared icon-only action button class — matches Deposits/Maintenance style.
const ACTION_BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-surface text-slate-500 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700';

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const k of ['ownerType', 'category', 'q', 'sortOrder'] as const) {
    if (sp[k]) qs.set(k, sp[k]!);
  }
  if (!sp.sortOrder) qs.set('sortOrder', 'asc');

  const res = await safe(api.get<Paged<DocumentItem>>(`/documents?${qs.toString()}`));
  const items = res.data?.data ?? [];
  const meta = res.data?.meta;

  // ── Summary strip derivations (from already-fetched data only) ───────────
  const totalCount = meta?.total ?? items.length;
  const totalPages = meta ? Math.ceil(meta.total / PAGE_SIZE) : 1;
  // Backend sorts createdAt DESC, so items[0] is always the most recently uploaded.
  const lastDate = items.length > 0 ? (items[0]?.createdAt ?? null) : null;

  const hasFilters = !!(sp.q || sp.ownerType || sp.category);

  return (
    <div className="space-y-5">
      <PageHeader
        title="مركز المستندات"
        description="إدارة ملفات العملاء، العقود، المرفقات، ومستندات الكيانات داخل المنصة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المستندات' },
        ]}
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

      {/* ── Summary strip ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-hairline bg-surface px-5 py-3.5 shadow-xs">
        <SummaryPill
          icon={<FileText className="h-3.5 w-3.5" />}
          label={hasFilters ? 'نتائج التصفية' : 'الإجمالي'}
          value={totalCount}
        />
        {totalPages > 1 && (
          <>
            <div className="w-px h-6 bg-hairline shrink-0 hidden sm:block" aria-hidden />
            <SummaryPill
              icon={<List className="h-3.5 w-3.5" />}
              label="الصفحة"
              value={`${page} / ${totalPages}`}
            />
          </>
        )}
        {lastDate && (
          <>
            <div className="w-px h-6 bg-hairline shrink-0 hidden sm:block" aria-hidden />
            <SummaryPill
              icon={<Clock className="h-3.5 w-3.5" />}
              label="آخر رفع"
              value={formatDate(lastDate)}
            />
          </>
        )}
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <form
        method="get"
        action="/dashboard/documents"
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-surface px-3 py-3 shadow-xs"
      >
        <Input
          name="q"
          inputSize="sm"
          placeholder="بحث باسم الشخص"
          defaultValue={sp.q ?? ''}
          className="flex-1 min-w-[180px]"
        />
        <Select name="ownerType" inputSize="sm" defaultValue={sp.ownerType ?? ''} className="w-36">
          <option value="">كل المالكين</option>
          {OWNER_TYPES.map((t) => (
            <option key={t} value={t}>{OWNER_TYPE_LABEL[t]}</option>
          ))}
        </Select>
        <Select name="category" inputSize="sm" defaultValue={sp.category ?? ''} className="w-36">
          <option value="">كل التصنيفات</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </Select>
        <Select name="sortOrder" inputSize="sm" defaultValue={sp.sortOrder ?? 'asc'} className="w-36">
          <option value="asc">الأقدم أولًا</option>
          <option value="desc">الأحدث أولًا</option>
        </Select>
        <div className="ms-auto flex items-center gap-2">
          <Button type="submit" variant="primary" size="sm">تصفية</Button>
          {hasFilters && (
            <Link href="/dashboard/documents">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </div>
      </form>

      {/* ── Documents table ──────────────────────────────────────────────── */}
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
                  <th className="text-start font-semibold py-2.5 ps-5 pe-4 w-[35%]">العنوان</th>
                  <th className="text-start font-semibold py-2.5 px-4">التصنيف</th>
                  <th className="text-start font-semibold py-2.5 px-4">المالك</th>
                  <th className="text-start font-semibold py-2.5 px-4">الحجم</th>
                  <th className="text-start font-semibold py-2.5 px-4">رفع بواسطة</th>
                  <th className="text-start font-semibold py-2.5 px-4">الوقت</th>
                  <th className="text-end font-semibold py-2.5 ps-4 pe-5">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const oHref = ownerHref(row.ownerType, row.ownerId);
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-hairline hover:bg-surface-muted/40 align-middle transition-colors"
                    >
                      {/* ── Title + filename ── */}
                      <td className="py-3 ps-5 pe-4">
                        <div className="max-w-[280px]">
                          <Link
                            href={`/dashboard/documents/${row.id}`}
                            className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700"
                            dir="auto"
                            title={row.title || undefined}
                          >
                            {row.title || <span className="text-slate-400">مستند بدون عنوان</span>}
                          </Link>
                          {row.fileName && (
                            <p className="mt-0.5 truncate text-2xs text-slate-400 font-mono" dir="ltr">
                              {row.fileName}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* ── Category badge ── */}
                      <td className="py-3 px-4">
                        <Badge tone={CATEGORY_TONE[row.category]} size="sm">
                          {CATEGORY_LABEL[row.category]}
                        </Badge>
                      </td>

                      {/* ── Owner: badge IS the link when a route exists ── */}
                      <td className="py-3 px-4">
                        {oHref ? (
                          <Link
                            href={oHref as never}
                            className="inline-flex hover:opacity-75 transition-opacity"
                            title={row.ownerId}
                          >
                            <Badge tone={OWNER_TYPE_TONE[row.ownerType]} size="sm">
                              {OWNER_TYPE_LABEL[row.ownerType]}
                            </Badge>
                          </Link>
                        ) : (
                          <Badge tone={OWNER_TYPE_TONE[row.ownerType]} size="sm">
                            {OWNER_TYPE_LABEL[row.ownerType]}
                          </Badge>
                        )}
                      </td>

                      {/* ── File size ── */}
                      <td className="py-3 px-4 text-xs tabular-nums text-slate-500 whitespace-nowrap">
                        {formatFileSize(row.sizeBytes)}
                      </td>

                      {/* ── Uploaded by ── */}
                      <td className="py-3 px-4">
                        <p className="text-xs text-slate-800">{row.uploadedBy?.fullName ?? '—'}</p>
                        {row.uploadedBy?.email && (
                          <p className="mt-0.5 truncate text-2xs text-slate-400 max-w-[140px]">
                            {row.uploadedBy.email}
                          </p>
                        )}
                      </td>

                      {/* ── Timestamp ── */}
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatDateTime(row.createdAt)}
                      </td>

                      {/* ── Icon-only action buttons ── */}
                      <td className="py-3 ps-4 pe-5 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={row.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={ACTION_BTN}
                            aria-label="فتح الملف"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <Link
                            href={`/dashboard/documents/${row.id}`}
                            className={ACTION_BTN}
                            aria-label="تفاصيل المستند"
                          >
                            <Eye className="h-4 w-4" />
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
            category: sp.category,
            q: sp.q,
            sortOrder: sp.sortOrder ?? 'asc',
          }}
        />
      )}
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function SummaryPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-2xs text-slate-500 leading-none">{label}</span>
        <span className="text-sm font-bold tabular-nums leading-none text-slate-800">{value}</span>
      </div>
    </div>
  );
}
