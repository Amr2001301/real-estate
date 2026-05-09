'use client';

import { useRouter } from 'next/navigation';
import { MediaUploader } from '@/components/media-uploader';
import type { Contract } from '@/lib/types';
import { attachContractPdfAction } from '../actions';

export function ContractPdfPanel({ contract }: { contract: Contract }) {
  const router = useRouter();

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-lg font-bold mb-3">ملف العقد PDF</h2>

      {contract.pdfUrl ? (
        <div className="mb-4">
          <a
            href={contract.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-100 hover:bg-gray-200 px-3 py-2 text-sm"
          >
            📄 فتح العقد
          </a>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-4">لم يتم رفع ملف عقد بعد.</p>
      )}

      <MediaUploader
        folder="contracts"
        accept="application/pdf"
        buttonLabel={contract.pdfUrl ? '+ استبدال ملف PDF' : '+ رفع ملف PDF'}
        onUploaded={async (publicUrl) => {
          await attachContractPdfAction(contract.id, publicUrl);
          router.refresh();
        }}
      />
    </section>
  );
}
