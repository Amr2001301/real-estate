'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { DocumentUploader, type UploadResult } from '@/components/documents/document-uploader';
import type { Contract } from '@/lib/types';
import { attachContractDocumentAction } from '../../deposits/actions';

// P11 — replaces the legacy URL-paste flow. Uploads via the centralized
// DocumentUploader (signed presign → R2 PUT → publicUrl) and then registers
// the file as a CONTRACT-category Document via POST /v1/contracts/:id/document.
// Accepts PDF + image (JPEG/PNG/WebP) per the DocumentUploader whitelist.
// The legacy attachContractPdfAction is retained at the actions module for
// back-compat with older surfaces but is not used here.
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
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-lg font-bold mb-3">ملف العقد</h2>

      {contract.pdfUrl ? (
        <div className="mb-4">
          <a
            href={contract.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 hover:bg-gray-200 px-3 py-2 text-sm"
          >
            📄 فتح ملف العقد
          </a>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-4">لم يُرفع ملف العقد بعد.</p>
      )}

      <DocumentUploader
        onUploaded={handleUploaded}
        onCleared={() => setError(null)}
      />
      {pending && (
        <p className="mt-2 text-xs text-slate-500">جارٍ ربط الملف بالعقد…</p>
      )}
      {error && (
        <p className="mt-2 inline-flex items-start gap-2 text-xs text-danger-700">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </section>
  );
}
