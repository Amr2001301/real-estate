import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight, ChevronLeft, Download, ExternalLink, Trash2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { DocumentItem } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { ConfirmingForm } from '@/components/confirming-form';
import {
  CATEGORY_LABEL,
  OWNER_TYPE_LABEL,
  VISIBILITY_LABEL,
  formatFileSize,
  ownerHref,
} from '@/components/documents/labels';
import { FileKindTile, fileKind } from '@/components/documents/file-kind';
import { Avatar } from '@/components/cockpit/cockpit';
import { softDeleteDocumentAction } from '../actions';
import { PremiumPageHero } from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const VISIBILITY_CHIP: Record<string, string> = {
  ADMIN_ONLY: 'bg-slate-500/12 text-slate-500',
  BROKER_VISIBLE: 'bg-violet-500/12 text-violet-600',
  CUSTOMER_VISIBLE: 'bg-emerald-500/12 text-emerald-600',
};

/**
 * One document: the file itself up front (kind, name, size, open and
 * download), its details in a 2×2 grid with the linked record as a link,
 * then who uploaded it and the delete action.
 */
export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [res, locale] = await Promise.all([
    safe(api.get<DocumentItem>(`/documents/${id}`)),
    getLocale(),
  ]);
  if (res.error || !res.data) notFound();
  const doc = res.data;
  const oHref = ownerHref(doc.ownerType, doc.ownerId);
  const t = uiT(locale);
  const m = t.documentsDetailPage;
  const roleLabels = t.userPermissionsPage?.roleLabels as Record<string, string> | undefined;
  const kind = fileKind(doc.mimeType, doc.fileName);

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={doc.title}
        description={doc.description ?? undefined}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbDocuments, href: '/dashboard/documents' },
          { label: doc.title },
        ]}
        actions={
          <Link href="/dashboard/documents">
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4 rtl:rotate-180" />}>
              {m.backButton}
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        <div className="space-y-6 xl:col-span-2">
          {/* The file */}
          <section data-testid="document-file" className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
            {kind === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={doc.fileUrl} alt={doc.title} className="max-h-[420px] w-full border-b border-hairline bg-surface-muted object-contain" />
            )}
            <div className="flex flex-wrap items-center gap-5 p-6">
              <FileKindTile kind={kind} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-bold text-slate-900" dir="auto">{doc.fileName ?? doc.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-slate-500">
                  <span className="tabular-nums" dir="ltr">{formatFileSize(doc.sizeBytes)}</span>
                  <span aria-hidden>·</span>
                  <span>{formatDateTime(doc.createdAt, locale)}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="primary" size="md" leftIcon={<ExternalLink className="h-4 w-4" />}>
                    {m.openFileButton}
                  </Button>
                </a>
                <a href={doc.fileUrl} download={doc.fileName ?? undefined}>
                  <Button variant="outline" size="md" leftIcon={<Download className="h-4 w-4" />}>
                    {m.downloadButton}
                  </Button>
                </a>
              </div>
            </div>
          </section>

          {/* Details, 2×2 */}
          <section className="rounded-[22px] border border-hairline bg-surface">
            <h2 className="px-6 pb-3 pt-5 font-heading text-[18px] font-bold text-slate-900">{m.sectionDetails}</h2>
            <dl data-testid="document-details" className="grid grid-cols-1 border-t border-hairline sm:grid-cols-2">
              {[
                {
                  label: m.fieldCategory,
                  value: <span className="text-[15px] font-bold text-slate-900">{CATEGORY_LABEL[doc.category]}</span>,
                },
                {
                  label: m.fieldVisibility,
                  value: (
                    <span className={cn('rounded-full px-2.5 py-1 text-[12px] font-bold', VISIBILITY_CHIP[doc.visibility])}>
                      {VISIBILITY_LABEL[doc.visibility]}
                    </span>
                  ),
                },
                {
                  label: m.fieldLinked,
                  value: oHref ? (
                    <Link href={oHref as never} className="inline-flex items-center gap-1.5 text-[15px] font-bold text-brand-700 hover:text-brand-600">
                      {OWNER_TYPE_LABEL[doc.ownerType]}
                      <span className="text-[12px] font-semibold">· {m.openLinked}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <span className="text-[15px] font-bold text-slate-900">{OWNER_TYPE_LABEL[doc.ownerType]}</span>
                  ),
                },
                {
                  label: m.fieldCreatedAt,
                  value: <span className="text-[15px] font-bold tabular-nums text-slate-900">{formatDateTime(doc.createdAt, locale)}</span>,
                },
              ].map((f, i) => (
                <div
                  key={f.label}
                  className={cn(
                    'px-6 py-5',
                    i % 2 === 0 && 'sm:border-e sm:border-hairline',
                    i < 2 && 'border-b border-hairline',
                    i === 2 && 'max-sm:border-b max-sm:border-hairline',
                  )}
                >
                  <dt className="mb-2 text-[12px] font-semibold text-slate-500">{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[22px] border border-hairline bg-surface p-6">
            <p className="text-[12px] font-semibold text-slate-500">{m.panelUploadedBy}</p>
            {doc.uploadedBy ? (
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={doc.uploadedBy.fullName} className="h-11 w-11 text-[14px]" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-slate-900">{doc.uploadedBy.fullName}</p>
                  <p className="text-[12px] text-[#B8913F] dark:text-[#D8B66A]">
                    {roleLabels?.[doc.uploadedBy.role] ?? doc.uploadedBy.role}
                  </p>
                  {doc.uploadedBy.email && <p className="truncate text-[12px] text-slate-500" dir="ltr">{doc.uploadedBy.email}</p>}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-slate-500">{m.unknownUploader}</p>
            )}
          </section>

          <section className="rounded-[22px] border border-danger-500/25 bg-surface p-6">
            <p className="text-[14px] font-bold text-slate-900">{m.dangerTitle}</p>
            <p className="mt-1 text-[12.5px] text-slate-500">{m.dangerDesc}</p>
            <ConfirmingForm action={softDeleteDocumentAction} confirmMessage={m.deleteConfirm(doc.title)}>
              <input type="hidden" name="id" value={doc.id} />
              <button
                type="submit"
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-danger-500/40 text-[13px] font-bold text-danger-600 transition-colors hover:bg-danger-500/10"
              >
                <Trash2 className="h-4 w-4" />
                {m.deleteButton}
              </button>
            </ConfirmingForm>
          </section>
        </aside>
      </div>
    </div>
  );
}
