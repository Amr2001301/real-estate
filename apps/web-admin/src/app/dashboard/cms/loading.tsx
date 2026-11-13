import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/cms while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 114 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-3 sm:grid-cols-3',
    cols: [{ h: [78] }, { h: [78] }, { h: [78] }],
  },
  { t: 'card', h: 640, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
