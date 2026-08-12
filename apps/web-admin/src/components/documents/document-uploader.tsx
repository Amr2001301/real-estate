'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { File as FileIcon, X, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface UploadResult {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface Props {
  /** Called once the file has finished uploading to R2. */
  onUploaded: (result: UploadResult) => void;
  /** Called when the user clears the selection. */
  onCleared?: () => void;
}

/**
 * MIME whitelist mirrored from `ALLOWED_DOCUMENT_MIME_TYPES` on the API
 * (apps/api/src/modules/documents/documents.module.ts). Client-side check
 * is convenience only — the API is the authoritative gate.
 */
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

type Phase = 'idle' | 'signing' | 'uploading' | 'done' | 'error';

export function DocumentUploader({ onUploaded, onCleared }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ name: string; size: number; type: string } | null>(null);

  function clear() {
    if (inputRef.current) inputRef.current.value = '';
    setPicked(null);
    setProgress(0);
    setError(null);
    setPhase('idle');
    onCleared?.();
  }

  async function handleFile(file: File) {
    setError(null);
    setProgress(0);
    setPicked({ name: file.name, size: file.size, type: file.type || 'application/octet-stream' });

    // Client-side guardrails — backend re-validates.
    if (file.size > MAX_SIZE_BYTES) {
      setError(`الملف أكبر من الحد المسموح (${formatSize(MAX_SIZE_BYTES)}).`);
      setPhase('error');
      return;
    }
    const ct = file.type || 'application/octet-stream';
    if (!ALLOWED_TYPES.includes(ct)) {
      setError(`نوع الملف "${ct || 'غير معروف'}" غير مسموح. الأنواع المسموح بها: PDF، صور، Word، Excel، CSV.`);
      setPhase('error');
      return;
    }

    try {
      // 1) Mint a presigned R2 PUT URL via the API.
      setPhase('signing');
      const presignRes = await fetch('/api-proxy/documents/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contentType: ct,
          sizeBytes: file.size,
          fileName: file.name,
        }),
      });
      if (!presignRes.ok) {
        // An expired/absent session yields 401 (no Bearer reaches the API).
        // Surface a clear Arabic message instead of dumping the raw JSON body.
        if (presignRes.status === 401) {
          throw new Error(
            'انتهت الجلسة. يرجى تحديث الصفحة أو تسجيل الدخول من جديد ثم إعادة المحاولة.',
          );
        }
        const body = await presignRes.text();
        throw new Error(`فشل التحضير (${presignRes.status}): ${body.slice(0, 200)}`);
      }
      // Private-bucket presigns (documents, contracts, receipts) omit publicUrl.
      // Use the bare object key as the stored fileUrl in that case.
      const { uploadUrl, publicUrl, key: objectKey } = (await presignRes.json()) as {
        uploadUrl: string;
        publicUrl?: string;
        key: string;
      };

      // 2) PUT directly to R2 with progress events.
      setPhase('uploading');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', ct);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`فشل الرفع إلى التخزين (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('انقطاع في الشبكة أثناء الرفع'));
        xhr.send(file);
      });

      setPhase('done');
      onUploaded({
        fileUrl: publicUrl ?? objectKey,
        fileName: file.name,
        mimeType: ct,
        sizeBytes: file.size,
      });
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    handleFile(f);
  }

  const busy = phase === 'signing' || phase === 'uploading';
  const banner =
    phase === 'signing'
      ? 'جاري التحضير…'
      : phase === 'uploading'
        ? `جاري الرفع ${progress}%`
        : phase === 'done'
          ? 'تم الرفع بنجاح'
          : null;

  return (
    <div className="space-y-3">
      <label className="block">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="block w-full text-xs file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 disabled:opacity-50"
          onChange={onPick}
          disabled={busy}
        />
        <span className="block text-2xs text-slate-500 mt-1">
          PDF، صور (JPG/PNG/WebP)، Word، Excel، CSV — حتى {formatSize(MAX_SIZE_BYTES)}.
        </span>
      </label>

      {picked && (
        <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-muted/40 p-3">
          <FileIcon className="h-5 w-5 text-slate-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 truncate" dir="ltr">{picked.name}</p>
            <p className="text-2xs text-slate-500 mt-0.5 font-mono" dir="ltr">
              {picked.type} • {formatSize(picked.size)}
            </p>
          </div>
          {phase === 'done' && <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0" />}
          {!busy && (
            <Button type="button" variant="ghost" size="sm" onClick={clear} leftIcon={<X className="h-3.5 w-3.5" />}>
              إزالة
            </Button>
          )}
        </div>
      )}

      {phase === 'uploading' && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full bg-brand-600 transition-all"
            style={{ width: `${progress}%` }}
            aria-label={`upload progress ${progress}%`}
          />
        </div>
      )}

      {banner && phase !== 'error' && (
        <p className="inline-flex items-center gap-2 text-xs text-slate-600">
          {phase === 'done' ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-success-600" />
          ) : (
            <Upload className="h-3.5 w-3.5 animate-pulse" />
          )}
          {banner}
        </p>
      )}

      {error && (
        <p className="inline-flex items-start gap-2 text-xs text-danger-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {error}
        </p>
      )}
    </div>
  );
}
