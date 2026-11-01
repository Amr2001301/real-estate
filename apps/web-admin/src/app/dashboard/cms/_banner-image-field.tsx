'use client';

import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { MediaUploader } from '@/components/media-uploader';
import { Input } from '@/components/ui/input';

interface Props {
  uploadLabel: string;
  pasteLabel: string;
  hint: string;
}

/**
 * The banner's image: uploaded to the public banners folder, or pasted as a
 * link. Either way it lands in the form's `imageUrl` field, with a preview.
 */
export function BannerImageField({ uploadLabel, pasteLabel, hint }: Props) {
  const [url, setUrl] = useState('');

  return (
    <div className="grid gap-3">
      <div className="relative aspect-[16/6] max-h-48 overflow-hidden rounded-2xl border border-dashed border-hairline bg-surface-muted/40">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon aria-hidden className="absolute inset-0 m-auto h-8 w-8 text-slate-400" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <MediaUploader folder="banners" accept="image/jpeg,image/png,image/webp" buttonLabel={uploadLabel} onUploaded={(value) => setUrl(value)} />
        <Input
          name="imageUrl"
          required
          dir="ltr"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={`${pasteLabel} — https://...`}
          aria-label={pasteLabel}
          className="min-w-[240px] flex-1"
        />
      </div>
      <p className="text-[11.5px] text-slate-500">{hint}</p>
    </div>
  );
}
