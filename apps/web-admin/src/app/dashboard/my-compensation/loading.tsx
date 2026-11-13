import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/my-compensation while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-5 xl:grid-cols-5 xl:items-stretch',
    cols: [
      { s: 'xl:col-span-3', h: [321] },
      { s: 'xl:col-span-2', h: [321] },
    ],
  },
  { t: 'card', h: 292, list: true },
  { t: 'card', h: 194, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
