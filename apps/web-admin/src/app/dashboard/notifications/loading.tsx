import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/notifications while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 2, h: 153 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6',
    cols: [{ s: 'lg:col-span-2', h: [560] }, { h: [560] }],
  },
  { t: 'card', h: 57, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
