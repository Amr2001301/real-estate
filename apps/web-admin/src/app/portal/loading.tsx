import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /portal while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 91 },
  { t: 'navy', n: 5 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 lg:grid-cols-3 items-stretch gap-5',
    cols: [{ s: 'lg:col-span-2', h: [287] }, { h: [287] }],
  },
  { t: 'card', h: 361, list: false },
  { t: 'card', h: 312, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
