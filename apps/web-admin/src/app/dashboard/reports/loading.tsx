import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/reports while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  { t: 'card', h: 40, list: false },
  { t: 'filter' },
  { t: 'navy', n: 4 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 items-stretch gap-6 lg:grid-cols-5',
    cols: [
      { s: 'lg:col-span-3', h: [400] },
      { s: 'lg:col-span-2', h: [400] },
    ],
  },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2',
    cols: [{ h: [263] }, { h: [263] }],
  },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2',
    cols: [{ h: [255] }, { h: [255] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
