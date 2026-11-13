import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/company/print/forms/new while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 138 },
  { t: 'navy', n: 4 },
  {
    t: 'grid',
    cls: 'grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)_280px]',
    cols: [{ h: [213, 182, 560] }, { h: [560] }, { h: [88, 112] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
