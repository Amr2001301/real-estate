import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/company/print/templates/new while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 84 },
  { t: 'navy', n: 4 },
  {
    t: 'grid',
    cls: 'grid items-start gap-5 xl:grid-cols-2',
    cols: [{ h: [230, 560, 44] }, { h: [283] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
