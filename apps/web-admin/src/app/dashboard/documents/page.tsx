import Link from 'next/link';
import { ExternalLink, Eye, FileText, Plus } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  DocumentCategory,
  DocumentItem,
  DocumentOwnerType,
  Paged,
} from '@/lib/types';
import { formatDateTime, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
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
  PremiumFilterBar,
  PremiumFilterField,
  PremiumEmptyState,
} from '@/components/premium';
import { FileKindTile, fileKind } from '@/components/documents/file-kind';
import { Avatar, Panel } from '@/components/cockpit/cockpit';
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

const CATEGORY_CHIP: Record<DocumentCategory, string> = {
  IMAGE:                'bg-sky-500/12 text-sky-600',
  CONTRACT:             'bg-[#D8B66A]/[0.16] text-[#9A7A2E] dark:text-[#D8B66A]',
  RECEIPT:              'bg-emerald-500/12 text-emerald-600',
  INVOICE:              'bg-emerald-500/12 text-emerald-600',
  BROKER_AGREEMENT:     'bg-violet-500/12 text-violet-600',
  COMMISSION_STATEMENT: 'bg-violet-500/12 text-violet-600',
  PAYOUT_RECEIPT:       'bg-emerald-500/12 text-emerald-600',
  ID_DOCUMENT:          'bg-amber-500/12 text-amber-600',
  LEGAL:                'bg-indigo-500/12 text-indigo-500',
  FINANCIAL:            'bg-emerald-500/12 text-emerald-600',
  OTHER:                'bg-slate-500/12 text-slate-500',
};

const ACTION_BTN =
  'inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-slate-500 transition-colors hover:border-[#C9A24E]/60 hover:text-slate-900';

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
  // Newest first unless asked otherwise (the API's own default is oldest first).
  if (!sp.sortOrder) qs.set('sortOrder', 'desc');

  const res = await safe(api.get<Paged<DocumentItem>>(`/documents?${qs.toString()}`));
  const items = res.data?.data ?? [];
  const meta = res.data?.meta;

  const totalCount = meta?.total ?? items.length;
  const newestFirst = (sp.sortOrder ?? 'desc') === 'desc';
  const lastDate = newestFirst && page === 1 ? (items[0]?.createdAt ?? null) : null;

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
          <Select name="sortOrder" inputSize="sm" defaultValue={sp.sortOrder ?? 'desc'} className="w-36">
            <option value="desc">{m.filterSortDesc}</option>
            <option value="asc">{m.filterSortAsc}</option>
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      <Panel
        testId="documents"
        title={hasFilters ? m.metricFiltered : m.sectionTitle}
        sub={m.countSub(totalCount, lastDate ? formatDate(lastDate, locale) : null)}
      >
        {items.length === 0 ? (
          <PremiumEmptyState icon={<FileText />} title={m.emptyTitle} description={m.emptyDescription} />
        ) : (
          <ul className="divide-y divide-hairline border-t border-hairline">
            {items.map((row) => {
              const oHref = ownerHref(row.ownerType, row.ownerId);
              const uploader = row.uploadedBy?.fullName;
              return (
                <li
                  key={row.id}
                  data-testid="document-row"
                  className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <FileKindTile kind={fileKind(row.mimeType, row.fileName)} />

                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/documents/${row.id}`}
                      className="block truncate text-[14px] font-bold text-slate-900 hover:text-brand-700"
                      dir="auto"
                      title={row.title || undefined}
                    >
                      {row.title || <span className="text-slate-400">{m.noTitle}</span>}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-500">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', CATEGORY_CHIP[row.category])}>
                        {CATEGORY_LABEL[row.category]}
                      </span>
                      <span className="tabular-nums">{formatFileSize(row.sizeBytes)}</span>
                    </p>
                  </div>

                  <div className="hidden min-w-0 text-[12.5px] lg:block">
                    <p className="text-[11px] text-slate-500">{m.linkedTo}</p>
                    {oHref ? (
                      <Link href={oHref as never} className="font-semibold text-slate-800 hover:text-brand-700" title={row.ownerId}>
                        {OWNER_TYPE_LABEL[row.ownerType]}
                      </Link>
                    ) : (
                      <span className="font-semibold text-slate-800">{OWNER_TYPE_LABEL[row.ownerType]}</span>
                    )}
                  </div>

                  <div className="hidden min-w-0 items-center gap-2.5 lg:flex">
                    {uploader && <Avatar name={uploader} className="h-8 w-8 text-[11px]" />}
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-slate-800">{uploader ?? '—'}</p>
                      <p className="whitespace-nowrap text-[11.5px] text-slate-500">{formatDateTime(row.createdAt, locale)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <a href={row.fileUrl} target="_blank" rel="noopener noreferrer" className={ACTION_BTN} aria-label={m.ariaOpenFile} title={m.ariaOpenFile}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <Link href={`/dashboard/documents/${row.id}`} className={ACTION_BTN} aria-label={m.ariaDocDetails} title={m.ariaDocDetails}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

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
            sortOrder: sp.sortOrder ?? 'desc',
          }}
        />
      )}
    </div>
  );
}
