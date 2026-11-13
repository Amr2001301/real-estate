import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/sales/performance while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  { t: 'filter' },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]',
    cols: [{ h: [296] }, { h: [296] }],
  },
  { t: 'card', h: 640, list: true },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 items-stretch gap-6 lg:grid-cols-5',
    cols: [
      { s: 'lg:col-span-2', h: [487] },
      { s: 'lg:col-span-3', h: [487] },
    ],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
