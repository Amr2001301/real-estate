'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, FileText, Link as LinkIcon, Save, Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  DocumentCategory,
  DocumentOwnerType,
  DocumentVisibility,
} from '@/lib/types';
import { CATEGORY_LABEL, OWNER_TYPE_LABEL, VISIBILITY_LABEL } from '@/components/documents/labels';
import { DocumentUploader, type UploadResult } from '@/components/documents/document-uploader';
import { createDocumentAction, type DocumentFormState } from '../actions';

const OWNER_TYPES: DocumentOwnerType[] = [
  'PROJECT', 'UNIT', 'LEAD', 'RESERVATION', 'CONTRACT', 'DEPOSIT',
  'BROKER', 'BROKER_COMMISSION', 'BROKER_PAYOUT', 'USER', 'OTHER',
];
const CATEGORIES: DocumentCategory[] = [
  'CONTRACT', 'RECEIPT', 'INVOICE', 'BROKER_AGREEMENT', 'COMMISSION_STATEMENT',
  'PAYOUT_RECEIPT', 'ID_DOCUMENT', 'LEGAL', 'FINANCIAL', 'IMAGE', 'OTHER',
];
const VISIBILITIES: DocumentVisibility[] = ['ADMIN_ONLY', 'BROKER_VISIBLE', 'CUSTOMER_VISIBLE'];

type Mode = 'upload' | 'url';

interface PageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

/**
 * Strip the file extension and replace separators with spaces so the
 * suggested title reads cleanly. "Broker_agreement_v2.pdf" → "Broker agreement v2".
 */
function defaultTitleFromFileName(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  return base.replace(/[_-]+/g, ' ').trim();
}

export default function NewDocumentPage({ searchParams }: PageProps) {
  const initialOwnerType = (searchParams?.ownerType as DocumentOwnerType | undefined) ?? '';
  const initialOwnerId = (searchParams?.ownerId as string | undefined) ?? '';
  const initialCategory = (searchParams?.category as DocumentCategory | undefined) ?? 'OTHER';

  const [mode, setMode] = useState<Mode>('upload');
  const [uploaded, setUploaded] = useState<UploadResult | null>(null);
  const [title, setTitle] = useState('');

  const [state, formAction] = useActionState<DocumentFormState, FormData>(
    createDocumentAction,
    {},
  );

  const ready = mode === 'url' ? true : uploaded !== null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="إضافة مستند جديد"
        description="ارفع ملفًا مباشرة، أو ألصق رابطًا لملف موجود على الإنترنت. الرفع يتم عبر تخزين آمن بصلاحية مؤقتة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المستندات', href: '/dashboard/documents' },
          { label: 'إضافة مستند' },
        ]}
        meta={<FileText className="h-4 w-4 text-brand-600" />}
        actions={
          <Link href="/dashboard/documents">
            <Button variant="ghost" size="md" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              العودة للقائمة
            </Button>
          </Link>
        }
      />

      <form action={formAction} className="space-y-5">
        {state?.error && (
          <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
            {state.error}
          </div>
        )}

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">المالك والتصنيف</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs text-slate-600 mb-1">نوع المالك *</span>
              <Select name="ownerType" defaultValue={initialOwnerType} required>
                <option value="" disabled>اختر…</option>
                {OWNER_TYPES.map((t) => (
                  <option key={t} value={t}>{OWNER_TYPE_LABEL[t]}</option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="block text-xs text-slate-600 mb-1">معرّف المالك (UUID) *</span>
              <Input name="ownerId" defaultValue={initialOwnerId} dir="ltr" required />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-600 mb-1">التصنيف</span>
              <Select name="category" defaultValue={initialCategory}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="block text-xs text-slate-600 mb-1">الرؤية</span>
              <Select name="visibility" defaultValue="ADMIN_ONLY">
                {VISIBILITIES.map((v) => (
                  <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>
                ))}
              </Select>
            </label>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">مصدر الملف</h2>
            <div className="inline-flex rounded-lg border border-hairline p-0.5 bg-surface-muted">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'upload' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                رفع ملف
              </button>
              <button
                type="button"
                onClick={() => setMode('url')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'url' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <LinkIcon className="h-3.5 w-3.5" />
                لصق رابط
              </button>
            </div>
          </div>

          {mode === 'upload' ? (
            <>
              <DocumentUploader
                onUploaded={(r) => {
                  setUploaded(r);
                  if (!title) setTitle(defaultTitleFromFileName(r.fileName));
                }}
                onCleared={() => setUploaded(null)}
              />
              {/* Hidden inputs feed the existing server action. They are
                  populated once the R2 PUT completes. */}
              <input type="hidden" name="fileUrl" value={uploaded?.fileUrl ?? ''} />
              <input type="hidden" name="fileName" value={uploaded?.fileName ?? ''} />
              <input type="hidden" name="mimeType" value={uploaded?.mimeType ?? ''} />
              <input
                type="hidden"
                name="sizeBytes"
                value={uploaded ? String(uploaded.sizeBytes) : ''}
              />
            </>
          ) : (
            <>
              <label className="block">
                <span className="block text-xs text-slate-600 mb-1">رابط الملف *</span>
                <Input name="fileUrl" type="url" dir="ltr" required placeholder="https://…" />
                <span className="block text-2xs text-slate-500 mt-1">
                  يجب أن يبدأ الرابط بـ http:// أو https://. الروابط من نوع javascript: أو file: مرفوضة.
                </span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block">
                  <span className="block text-xs text-slate-600 mb-1">اسم الملف</span>
                  <Input name="fileName" dir="ltr" maxLength={255} />
                </label>
                <label className="block">
                  <span className="block text-xs text-slate-600 mb-1">MIME</span>
                  <Input name="mimeType" dir="ltr" placeholder="application/pdf" maxLength={120} />
                </label>
                <label className="block">
                  <span className="block text-xs text-slate-600 mb-1">الحجم (بايت)</span>
                  <Input name="sizeBytes" type="number" min={0} dir="ltr" />
                </label>
              </div>
            </>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">معلومات المستند</h2>
          <div className="grid grid-cols-1 gap-3">
            <label className="block">
              <span className="block text-xs text-slate-600 mb-1">العنوان *</span>
              <Input
                name="title"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: اتفاقية الوسيط 2026"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-600 mb-1">الوصف</span>
              <Textarea name="description" rows={3} maxLength={2000} />
            </label>
          </div>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <p className="text-2xs text-slate-500">
            {mode === 'upload' && !ready
              ? 'اختر ملفًا وانتظر اكتمال الرفع قبل الحفظ.'
              : 'سيتم حفظ السجل في مركز المستندات وتدوين العملية في سجل التدقيق.'}
          </p>
          <Button
            type="submit"
            variant="primary"
            size="md"
            leftIcon={<Save className="h-4 w-4" />}
            disabled={!ready}
          >
            حفظ المستند
          </Button>
        </div>
      </form>
    </div>
  );
}
