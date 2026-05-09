'use client';

import { useState } from 'react';

type Folder = 'projects' | 'units' | 'contracts' | 'receipts' | 'maintenance' | 'banners';
type MediaType = 'IMAGE' | 'VIDEO' | 'FLOORPLAN' | 'DOCUMENT';

interface Props {
  /** Where in R2 the file goes — also drives accept attr */
  folder: Folder;
  /** Called after upload + attach succeeds. Receives the public URL. */
  onUploaded: (publicUrl: string, key: string) => void | Promise<void>;
  /** If provided, after upload we'll call this server endpoint to attach */
  attach?: {
    type: 'project' | 'unit';
    targetId: string;
    mediaType?: MediaType;
  };
  accept?: string;
  buttonLabel?: string;
}

export function MediaUploader({ folder, onUploaded, attach, accept, buttonLabel }: Props) {
  const [status, setStatus] = useState<'idle' | 'signing' | 'uploading' | 'attaching' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const defaultAccept =
    folder === 'contracts' || folder === 'receipts' ? 'application/pdf' : 'image/*,video/mp4';

  async function handleFile(file: File) {
    setError(null);
    setProgress(0);
    setStatus('signing');

    try {
      // 1) Get presigned URL
      const res = await fetch('/api-proxy/media/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contentType: file.type || 'application/octet-stream',
          folder,
          extension: file.name.split('.').pop(),
        }),
      });
      if (!res.ok) throw new Error(`presign failed (${res.status})`);
      const { uploadUrl, key, publicUrl } = (await res.json()) as {
        uploadUrl: string;
        key: string;
        publicUrl: string;
      };

      // 2) Upload directly to R2 (XHR for progress)
      setStatus('uploading');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`R2 upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('Network error during R2 upload'));
        xhr.send(file);
      });

      // 3) Optional auto-attach
      if (attach) {
        setStatus('attaching');
        const endpoint = attach.type === 'project' ? '/api-proxy/media/projects' : '/api-proxy/media/units';
        const body =
          attach.type === 'project'
            ? { projectId: attach.targetId, url: publicUrl, type: attach.mediaType ?? 'IMAGE' }
            : { unitId: attach.targetId, url: publicUrl, type: attach.mediaType ?? 'IMAGE' };
        const r = await fetch(endpoint, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(`attach failed (${r.status})`);
      }

      setStatus('done');
      await onUploaded(publicUrl, key);
      // Reset so the same file can be re-selected if needed
      setTimeout(() => {
        setStatus('idle');
        setProgress(0);
      }, 1000);
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }

  return (
    <div>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="file"
          accept={accept ?? defaultAccept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
          disabled={status === 'signing' || status === 'uploading' || status === 'attaching'}
        />
        <span className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium">
          {buttonLabel ?? 'رفع ملف'}
        </span>
      </label>

      {status !== 'idle' && status !== 'error' && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
          <div className="w-40 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{ width: `${status === 'uploading' ? progress : status === 'done' ? 100 : 5}%` }}
            />
          </div>
          <span>
            {status === 'signing' && 'جاري التحضير…'}
            {status === 'uploading' && `جاري الرفع ${progress}%`}
            {status === 'attaching' && 'جاري الإرفاق…'}
            {status === 'done' && '✓ تم'}
          </span>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
