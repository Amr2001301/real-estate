import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/projects/[id] while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 5, h: 234 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]',
    cols: [{ h: [156] }, { h: [156] }],
  },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 items-start gap-6 xl:grid-cols-3',
    cols: [{ s: 'xl:col-span-2', h: [301, 270, 199] }, { h: [375, 342, 181] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
