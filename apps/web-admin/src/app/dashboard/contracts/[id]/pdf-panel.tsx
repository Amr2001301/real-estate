'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ExternalLink, AlertCircle } from 'lucide-react';
import { DocumentUploader, type UploadResult } from '@/components/documents/document-uploader';
import type { Contract } from '@/lib/types';
import { attachContractDocumentAction } from '../../deposits/actions';
import { PremiumSectionCard } from '@/components/premium';

// P11 — replaces the legacy URL-paste flow. Uploads via the centralized
// DocumentUploader (signed presign → R2 PUT → publicUrl) and then registers
// the file as a CONTRACT-category Document via POST /v1/contracts/:id/document.
export function ContractPdfPanel({ contract }: { contract: Contract }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleUploaded(result: UploadResult) {
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set('contractId', contract.id);
      form.set('fileUrl', result.fileUrl);
      if (result.fileName) form.set('fileName', result.fileName);
      if (result.mimeType) form.set('mimeType', result.mimeType);
      if (result.sizeBytes) form.set('sizeBytes', String(result.sizeBytes));
      const res = await attachContractDocumentAction({}, form);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <PremiumSectionCard title="ملف العقد" icon={<FileText />}>
      <div className="space-y-4">
        {contract.pdfUrl && contract.pdfUrl.startsWith('http') && (
          // Legacy public-URL contracts: direct link still works.
          // New contracts store a bare object key — access via the Documents tab.
          <a
            href={contract.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline hover:bg-canvas transition-colors"
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
              <FileText />
            </span>
            <span className="text-sm font-medium text-brand-700 flex-1 truncate">
              فتح ملف العقد
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-brand-400" />
          </a>
        )}
        {contract.pdfUrl && !contract.pdfUrl.startsWith('http') && (
          <div className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
              <FileText />
            </span>
            <span className="text-sm text-slate-600 flex-1 truncate">
              ملف العقد محفوظ — يمكن تنزيله من تبويب المستندات
            </span>
          </div>
        )}
        <DocumentUploader
          onUploaded={handleUploaded}
          onCleared={() => setError(null)}
        />
        {pending && (
          <p className="text-xs text-slate-400">جارٍ ربط الملف بالعقد…</p>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 p-3 text-xs">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </PremiumSectionCard>
  );
}
