import Link from 'next/link';
import { Clock, ExternalLink, Eye, FileText, List, Plus } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  DocumentCategory,
  DocumentItem,
  DocumentOwnerType,
  Paged,
} from '@/lib/types';
import { formatDateTime, formatDate } from '@/lib/format';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import {
  CATEGORY_LABEL,
  OWNER_TYPE_LABEL,
  formatFileSize,
  ownerHref,
} from '@/components/documents/labels';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

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

const ACTION_BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-surface text-slate-500 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700';

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const [sp, locale] = await Promise.all([searchParams, getLocale()]);
  const m = uiT(locale).documentsPage;

  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const k of ['ownerType', 'category', 'q', 'sortOrder'] as const) {
    if (sp[k]) qs.set(k, sp[k]!);
  }
  if (!sp.sortOrder) qs.set('sortOrder', 'asc');

  const res = await safe(api.get<Paged<DocumentItem>>(`/documents?${qs.toString()}`));
  const items = res.data?.data ?? [];
  const meta = res.data?.meta;

  const totalCount = meta?.total ?? items.length;
  const totalPages = meta ? Math.ceil(meta.total / PAGE_SIZE) : 1;
  const lastDate = items.length > 0 ? (items[0]?.createdAt ?? null) : null;

  const hasFilters = !!(sp.q || sp.ownerType || sp.category);

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbDocuments },
        ]}
        actions={
          <Link href="/dashboard/documents/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              {m.addDocument}
            </Button>
          </Link>
        }
      />

      {sp.ok && (
        <div className="rounded-2xl bg-success-50 border border-success-100 text-success-700 p-4 text-sm">
          {m.deleteSuccess}
        </div>
      )}
      {sp.err && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {sp.err}
        </div>
      )}
      {res.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {m.loadError}: {res.error}
        </div>
      )}

      <PremiumMetricStrip
        variant="compact"
        metrics={[
          {
            label: hasFilters ? m.metricFiltered : m.metricTotal,
            value: totalCount,
            icon: <FileText className="h-4 w-4" />,
            primary: true,
            tone: 'brand',
          },
          {
            label: m.metricLastUpload,
            value: lastDate ? formatDate(lastDate) : '—',
            icon: <Clock className="h-4 w-4" />,
            tone: 'neutral',
            valueSize: 'compact',
          },
          ...(totalPages > 1
            ? [
                {
                  label: m.metricPage,
                  value: `${page} / ${totalPages}`,
                  icon: <List className="h-4 w-4" />,
                  tone: 'neutral' as const,
                },
              ]
            : []),
        ]}
        cols={totalPages > 1 ? 3 : 2}
      />

      <PremiumFilterBar
        method="get"
        action="/dashboard/documents"
        trailing={
          <div className="flex items-center gap-1.5">
            <Button type="submit" variant="primary" size="sm">{m.btnFilter}</Button>
            {hasFilters && (
              <Link href="/dashboard/documents">
                <Button type="button" variant="ghost" size="sm">{m.btnClear}</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label={m.filterSearch}>
          <Input
            name="q"
            inputSize="sm"
            placeholder={m.filterSearchPlaceholder}
            defaultValue={sp.q ?? ''}
            className="min-w-[180px]"
          />
        </PremiumFilterField>
        <PremiumFilterField label={m.filterOwnerType}>
          <Select name="ownerType" inputSize="sm" defaultValue={sp.ownerType ?? ''} className="w-36">
            <option value="">{m.filterOwnerTypeAll}</option>
            {OWNER_TYPES.map((t) => (
              <option key={t} value={t}>{OWNER_TYPE_LABEL[t]}</option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label={m.filterCategory}>
          <Select name="category" inputSize="sm" defaultValue={sp.category ?? ''} className="w-36">
            <option value="">{m.filterCategoryAll}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label={m.filterSort}>
          <Select name="sortOrder" inputSize="sm" defaultValue={sp.sortOrder ?? 'asc'} className="w-36">
            <option value="asc">{m.filterSortAsc}</option>
            <option value="desc">{m.filterSortDesc}</option>
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      <PremiumSectionCard
        title={m.sectionTitle}
        trailing={
          meta ? (
            <span className="text-xs text-slate-400 tabular-nums">
              {meta.total.toLocaleString('ar-EG')} {m.sectionCount}
            </span>
          ) : undefined
        }
        padded={false}
      >
        {items.length === 0 ? (
          <PremiumEmptyState
            icon={<FileText />}
            title={m.emptyTitle}
            description={m.emptyDescription}
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 ps-5 pe-4 w-[35%]">{m.colTitle}</th>
                  <th className="text-start py-3 px-4">{m.colCategory}</th>
                  <th className="text-start py-3 px-4">{m.colOwner}</th>
                  <th className="text-start py-3 px-4">{m.colSize}</th>
                  <th className="text-start py-3 px-4">{m.colUploadedBy}</th>
                  <th className="text-start py-3 px-4">{m.colTime}</th>
                  <th className="text-end py-3 ps-4 pe-5">{m.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {items.map((row) => {
                  const oHref = ownerHref(row.ownerType, row.ownerId);
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-canvas/40 transition-colors duration-100 align-middle"
                    >
                      <td className="py-3 ps-5 pe-4">
                        <div className="max-w-[280px]">
                          <Link
                            href={`/dashboard/documents/${row.id}`}
                            className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700"
                            dir="auto"
                            title={row.title || undefined}
                          >
                            {row.title || (
                              <span className="text-slate-400">{m.noTitle}</span>
                            )}
                          </Link>
                          {row.fileName && (
                            <p
                              className="mt-0.5 truncate text-2xs text-slate-400 font-mono"
                              dir="ltr"
                            >
                              {row.fileName}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <Badge tone={CATEGORY_TONE[row.category]} size="sm">
                          {CATEGORY_LABEL[row.category]}
                        </Badge>
                      </td>

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

                      <td className="py-3 px-4 text-xs tabular-nums text-slate-500 whitespace-nowrap">
                        {formatFileSize(row.sizeBytes)}
                      </td>

                      <td className="py-3 px-4">
                        <p className="text-xs text-slate-800">{row.uploadedBy?.fullName ?? '—'}</p>
                        {row.uploadedBy?.email && (
                          <p className="mt-0.5 truncate text-2xs text-slate-400 max-w-[140px]">
                            {row.uploadedBy.email}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatDateTime(row.createdAt)}
                      </td>

                      <td className="py-3 ps-4 pe-5 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={row.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={ACTION_BTN}
                            aria-label={m.ariaOpenFile}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <Link
                            href={`/dashboard/documents/${row.id}`}
                            className={ACTION_BTN}
                            aria-label={m.ariaDocDetails}
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
      </PremiumSectionCard>

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
