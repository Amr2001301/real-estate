import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/super-admin/pricing while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 2, h: 114 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 xl:grid-cols-4 gap-5 items-start',
    cols: [{ s: 'xl:col-span-3', h: [148] }, { h: [188, 228] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
