import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/bonus while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  { t: 'navy', n: 4 },
  { t: 'filter' },
  { t: 'table', cols: 5, rows: 8, head: true },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-5 items-stretch',
    cols: [{ h: [524] }, { h: [524] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
