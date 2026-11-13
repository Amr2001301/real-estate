import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/clients/[id]/activity while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 105 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 xl:grid-cols-3 gap-6',
    cols: [{ s: 'xl:col-span-2', h: [391] }, { h: [213, 154] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
