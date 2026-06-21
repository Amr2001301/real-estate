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

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const CMD_LINK = 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/75 hover:bg-white/[0.07] hover:text-white/95 transition-colors';
const CMD_ICON = 'h-8 w-8 inline-flex items-center justify-center rounded-lg bg-white/[0.08] text-brand-300 shrink-0 [&_svg]:h-4 [&_svg]:w-4';

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await safe(api.get<DocumentItem>(`/documents/${id}`));
  if (res.error || !res.data) notFound();
  const doc = res.data;
  const oHref = ownerHref(doc.ownerType, doc.ownerId);

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={doc.title}
        description={doc.description ?? undefined}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المستندات', href: '/dashboard/documents' },
          { label: doc.title },
        ]}
        meta={<FileText className="h-4 w-4 text-brand-600" />}
        actions={
          <div className="flex items-center gap-2">
            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="primary" size="md" leftIcon={<ExternalLink className="h-4 w-4" />}>
                فتح الملف
              </Button>
            </a>
            <Link href="/dashboard/documents">
              <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
                العودة للقائمة
              </Button>
            </Link>
          </div>
        }
      />

      <PremiumDetailLayout
        main={
          <div className="space-y-5">
            <PremiumSectionCard title="المعلومات الأساسية" icon={<FileText className="h-4 w-4" />}>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-2xs text-slate-500">التصنيف</dt>
                  <dd>{CATEGORY_LABEL[doc.category]}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">الرؤية</dt>
                  <dd>{VISIBILITY_LABEL[doc.visibility]}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">نوع المالك</dt>
                  <dd>{OWNER_TYPE_LABEL[doc.ownerType]}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">معرّف المالك</dt>
                  <dd className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-800" dir="ltr">{doc.ownerId}</span>
                    {oHref && (
                      <Link href={oHref as never}>
                        <Button variant="ghost" size="sm">فتح</Button>
                      </Link>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">اسم الملف</dt>
                  <dd className="font-mono text-xs" dir="ltr">{doc.fileName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">النوع</dt>
                  <dd className="font-mono text-xs" dir="ltr">{doc.mimeType ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">الحجم</dt>
                  <dd className="tabular-nums">{formatFileSize(doc.sizeBytes)}</dd>
                </div>
                <div>
                  <dt className="text-2xs text-slate-500">تاريخ الإنشاء</dt>
                  <dd className="text-xs">{formatDateTime(doc.createdAt)}</dd>
                </div>
              </dl>
            </PremiumSectionCard>

            <PremiumSectionCard title="رابط الملف">
              <p className="font-mono text-xs text-slate-700 break-all" dir="ltr">{doc.fileUrl}</p>
            </PremiumSectionCard>
          </div>
        }
        side={
          <div className="space-y-5">
            <PremiumCommandPanel title="إجراءات">
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className={CMD_LINK}>
                <span className={CMD_ICON}><ExternalLink /></span>
                فتح الملف
              </a>
              <Link href="/dashboard/documents" className={CMD_LINK}>
                <span className={CMD_ICON}><ChevronLeft /></span>
                العودة للقائمة
              </Link>
              {oHref && (
                <Link href={oHref as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><FileText /></span>
                  فتح سجل المالك
                </Link>
              )}
            </PremiumCommandPanel>

            <PremiumSectionCard title="رفع بواسطة">
              {doc.uploadedBy ? (
                <dl className="text-sm space-y-2">
                  <div>
                    <dt className="text-2xs text-slate-500">الاسم</dt>
                    <dd className="font-medium text-slate-900">{doc.uploadedBy.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-slate-500">الدور</dt>
                    <dd className="font-mono text-xs" dir="ltr">{doc.uploadedBy.role}</dd>
                  </div>
                  {doc.uploadedBy.email && (
                    <div>
                      <dt className="text-2xs text-slate-500">البريد</dt>
                      <dd className="text-xs" dir="ltr">{doc.uploadedBy.email}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-xs text-slate-500">غير معروف</p>
              )}
            </PremiumSectionCard>

            <PremiumSectionCard title="إجراءات" tone="danger">
              <ConfirmingForm
                action={softDeleteDocumentAction}
                confirmMessage={`سيتم حذف المستند «${doc.title}». الحذف لين فقط (soft) ويبقى السجل لأغراض التدقيق. هل أنت متأكد؟`}
              >
                <input type="hidden" name="id" value={doc.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="md"
                  leftIcon={<Trash2 className="h-4 w-4" />}
                  className="text-danger-700 hover:text-danger-800 hover:bg-danger-50"
                >
                  حذف المستند
                </Button>
              </ConfirmingForm>
            </PremiumSectionCard>
          </div>
        }
      />
    </div>
  );
}
