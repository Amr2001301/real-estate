'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Trash2, Image as ImageIcon } from 'lucide-react';
import { MediaUploader } from '@/components/media-uploader';
import { EmptyState } from '@/components/ui/empty-state';
import type { Project, Media } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { deleteProjectMediaAction } from '../actions';

export function ProjectMediaPanel({ project, locale = 'ar' }: { project: Project; locale?: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const media = project.media ?? [];
  const m = uiT(locale).projectDetailPage;

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 bg-canvas/30 border-b border-hairline">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100 shrink-0">
            <ImageIcon className="h-[15px] w-[15px] text-brand-600" />
          </span>
          <div>
            <h3 className="text-[13.5px] font-bold text-navy leading-none">{m.mediaLibraryTitle}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {media.length > 0 ? m.mediaCountLabel(media.length) : m.mediaEmpty}
            </p>
          </div>
        </div>
        <MediaUploader
          folder="projects"
          attach={{ type: 'project', targetId: project.id, mediaType: 'IMAGE' }}
          onUploaded={() => router.refresh()}
          buttonLabel={m.mediaBtnUpload}
        />
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        {media.length === 0 ? (
          <EmptyState
            icon={<ImageIcon />}
            title={m.mediaEmptyTitle}
            description={m.mediaEmptyDesc}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {media.map((item: Media) => (
              <div
                key={item.id}
                className="relative group rounded-[14px] overflow-hidden ring-1 ring-inset ring-hairline aspect-[4/3] bg-canvas/60"
              >
                {item.type === 'VIDEO' ? (
                  <video src={item.url} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <button
                  type="button"
                  disabled={pending}
                  aria-label={m.mediaDeleteAriaLabel}
                  title={m.mediaDeleteAriaLabel}
                  className="absolute top-2 start-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/80 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger-600 disabled:opacity-40"
                  onClick={() => {
                    if (!confirm(m.mediaDeleteConfirm)) return;
                    start(() =>
                      deleteProjectMediaAction(project.id, item.id).then(() => router.refresh()),
                    );
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
