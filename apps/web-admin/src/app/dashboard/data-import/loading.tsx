import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/data-import while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  { t: 'navy', n: 4 },
  {
    t: 'grid',
    cls: 'grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]',
    cols: [{ h: [395] }, { h: [307, 195] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
