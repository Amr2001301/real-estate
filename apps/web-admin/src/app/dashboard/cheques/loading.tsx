import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/cheques while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  { t: 'filter' },
  {
    t: 'grid',
    cls: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5',
    cols: [{ h: [80] }, { h: [80] }, { h: [80] }, { h: [80] }, { h: [80] }],
  },
  { t: 'table', cols: 8, rows: 8, head: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
