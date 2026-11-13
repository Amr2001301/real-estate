import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/permissions while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 152 },
  { t: 'navy', n: 4 },
  { t: 'card', h: 44, list: false },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 lg:grid-cols-3 gap-5 items-start',
    cols: [{ s: 'lg:col-span-2', h: [54, 560] }, { h: [560] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
