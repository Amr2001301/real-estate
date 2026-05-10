'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ImageIcon, Map as MapIcon, Trash2 } from 'lucide-react';
import { MediaUploader } from '@/components/media-uploader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Unit, Media } from '@/lib/types';
import { deleteUnitMediaAction } from '../actions';

export function UnitMediaPanel({ unit }: { unit: Unit }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const media = unit.media ?? [];
  const images = media.filter((m) => m.type !== 'FLOORPLAN');
  const floorplans = media.filter((m) => m.type === 'FLOORPLAN');

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
          الوسائط والملفات
        </h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        صور الوحدة والمخططات الهندسية المرفقة.
      </p>

      <MediaSection
        title="صور الوحدة"
        emptyText="لم يتم رفع أي صور بعد"
        items={images}
        pending={pending}
        onDelete={(id) =>
          start(() =>
            deleteUnitMediaAction(unit.id, id).then(() => router.refresh()),
          )
        }
      />

      <div className="mt-3">
        <MediaUploader
          folder="units"
          attach={{ type: 'unit', targetId: unit.id, mediaType: 'IMAGE' }}
          onUploaded={() => router.refresh()}
          buttonLabel="+ رفع صورة"
        />
      </div>

      <div className="mt-6 border-t border-hairline pt-5">
        <div className="flex items-center gap-2">
          <MapIcon className="h-4 w-4 text-info-600" />
          <h4 className="text-sm font-semibold text-slate-900 tracking-tight">
            مخطط الطابق
          </h4>
        </div>
        <MediaSection
          title=""
          emptyText="لم يُرفع أي مخطط بعد"
          items={floorplans}
          pending={pending}
          onDelete={(id) =>
            start(() =>
              deleteUnitMediaAction(unit.id, id).then(() => router.refresh()),
            )
          }
          dense
        />
        <div className="mt-3">
          <MediaUploader
            folder="units"
            attach={{ type: 'unit', targetId: unit.id, mediaType: 'FLOORPLAN' }}
            onUploaded={() => router.refresh()}
            buttonLabel="+ رفع مخطط (PDF/صورة)"
          />
        </div>
      </div>
    </Card>
  );
}

function MediaSection({
  title,
  emptyText,
  items,
  pending,
  onDelete,
  dense,
}: {
  title: string;
  emptyText: string;
  items: Media[];
  pending: boolean;
  onDelete: (id: string) => void;
  dense?: boolean;
}) {
  return (
    <div className={dense ? 'mt-3' : 'mt-4'}>
      {title && (
        <p className="text-2xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          {title}
        </p>
      )}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-surface-muted/40 px-4 py-6 text-center">
          <p className="text-xs text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map((m) => (
            <div
              key={m.id}
              className="relative group rounded-xl overflow-hidden border border-hairline bg-surface-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.url}
                alt=""
                className="w-full h-24 object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              />
              <span className="absolute bottom-1.5 start-1.5">
                <Badge tone="gray" variant="solid" size="sm">
                  {m.type}
                </Badge>
              </span>
              <button
                type="button"
                disabled={pending}
                aria-label="حذف"
                title="حذف"
                className="absolute top-1.5 end-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900/70 text-white opacity-0 group-hover:opacity-100 hover:bg-danger-600 transition-all disabled:opacity-50"
                onClick={() => {
                  if (!confirm('حذف هذا الملف؟')) return;
                  onDelete(m.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
