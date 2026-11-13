import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/units/[id] while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 236 },
  { t: 'figures', n: 4 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 xl:grid-cols-3 gap-5 lg:gap-6 items-start',
    cols: [
      { s: 'xl:col-span-2', h: [247, 248, 136, 289, 129] },
      { s: 'xl:col-span-1', h: [323, 444, 160] },
    ],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
