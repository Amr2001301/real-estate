import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/deposits/[id] while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 105 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 lg:grid-cols-3 gap-4',
    cols: [
      { s: 'lg:col-span-2', h: [335] },
      { s: 'lg:col-span-1', h: [335] },
    ],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
