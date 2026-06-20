'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Trash2, Image as ImageIcon } from 'lucide-react';
import { MediaUploader } from '@/components/media-uploader';
import { EmptyState } from '@/components/ui/empty-state';
import type { Project, Media } from '@/lib/types';
import { deleteProjectMediaAction } from '../actions';

export function ProjectMediaPanel({ project }: { project: Project }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const media = project.media ?? [];

  return (
    <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 bg-canvas/30 border-b border-hairline">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100 shrink-0">
            <ImageIcon className="h-[15px] w-[15px] text-brand-600" />
          </span>
          <div>
            <h3 className="text-[13.5px] font-bold text-navy leading-none">مكتبة الوسائط</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {media.length > 0 ? `${media.length} عنصر` : 'لم يتم رفع أي وسائط بعد'}
            </p>
          </div>
        </div>
        <MediaUploader
          folder="projects"
          attach={{ type: 'project', targetId: project.id, mediaType: 'IMAGE' }}
          onUploaded={() => router.refresh()}
          buttonLabel="+ رفع صورة"
        />
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        {media.length === 0 ? (
          <EmptyState
            icon={<ImageIcon />}
            title="لا توجد وسائط"
            description="أضف صوراً ومقاطع فيديو لإبراز المشروع."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {media.map((m: Media) => (
              <div
                key={m.id}
                className="relative group rounded-[14px] overflow-hidden ring-1 ring-inset ring-hairline aspect-[4/3] bg-canvas/60"
              >
                {m.type === 'VIDEO' ? (
                  <video src={m.url} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <button
                  type="button"
                  disabled={pending}
                  aria-label="حذف"
                  title="حذف"
                  className="absolute top-2 start-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/80 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger-600 disabled:opacity-40"
                  onClick={() => {
                    if (!confirm('حذف هذه الوسائط؟')) return;
                    start(() =>
                      deleteProjectMediaAction(project.id, m.id).then(() => router.refresh()),
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
