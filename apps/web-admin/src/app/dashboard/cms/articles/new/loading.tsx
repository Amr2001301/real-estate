import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/cms/articles/new while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start',
    cols: [{ s: 'xl:col-span-2', h: [506] }, { h: [304, 330] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
