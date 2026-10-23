'use client';

import { useRef, useState } from 'react';
import { FilePlus2, Loader2 } from 'lucide-react';

/** A page is rendered this wide: about 200 dpi on A4, a sharp print at a few hundred KB. */
const PAGE_PX = 1654;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Stores one page image in the company's branding folder; returns its public URL. */
async function storePage(blob: Blob, extension: string): Promise<string> {
  const res = await fetch('/api-proxy/media/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      contentType: blob.type,
      folder: 'branding',
      sizeBytes: blob.size,
      extension,
      brandingAsset: 'letterhead',
    }),
  });
  if (!res.ok) {
    throw new Error(
      res.status === 503
        ? 'تخزين الملفات غير مُعدّ على الخادم — راجع إعدادات R2 أو MinIO'
        : `تعذّر تجهيز رفع الملف (${res.status})`,
    );
  }
  const { uploadUrl, publicUrl } = (await res.json()) as { uploadUrl: string; publicUrl?: string };
  // The browser sends the file to the storage itself: a network error here
  // means the storage is not reachable (MinIO not running, or the bucket's
  // CORS does not allow this site).
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob }).catch(() => {
    throw new Error(`تعذّر الوصول إلى تخزين الملفات (${new URL(uploadUrl).host}) — تأكد أنه يعمل ويسمح بالرفع من هذا الموقع`);
  });
  if (!put.ok || !publicUrl) throw new Error(`رفض تخزين الملفات الصفحة (${put.status})`);
  return publicUrl;
}

/** Each page of a PDF as a JPEG image, in order. */
async function pdfPages(file: File, max: number): Promise<Blob[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out: Blob[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, max); n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PAGE_PX / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push(await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('render'))), 'image/jpeg', 0.85)));
  }
  await doc.destroy();
  return out;
}

/**
 * Adds pages to a form: an image is one page; a PDF becomes one page per PDF
 * page (up to the room left). Each page is stored as an image.
 */
export function PageUploader({
  label,
  busyLabel,
  room,
  onPages,
  onError,
}: {
  label: string;
  busyLabel: (done: number, total: number) => string;
  /** How many more pages the form can take. */
  room: number;
  onPages: (urls: string[]) => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);

  const handle = async (file: File) => {
    try {
      let blobs: { blob: Blob; ext: string }[];
      if (file.type === 'application/pdf') {
        setBusy({ done: 0, total: 0 });
        blobs = (await pdfPages(file, room)).map((blob) => ({ blob, ext: 'jpg' }));
      } else if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        if (file.size > MAX_IMAGE_BYTES) throw new Error('الصورة أكبر من ٢ ميجابايت');
        blobs = [{ blob: file, ext: file.name.split('.').pop() || 'png' }];
      } else {
        throw new Error('ارفع صورة (PNG أو JPEG) أو ملف PDF');
      }
      const urls: string[] = [];
      for (const [i, b] of blobs.entries()) {
        setBusy({ done: i, total: blobs.length });
        urls.push(await storePage(b.blob, b.ext));
      }
      onPages(urls);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <label
      data-testid="form-add-pages"
      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-hairline px-4 text-[12.5px] font-semibold text-slate-700 hover:border-brand-400/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
    >
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        disabled={!!busy || room <= 0}
        data-testid="form-page-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handle(f);
        }}
      />
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
      {busy ? busyLabel(busy.done, busy.total) : label}
    </label>
  );
}
