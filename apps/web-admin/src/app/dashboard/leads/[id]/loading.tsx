import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/leads/[id] while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 9, h: 326 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 xl:grid-cols-3 gap-5 lg:gap-6 items-start',
    cols: [
      { s: 'xl:col-span-2', h: [560, 199, 199] },
      { s: 'xl:col-span-1', h: [246, 231, 257] },
    ],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
