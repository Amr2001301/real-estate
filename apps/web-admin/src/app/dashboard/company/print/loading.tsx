import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/company/print while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  { t: 'navy', n: 4 },
  {
    t: 'grid',
    cls: 'grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]',
    cols: [{ h: [303] }, { h: [436] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
