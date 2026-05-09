'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { MediaUploader } from '@/components/media-uploader';
import type { Unit, Media } from '@/lib/types';
import { deleteUnitMediaAction } from '../actions';

export function UnitMediaPanel({ unit }: { unit: Unit }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-lg font-bold mb-3">صور الوحدة</h2>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {(unit.media ?? []).map((m: Media) => (
          <div key={m.id} className="relative group rounded-lg overflow-hidden border border-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt="" className="w-full h-24 object-cover" />
            <span className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
              {m.type}
            </span>
            <button
              type="button"
              disabled={pending}
              className="absolute top-1 left-1 rounded-full bg-black/60 text-white text-xs px-2 py-0.5 opacity-0 group-hover:opacity-100"
              onClick={() => {
                if (!confirm('حذف هذه الصورة؟')) return;
                start(() =>
                  deleteUnitMediaAction(unit.id, m.id).then(() => router.refresh()),
                );
              }}
            >
              حذف
            </button>
          </div>
        ))}
        {(unit.media ?? []).length === 0 && (
          <div className="col-span-2 text-xs text-gray-400 py-6 text-center border border-dashed rounded-lg">
            لا توجد صور
          </div>
        )}
      </div>

      <div className="space-y-2">
        <MediaUploader
          folder="units"
          attach={{ type: 'unit', targetId: unit.id, mediaType: 'IMAGE' }}
          onUploaded={() => router.refresh()}
          buttonLabel="+ رفع صورة"
        />
        <MediaUploader
          folder="units"
          attach={{ type: 'unit', targetId: unit.id, mediaType: 'FLOORPLAN' }}
          onUploaded={() => router.refresh()}
          buttonLabel="+ رفع مخطط"
        />
      </div>
    </section>
  );
}
