import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/leads while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 4, h: 138 },
  { t: 'navy', n: 4 },
  { t: 'filter' },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4',
    cols: [{ h: [150, 150, 150] }, { h: [150, 150] }, { h: [150, 150, 150] }, { h: [150] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
