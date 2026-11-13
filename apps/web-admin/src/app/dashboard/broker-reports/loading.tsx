import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/broker-reports while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 2, h: 114 },
  { t: 'filter' },
  { t: 'navy', n: 5 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch',
    cols: [{ h: [471] }, { h: [230, 222] }],
  },
  { t: 'card', h: 288, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
