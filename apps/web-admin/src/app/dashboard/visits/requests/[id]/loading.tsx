import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/visits/requests/[id] while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 229 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 xl:grid-cols-3 gap-5 lg:gap-6 items-start',
    cols: [
      { s: 'xl:col-span-2', h: [219, 151, 218] },
      { s: 'xl:col-span-1', h: [280, 150] },
    ],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
