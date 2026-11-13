import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/visits/appointments/[id] while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 107 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 xl:grid-cols-3 gap-6',
    cols: [{ s: 'xl:col-span-2', h: [307, 111, 339, 212] }, { h: [147, 111, 111, 111, 135, 129] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
