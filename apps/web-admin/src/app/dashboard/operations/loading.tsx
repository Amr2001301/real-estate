import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/operations while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 152 },
  { t: 'card', h: 319, list: false },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
    cols: [{ h: [128] }, { h: [128] }, { h: [128] }, { h: [128] }],
  },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6',
    cols: [{ s: 'lg:col-span-2', h: [560] }, { h: [359, 269] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
