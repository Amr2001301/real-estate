import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/brokers/[id]/performance while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 1, h: 146 },
  { t: 'filter' },
  { t: 'figures', n: 6 },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-stretch',
    cols: [{ s: 'xl:col-span-2', h: [468] }, { h: [468] }],
  },
  { t: 'card', h: 408, list: true },
  { t: 'grid', cls: 'grid grid-cols-1 gap-6 xl:grid-cols-2', cols: [{ h: [176] }, { h: [176] }] },
  {
    t: 'grid',
    cls: 'grid grid-cols-1 gap-6 xl:grid-cols-2',
    cols: [{ h: [138] }, { h: [138] }, { h: [138] }, { h: [138] }],
  },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
