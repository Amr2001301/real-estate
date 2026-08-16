'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Link as LinkIcon, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/form/submit-button';
import { PremiumFormPanel } from '@/components/premium';
import type { DocumentCategory, DocumentOwnerType, DocumentVisibility } from '@/lib/types';
import { CATEGORY_LABEL, OWNER_TYPE_LABEL, VISIBILITY_LABEL } from '@/components/documents/labels';
import { DocumentUploader, type UploadResult } from '@/components/documents/document-uploader';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
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

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
        {required && <span className="text-danger-500 ms-1">*</span>}
      </p>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{hint}</p>}
    </div>
  );
}

function defaultTitleFromFileName(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  return base.replace(/[_-]+/g, ' ').trim();
}

interface Props {
  initialOwnerType: DocumentOwnerType | '';
  initialOwnerId: string;
  initialCategory: DocumentCategory;
  locale?: Locale;
}

export function NewDocumentForm({ initialOwnerType, initialOwnerId, initialCategory, locale = 'ar' }: Props) {
  const m = uiT(locale).pages.documentsForm;
  const [mode, setMode] = useState<Mode>('upload');
  const [uploaded, setUploaded] = useState<UploadResult | null>(null);
  const [title, setTitle] = useState('');

  const [state, formAction] = useActionState<DocumentFormState, FormData>(
    createDocumentAction,
    {},
  );

  const ready = mode === 'url' ? true : uploaded !== null;

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{state.error}</p>
        </div>
      )}

      {/* ── Panel 01 — Owner & Classification ─────────────────────────────── */}
      <PremiumFormPanel
        id="owner"
        number="01"
        title={m.panel01Title}
        description={m.panel01Desc}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label={m.labelOwnerType} required>
            <Select name="ownerType" defaultValue={initialOwnerType} required>
              <option value="" disabled>{m.optionChoose}</option>
              {OWNER_TYPES.map((t) => (
                <option key={t} value={t}>{OWNER_TYPE_LABEL[t]}</option>
              ))}
            </Select>
          </FormField>
          <FormField label={m.labelOwnerId} required>
            <Input name="ownerId" defaultValue={initialOwnerId} dir="ltr" required />
          </FormField>
          <FormField label={m.labelCategory}>
            <Select name="category" defaultValue={initialCategory}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </Select>
          </FormField>
          <FormField label={m.labelVisibility}>
            <Select name="visibility" defaultValue="ADMIN_ONLY">
              {VISIBILITIES.map((v) => (
                <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>
              ))}
            </Select>
          </FormField>
        </div>
      </PremiumFormPanel>

      {/* ── Panel 02 — File Source ────────────────────────────────────────── */}
      <PremiumFormPanel
        id="source"
        number="02"
        title={m.panel02Title}
        description={m.panel02Desc}
      >
        <div className="space-y-5">
          {/* Mode toggle */}
          <div className="inline-flex rounded-xl border border-hairline p-1 bg-canvas/40">
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors ${
                mode === 'upload'
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              {m.modeUpload}
            </button>
            <button
              type="button"
              onClick={() => setMode('url')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors ${
                mode === 'url'
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LinkIcon className="h-3.5 w-3.5" />
              {m.modeUrl}
            </button>
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
              <input type="hidden" name="fileUrl"   value={uploaded?.fileUrl   ?? ''} />
              <input type="hidden" name="fileName"  value={uploaded?.fileName  ?? ''} />
              <input type="hidden" name="mimeType"  value={uploaded?.mimeType  ?? ''} />
              <input type="hidden" name="sizeBytes" value={uploaded ? String(uploaded.sizeBytes) : ''} />
            </>
          ) : (
            <div className="space-y-5">
              <FormField
                label={m.labelFileUrl}
                required
                hint={m.hintFileUrl}
              >
                <Input name="fileUrl" type="url" dir="ltr" required placeholder="https://…" />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <FormField label={m.labelFileName}>
                  <Input name="fileName" dir="ltr" maxLength={255} />
                </FormField>
                <FormField label={m.labelMime}>
                  <Input name="mimeType" dir="ltr" placeholder="application/pdf" maxLength={120} />
                </FormField>
                <FormField label={m.labelSize}>
                  <Input name="sizeBytes" type="number" min={0} dir="ltr" />
                </FormField>
              </div>
            </div>
          )}
        </div>
      </PremiumFormPanel>

      {/* ── Panel 03 — Document Info ──────────────────────────────────────── */}
      <PremiumFormPanel
        id="info"
        number="03"
        title={m.panel03Title}
        description={m.panel03Desc}
      >
        <div className="space-y-6">
          <FormField label={m.labelTitle} required>
            <Input
              name="title"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={m.titlePlaceholder}
            />
          </FormField>

          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{m.labelDescription}</p>
            <Textarea name="description" rows={4} maxLength={2000} className="resize-none" />
          </div>

          <div className="flex items-center justify-between gap-4 pt-5 border-t border-hairline">
            <p className="text-[11px] text-slate-400 leading-snug max-w-xs">
              {mode === 'upload' && !ready
                ? m.helperUploadWaiting
                : m.helperReady}
            </p>
            <div className="flex items-center gap-2.5 shrink-0">
              <Link href="/dashboard/documents">
                <Button type="button" variant="ghost" size="sm" leftIcon={<X className="h-4 w-4" />}>
                  {m.cancelBtn}
                </Button>
              </Link>
              <SubmitButton disabled={!ready}>{m.submitBtn}</SubmitButton>
            </div>
          </div>
        </div>
      </PremiumFormPanel>
    </form>
  );
}
