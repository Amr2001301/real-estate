import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/targets while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  { t: 'filter' },
  { t: 'figures', n: 4 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-4 sm:grid-cols-3',
    cols: [{ h: [86] }, { h: [86] }, { h: [86] }],
  },
  { t: 'card', h: 640, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
