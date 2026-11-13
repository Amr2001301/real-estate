import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/calendar while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 141 },
  { t: 'filter' },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]',
    cols: [{ h: [560], block: true }, { h: [560] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
