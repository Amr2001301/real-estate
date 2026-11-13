import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/audit while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 152 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
    cols: [{ h: [146] }, { h: [146] }, { h: [146] }, { h: [146] }],
  },
  { t: 'filter' },
  { t: 'card', h: 640, list: true },
  { t: 'card', h: 57, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
