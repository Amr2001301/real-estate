import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/maintenance/[id] while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 146 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 xl:grid-cols-3 gap-5 lg:gap-6 items-start',
    cols: [
      { s: 'xl:col-span-2', h: [560] },
      { s: 'xl:col-span-1', h: [560] },
    ],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
