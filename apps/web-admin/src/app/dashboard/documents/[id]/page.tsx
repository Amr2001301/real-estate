import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ExternalLink, FileText, Trash2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { DocumentItem } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { ConfirmingForm } from '@/components/confirming-form';
import {
  CATEGORY_LABEL,
  OWNER_TYPE_LABEL,
  VISIBILITY_LABEL,
  formatFileSize,
  ownerHref,
} from '@/components/documents/labels';
import { softDeleteDocumentAction } from '../actions';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const CMD_LINK = 'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

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
  const m = uiT(locale).documentsDetailPage;

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={doc.title}
        description={doc.description ?? undefined}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbDocuments, href: '/dashboard/documents' },
          { label: doc.title },
        ]}
        meta={<FileText className="h-4 w-4 text-brand-600" />}
        actions={
          <div className="flex items-center gap-2">
            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="primary" size="md" leftIcon={<ExternalLink className="h-4 w-4" />}>
                {m.openFileButton}
              </Button>
            </a>
            <Link href="/dashboard/documents">
              <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
                {m.backButton}
              </Button>
            </Link>
          </div>
        }
      />

      <PremiumDetailLayout
        main={
          <div className="space-y-5">
            <PremiumSectionCard title={m.sectionInfo} icon={<FileText className="h-4 w-4" />}>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-2xs text-slate-500">{m.fieldCategory}</dt>
                  <dd>{CATEGORY_LABEL[doc.category]}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">{m.fieldVisibility}</dt>
                  <dd>{VISIBILITY_LABEL[doc.visibility]}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">{m.fieldOwnerType}</dt>
                  <dd>{OWNER_TYPE_LABEL[doc.ownerType]}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">{m.fieldOwnerId}</dt>
                  <dd className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-800" dir="ltr">{doc.ownerId}</span>
                    {oHref && (
                      <Link href={oHref as never}>
                        <Button variant="ghost" size="sm">{m.openOwner}</Button>
                      </Link>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">{m.fieldFileName}</dt>
                  <dd className="font-mono text-xs" dir="ltr">{doc.fileName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">{m.fieldMimeType}</dt>
                  <dd className="font-mono text-xs" dir="ltr">{doc.mimeType ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">{m.fieldSize}</dt>
                  <dd className="tabular-nums">{formatFileSize(doc.sizeBytes)}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">{m.fieldCreatedAt}</dt>
                  <dd className="text-xs">{formatDateTime(doc.createdAt)}</dd>
                </div>
              </dl>
            </PremiumSectionCard>

            <PremiumSectionCard title={m.sectionFileUrl}>
              <p className="font-mono text-xs text-slate-700 break-all" dir="ltr">{doc.fileUrl}</p>
            </PremiumSectionCard>
          </div>
        }
        side={
          <div className="space-y-5">
            <PremiumCommandPanel title={m.panelActions}>
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className={CMD_LINK}>
                <span className={CMD_ICON}><ExternalLink /></span>
                {m.openFileAction}
              </a>
              <Link href="/dashboard/documents" className={CMD_LINK}>
                <span className={CMD_ICON}><ChevronLeft /></span>
                {m.backAction}
              </Link>
              {oHref && (
                <Link href={oHref as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><FileText /></span>
                  {m.openOwnerRecord}
                </Link>
              )}
            </PremiumCommandPanel>

            <PremiumSectionCard title={m.panelUploadedBy}>
              {doc.uploadedBy ? (
                <dl className="text-sm space-y-2">
                  <div>
                    <dt className="text-2xs text-slate-500">{m.fieldName}</dt>
                    <dd className="font-medium text-slate-900">{doc.uploadedBy.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-slate-500">{m.fieldRole}</dt>
                    <dd className="font-mono text-xs" dir="ltr">{doc.uploadedBy.role}</dd>
                  </div>
                  {doc.uploadedBy.email && (
                    <div>
                      <dt className="text-2xs text-slate-500">{m.fieldEmail}</dt>
                      <dd className="text-xs" dir="ltr">{doc.uploadedBy.email}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-xs text-slate-500">{m.unknownUploader}</p>
              )}
            </PremiumSectionCard>

            <PremiumSectionCard title={m.panelDanger} tone="danger">
              <ConfirmingForm
                action={softDeleteDocumentAction}
                confirmMessage={m.deleteConfirm(doc.title)}
              >
                <input type="hidden" name="id" value={doc.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="md"
                  leftIcon={<Trash2 className="h-4 w-4" />}
                  className="text-danger-700 hover:text-danger-800 hover:bg-danger-50"
                >
                  {m.deleteButton}
                </Button>
              </ConfirmingForm>
            </PremiumSectionCard>
          </div>
        }
      />
    </div>
  );
}
