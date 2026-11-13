import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/users while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
    cols: [{ h: [146] }, { h: [146] }, { h: [146] }, { h: [146] }],
  },
  { t: 'filter' },
  { t: 'table', cols: 6, rows: 8, head: true },
  { t: 'card', h: 57, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
