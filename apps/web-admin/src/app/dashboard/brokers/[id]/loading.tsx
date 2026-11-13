import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/brokers/[id] while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 2, h: 116 },
  { t: 'figures', n: 4 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start',
    cols: [{ s: 'xl:col-span-2', h: [327, 163] }, { h: [334, 213] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
