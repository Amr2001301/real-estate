import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /portal/profile while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 88 },
  { t: 'card', h: 164, list: false },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3 lg:gap-6',
    cols: [{ s: 'lg:col-span-2', h: [491] }, { h: [491] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
