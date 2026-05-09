'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { MediaUploader } from '@/components/media-uploader';
import type { Project, Media } from '@/lib/types';
import { deleteProjectMediaAction } from '../actions';

export function ProjectMediaPanel({ project }: { project: Project }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-lg font-bold mb-3">الوسائط</h2>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {(project.media ?? []).map((m: Media) => (
          <div key={m.id} className="relative group rounded-lg overflow-hidden border border-gray-100">
            {m.type === 'VIDEO' ? (
              <video src={m.url} className="w-full h-24 object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt="" className="w-full h-24 object-cover" />
            )}
            <button
              type="button"
              disabled={pending}
              className="absolute top-1 left-1 rounded-full bg-black/60 text-white text-xs px-2 py-0.5 opacity-0 group-hover:opacity-100 transition"
              onClick={() => {
                if (!confirm('حذف هذه الصورة؟')) return;
                start(() =>
                  deleteProjectMediaAction(project.id, m.id).then(() => router.refresh()),
                );
              }}
            >
              حذف
            </button>
          </div>
        ))}
        {(project.media ?? []).length === 0 && (
          <div className="col-span-2 text-xs text-gray-400 py-6 text-center border border-dashed rounded-lg">
            لا توجد وسائط
          </div>
        )}
      </div>

      <MediaUploader
        folder="projects"
        attach={{ type: 'project', targetId: project.id, mediaType: 'IMAGE' }}
        onUploaded={() => router.refresh()}
        buttonLabel="+ رفع صورة / فيديو"
      />
    </section>
  );
}
